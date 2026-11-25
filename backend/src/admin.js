// Owner dashboard (Cloudflare Worker). Every request, including the page itself, is checked with Google sign-in sessions
// (ADMIN_AUTH=google) or Cloudflare Access (ADMIN_AUTH=access); state-changing requests also need a JSON body, the custom header x-ag-admin and a same-origin
// Origin, so a third-party page cannot drive them (CSRF). The UI renders every stored value as text, never as HTML.
import { json, now, randomId, readJson, log } from './lib/util.js';
import { verifyAccess } from './lib/access.js';
import * as google from './lib/google-auth.js';
import { sendEmail, oneLine } from './lib/email.js';
import { retention } from './public.js';
import PAGE from './admin/dashboard.html';
import CSS from './admin/dashboard.css';
import APP from './admin/app.dash.js';

const STATUSES = ['new', 'read', 'pending', 'replied', 'archived'];
const SEC = {
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store'
};
const asset = (body, type) => new Response(body, { headers: { 'content-type': type, ...SEC } });

function csrfOk(request, url, strict) {
  if (request.headers.get('x-ag-admin') !== '1') return false;
  const o = request.headers.get('origin');
  return strict ? o === url.origin : (!o || o === url.origin);   // cookie sessions: a same-origin Origin is required
}

// ADMIN_AUTH = "google" (Google sign-in, session cookie) or "access" (Cloudflare Access). Anything else fails closed.
const LOGIN_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Sign in · Inquiries</title><link rel="stylesheet" href="/app.css"></head>
<body><main class="login"><h1>Private inquiry dashboard</h1><p>Only the site owner can sign in.</p>
<p><a class="btn" href="/auth/login">Sign in with Google</a></p></main></body></html>`;
async function identify(request, env) {
  if (env.ADMIN_AUTH === 'google') return google.session(request, env);
  if (env.ADMIN_AUTH === 'access') return verifyAccess(request, env);
  return { ok: false, reason: 'auth_mode' };
}

async function list(env, url) {
  const st = url.searchParams.get('status'), it = url.searchParams.get('intent'), q = (url.searchParams.get('q') || '').slice(0, 100);
  const where = [], args = [];
  if (st && STATUSES.includes(st)) { where.push('status = ?'); args.push(st); }
  else if (st !== 'all') where.push("status != 'archived'");
  if (it && ['project', 'collab', 'msg'].includes(it)) { where.push('intent = ?'); args.push(it); }
  if (q) {
    const like = '%' + q.replace(/[\\%_]/g, (m) => '\\' + m) + '%';
    where.push("(ref LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR org LIKE ? ESCAPE '\\' OR brief LIKE ? ESCAPE '\\')");
    args.push(like, like, like, like, like);
  }
  const sql = 'SELECT id, ref, intent, lang, reply_lang, name, email, org, status, board_optin, board_approved, notify_status, created_at, replied_at, fields_json FROM inquiries' +
    (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY created_at DESC LIMIT 200';
  const r = await env.DB.prepare(sql).bind(...args).all();
  const items = (r.results || []).map((x) => {
    const f = JSON.parse(x.fields_json || '{}'); delete x.fields_json;
    return { ...x, budget: f.budget || null, currency: f.currency || null, start: f.start || null };
  });
  const c = await env.DB.prepare("SELECT COUNT(*) AS total, SUM(status = 'new') AS new, SUM(status = 'read') AS read, SUM(status = 'pending') AS pending, SUM(status = 'replied') AS replied, SUM(status = 'archived') AS archived FROM inquiries").first();
  return json({ items, counts: c });
}

async function detail(env, id) {
  const row = await env.DB.prepare('SELECT * FROM inquiries WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'not_found' }, 404);
  const replies = await env.DB.prepare('SELECT id, subject, body, channel, status, provider_id, error, created_at, updated_at FROM replies WHERE inquiry_id = ? ORDER BY created_at').bind(id).all();
  delete row.client_hash; delete row.idem_key; delete row.content_hash;
  row.fields = JSON.parse(row.fields_json || '{}'); delete row.fields_json;
  return json({ inquiry: row, replies: replies.results || [] });
}

async function setStatus(env, id, status) {
  if (!STATUSES.includes(status)) return json({ error: 'invalid' }, 400);
  const t = now();
  const col = { read: 'read_at', archived: 'archived_at', replied: 'replied_at' }[status];
  const r = await env.DB.prepare('UPDATE inquiries SET status = ?, updated_at = ?' + (col ? ', ' + col + ' = COALESCE(' + col + ', ?)' : '') + ' WHERE id = ?')
    .bind(...(col ? [status, t, t, id] : [status, t, id])).run();
  return r.meta && r.meta.changes ? json({ ok: true }) : json({ error: 'not_found' }, 404);
}

async function reply(env, id, body, manual) {
  const row = await env.DB.prepare('SELECT id, ref, email, name FROM inquiries WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'not_found' }, 404);
  const subject = oneLine(body.subject || '').slice(0, 200), text = String(body.body || '').replace(/\r\n?/g, '\n');
  if (!manual && (!subject || !text.trim() || text.length > 20000)) return json({ error: 'invalid' }, 400);
  if (manual && text.length > 20000) return json({ error: 'invalid' }, 400);
  const t = now(), rid = randomId();
  if (manual) {                       // answered outside the system: recorded as such, never as "sent by the system"
    await env.DB.batch([
      env.DB.prepare("INSERT INTO replies (id, inquiry_id, subject, body, channel, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'manual', 'recorded', ?, ?)").bind(rid, id, subject || '(answered outside the dashboard)', text, t, t),
      env.DB.prepare("UPDATE inquiries SET status = 'replied', replied_at = COALESCE(replied_at, ?), updated_at = ? WHERE id = ?").bind(t, t, id)
    ]);
    return json({ ok: true, channel: 'manual' });
  }
  if (!env.REPLY_FROM) return json({ error: 'sender_not_configured' }, 409);
  const res = await sendEmail(env, 'RESEND_API_KEY_ADMIN', { from: env.REPLY_FROM, to: row.email, subject, text, replyTo: env.REPLY_TO || undefined, idempotencyKey: 'reply-' + rid });
  const st = res.status === 'accepted' ? 'accepted' : 'failed';
  const stmts = [env.DB.prepare("INSERT INTO replies (id, inquiry_id, subject, body, channel, status, provider_id, error, created_at, updated_at) VALUES (?, ?, ?, ?, 'email', ?, ?, ?, ?, ?)")
    .bind(rid, id, subject, text, st, res.id || null, res.error || null, t, t)];
  if (st === 'accepted') stmts.push(env.DB.prepare("UPDATE inquiries SET status = 'replied', replied_at = COALESCE(replied_at, ?), updated_at = ? WHERE id = ?").bind(t, t, id));
  await env.DB.batch(stmts);
  log('reply', { ref: row.ref, status: st });
  return json({ ok: st === 'accepted', status: st, providerId: res.id || null, error: res.error || null }, st === 'accepted' ? 200 : 502);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname, m = request.method, G = env.ADMIN_AUTH === 'google';
    if (G && p.startsWith('/auth/')) {
      if (m === 'GET' && p === '/auth/login') return google.login(request, env);
      if (m === 'GET' && p === '/auth/callback') {
        const r = await google.callback(request, env);
        if (!r.ok) {
          log('admin_login_denied', { reason: r.reason });
          return new Response('Sign-in refused.', { status: r.status, headers: { 'content-type': 'text/plain', ...SEC, 'set-cookie': '__Host-ag_oauth=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0' } });
        }
        log('admin_login', { ok: true });
        const h = new Headers({ location: '/', ...SEC }); r.cookies.forEach((c) => h.append('set-cookie', c));
        return new Response(null, { status: 302, headers: h });
      }
      if (m === 'POST' && p === '/auth/logout') {
        if (!csrfOk(request, url, true)) return json({ error: 'forbidden' }, 403, SEC);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', ...SEC, 'set-cookie': await google.logout(request, env) } });
      }
      return json({ error: 'not_found' }, 404, SEC);
    }
    if (G && m === 'GET' && p === '/app.css') return asset(CSS, 'text/css; charset=utf-8');   // needed by the sign-in page; holds no data
    const who = await identify(request, env);
    if (!who.ok) {
      log('admin_denied', { reason: who.reason });
      if (G && m === 'GET' && (p === '/' || p === '/index.html') && who.reason !== 'not_configured') return new Response(LOGIN_PAGE, { status: 401, headers: { 'content-type': 'text/html; charset=utf-8', ...SEC } });
      return new Response('Not authorized', { status: who.reason === 'not_allowed' ? 403 : 401, headers: { 'content-type': 'text/plain', ...SEC } });
    }
    if (m === 'GET' && (p === '/' || p === '/index.html')) return asset(PAGE, 'text/html; charset=utf-8');
    if (m === 'GET' && p === '/app.css') return asset(CSS, 'text/css; charset=utf-8');
    if (m === 'GET' && p === '/app.js') return asset(APP, 'text/javascript; charset=utf-8');
    if (!p.startsWith('/api/')) return json({ error: 'not_found' }, 404, SEC);
    try {
      if (m === 'GET' && p === '/api/me') return json({ email: who.email, auth: G ? 'google' : 'access', provider: env.EMAIL_PROVIDER || 'resend', replyConfigured: !!env.REPLY_FROM });
      if (m === 'GET' && p === '/api/inquiries') return list(env, url);
      const mm = p.match(/^\/api\/inquiries\/([0-9a-f]{32})(?:\/(status|reply|manual-reply|board))?$/);
      if (m === 'GET' && mm && !mm[2]) return detail(env, mm[1]);
      if (m !== 'GET') {
        if (!csrfOk(request, url, G)) return json({ error: 'forbidden' }, 403);
        const parsed = await readJson(request, 64 * 1024);
        if (parsed.error) return json({ error: parsed.error }, 400);
        const b = parsed.body || {};
        if (m === 'POST' && p === '/api/retention/run') return json(await retention(env));
        if (!mm) return json({ error: 'not_found' }, 404);
        if (m === 'POST' && mm[2] === 'status') return setStatus(env, mm[1], b.status);
        if (m === 'POST' && mm[2] === 'reply') return reply(env, mm[1], b, false);
        if (m === 'POST' && mm[2] === 'manual-reply') return reply(env, mm[1], b, true);
        if (m === 'POST' && mm[2] === 'board') {
          const r = await env.DB.prepare('UPDATE inquiries SET board_approved = ?, updated_at = ? WHERE id = ? AND board_optin = 1').bind(b.approved ? 1 : 0, now(), mm[1]).run();
          return r.meta && r.meta.changes ? json({ ok: true }) : json({ error: 'not_opted_in' }, 409);
        }
        if (m === 'DELETE' && !mm[2]) {
          const row = await env.DB.prepare('SELECT ref FROM inquiries WHERE id = ?').bind(mm[1]).first();
          if (!row) return json({ error: 'not_found' }, 404);
          if (b.confirm !== row.ref) return json({ error: 'confirm_ref' }, 400);   // deletion is explicit and permanent
          await env.DB.batch([
            env.DB.prepare('DELETE FROM replies WHERE inquiry_id = ?').bind(mm[1]),
            env.DB.prepare('DELETE FROM inquiries WHERE id = ?').bind(mm[1])
          ]);
          log('deleted', { ref: row.ref });
          return json({ ok: true });
        }
      }
      return json({ error: 'not_found' }, 404);
    } catch (e) {
      log('admin_error', { message: String(e && e.message || e).slice(0, 120) });
      return json({ error: 'server' }, 500);
    }
  }
};

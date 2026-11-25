// Public inquiry API for gainauntu.github.io (Cloudflare Worker).
//   POST /v1/inquiries          submit an inquiry (validated, bot-checked, rate-limited, idempotent); stored before any email
//   GET  /v1/board              anonymous board: only opted-in AND owner-approved items, category + coarse status + month
//   POST /v1/webhooks/resend    signed delivery events from the email provider
//   scheduled                   retention clean-up
// There is no endpoint that looks an inquiry up by reference.
import { json, now, randomId, reference, sha256, hmacHex, list, readJson, withTimeout, log } from './lib/util.js';
import { validateInquiry, MAX_BODY_BYTES } from './lib/validate.js';
import { sendEmail } from './lib/email.js';
import { confirmation, ownerNotification } from './lib/templates.js';
import { verifyWebhook, EVENT_STATE } from './lib/webhook.js';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const DAY = 24 * 3600 * 1000;

function cors(request, env) {
  const origin = request.headers.get('origin');
  const allowed = list(env.ALLOWED_ORIGINS);
  if (!origin) return { ok: true, headers: {} };                  // non-browser client: still needs a valid Turnstile token
  if (!allowed.includes(origin)) return { ok: false, headers: { vary: 'Origin' } };
  return { ok: true, headers: { 'access-control-allow-origin': origin, vary: 'Origin' } };
}

async function verifyTurnstile(env, token, ip, idemKey) {
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  form.append('idempotency_key', idemKey);
  const res = await withTimeout(fetch(SITEVERIFY, { method: 'POST', body: form }), 8000, 'turnstile');
  const d = await res.json();
  if (!d.success) return { ok: false, reason: 'turnstile:' + (d['error-codes'] || []).join('|').slice(0, 60) };
  const hosts = list(env.TURNSTILE_HOSTNAMES);
  if (hosts.length && !hosts.includes(d.hostname)) return { ok: false, reason: 'turnstile:hostname' };
  if (d.action && d.action !== 'inquiry') return { ok: false, reason: 'turnstile:action' };
  return { ok: true };
}

function publicStatus(row) {
  if (row.replied_at) return 'replied';
  return row.status === 'new' ? 'received' : 'pending';
}

async function submit(request, env) {
  const c = cors(request, env);
  if (!c.ok) return json({ error: 'origin' }, 403, c.headers);
  if (!env.TURNSTILE_SECRET || !env.IP_HASH_SECRET) return json({ error: 'not_configured' }, 503, c.headers);
  const parsed = await readJson(request, MAX_BODY_BYTES);
  if (parsed.error) return json({ error: parsed.error }, parsed.error === 'too_large' ? 413 : 415, c.headers);
  const v = validateInquiry(parsed.body);
  if (v.errors.length) return json({ error: 'invalid', fields: v.errors.slice(0, 20) }, 400, c.headers);
  const b = parsed.body, ip = request.headers.get('cf-connecting-ip') || '';
  const client = await hmacHex(env.IP_HASH_SECRET, ip || 'unknown');

  // 1 short burst limit (per client, per Cloudflare location; approximate by design)
  if (env.BURST) {
    const { success } = await env.BURST.limit({ key: 'submit:' + client });
    if (!success) return json({ error: 'rate' }, 429, { ...c.headers, 'retry-after': '60' });
  }
  try {
    // 2 idempotent retry: the same attempt key returns the same inquiry (checked before the single-use bot token)
    const prior = await env.DB.prepare('SELECT ref, notify_status, confirm_status FROM inquiries WHERE idem_key = ?').bind(b.idemKey).first();
    if (prior) return json({ ok: true, duplicate: true, ref: prior.ref, notify: prior.notify_status, confirmation: prior.confirm_status }, 200, c.headers);

    // 3 bot check
    let tv;
    try { tv = await verifyTurnstile(env, b.token, ip, b.idemKey); } catch { return json({ error: 'verification_unavailable' }, 503, c.headers); }
    if (!tv.ok) { log('turnstile_rejected', { reason: tv.reason }); return json({ error: 'spam' }, 403, c.headers); }

    // 4 the same content again within a day (double submit with a fresh key): return the existing inquiry
    const hash = await sha256(JSON.stringify([b.intent, v.fields]));
    const same = await env.DB.prepare('SELECT ref, notify_status, confirm_status FROM inquiries WHERE content_hash = ? AND created_at > ?').bind(hash, now() - DAY).first();
    if (same) return json({ ok: true, duplicate: true, ref: same.ref, notify: same.notify_status, confirmation: same.confirm_status }, 200, c.headers);

    // 5 daily limits: per client and in total (protects the free email quota)
    const perClient = await env.DB.prepare('SELECT COUNT(*) AS n FROM inquiries WHERE client_hash = ? AND created_at > ?').bind(client, now() - DAY).first();
    if (perClient.n >= Number(env.DAILY_LIMIT_PER_CLIENT || 5)) return json({ error: 'rate' }, 429, { ...c.headers, 'retry-after': '3600' });
    const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM inquiries WHERE created_at > ?').bind(now() - DAY).first();
    if (total.n >= Number(env.DAILY_LIMIT_TOTAL || 80)) return json({ error: 'rate' }, 429, { ...c.headers, 'retry-after': '3600' });

    // 6 store first: success is reported only after the database accepted the row
    const id = randomId(), ref = reference(), t = now(), f = v.fields;
    const confirmOn = env.SEND_CONFIRMATION === 'true' && !!env.CONFIRM_FROM;
    await env.DB.prepare(`INSERT INTO inquiries (id, ref, idem_key, content_hash, intent, lang, reply_lang, name, email, org, fields_json, brief,
        board_optin, client_hash, notify_status, confirm_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`)
      .bind(id, ref, b.idemKey, hash, b.intent, b.lang, f.replyLang, f.name, f.email, f.org || null, JSON.stringify(f), v.brief,
        b.boardOptIn ? 1 : 0, client, confirmOn ? 'pending' : 'off', t, t).run();
    log('inquiry_stored', { ref, intent: b.intent });

    // 7 notify the owner; then (optionally) confirm to the visitor. Email outcome is reported separately from storage.
    const row = { ref, intent: b.intent, name: f.name, email: f.email, org: f.org, lang: b.lang, reply_lang: f.replyLang, board_optin: b.boardOptIn ? 1 : 0, brief: v.brief };
    const note = ownerNotification(row, f);
    const n = await sendEmail(env, 'RESEND_API_KEY', { from: env.NOTIFY_FROM, to: env.OWNER_EMAIL, subject: note.subject, text: note.text, replyTo: f.email, idempotencyKey: 'notify-' + id });
    let conf = { status: 'off' };
    if (confirmOn) {
      const m = confirmation(f.replyLang || b.lang, b.intent, ref);
      conf = await sendEmail(env, 'RESEND_API_KEY', { from: env.CONFIRM_FROM, to: f.email, subject: m.subject, text: m.text, idempotencyKey: 'confirm-' + id });
    }
    await env.DB.prepare('UPDATE inquiries SET notify_status = ?, notify_id = ?, confirm_status = ?, confirm_id = ?, updated_at = ? WHERE id = ?')
      .bind(n.status, n.id || null, conf.status === 'skipped' ? 'failed' : conf.status, conf.id || null, now(), id).run();
    if (n.status !== 'accepted') log('notify_not_accepted', { ref, error: n.error });
    if (confirmOn && conf.status !== 'accepted') log('confirm_not_accepted', { ref, error: conf.error });
    return json({ ok: true, duplicate: false, ref, notify: n.status, confirmation: confirmOn ? (conf.status === 'accepted' ? 'requested' : 'failed') : 'off' }, 201, c.headers);
  } catch (e) {
    log('storage_error', { message: String(e && e.message || e).slice(0, 120) });
    return json({ error: 'storage' }, 500, c.headers);
  }
}

async function board(request, env) {
  const c = cors(request, env);
  if (!c.ok) return json({ error: 'origin' }, 403, c.headers);
  try {
    const r = await env.DB.prepare(`SELECT intent, status, replied_at, created_at FROM inquiries
        WHERE board_optin = 1 AND board_approved = 1 ORDER BY created_at DESC LIMIT 20`).all();
    // deliberately minimal: category, coarse status and month only; no ids, names, times, budgets or text
    const items = (r.results || []).map((x) => ({ type: x.intent, status: publicStatus(x), month: new Date(x.created_at).toISOString().slice(0, 7) }));
    return json({ items }, 200, { ...c.headers, 'cache-control': 'public, max-age=300' });
  } catch {
    return json({ error: 'unavailable' }, 503, c.headers);
  }
}

async function webhook(request, env) {
  const raw = await request.text();
  if (raw.length > 64 * 1024) return json({ error: 'too_large' }, 413);
  const v = await verifyWebhook(request, raw, env.RESEND_WEBHOOK_SECRET);
  if (!v.ok) return json({ error: 'unauthorized' }, 401);
  let evt; try { evt = JSON.parse(raw); } catch { return json({ error: 'bad_json' }, 400); }
  const state = EVENT_STATE[evt.type], pid = evt.data && (evt.data.email_id || evt.data.id);
  try {
    const ins = await env.DB.prepare('INSERT OR IGNORE INTO email_events (svix_id, provider_id, type, created_at) VALUES (?, ?, ?, ?)').bind(v.id, pid || null, String(evt.type || '').slice(0, 40), now()).run();
    if (!ins.meta || ins.meta.changes === 0) return json({ ok: true, replay: true });
    if (state && pid) {
      await env.DB.batch([
        env.DB.prepare('UPDATE replies SET status = ?, error = ?, updated_at = ? WHERE provider_id = ?').bind(state, state === 'delivered' ? null : evt.type, now(), pid),
        env.DB.prepare('UPDATE inquiries SET notify_status = ?, updated_at = ? WHERE notify_id = ?').bind(state, now(), pid),
        env.DB.prepare('UPDATE inquiries SET confirm_status = ?, updated_at = ? WHERE confirm_id = ?').bind(state, now(), pid)
      ]);
    }
    return json({ ok: true });
  } catch {
    return json({ error: 'storage' }, 500);
  }
}

export async function retention(env) {
  const days = Number(env.RETENTION_DAYS);
  const t = now(), out = { archivedDeleted: 0 };
  if (Number.isFinite(days) && days > 0) {
    const r = await env.DB.prepare("DELETE FROM inquiries WHERE status = 'archived' AND archived_at IS NOT NULL AND archived_at < ?").bind(t - days * DAY).run();
    out.archivedDeleted = r.meta ? r.meta.changes : 0;
  }
  await env.DB.prepare('UPDATE inquiries SET client_hash = NULL WHERE client_hash IS NOT NULL AND created_at < ?').bind(t - 2 * DAY).run();
  await env.DB.prepare('DELETE FROM email_events WHERE created_at < ?').bind(t - 90 * DAY).run();
  log('retention', out);
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      const c = cors(request, env);
      if (!c.ok || !request.headers.get('origin')) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: { ...c.headers, 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' } });
    }
    if (url.pathname === '/v1/inquiries' && request.method === 'POST') return submit(request, env);
    if (url.pathname === '/v1/board' && request.method === 'GET') return board(request, env);
    if (url.pathname === '/v1/webhooks/resend' && request.method === 'POST') return webhook(request, env);
    return json({ error: 'not_found' }, 404);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(retention(env));
  }
};

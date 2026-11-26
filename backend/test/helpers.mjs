// Test harness: both Workers in one local workerd (Miniflare) with a shared D1 database built from the real migration.
// All outbound HTTP (Turnstile, Resend, Access certificates) goes to an in-process mock; nothing leaves the machine.
import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ORIGIN = 'https://gainauntu.github.io';
export const TEAM = 'testteam.cloudflareaccess.com';
export const AUD = 'aud-test-123';
export const ADMIN = 'owner@example.com';

// ---- Access signing key (local, throwaway)
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const b64u = (b) => Buffer.from(b).toString('base64url');
export function accessToken(claims = {}, opts = {}) {
  const t = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', kid: opts.kid || 'k1', typ: 'JWT' };
  const body = { iss: 'https://' + TEAM, aud: [AUD], email: ADMIN, iat: t, nbf: t - 5, exp: t + 600, ...claims };
  const data = b64u(JSON.stringify(header)) + '.' + b64u(JSON.stringify(body));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(data), opts.wrongKey ? other.privateKey : privateKey);
  return data + '.' + b64u(sig);
}

// Google ID tokens for the admin sign-in tests (same throwaway key, published under kid "g1")
export const GCLIENT = 'admin-client.apps.googleusercontent.com';
export function googleIdToken(claims = {}, opts = {}) {
  const t = Math.floor(Date.now() / 1000);
  const header = { alg: opts.alg || 'RS256', kid: opts.kid || 'g1', typ: 'JWT' };
  const body = { iss: 'https://accounts.google.com', aud: GCLIENT, azp: GCLIENT, sub: '1234567890', email: ADMIN, email_verified: true, iat: t, exp: t + 3600, ...claims };
  const data = b64u(JSON.stringify(header)) + '.' + b64u(JSON.stringify(body));
  const sig = opts.noSig ? '' : b64u(crypto.sign('RSA-SHA256', Buffer.from(data), opts.wrongKey ? other.privateKey : privateKey));
  return data + '.' + sig;
}

// ---- outbound mock
export function makeOutbound() {
  const o = {
    calls: [],
    turnstile: 'pass',            // pass | fail | error | wronghost
    resend: 'accept',             // accept | fail | timeout
    resendCount: 0,
    gmail: 'accept',              // accept | fail | oauthfail
    async handle(req) {
      const url = new URL(req.url);
      const body = req.method === 'POST' ? await req.text() : '';
      o.calls.push({ host: url.host, path: url.pathname, body, headers: Object.fromEntries(req.headers) });
      if (url.host === 'challenges.cloudflare.com') {
        if (o.turnstile === 'error') return new Response('upstream', { status: 502 });
        if (o.turnstile === 'fail') return Response.json({ success: false, 'error-codes': ['invalid-input-response'] });
        return Response.json({ success: true, hostname: o.turnstile === 'wronghost' ? 'evil.example' : 'gainauntu.github.io', action: 'inquiry' });
      }
      if (url.host === 'api.resend.com') {
        if (o.resend === 'timeout') { await new Promise((r) => setTimeout(r, 9000)); return Response.json({ id: 'late' }); }
        if (o.resend === 'fail') return Response.json({ name: 'validation_error', message: 'x' }, { status: 422 });
        o.resendCount++;
        return Response.json({ id: 'msg_' + o.resendCount });
      }
      if (url.host === 'www.googleapis.com' && url.pathname === '/oauth2/v3/certs') return Response.json({ keys: [{ ...jwk, kid: 'g1' }] });
      if (url.host === 'oauth2.googleapis.com' && url.pathname === '/token' && /grant_type=authorization_code/.test(body)) {
        o.lastCodeExchange = new URLSearchParams(body);
        if (o.idTokenFail) return Response.json({ error: 'invalid_grant' }, { status: 400 });
        return Response.json({ access_token: 'ya29.login', id_token: typeof o.idToken === 'function' ? o.idToken(o.lastCodeExchange) : o.idToken, expires_in: 3599 });
      }
      if (url.host === 'oauth2.googleapis.com' && url.pathname === '/token') {
        if (o.gmail === 'oauthfail') return Response.json({ error: 'invalid_grant' }, { status: 400 });
        return Response.json({ access_token: 'ya29.test-token', expires_in: 3599, token_type: 'Bearer' });
      }
      if (url.host === 'gmail.googleapis.com' && url.pathname === '/gmail/v1/users/me/messages/send') {
        if (o.gmail === 'fail') return Response.json({ error: { code: 403, status: 'PERMISSION_DENIED' } }, { status: 403 });
        o.gmailCount = (o.gmailCount || 0) + 1;
        return Response.json({ id: 'gm' + o.gmailCount, threadId: 't' + o.gmailCount });
      }
      if (url.host === TEAM && url.pathname === '/cdn-cgi/access/certs') return Response.json({ keys: [jwk] });
      return new Response('blocked in tests: ' + url.host, { status: 599 });
    }
  };
  return o;
}

export async function start({ publicVars = {}, adminVars = {}, migrate = true } = {}) {
  const out = makeOutbound();
  const rules = [{ type: 'Text', include: ['**/*.html', '**/*.css', '**/*.dash.js'] }, { type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }];
  const common = { modules: true, modulesRules: rules, compatibilityDate: '2026-07-01', d1Databases: { DB: 'inquiries-test' }, outboundService: (req) => out.handle(req) };
  const mf = new Miniflare({
    workers: [
      { ...common, name: 'public', routes: ['api.test/*'], scriptPath: path.join(ROOT, 'src/public.js'), modulesRoot: ROOT,
        ratelimits: { BURST: { namespace_id: '5101', simple: { limit: 3, period: 60 } } },
        bindings: { ALLOWED_ORIGINS: ORIGIN, TURNSTILE_HOSTNAMES: 'gainauntu.github.io', NOTIFY_FROM: 'Inquiries <onboarding@resend.dev>', CONFIRM_FROM: '', SEND_CONFIRMATION: 'false',
          RETENTION_DAYS: '365', DAILY_LIMIT_PER_CLIENT: '5', DAILY_LIMIT_TOTAL: '80', TURNSTILE_SECRET: 'test-secret', RESEND_API_KEY: 're_test', RESEND_WEBHOOK_SECRET: 'whsec_' + Buffer.from('webhook-secret-for-tests-0123456789').toString('base64'),
          IP_HASH_SECRET: 'ip-hash-secret', OWNER_EMAIL: ADMIN, ...publicVars } },
      { ...common, name: 'admin', routes: ['admin.test/*'], scriptPath: path.join(ROOT, 'src/admin.js'), modulesRoot: ROOT,
        bindings: { ADMIN_AUTH: 'access', ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ADMIN_EMAILS: ADMIN, REPLY_FROM: '', REPLY_TO: '', RESEND_API_KEY_ADMIN: 're_test', ...adminVars } }
    ]
  });
  const db = await mf.getD1Database('DB', 'public');
  if (migrate) {
    for (const f of ['0001_init.sql', '0002_admin_sessions.sql', '0003_admin_session_subject.sql']) {
      const sql = readFileSync(path.join(ROOT, 'migrations', f), 'utf8').replace(/--[^\n]*/g, '');
      for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) await db.prepare(stmt).run();
    }
  }
  // requests go through the normal entry and are routed by hostname, like production traffic
  const wrap = (host) => ({ fetch: (url, init) => mf.dispatchFetch(url.replace(/^https:\/\/[^/]+/, 'https://' + host), init) });
  const pub = wrap('api.test'), adm = wrap('admin.test');
  return { mf, db, out, pub, adm, close: () => mf.dispose() };
}

let n = 0;
export function inquiry(over = {}, fieldsOver = {}) {
  n++;
  const base = {
    idemKey: crypto.randomUUID(),
    intent: 'project', lang: 'en', consent: true, boardOptIn: false, website: '', token: 'XXXX.DUMMY.TOKEN.XXXX',
    brief: 'Inquiry prepared on gainauntu.github.io\n\nPurpose: Project inquiry\nDescription:\nA battery-powered sensor node #' + n,
    fields: { scope: ['cat.embedded', 'cat.vision'], ptitle: 'Edge pilot ' + n, desc: 'A battery-powered sensor node needs on-device detection, case ' + n + '.', env: 'STM32, ROS2',
      stage: 'stage.proto', budget: 'bud.usd.2', currency: 'USD', engage: 'eng.fixed', start: 'start.m3', org: 'Example Lab', ctype: 'type.company',
      name: 'Test Person', email: 'test@example.com', replyLang: 'en', ...fieldsOver }
  };
  return { ...base, ...over };
}

export function post(worker, pathname, body, headers = {}) {
  return worker.fetch('https://api.test' + pathname, {
    method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json', origin: ORIGIN, 'cf-connecting-ip': headers.ip || '203.0.113.7', ...headers }
  });
}

export async function svixHeaders(body, opts = {}) {
  const secret = Buffer.from('webhook-secret-for-tests-0123456789');
  const id = opts.id || 'msg_' + crypto.randomUUID(), ts = String(opts.ts || Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac('sha256', opts.wrongSecret ? Buffer.from('nope') : secret).update(id + '.' + ts + '.' + body).digest('base64');
  return { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': 'v1,' + sig, 'content-type': 'application/json' };
}

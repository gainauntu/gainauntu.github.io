#!/usr/bin/env node
// Non-destructive production checks for the inquiry backend. Stores nothing, sends no email, needs no secret.
//   node scripts/verify-production.mjs --api https://gainauntu-inquiry-api.<subdomain>.workers.dev \
//        --admin https://gainauntu-inquiry-admin.<subdomain>.workers.dev [--origin https://gainauntu.github.io]
// It does NOT replace the real end-to-end test (README "Verify in production"): one real submission per inquiry type
// from the live site to your own address, checked in the dashboard and in your inbox.
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const API = (arg('api') || '').replace(/\/$/, ''), ADMIN = (arg('admin') || '').replace(/\/$/, '');
const ORIGIN = arg('origin', 'https://gainauntu.github.io'), OTHER = 'https://example.com';
if (!API) { console.error('usage: --api <public Worker URL> [--admin <admin Worker URL>] [--origin <site origin>]'); process.exit(2); }
let fails = 0;
const check = (name, ok, info = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  (' + info + ')' : ''}`); };
const f = (url, o = {}) => fetch(url, { redirect: 'manual', ...o }).catch((e) => ({ status: 0, headers: new Headers(), text: async () => String(e) }));

let r = await f(API + '/v1/inquiries', { method: 'OPTIONS', headers: { origin: ORIGIN, 'access-control-request-method': 'POST' } });
check('CORS preflight from the site is allowed', r.status === 204 && r.headers.get('access-control-allow-origin') === ORIGIN, 'status ' + r.status);
r = await f(API + '/v1/inquiries', { method: 'OPTIONS', headers: { origin: OTHER, 'access-control-request-method': 'POST' } });
check('CORS preflight from another origin is refused', r.status === 403, 'status ' + r.status);
r = await f(API + '/v1/inquiries', { method: 'POST', headers: { origin: OTHER, 'content-type': 'application/json' }, body: '{}' });
check('submission from another origin is refused', r.status === 403, 'status ' + r.status);
r = await f(API + '/v1/inquiries', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{}' });
const body = await r.text();
check('empty submission is rejected by validation before anything is stored (secrets are set: not 503)', r.status === 400 && /invalid/.test(body), 'status ' + r.status + (r.status === 503 ? ': TURNSTILE_SECRET or IP_HASH_SECRET missing' : ''));
r = await f(API + '/v1/board', { headers: { origin: ORIGIN } });
let items = null; try { items = JSON.parse(await r.text()).items; } catch {}
const keysOk = Array.isArray(items) && items.every((x) => Object.keys(x).every((k) => ['type', 'status', 'month'].includes(k)));
check('board answers with only type, status and month', r.status === 200 && keysOk, `status ${r.status}, ${Array.isArray(items) ? items.length + ' items' : 'no list'}`);
r = await f(API + '/v1/board', { headers: { origin: OTHER } });
check('board refuses another origin', r.status === 403, 'status ' + r.status);
r = await f(API + '/v1/webhooks/resend', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"type":"email.delivered"}' });
check('unsigned email webhook is refused', r.status === 401, 'status ' + r.status);
r = await f(API + '/v1/inquiries/anything');
check('no lookup endpoint exists', r.status === 404, 'status ' + r.status);

if (ADMIN) {
  for (const p of ['/', '/api/inquiries', '/api/me']) {
    r = await f(ADMIN + p);
    const loc = r.headers.get('location') || '';
    const gated = (r.status >= 300 && r.status < 400 && /cloudflareaccess\.com/.test(loc)) || r.status === 401 || r.status === 403;
    check(`dashboard ${p} without login is blocked (Access redirect, 401 or 403)`, gated, 'status ' + r.status + (loc ? ' -> ' + new URL(loc).host : ''));
  }
  r = await f(ADMIN + '/api/inquiries', { headers: { 'cf-access-jwt-assertion': 'forged.token.value' } });
  check('dashboard API rejects a forged Access token', r.status !== 200, 'status ' + r.status);
} else console.log('SKIP  dashboard checks (no --admin)');

console.log(fails ? `\n${fails} check(s) failed: keep the website on the email hand-off.` : '\nAll automatic checks passed. Now do the manual end-to-end test (README).');
process.exit(fails ? 1 : 0);

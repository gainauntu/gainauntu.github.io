// Owner dashboard with Google sign-in (ADMIN_AUTH=google): the full login flow, and every bypass attempt we could think of.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { start, inquiry, post, accessToken, googleIdToken, GCLIENT, ADMIN } from './helpers.mjs';

const BASE = 'https://admin.test';
const VARS = { ADMIN_AUTH: 'google', ADMIN_GOOGLE_CLIENT_ID: GCLIENT, ADMIN_GOOGLE_CLIENT_SECRET: 'gsecret', ADMIN_EMAILS: ADMIN };
const setCookies = (r) => (r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')].filter(Boolean));
const cookieVal = (r, name) => { const c = setCookies(r).find((x) => x.startsWith(name + '=')); return c ? c.split(';')[0].slice(name.length + 1) : null; };
const get = (h, path, cookie, extra = {}) => h.adm.fetch(BASE + path, { redirect: 'manual', headers: { ...(cookie ? { cookie } : {}), ...extra } });

async function beginLogin(h) {
  const r = await get(h, '/auth/login');
  const flow = cookieVal(r, '__Host-ag_oauth');
  const [state, nonce, verifier] = flow.split('.');
  return { r, flow, state, nonce, verifier };
}
async function signIn(h, claims = {}, opts = {}) {
  const b = await beginLogin(h);
  h.out.idToken = googleIdToken({ nonce: b.nonce, ...claims }, opts);
  const r = await get(h, '/auth/callback?code=abc&state=' + (opts.state || b.state), opts.noFlow ? null : '__Host-ag_oauth=' + b.flow);
  return { r, b, session: cookieVal(r, '__Host-ag_admin') };
}
const sendJson = (h, method, path, cookie, body, extra = {}) => h.adm.fetch(BASE + path, { method, body: JSON.stringify(body),
  headers: { cookie, 'content-type': 'application/json', 'x-ag-admin': '1', origin: BASE, ...extra } });

test('google: unauthenticated visitors get only the sign-in page; no data, script or API', async () => {
  const h = await start({ adminVars: VARS });
  try {
    await post(h.pub, '/v1/inquiries', inquiry());
    const page = await get(h, '/');
    assert.equal(page.status, 401);
    const html = await page.text();
    assert.match(html, /Sign in with Google/); assert.doesNotMatch(html, /test@example|Edge pilot|AG-/);
    for (const p of ['/app.js', '/api/me', '/api/inquiries', '/index.html']) assert.ok([401, 403].includes((await get(h, p)).status), p);
    const valid = accessToken();                                     // a valid Cloudflare Access token must not work in Google mode
    assert.equal((await get(h, '/api/inquiries', null, { 'cf-access-jwt-assertion': valid })).status, 401);
  } finally { await h.close(); }
});

test('google: login redirect uses PKCE, state and nonce; flow cookie is HttpOnly, Secure, host-only', async () => {
  const h = await start({ adminVars: VARS });
  try {
    const { r, state, nonce, verifier } = await beginLogin(h);
    assert.equal(r.status, 302);
    const loc = new URL(r.headers.get('location'));
    assert.equal(loc.origin + loc.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
    const q = loc.searchParams;
    assert.equal(q.get('client_id'), GCLIENT); assert.equal(q.get('redirect_uri'), BASE + '/auth/callback'); assert.equal(q.get('scope'), 'openid email');
    assert.equal(q.get('state'), state); assert.equal(q.get('nonce'), nonce); assert.equal(q.get('code_challenge_method'), 'S256');
    assert.equal(q.get('code_challenge'), crypto.createHash('sha256').update(verifier).digest('base64url'));
    const c = setCookies(r)[0];
    assert.match(c, /^__Host-ag_oauth=/); assert.match(c, /HttpOnly/); assert.match(c, /Secure/); assert.match(c, /Path=\//); assert.doesNotMatch(c, /Domain=/i);
  } finally { await h.close(); }
});

test('google: full sign-in, protected access, CSRF rules and logout', async () => {
  const h = await start({ adminVars: VARS });
  try {
    await post(h.pub, '/v1/inquiries', inquiry());
    const { r, b, session } = await signIn(h);
    assert.equal(r.status, 302); assert.equal(r.headers.get('location'), '/');
    assert.ok(session && session.length >= 40);
    assert.match(setCookies(r).find((x) => x.startsWith('__Host-ag_admin=')), /HttpOnly; SameSite=Lax; Max-Age=28800/);
    const ex = h.out.lastCodeExchange;                                 // server-side code exchange with secret and verifier
    assert.equal(ex.get('client_secret'), 'gsecret'); assert.equal(ex.get('code_verifier'), b.verifier); assert.equal(ex.get('redirect_uri'), BASE + '/auth/callback');
    const stored = await h.db.prepare('SELECT id FROM admin_sessions').first();
    assert.notEqual(stored.id, session);                               // only a hash is stored
    const cookie = '__Host-ag_admin=' + session;
    const me = await (await get(h, '/api/me', cookie)).json();
    assert.equal(me.email, ADMIN); assert.equal(me.auth, 'google');
    const list = await (await get(h, '/api/inquiries', cookie)).json();
    assert.equal(list.items.length, 1);
    assert.equal((await get(h, '/', cookie)).status, 200);
    const id = list.items[0].id;
    assert.equal((await sendJson(h, 'POST', '/api/inquiries/' + id + '/status', cookie, { status: 'read' }, { origin: '' })).status, 403);         // no Origin
    assert.equal((await sendJson(h, 'POST', '/api/inquiries/' + id + '/status', cookie, { status: 'read' }, { origin: 'https://evil.test' })).status, 403);
    assert.equal((await sendJson(h, 'POST', '/api/inquiries/' + id + '/status', cookie, { status: 'read' }, { 'x-ag-admin': '' })).status, 403);
    assert.equal((await sendJson(h, 'POST', '/api/inquiries/' + id + '/status', cookie, { status: 'read' })).status, 200);
    assert.equal((await sendJson(h, 'POST', '/auth/logout', cookie, {}, { origin: 'https://evil.test' })).status, 403);          // logout is CSRF-checked too
    const out = await sendJson(h, 'POST', '/auth/logout', cookie, {});
    assert.equal(out.status, 200); assert.match(setCookies(out)[0], /^__Host-ag_admin=; .*Max-Age=0/);
    assert.equal((await get(h, '/api/inquiries', cookie)).status, 401);   // the old cookie is dead server-side
    assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM admin_sessions').first()).n, 0);
  } finally { await h.close(); }
});

test('google: every forged or mismatched sign-in is refused and creates no session', async () => {
  const h = await start({ adminVars: { ...VARS, ADMIN_GOOGLE_SUB: '1234567890' } });
  const t = Math.floor(Date.now() / 1000);
  const cases = [
    ['state mismatch', {}, { state: 'forged' }],
    ['missing flow cookie', {}, { noFlow: true }],
    ['wrong nonce', { nonce: 'other' }, {}],
    ['other client (audience)', { aud: 'someone-else.apps.googleusercontent.com', azp: 'someone-else' }, {}],
    ['wrong issuer', { iss: 'https://evil.test' }, {}],
    ['expired', { exp: t - 3600, iat: t - 7200 }, {}],
    ['issued in the future', { iat: t + 3600 }, {}],
    ['email not allowed', { email: 'intruder@example.com' }, {}],
    ['email not verified', { email_verified: false }, {}],
    ['other Google account with the allowed email (pinned subject)', { sub: '999' }, {}],
    ['signature by another key', {}, { wrongKey: true }],
    ['alg none', {}, { alg: 'none', noSig: true }],
    ['unknown key id', {}, { kid: 'nope' }]
  ];
  try {
    for (const [name, claims, opts] of cases) {
      const { r, session } = await signIn(h, claims, opts);
      assert.equal(r.status, 403, name); assert.equal(session, null, name);
    }
    h.out.idTokenFail = true;
    const { r } = await signIn(h);
    assert.equal(r.status, 403, 'code exchange failure');
    h.out.idTokenFail = false;
    assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM admin_sessions').first()).n, 0);
    assert.equal((await signIn(h)).r.status, 302);                     // the genuine owner still gets in
  } finally { await h.close(); }
});

test('google: forged, expired or de-listed sessions fail closed; missing configuration fails closed', async () => {
  const h = await start({ adminVars: VARS });
  try {
    const fake = crypto.randomBytes(32).toString('base64url');
    assert.equal((await get(h, '/api/inquiries', '__Host-ag_admin=' + fake)).status, 401);
    assert.equal((await get(h, '/api/inquiries', '__Host-ag_admin=' + fake + "' OR 1=1 --")).status, 401);
    const hash = (s) => crypto.createHash('sha256').update(s).digest('base64url');
    const old = crypto.randomBytes(32).toString('base64url'), gone = crypto.randomBytes(32).toString('base64url');
    await h.db.prepare('INSERT INTO admin_sessions (id, email, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(hash(old), ADMIN, 1, Date.now() - 1000).run();
    await h.db.prepare('INSERT INTO admin_sessions (id, email, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(hash(gone), 'former@example.com', 1, Date.now() + 3600e3).run();
    assert.equal((await get(h, '/api/inquiries', '__Host-ag_admin=' + old)).status, 401);
    assert.equal((await get(h, '/api/inquiries', '__Host-ag_admin=' + gone)).status, 403);
  } finally { await h.close(); }
  const h2 = await start({ adminVars: { ADMIN_AUTH: 'google', ADMIN_EMAILS: ADMIN } });
  try {
    assert.equal((await get(h2, '/auth/login')).status, 503);
    assert.equal((await get(h2, '/')).status, 401);
    assert.equal((await get(h2, '/api/inquiries')).status, 401);
  } finally { await h2.close(); }
  const h3 = await start({ adminVars: { ADMIN_AUTH: '' } });
  try { assert.equal((await get(h3, '/api/inquiries', null, { 'cf-access-jwt-assertion': accessToken() })).status, 401); } finally { await h3.close(); }
});

test('google: pinned account ID is enforced at sign-in and on every request', async () => {
  const h = await start({ adminVars: { ...VARS, ADMIN_GOOGLE_SUB: '1234567890' } });
  try {
    const ok = await signIn(h);
    assert.equal(ok.r.status, 302);
    assert.equal((await h.db.prepare('SELECT sub FROM admin_sessions').first()).sub, '1234567890');
    assert.equal((await get(h, '/api/me', '__Host-ag_admin=' + ok.session)).status, 200);
    assert.equal((await signIn(h, { sub: '555' })).r.status, 403);          // same email, different Google account
    const hash = (s) => crypto.createHash('sha256').update(s).digest('base64url');
    const legacy = crypto.randomBytes(32).toString('base64url');            // a session from before pinning (no account ID)
    await h.db.prepare('INSERT INTO admin_sessions (id, email, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(hash(legacy), ADMIN, 1, Date.now() + 3600e3).run();
    assert.equal((await get(h, '/api/me', '__Host-ag_admin=' + legacy)).status, 401);
  } finally { await h.close(); }
});

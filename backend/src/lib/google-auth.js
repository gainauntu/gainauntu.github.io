// Owner sign-in with Google (OpenID Connect authorization-code flow, confidential client + PKCE), for the admin Worker.
// No payment card, no domain: only a Google OAuth client (separate from the Gmail-sending client).
//
//  GET  /auth/login     -> new state, nonce and PKCE verifier in a short-lived HttpOnly cookie; redirect to Google
//  GET  /auth/callback  -> state must match the cookie; code exchanged server-side (client secret + verifier); the ID token
//                          is verified here (RS256 signature against Google's published keys, issuer, audience, expiry,
//                          issued-at, nonce, email_verified, email on ADMIN_EMAILS, pinned Google account ID ADMIN_GOOGLE_SUB,
//                          which is also re-checked on every request)
//  POST /auth/logout    -> CSRF-checked; the session row is deleted and the cookie cleared
// Sessions: 32 random bytes in a __Host- cookie (HttpOnly, Secure, SameSite=Lax, Path=/); only its SHA-256 is stored in
// D1 (admin_sessions), with an 8-hour lifetime. Every protected request re-reads the row and re-checks the allow-list.
// Anything missing or malformed fails closed.
import { list } from './util.js';

const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const ISS = ['https://accounts.google.com', 'accounts.google.com'];
export const SESSION_COOKIE = '__Host-ag_admin';
const FLOW_COOKIE = '__Host-ag_oauth';
const SESSION_TTL = 8 * 3600 * 1000, FLOW_TTL = 600;

const enc = new TextEncoder();
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uBytes = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
const b64uJson = (s) => JSON.parse(new TextDecoder().decode(b64uBytes(s)));
const rand = (n = 32) => b64u(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async (s) => b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))));
const eq = (a, b) => { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

export function configured(env) {
  return !!(env.ADMIN_GOOGLE_CLIENT_ID && env.ADMIN_GOOGLE_CLIENT_SECRET && list(env.ADMIN_EMAILS).length && !/[<>]/.test(env.ADMIN_GOOGLE_CLIENT_ID));
}
function cookies(request) {
  const out = {};
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('='); if (i < 0) continue;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k && !(k in out)) out[k] = v;
  }
  return out;
}
const setCookie = (name, value, maxAge, sameSite = 'Lax') => `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAge}`;
const redirectUri = (url) => url.origin + '/auth/callback';

let certCache = { at: 0, keys: [] };
async function googleKeys(fetcher, force) {
  if (!force && certCache.keys.length && Date.now() - certCache.at < 3600 * 1000) return certCache.keys;
  const res = await fetcher(CERTS);
  if (!res.ok) throw new Error('certs_http_' + res.status);
  certCache = { at: Date.now(), keys: (await res.json()).keys || [] };
  return certCache.keys;
}
export function _resetCertCache() { certCache = { at: 0, keys: [] }; }

export async function verifyIdToken(token, env, nonce, fetcher = fetch) {
  const fail = (reason) => ({ ok: false, reason });
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return fail('malformed');
  let header, claims;
  try { header = b64uJson(parts[0]); claims = b64uJson(parts[1]); } catch { return fail('malformed'); }
  if (header.alg !== 'RS256' || !header.kid) return fail('alg');
  let jwk;
  try {
    jwk = (await googleKeys(fetcher)).find((k) => k.kid === header.kid);
    if (!jwk) jwk = (await googleKeys(fetcher, true)).find((k) => k.kid === header.kid);   // key rotation
  } catch { return fail('certs_unavailable'); }
  if (!jwk) return fail('unknown_kid');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64uBytes(parts[2]), enc.encode(parts[0] + '.' + parts[1])))) return fail('signature');
  const t = Math.floor(Date.now() / 1000);
  if (!ISS.includes(claims.iss)) return fail('issuer');
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(env.ADMIN_GOOGLE_CLIENT_ID)) return fail('audience');
  if (aud.length > 1 && claims.azp !== env.ADMIN_GOOGLE_CLIENT_ID) return fail('azp');
  if (typeof claims.exp !== 'number' || claims.exp < t - 60) return fail('expired');
  if (typeof claims.iat !== 'number' || claims.iat > t + 300) return fail('iat');
  if (!nonce || !eq(String(claims.nonce || ''), nonce)) return fail('nonce');
  if (claims.email_verified !== true && claims.email_verified !== 'true') return fail('email_unverified');
  const email = String(claims.email || '').toLowerCase();
  if (!email || !list(env.ADMIN_EMAILS).map((e) => e.toLowerCase()).includes(email)) return fail('not_allowed');
  if (env.ADMIN_GOOGLE_SUB && String(claims.sub) !== String(env.ADMIN_GOOGLE_SUB)) return fail('subject');
  return { ok: true, email, sub: String(claims.sub) };
}

export async function login(request, env) {
  const url = new URL(request.url);
  if (!configured(env)) return new Response('Sign-in is not configured.', { status: 503, headers: { 'content-type': 'text/plain' } });
  const state = rand(), nonce = rand(), verifier = rand(48);
  const challenge = b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(verifier))));
  const q = new URLSearchParams({ client_id: env.ADMIN_GOOGLE_CLIENT_ID, redirect_uri: redirectUri(url), response_type: 'code', scope: 'openid email',
    state, nonce, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account' });
  const hint = list(env.ADMIN_EMAILS)[0]; if (hint) q.set('login_hint', hint);
  return new Response(null, { status: 302, headers: { location: AUTH + '?' + q, 'set-cookie': setCookie(FLOW_COOKIE, [state, nonce, verifier].join('.'), FLOW_TTL), 'cache-control': 'no-store' } });
}

export async function callback(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  const deny = (reason, status = 403) => ({ ok: false, reason, status });
  if (!configured(env)) return deny('not_configured', 503);
  const flow = (cookies(request)[FLOW_COOKIE] || '').split('.');
  if (flow.length !== 3) return deny('no_flow');
  const [state, nonce, verifier] = flow;
  if (url.searchParams.get('error')) return deny('google_' + url.searchParams.get('error').slice(0, 40));
  if (!eq(url.searchParams.get('state') || '', state)) return deny('state');
  const code = url.searchParams.get('code');
  if (!code) return deny('no_code');
  let tok;
  try {
    const res = await fetcher(TOKEN, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: env.ADMIN_GOOGLE_CLIENT_ID, client_secret: env.ADMIN_GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri(url), grant_type: 'authorization_code', code_verifier: verifier }) });
    tok = await res.json().catch(() => ({}));
    if (!res.ok || !tok.id_token) return deny('token_exchange');
  } catch { return deny('token_exchange'); }
  const v = await verifyIdToken(tok.id_token, env, nonce, fetcher);
  if (!v.ok) return deny(v.reason);
  const sid = rand(32), t = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').bind(t),
    env.DB.prepare('INSERT INTO admin_sessions (id, email, sub, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').bind(await sha256(sid), v.email, v.sub, t, t + SESSION_TTL)
  ]);
  return { ok: true, email: v.email, cookies: [setCookie(SESSION_COOKIE, sid, SESSION_TTL / 1000), setCookie(FLOW_COOKIE, '', 0)] };
}

export async function session(request, env) {
  const fail = (reason) => ({ ok: false, reason });
  if (!configured(env)) return fail('not_configured');
  const sid = cookies(request)[SESSION_COOKIE];
  if (!sid || !/^[A-Za-z0-9_-]{40,60}$/.test(sid)) return fail('no_session');
  const row = await env.DB.prepare('SELECT email, sub, expires_at FROM admin_sessions WHERE id = ?').bind(await sha256(sid)).first();
  if (!row || row.expires_at < Date.now()) return fail('expired');
  const email = String(row.email).toLowerCase();
  if (!list(env.ADMIN_EMAILS).map((e) => e.toLowerCase()).includes(email)) return fail('not_allowed');   // removed from the allow-list
  if (env.ADMIN_GOOGLE_SUB && String(row.sub || '') !== String(env.ADMIN_GOOGLE_SUB)) return fail('subject');   // pinned Google account
  return { ok: true, email };
}

export async function logout(request, env) {
  const sid = cookies(request)[SESSION_COOKIE];
  if (sid) await env.DB.prepare('DELETE FROM admin_sessions WHERE id = ?').bind(await sha256(sid)).run();
  return setCookie(SESSION_COOKIE, '', 0);
}

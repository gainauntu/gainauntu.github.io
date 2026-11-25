// Cloudflare Access: verify the signed identity token (Cf-Access-Jwt-Assertion) on EVERY admin request.
// Checks: RS256 signature against the team's published keys, issuer, audience (this application's AUD), expiry,
// not-before, and the identity's email against the ADMIN_EMAILS allow-list. Anything missing fails closed.
import { list } from './util.js';

const b64urlBytes = (s) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};
const b64urlJson = (s) => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));

let cache = { url: '', at: 0, keys: [] };
async function keys(env, fetcher) {
  const url = 'https://' + env.ACCESS_TEAM_DOMAIN + '/cdn-cgi/access/certs';
  if (cache.url === url && Date.now() - cache.at < 10 * 60 * 1000 && cache.keys.length) return cache.keys;
  const res = await fetcher(url);
  if (!res.ok) throw new Error('certs_http_' + res.status);
  const data = await res.json();
  cache = { url, at: Date.now(), keys: data.keys || [] };
  return cache.keys;
}
export function _resetKeyCache() { cache = { url: '', at: 0, keys: [] }; }

export async function verifyAccess(request, env, fetcher = fetch) {
  const fail = (reason) => ({ ok: false, reason });
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || /[<>]/.test(env.ACCESS_TEAM_DOMAIN + env.ACCESS_AUD)) return fail('not_configured');
  const allow = list(env.ADMIN_EMAILS).map((e) => e.toLowerCase());
  if (!allow.length) return fail('no_admins');
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return fail('no_token');
  const parts = token.split('.');
  if (parts.length !== 3) return fail('malformed');
  let header, claims;
  try { header = b64urlJson(parts[0]); claims = b64urlJson(parts[1]); } catch { return fail('malformed'); }
  if (header.alg !== 'RS256' || !header.kid) return fail('alg');
  let jwk;
  try { jwk = (await keys(env, fetcher)).find((k) => k.kid === header.kid); } catch { return fail('certs_unavailable'); }
  if (!jwk) return fail('unknown_kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const okSig = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!okSig) return fail('signature');
  const t = Math.floor(Date.now() / 1000);
  if (claims.iss !== 'https://' + env.ACCESS_TEAM_DOMAIN) return fail('issuer');
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(env.ACCESS_AUD)) return fail('audience');
  if (typeof claims.exp !== 'number' || claims.exp < t - 30) return fail('expired');
  if (typeof claims.nbf === 'number' && claims.nbf > t + 30) return fail('not_yet_valid');
  const email = String(claims.email || '').toLowerCase();
  if (!email || !allow.includes(email)) return fail('not_allowed');
  return { ok: true, email };
}

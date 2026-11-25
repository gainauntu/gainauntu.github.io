// Shared helpers. No personal data is ever written to logs: log only references and error codes.
const enc = new TextEncoder();

export const now = () => Date.now();

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers }
  });
}

export function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256(text) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

export async function hmacHex(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}

export function randomId(bytes = 16) {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)));
}

// Visitor reference: random, unambiguous alphabet, e.g. AG-7K3Q-9XPM. Not sequential, not derived from the id.
const ALPHA = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function reference() {
  const r = crypto.getRandomValues(new Uint8Array(8));
  const c = [...r].map((b) => ALPHA[b % ALPHA.length]).join('');
  return 'AG-' + c.slice(0, 4) + '-' + c.slice(4);
}

// constant-time comparison for secrets/signatures
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function list(v) {
  return String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export async function readJson(request, maxBytes) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > maxBytes) return { error: 'too_large' };
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  if (!ct.startsWith('application/json')) return { error: 'content_type' };
  const text = await request.text();
  if (enc.encode(text).length > maxBytes) return { error: 'too_large' };
  try { return { body: JSON.parse(text), text }; } catch { return { error: 'bad_json' }; }
}

export async function withTimeout(promise, ms, label) {
  let t;
  const timer = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(label + '_timeout')), ms); });
  try { return await Promise.race([promise, timer]); } finally { clearTimeout(t); }
}

export function log(event, data = {}) {
  // structured, minimal: callers pass only references, codes and counts
  console.log(JSON.stringify({ event, ...data }));
}

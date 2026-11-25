// Resend delivers webhooks through Svix: headers svix-id, svix-timestamp, svix-signature ("v1,<base64> v1,<base64>"),
// signed content "<id>.<timestamp>.<raw body>", HMAC-SHA256 with the base64 secret after the "whsec_" prefix.
// Rejects stale timestamps (replay) and unknown signatures. Each svix-id is processed once (email_events primary key).
const TOLERANCE_S = 300;

function b64(bytes) { let s = ''; for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b); return btoa(s); }

export async function verifyWebhook(request, rawBody, secret) {
  const id = request.headers.get('svix-id'), ts = request.headers.get('svix-timestamp'), sig = request.headers.get('svix-signature');
  if (!secret || !id || !ts || !sig) return { ok: false, reason: 'missing' };
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > TOLERANCE_S) return { ok: false, reason: 'timestamp' };
  const raw = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let keyBytes;
  try { keyBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)); } catch { return { ok: false, reason: 'secret' }; }
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = b64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(id + '.' + ts + '.' + rawBody)));
  const given = sig.split(' ').map((p) => p.split(',')).filter((p) => p[0] === 'v1').map((p) => p[1]);
  // constant-time compare against each provided signature
  const eq = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
  if (!given.some((g) => eq(g, expected))) return { ok: false, reason: 'signature' };
  return { ok: true, id };
}

// map provider event types to our delivery states
export const EVENT_STATE = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.delivery_delayed': 'delayed',
  'email.complained': 'complained',
  'email.failed': 'failed'
};

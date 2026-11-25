// Transactional email. Two providers, chosen by EMAIL_PROVIDER:
//  - "resend" (default): Resend's HTTP API; without a verified domain it delivers only to the account's own address.
//  - "gmail": the Gmail API, sending as the owner's own Gmail account (OAuth 2.0 refresh token, scope gmail.send).
//    Free and needs no domain; it can reach any recipient within Gmail's sending limits.
// Header safety: every header value is reduced to one line; non-ASCII header text is RFC 2047 encoded; addresses must be
// plain addr-spec. The body is sent base64-encoded as text/plain UTF-8. Nothing from a visitor can add a header.
import { withTimeout } from './util.js';

const RESEND = 'https://api.resend.com/emails';
const TOKEN = 'https://oauth2.googleapis.com/token';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const oneLine = (s) => String(s || '').replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
const ADDR = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// returns { status: 'accepted', id } | { status: 'failed', error } | { status: 'skipped', error }
// "accepted" means the provider accepted the message for sending, not that it was delivered.
export async function sendEmail(env, keyName, msg) {
  if (env.EMAIL_PROVIDER === 'gmail') return sendGmail(env, msg);
  const key = env[keyName];
  if (!key || !msg.from) return { status: 'skipped', error: !key ? 'no_api_key' : 'no_sender' };
  const payload = { from: msg.from, to: [msg.to], subject: oneLine(msg.subject).slice(0, 200), text: msg.text };
  if (msg.replyTo) payload.reply_to = [msg.replyTo];
  try {
    const res = await withTimeout(fetch(RESEND, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json', ...(msg.idempotencyKey ? { 'idempotency-key': msg.idempotencyKey } : {}) },
      body: JSON.stringify(payload)
    }), 8000, 'email');
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.id) return { status: 'accepted', id: String(data.id) };
    return { status: 'failed', error: 'http_' + res.status + (data && data.name ? ':' + oneLine(data.name).slice(0, 60) : '') };
  } catch (e) {
    return { status: 'failed', error: String(e && e.message || 'error').slice(0, 80) };
  }
}

// ---------------- Gmail ----------------
let cached = null;                                   // { token, exp } per isolate; never logged or returned
async function gmailToken(env) {
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const body = new URLSearchParams({ client_id: env.GMAIL_CLIENT_ID, client_secret: env.GMAIL_CLIENT_SECRET, refresh_token: env.GMAIL_REFRESH_TOKEN, grant_type: 'refresh_token' });
  const res = await withTimeout(fetch(TOKEN, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body }), 8000, 'oauth');
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error('oauth_' + res.status + (data.error ? ':' + oneLine(data.error).slice(0, 40) : ''));
  cached = { token: data.access_token, exp: Date.now() + (Number(data.expires_in) || 3000) * 1000 };
  return cached.token;
}
export function _resetGmailCache() { cached = null; }

const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const utf8 = (s) => new TextEncoder().encode(s);
const encWord = (s) => /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + b64(utf8(s)) + '?=';
// display name from "Name <addr>" or a bare name; quotes and angle brackets removed
const displayName = (from) => oneLine(String(from || '').replace(/<[^>]*>/g, '')).replace(/["<>\\]/g, '').slice(0, 80);

export function buildMime({ fromName, fromAddr, to, replyTo, subject, text }) {
  for (const a of [fromAddr, to, replyTo].filter(Boolean)) if (!ADDR.test(a)) throw new Error('bad_address');
  const name = displayName(fromName);
  const head = [
    'From: ' + (name ? encWord(name) + ' ' : '') + '<' + fromAddr + '>',
    'To: <' + to + '>',
    ...(replyTo ? ['Reply-To: <' + replyTo + '>'] : []),
    'Subject: ' + encWord(oneLine(subject).slice(0, 200)),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64'
  ];
  const body = b64(utf8(String(text || '').replace(/\r?\n/g, '\r\n'))).replace(/.{76}/g, '$&\r\n');
  return head.join('\r\n') + '\r\n\r\n' + body;
}

async function sendGmail(env, msg) {
  if (!env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET || !env.GMAIL_REFRESH_TOKEN || !env.GMAIL_SENDER) return { status: 'skipped', error: 'gmail_not_configured' };
  if (!msg.from) return { status: 'skipped', error: 'no_sender' };
  let raw;
  try {
    raw = buildMime({ fromName: msg.from, fromAddr: env.GMAIL_SENDER, to: msg.to, replyTo: msg.replyTo, subject: msg.subject, text: msg.text });
  } catch (e) { return { status: 'failed', error: 'bad_address' }; }
  try {
    const token = await gmailToken(env);
    const res = await withTimeout(fetch(GMAIL, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({ raw: b64(utf8(raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') })
    }), 10000, 'email');
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) cached = null;
    if (res.ok && data.id) return { status: 'accepted', id: 'gmail:' + String(data.id) };
    return { status: 'failed', error: 'gmail_' + res.status + (data.error && data.error.status ? ':' + oneLine(data.error.status).slice(0, 40) : '') };
  } catch (e) {
    return { status: 'failed', error: String(e && e.message || 'error').slice(0, 80) };
  }
}

export { oneLine };

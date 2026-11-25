// Transactional email through Resend's HTTP API. Values are passed as JSON fields (never assembled into raw headers);
// subjects and names are additionally reduced to one line, so header injection is not possible.
import { withTimeout } from './util.js';

const API = 'https://api.resend.com/emails';
const oneLine = (s) => String(s || '').replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

// returns { status: 'accepted', id } | { status: 'failed', error } | { status: 'skipped', error }
export async function sendEmail(env, keyName, msg) {
  const key = env[keyName];
  if (!key || !msg.from) return { status: 'skipped', error: !key ? 'no_api_key' : 'no_sender' };
  const payload = {
    from: msg.from,
    to: [msg.to],
    subject: oneLine(msg.subject).slice(0, 200),
    text: msg.text
  };
  if (msg.replyTo) payload.reply_to = [msg.replyTo];
  try {
    const res = await withTimeout(fetch(API, {
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

export { oneLine };

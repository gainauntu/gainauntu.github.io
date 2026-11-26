// Gmail provider: notifications, visitor confirmations and dashboard replies sent through the owner's Gmail (mocked here).
import test from 'node:test';
import assert from 'node:assert/strict';
import { start, inquiry, post, accessToken } from './helpers.mjs';
import { buildMime } from '../src/lib/email.js';

const GMAIL = { EMAIL_PROVIDER: 'gmail', GMAIL_CLIENT_ID: 'cid.apps.googleusercontent.com', GMAIL_CLIENT_SECRET: 'csecret', GMAIL_REFRESH_TOKEN: '1//refresh', GMAIL_SENDER: 'owner@example.com' };
const decode = (call) => { const raw = JSON.parse(call.body).raw.replace(/-/g, '+').replace(/_/g, '/'); return Buffer.from(raw, 'base64').toString('utf8'); };
const bodyOf = (mime) => Buffer.from(mime.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8');
const sends = (h) => h.out.calls.filter((c) => c.host === 'gmail.googleapis.com');

test('gmail: owner notification and visitor confirmation are sent from the owner account; the inquiry records both', async () => {
  const h = await start({ publicVars: { ...GMAIL, NOTIFY_FROM: 'Website inquiries', CONFIRM_FROM: 'Auntu Gain', SEND_CONFIRMATION: 'true' } });
  try {
    const r = await post(h.pub, '/v1/inquiries', inquiry({}, { name: '홍길동 <Bcc: x@evil.test>', email: 'visitor@example.org' }));
    const j = await r.json();
    assert.equal(r.status, 201); assert.equal(j.notify, 'accepted'); assert.equal(j.confirmation, 'requested');
    const s = sends(h); assert.equal(s.length, 2);
    assert.equal(s[0].headers.authorization, 'Bearer ya29.test-token');
    const n = decode(s[0]), c = decode(s[1]);
    assert.match(n, /^From: Website inquiries <owner@example\.com>\r\nTo: <owner@example\.com>\r\nReply-To: <visitor@example\.org>\r\n/);
    assert.match(c, /\r\nTo: <visitor@example\.org>\r\n/);
    assert.doesNotMatch(n.split('\r\n\r\n')[0], /Bcc|evil\.test/i);            // a hostile name cannot add a header
    assert.match(bodyOf(n), /홍길동/);                                           // UTF-8 body survives
    const row = await h.db.prepare('SELECT notify_status, notify_id, confirm_status FROM inquiries').first();
    assert.equal(row.notify_status, 'accepted'); assert.match(row.notify_id, /^gmail:gm1$/); assert.equal(row.confirm_status, 'accepted');
    assert.equal(h.out.calls.filter((c) => c.host === 'oauth2.googleapis.com').length, 1);   // token reused within the isolate
  } finally { await h.close(); }
});

test('gmail: an OAuth failure is reported honestly and the inquiry is still stored', async () => {
  const h = await start({ publicVars: { ...GMAIL, NOTIFY_FROM: 'Website inquiries' } });
  h.out.gmail = 'oauthfail';
  try {
    const { _resetGmailCache } = await import('../src/lib/email.js'); _resetGmailCache();
    const r = await post(h.pub, '/v1/inquiries', inquiry());
    const j = await r.json();
    assert.equal(r.status, 201); assert.equal(j.notify, 'failed');
    const row = await h.db.prepare('SELECT notify_status FROM inquiries').first();
    assert.equal(row.notify_status, 'failed');
    assert.equal(sends(h).length, 0);
  } finally { await h.close(); }
});

test('gmail: a dashboard reply is sent to the visitor and marks the inquiry replied; a refused send does not', async () => {
  const h = await start({ publicVars: { ...GMAIL, NOTIFY_FROM: 'Website inquiries' }, adminVars: { ...GMAIL, REPLY_FROM: 'Auntu Gain' } });
  try {
    await post(h.pub, '/v1/inquiries', inquiry({}, { email: 'visitor@example.org' }));
    const { id } = await h.db.prepare('SELECT id FROM inquiries').first();
    const send = (body) => h.adm.fetch('https://admin.test/api/inquiries/' + id + '/reply', { method: 'POST', body: JSON.stringify(body),
      headers: { 'cf-access-jwt-assertion': accessToken(), 'content-type': 'application/json', 'x-ag-admin': '1', origin: 'https://admin.test' } });
    h.out.gmail = 'fail';
    let r = await send({ subject: 'Re: your inquiry', body: 'Thank you.' });
    assert.equal(r.status, 502);
    assert.equal((await h.db.prepare('SELECT status FROM inquiries').first()).status, 'new');
    h.out.gmail = 'accept';
    r = await send({ subject: 'Re: 문의 감사합니다', body: '안녕하세요.\n답변드립니다.' });
    assert.equal(r.status, 200);
    const m = decode(sends(h).at(-1));
    assert.match(m, /^From: Auntu Gain <owner@example\.com>\r\nTo: <visitor@example\.org>\r\nSubject: =\?UTF-8\?B\?/);
    assert.equal(bodyOf(m), '안녕하세요.\r\n답변드립니다.');
    const st = await h.db.prepare('SELECT status, replied_at FROM inquiries').first();
    assert.equal(st.status, 'replied'); assert.ok(st.replied_at);
    const reps = (await h.db.prepare('SELECT status FROM replies ORDER BY created_at').all()).results.map((x) => x.status);
    assert.deepEqual(reps, ['failed', 'accepted']);
  } finally { await h.close(); }
});

test('gmail: MIME builder rejects header-breaking addresses', () => {
  assert.throws(() => buildMime({ fromName: 'A', fromAddr: 'owner@example.com', to: 'v@example.org\r\nBcc: x@y.z', subject: 's', text: 't' }), /bad_address/);
  const m = buildMime({ fromName: 'A "B" <c>', fromAddr: 'owner@example.com', to: 'v@example.org', subject: 'line1\r\nX-Injected: 1', text: 't' });
  assert.doesNotMatch(m, /\r\nX-Injected/);
});

test('confirmation: page language and chosen reply language both used when they differ', async () => {
  const { confirmation } = await import('../src/lib/templates.js');
  const same = confirmation('en', 'project', 'AG-TEST-0001', 'en');
  assert.equal(same.subject, 'Your inquiry AG-TEST-0001 was received'); assert.doesNotMatch(same.text, /접수/);
  const mixed = confirmation('en', 'project', 'AG-TEST-0001', 'ko');
  assert.match(mixed.subject, /^Your inquiry AG-TEST-0001 was received \/ 문의가 접수되었습니다/);
  assert.ok(mixed.text.indexOf('Thank you') < mixed.text.indexOf('접수번호'));
  const bn = confirmation('bn', 'collab', 'AG-TEST-0002', 'bn');
  assert.match(bn.text, /গ্রহণ/); assert.doesNotMatch(bn.text, /Thank you/);
});

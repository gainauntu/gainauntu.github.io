// Owner dashboard: Access verification on every route, CSRF guard, record handling, reply workflow, deletion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { start, inquiry, post, accessToken, ADMIN } from './helpers.mjs';

const BASE = 'https://admin.test';
const get = (h, path, token = accessToken()) => h.adm.fetch(BASE + path, { headers: token ? { 'cf-access-jwt-assertion': token } : {} });
const send = (h, method, path, body, extra = {}) => h.adm.fetch(BASE + path, {
  method, body: JSON.stringify(body), headers: { 'cf-access-jwt-assertion': accessToken(), 'content-type': 'application/json', 'x-ag-admin': '1', origin: BASE, ...extra }
});
async function seeded(opts) {
  const h = await start(opts);
  await post(h.pub, '/v1/inquiries', inquiry({ boardOptIn: true }));
  await post(h.pub, '/v1/inquiries', { idemKey: crypto.randomUUID(), intent: 'msg', lang: 'ko', consent: true, token: 'XXXX.DUMMY.TOKEN.XXXX', brief: '한국어 메시지',
    fields: { msg: '안녕하세요, 채용 관련해서 연락드립니다. 감사합니다.', name: '홍길동', email: 'hong@example.com', replyLang: 'ko' } }, { ip: '198.51.100.40' });
  const ids = (await h.db.prepare('SELECT id, ref, intent FROM inquiries ORDER BY created_at').all()).results;
  return { h, project: ids.find((x) => x.intent === 'project'), msg: ids.find((x) => x.intent === 'msg') };
}

test('every route requires a valid Access identity (fails closed)', async () => {
  const h = await start();
  try {
    const cases = [
      [null, 401], [accessToken({}, { wrongKey: true }), 401], [accessToken({ aud: ['other-app'] }), 401], [accessToken({ iss: 'https://evil.cloudflareaccess.com' }), 401],
      [accessToken({ exp: Math.floor(Date.now() / 1000) - 120 }), 401], [accessToken({}, { kid: 'unknown' }), 401], [accessToken({ email: 'intruder@example.com' }), 403], ['abc.def', 401]
    ];
    for (const [tok, code] of cases) {
      for (const p of ['/', '/api/inquiries', '/api/me', '/app.js']) assert.equal((await get(h, p, tok)).status, code, p + ' ' + code);
    }
    const ok = await get(h, '/');
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(ok.headers.get('x-frame-options'), 'DENY');
    assert.ok((await ok.text()).includes('<script src="/app.js">'));
  } finally { await h.close(); }
  const n = await start({ adminVars: { ACCESS_AUD: '<Application Audience (AUD) tag>' } });
  try { assert.equal((await get(n, '/api/me')).status, 401, 'placeholder configuration never authenticates'); } finally { await n.close(); }
});

test('list, filters, search (with LIKE escaping), counts and detail without internal fields', async () => {
  const { h, project, msg } = await seeded();
  try {
    let d = await (await get(h, '/api/inquiries')).json();
    assert.equal(d.items.length, 2); assert.equal(d.counts.total, 2); assert.equal(d.counts.new, 2);
    assert.equal(d.items.find((x) => x.intent === 'project').budget, 'bud.usd.2');
    d = await (await get(h, '/api/inquiries?intent=msg')).json(); assert.deepEqual(d.items.map((x) => x.id), [msg.id]);
    d = await (await get(h, '/api/inquiries?q=' + encodeURIComponent('홍길'))).json(); assert.deepEqual(d.items.map((x) => x.id), [msg.id]);
    d = await (await get(h, '/api/inquiries?q=%25')).json(); assert.equal(d.items.length, 0, '% is literal, not a wildcard');
    d = await (await get(h, '/api/inquiries?q=' + encodeURIComponent("' OR 1=1 --"))).json(); assert.equal(d.items.length, 0);
    const det = await (await get(h, '/api/inquiries/' + project.id)).json();
    assert.equal(det.inquiry.ref, project.ref); assert.equal(det.inquiry.fields.ctype, 'type.company');
    for (const k of ['client_hash', 'idem_key', 'content_hash']) assert.equal(det.inquiry[k], undefined, k);
    assert.equal((await get(h, '/api/inquiries/' + 'f'.repeat(32))).status, 404);
    assert.equal((await get(h, '/api/inquiries/../../etc')).status, 404);
  } finally { await h.close(); }
});

test('state changes need the CSRF header, JSON and a same-origin request', async () => {
  const { h, project } = await seeded();
  try {
    const url = BASE + '/api/inquiries/' + project.id + '/status';
    const base = { 'cf-access-jwt-assertion': accessToken(), 'content-type': 'application/json' };
    let r = await h.adm.fetch(url, { method: 'POST', body: '{"status":"archived"}', headers: { ...base } });
    assert.equal(r.status, 403, 'no x-ag-admin');
    r = await h.adm.fetch(url, { method: 'POST', body: '{"status":"archived"}', headers: { ...base, 'x-ag-admin': '1', origin: 'https://evil.example' } });
    assert.equal(r.status, 403, 'foreign origin');
    r = await h.adm.fetch(url, { method: 'POST', body: 'status=archived', headers: { ...base, 'content-type': 'application/x-www-form-urlencoded', 'x-ag-admin': '1' } });
    assert.equal(r.status, 400, 'form-encoded body');
    assert.equal((await h.db.prepare('SELECT status FROM inquiries WHERE id = ?').bind(project.id).first()).status, 'new');
    r = await send(h, 'POST', '/api/inquiries/' + project.id + '/status', { status: 'read' }); assert.equal(r.status, 200);
    r = await send(h, 'POST', '/api/inquiries/' + project.id + '/status', { status: 'deleted' }); assert.equal(r.status, 400);
    const row = await h.db.prepare('SELECT status, read_at FROM inquiries WHERE id = ?').bind(project.id).first();
    assert.equal(row.status, 'read'); assert.ok(row.read_at);
  } finally { await h.close(); }
});

test('reply without a verified sender: refused (409); manual reply is recorded as such', async () => {
  const { h, msg } = await seeded();
  try {
    let r = await send(h, 'POST', '/api/inquiries/' + msg.id + '/reply', { subject: 'Re', body: 'Thanks' });
    assert.equal(r.status, 409); assert.equal((await r.json()).error, 'sender_not_configured');
    r = await send(h, 'POST', '/api/inquiries/' + msg.id + '/manual-reply', { subject: 'Answered in Gmail', body: '' });
    assert.equal(r.status, 200);
    const det = await (await get(h, '/api/inquiries/' + msg.id)).json();
    assert.equal(det.inquiry.status, 'replied');
    assert.deepEqual(det.replies.map((x) => [x.channel, x.status]), [['manual', 'recorded']]);
    const toVisitor = h.out.calls.filter((c) => c.host === 'api.resend.com' && JSON.parse(c.body).to.includes('hong@example.com'));
    assert.equal(toVisitor.length, 0, 'nothing was emailed to the visitor (only the owner notification at submission)');
  } finally { await h.close(); }
});

test('reply through the provider: replied only when accepted; failures recorded; header injection impossible', async () => {
  const { h, project } = await seeded({ adminVars: { REPLY_FROM: 'Auntu Gain <reply@example.org>', REPLY_TO: 'owner@example.com' } });
  try {
    h.out.resend = 'fail';
    let r = await send(h, 'POST', '/api/inquiries/' + project.id + '/reply', { subject: 'Re: quote', body: 'Hello' });
    assert.equal(r.status, 502);
    let det = await (await get(h, '/api/inquiries/' + project.id)).json();
    assert.notEqual(det.inquiry.status, 'replied'); assert.equal(det.replies[0].status, 'failed');
    h.out.resend = 'accept';
    r = await send(h, 'POST', '/api/inquiries/' + project.id + '/reply', { subject: 'Re: quote\r\nBcc: victim@example.com', body: 'Hello,\nthank you.' });
    const d = await r.json();
    assert.equal(r.status, 200); assert.equal(d.status, 'accepted'); assert.match(d.providerId, /^msg_/);
    const mail = JSON.parse(h.out.calls.filter((c) => c.host === 'api.resend.com').pop().body);
    assert.equal(mail.subject, 'Re: quote Bcc: victim@example.com', 'CR/LF removed: stays one subject line');
    assert.deepEqual(mail.to, ['test@example.com']); assert.deepEqual(mail.reply_to, ['owner@example.com']);
    det = await (await get(h, '/api/inquiries/' + project.id)).json();
    assert.equal(det.inquiry.status, 'replied'); assert.equal(det.replies[1].provider_id, d.providerId);
    // a later bounce arrives through the public webhook and is attached to this reply
    const { svixHeaders } = await import('./helpers.mjs');
    const ev = JSON.stringify({ type: 'email.bounced', data: { email_id: d.providerId } });
    await h.pub.fetch('https://api.test/v1/webhooks/resend', { method: 'POST', body: ev, headers: await svixHeaders(ev) });
    det = await (await get(h, '/api/inquiries/' + project.id)).json();
    assert.equal(det.replies[1].status, 'bounced');
  } finally { await h.close(); }
});

test('board approval only for opted-in inquiries; deletion needs the reference and removes replies', async () => {
  const { h, project, msg } = await seeded();
  try {
    assert.equal((await send(h, 'POST', '/api/inquiries/' + msg.id + '/board', { approved: true })).status, 409, 'not opted in');
    assert.equal((await send(h, 'POST', '/api/inquiries/' + project.id + '/board', { approved: true })).status, 200);
    let b = await (await h.pub.fetch('https://api.test/v1/board', { headers: { origin: 'https://gainauntu.github.io' } })).json();
    assert.equal(b.items.length, 1);
    await send(h, 'POST', '/api/inquiries/' + project.id + '/manual-reply', { subject: 'done', body: '' });
    b = await (await h.pub.fetch('https://api.test/v1/board', { headers: { origin: 'https://gainauntu.github.io' } })).json();
    assert.equal(b.items[0].status, 'replied');
    assert.equal((await send(h, 'DELETE', '/api/inquiries/' + project.id, { confirm: 'AG-WRONG-REF0' })).status, 400);
    assert.equal((await send(h, 'DELETE', '/api/inquiries/' + project.id, { confirm: project.ref })).status, 200);
    assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM replies').first()).n, 0);
    assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM inquiries').first()).n, 1);
    b = await (await h.pub.fetch('https://api.test/v1/board', { headers: { origin: 'https://gainauntu.github.io' } })).json();
    assert.deepEqual(b.items, []);
  } finally { await h.close(); }
});

test('me endpoint reports the identity and whether replies can be sent', async () => {
  const h = await start();
  try {
    const d = await (await get(h, '/api/me')).json();
    assert.deepEqual(d, { email: ADMIN, replyConfigured: false });
  } finally { await h.close(); }
});

// Public API: submission, validation, bot check, limits, idempotency, storage-before-email, board, webhooks, retention.
import test from 'node:test';
import assert from 'node:assert/strict';
import { start, inquiry, post, svixHeaders, ORIGIN, ADMIN } from './helpers.mjs';

const rows = async (db) => (await db.prepare('SELECT * FROM inquiries').all()).results;

test('valid project inquiry is stored first, then the owner is notified', async () => {
  const h = await start();
  try {
    const body = inquiry();
    const r = await post(h.pub, '/v1/inquiries', body);
    const d = await r.json();
    assert.equal(r.status, 201);
    assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
    assert.match(d.ref, /^AG-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    assert.deepEqual([d.ok, d.duplicate, d.notify, d.confirmation], [true, false, 'accepted', 'off']);
    const [row] = await rows(h.db);
    assert.equal(row.ref, d.ref); assert.equal(row.status, 'new'); assert.equal(row.notify_status, 'accepted'); assert.equal(row.notify_id, 'msg_1');
    assert.equal(JSON.parse(row.fields_json).budget, 'bud.usd.2'); assert.equal(row.brief, body.brief);
    assert.ok(row.client_hash && row.client_hash.length === 64 && !row.client_hash.includes('203.0.113.7'));
    const email = h.out.calls.find((c) => c.host === 'api.resend.com');
    const p = JSON.parse(email.body);
    assert.deepEqual(p.to, [ADMIN]); assert.deepEqual(p.reply_to, ['test@example.com']);
    assert.match(p.subject, new RegExp('^\\[' + d.ref + '\\] Project inquiry: Test Person$'));
    assert.ok(p.text.includes(body.brief)); assert.equal(email.headers['idempotency-key'], 'notify-' + row.id);
    const ts = h.out.calls.find((c) => c.host === 'challenges.cloudflare.com');
    assert.ok(ts.body.includes('idempotency_key') && ts.body.includes(body.idemKey) && ts.body.includes('203.0.113.7'));
  } finally { await h.close(); }
});

test('confirmation email (when enabled) is a fixed template in the reply language, without the visitor text', async () => {
  const h = await start({ publicVars: { SEND_CONFIRMATION: 'true', CONFIRM_FROM: 'Auntu Gain <noreply@example.org>' } });
  try {
    const body = inquiry({}, { replyLang: 'ko', desc: 'SPAM LINK http://spam.example buy now please now now now' });
    const d = await (await post(h.pub, '/v1/inquiries', body)).json();
    assert.equal(d.confirmation, 'requested');
    const mails = h.out.calls.filter((c) => c.host === 'api.resend.com').map((c) => JSON.parse(c.body));
    const conf = mails.find((m) => m.to[0] === 'test@example.com');
    assert.ok(conf.subject.includes(d.ref) && conf.subject.includes('접수'));
    assert.ok(!conf.text.includes('spam.example') && !conf.text.includes('Test Person'));
  } finally { await h.close(); }
});

test('retry with the same attempt key returns the same inquiry and does not re-check the single-use token', async () => {
  const h = await start();
  try {
    const body = inquiry();
    const a = await (await post(h.pub, '/v1/inquiries', body)).json();
    const ts1 = h.out.calls.filter((c) => c.host === 'challenges.cloudflare.com').length;
    const r = await post(h.pub, '/v1/inquiries', body);
    const b = await r.json();
    assert.equal(r.status, 200); assert.equal(b.duplicate, true); assert.equal(b.ref, a.ref);
    assert.equal(h.out.calls.filter((c) => c.host === 'challenges.cloudflare.com').length, ts1);
    assert.equal((await rows(h.db)).length, 1);
    // a double click that produced a new key but the same content
    const c = await (await post(h.pub, '/v1/inquiries', { ...body, idemKey: crypto.randomUUID() })).json();
    assert.equal(c.duplicate, true); assert.equal(c.ref, a.ref); assert.equal((await rows(h.db)).length, 1);
  } finally { await h.close(); }
});

test('server-side validation rejects bad input and stores nothing', async () => {
  const h = await start();
  try {
    const cases = [
      [inquiry({}, { email: 'not-an-email' }), 'email'],
      [inquiry({}, { email: 'a@b.com\r\nBcc: victim@example.com' }), 'email'],
      [inquiry({}, { name: 'Evil\r\nBcc: x@y.z' }), 'name'],
      [inquiry({}, { desc: 'short' }), 'desc'],
      [inquiry({}, { budget: 'bud.eur.9' }), 'budget'],
      [inquiry({}, { scope: ['cat.embedded', 'drop table'] }), 'scope'],
      [inquiry({}, { extra: 'x' }), 'unknown:extra'],
      [inquiry({ consent: false }), 'consent'],
      [inquiry({ website: 'http://bot' }), 'website'],
      [inquiry({ intent: 'admin' }), 'intent'],
      [inquiry({ lang: 'fr' }), 'lang'],
      [inquiry({}, { desc: 'x'.repeat(3001) }), 'desc'],
      [inquiry({ idemKey: '../../etc' }), 'idemKey'],
      [inquiry({ token: '' }), 'token'],
      [inquiry({}, { budget: 'bud.krw.2', currency: 'USD' }), 'currency']
    ];
    for (const [b, field] of cases) {
      const r = await post(h.pub, '/v1/inquiries', b);
      const d = await r.json();
      assert.equal(r.status, 400, field); assert.equal(d.error, 'invalid'); assert.ok(d.fields.includes(field), field + ' in ' + d.fields);
    }
    assert.equal((await post(h.pub, '/v1/inquiries', '{bad json')).status, 415);
    const big = await post(h.pub, '/v1/inquiries', JSON.stringify(inquiry({ brief: 'x'.repeat(60000) })));
    assert.equal(big.status, 413);
    const ct = await h.pub.fetch('https://api.test/v1/inquiries', { method: 'POST', body: 'a=b', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN } });
    assert.equal(ct.status, 415);
    assert.equal((await rows(h.db)).length, 0);
    assert.equal(h.out.calls.length, 0, 'no outbound call for invalid input');
  } finally { await h.close(); }
});

test('long Korean and Bengali inquiries are accepted and stored intact; malicious text is stored as data', async () => {
  const h = await start();
  try {
    const ko = '배터리로 동작하는 센서 노드에서 온디바이스 검출이 필요합니다. '.repeat(90).slice(0, 3000);
    const bn = 'ছোট রোবটের জন্য অনিশ্চয়তা-সচেতন উপলব্ধি নিয়ে যৌথ গবেষণা। '.repeat(60).slice(0, 3000);
    const r1 = await post(h.pub, '/v1/inquiries', inquiry({ lang: 'ko', brief: ko }, { desc: ko, replyLang: 'ko' }));
    const r2 = await post(h.pub, '/v1/inquiries', { idemKey: crypto.randomUUID(), intent: 'collab', lang: 'bn', consent: true, token: 'XXXX.DUMMY.TOKEN.XXXX', brief: bn,
      fields: { topic: ['topic.2'], cdesc: bn, affil: 'বিশ্ববিদ্যালয়', name: "Robert'); DROP TABLE inquiries;--", email: 'dr@example.com', replyLang: 'bn' } }, { ip: '198.51.100.9' });
    const r3 = await post(h.pub, '/v1/inquiries', { idemKey: crypto.randomUUID(), intent: 'msg', lang: 'en', consent: true, token: 'XXXX.DUMMY.TOKEN.XXXX', brief: 'Hello <script>alert(1)</script>',
      fields: { msg: '<img src=x onerror=alert(1)> hello there, a general note.', name: '<script>alert(1)</script>', email: 'v@example.com', replyLang: 'en' } }, { ip: '198.51.100.10' });
    assert.deepEqual([r1.status, r2.status, r3.status], [201, 201, 201]);
    const all = await rows(h.db);
    assert.equal(all.length, 3);
    assert.equal(JSON.parse(all.find((x) => x.lang === 'ko').fields_json).desc, ko.trim());
    assert.equal(all.find((x) => x.lang === 'bn').brief, bn.trim());
    assert.ok(all.some((x) => x.name === "Robert'); DROP TABLE inquiries;--"));
    assert.ok(all.some((x) => x.name === '<script>alert(1)</script>'));
  } finally { await h.close(); }
});

test('origins, preflight and configuration', async () => {
  const h = await start();
  try {
    const r = await post(h.pub, '/v1/inquiries', inquiry(), { origin: 'https://evil.example' });
    assert.equal(r.status, 403); assert.equal(r.headers.get('access-control-allow-origin'), null);
    const pre = await h.pub.fetch('https://api.test/v1/inquiries', { method: 'OPTIONS', headers: { origin: ORIGIN, 'access-control-request-method': 'POST' } });
    assert.equal(pre.status, 204); assert.equal(pre.headers.get('access-control-allow-origin'), ORIGIN);
    const bad = await h.pub.fetch('https://api.test/v1/inquiries', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } });
    assert.equal(bad.status, 403);
    assert.equal((await h.pub.fetch('https://api.test/v1/inquiries/AG-XXXX-XXXX')).status, 404, 'no lookup by reference');
    assert.equal((await rows(h.db)).length, 0);
  } finally { await h.close(); }
  const u = await start({ publicVars: { TURNSTILE_SECRET: '' } });
  try { assert.equal((await post(u.pub, '/v1/inquiries', inquiry())).status, 503); } finally { await u.close(); }
});

test('bot check: failed, wrong hostname and unavailable verification store nothing', async () => {
  const h = await start();
  try {
    h.out.turnstile = 'fail';
    let r = await post(h.pub, '/v1/inquiries', inquiry()); assert.equal(r.status, 403); assert.equal((await r.json()).error, 'spam');
    h.out.turnstile = 'wronghost';
    r = await post(h.pub, '/v1/inquiries', inquiry(), { ip: '198.51.100.2' }); assert.equal(r.status, 403);
    h.out.turnstile = 'error';
    r = await post(h.pub, '/v1/inquiries', inquiry(), { ip: '198.51.100.3' }); assert.equal(r.status, 503);
    assert.equal((await rows(h.db)).length, 0);
    assert.equal(h.out.calls.filter((c) => c.host === 'api.resend.com').length, 0);
  } finally { await h.close(); }
});

test('rate limits: short burst per client, then a daily cap per client and in total', async () => {
  const h = await start({ publicVars: { DAILY_LIMIT_PER_CLIENT: '5', DAILY_LIMIT_TOTAL: '6' } });
  try {
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await post(h.pub, '/v1/inquiries', inquiry())).status);
    assert.deepEqual(codes, [201, 201, 201, 429]);
    // daily cap: pre-fill rows for another client, then try
    const ip = '192.0.2.44';
    for (let i = 0; i < 3; i++) await post(h.pub, '/v1/inquiries', inquiry(), { ip });
    const r = await post(h.pub, '/v1/inquiries', inquiry(), { ip: '192.0.2.45' });
    assert.equal(r.status, 429, 'total daily cap reached (6)');
    assert.equal((await rows(h.db)).length, 6);
  } finally { await h.close(); }
});

test('email failures are reported separately from storage', async () => {
  const h = await start();
  try {
    h.out.resend = 'fail';
    const d = await (await post(h.pub, '/v1/inquiries', inquiry())).json();
    assert.equal(d.ok, true); assert.equal(d.notify, 'failed');
    const [row] = await rows(h.db);
    assert.equal(row.notify_status, 'failed');
  } finally { await h.close(); }
  const k = await start({ publicVars: { RESEND_API_KEY: '' } });
  try {
    const d = await (await post(k.pub, '/v1/inquiries', inquiry())).json();
    assert.equal(d.notify, 'skipped');
  } finally { await k.close(); }
});

test('email provider timeout: inquiry kept, notification marked failed', { timeout: 30000 }, async () => {
  const h = await start();
  try {
    h.out.resend = 'timeout';
    const r = await post(h.pub, '/v1/inquiries', inquiry());
    const d = await r.json();
    assert.equal(r.status, 201); assert.equal(d.notify, 'failed');
    assert.equal((await rows(h.db))[0].notify_status, 'failed');
  } finally { await h.close(); }
});

test('database failure: no success is claimed', async () => {
  const h = await start({ migrate: false });
  try {
    const r = await post(h.pub, '/v1/inquiries', inquiry());
    const d = await r.json();
    assert.equal(r.status, 500); assert.equal(d.error, 'storage'); assert.equal(d.ok, undefined);
    assert.equal(h.out.calls.filter((c) => c.host === 'api.resend.com').length, 0, 'no notification without storage');
  } finally { await h.close(); }
});

test('anonymous board: only opted-in and approved items, minimal fields, empty when none', async () => {
  const h = await start();
  try {
    let b = await (await h.pub.fetch('https://api.test/v1/board', { headers: { origin: ORIGIN } })).json();
    assert.deepEqual(b.items, []);
    await post(h.pub, '/v1/inquiries', inquiry({ boardOptIn: true }));
    await post(h.pub, '/v1/inquiries', inquiry({ boardOptIn: false }), { ip: '198.51.100.20' });
    b = await (await h.pub.fetch('https://api.test/v1/board', { headers: { origin: ORIGIN } })).json();
    assert.deepEqual(b.items, [], 'opt-in alone is not enough: the owner must approve');
    await h.db.prepare('UPDATE inquiries SET board_approved = 1 WHERE board_optin = 1').run();
    await h.db.prepare('UPDATE inquiries SET board_approved = 1 WHERE board_optin = 0').run().catch(() => {});
    const res = await h.pub.fetch('https://api.test/v1/board', { headers: { origin: ORIGIN } });
    b = await res.json();
    assert.equal(b.items.length, 1);
    assert.deepEqual(Object.keys(b.items[0]).sort(), ['month', 'status', 'type']);
    assert.deepEqual([b.items[0].type, b.items[0].status], ['project', 'received']);
    assert.match(b.items[0].month, /^\d{4}-\d{2}$/);
    const raw = JSON.stringify(b);
    for (const secret of ['Test Person', 'test@example.com', 'Example Lab', 'Edge pilot', 'bud.', 'AG-']) assert.ok(!raw.includes(secret), secret);
  } finally { await h.close(); }
});

test('webhooks: signed events update delivery state once; bad, stale or replayed events are refused', async () => {
  const h = await start();
  try {
    await post(h.pub, '/v1/inquiries', inquiry());
    const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'msg_1' } });
    const hd = await svixHeaders(body);
    let r = await h.pub.fetch('https://api.test/v1/webhooks/resend', { method: 'POST', body, headers: hd });
    assert.equal(r.status, 200);
    assert.equal((await rows(h.db))[0].notify_status, 'delivered');
    r = await h.pub.fetch('https://api.test/v1/webhooks/resend', { method: 'POST', body, headers: hd });
    assert.equal((await r.json()).replay, true);
    r = await h.pub.fetch('https://api.test/v1/webhooks/resend', { method: 'POST', body, headers: await svixHeaders(body, { wrongSecret: true }) });
    assert.equal(r.status, 401);
    r = await h.pub.fetch('https://api.test/v1/webhooks/resend', { method: 'POST', body, headers: await svixHeaders(body, { ts: Math.floor(Date.now() / 1000) - 3600 }) });
    assert.equal(r.status, 401);
    const bounce = JSON.stringify({ type: 'email.bounced', data: { email_id: 'msg_1' } });
    r = await h.pub.fetch('https://api.test/v1/webhooks/resend', { method: 'POST', body: bounce, headers: { ...(await svixHeaders(bounce)), 'svix-signature': 'v1,AAAA' } });
    assert.equal(r.status, 401);
    assert.equal((await rows(h.db))[0].notify_status, 'delivered');
  } finally { await h.close(); }
});

test('retention removes old archived inquiries and old client hashes only', async () => {
  const h = await start({ publicVars: { RETENTION_DAYS: '30' } });
  try {
    await post(h.pub, '/v1/inquiries', inquiry());
    await post(h.pub, '/v1/inquiries', inquiry(), { ip: '198.51.100.30' });
    const old = Date.now() - 40 * 86400000;
    const [a, b] = (await rows(h.db)).map((x) => x.id);
    await h.db.prepare("UPDATE inquiries SET status = 'archived', archived_at = ?, created_at = ? WHERE id = ?").bind(old, old, a).run();
    await h.db.prepare('UPDATE inquiries SET created_at = ? WHERE id = ?').bind(old, b).run();
    const res = await h.mf.getWorker('public').then((w) => w.scheduled({ cron: '17 3 * * *' }));
    assert.equal(res.outcome, 'ok');
    const left = await rows(h.db);
    assert.deepEqual(left.map((x) => x.id), [b], 'archived and older than 30 days: deleted; active: kept');
    assert.equal(left[0].client_hash, null, 'client hash cleared after 2 days');
  } finally { await h.close(); }
});

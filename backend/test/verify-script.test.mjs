// The production check script, run against the real Worker code served locally over HTTP.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { start } from './helpers.mjs';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/verify-production.mjs');

function serve(worker, host) {   // plain HTTP front for one Worker; the Worker sees its usual hostname
  const srv = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const headers = { ...req.headers }; delete headers.host; delete headers.connection;
    const r = await worker.fetch('https://' + host + req.url, { method: req.method, headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks), redirect: 'manual' });
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ url: 'http://127.0.0.1:' + srv.address().port, close: () => srv.close() })));
}
const run = (api, admin) => new Promise((ok) => execFile(process.execPath, [SCRIPT, '--api', api, '--admin', admin], (err, stdout) => ok({ code: err ? err.code : 0, out: stdout })));

test('verify-production passes against correctly configured Workers and stores nothing', async () => {
  const h = await start(); const a = await serve(h.pub, 'api.test'), b = await serve(h.adm, 'admin.test');
  try {
    const r = await run(a.url, b.url);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /All automatic checks passed/);
    const n = await h.db.prepare('SELECT COUNT(*) AS n FROM inquiries').first();
    assert.equal(n.n, 0);
    assert.equal(h.out.resendCount, 0);
  } finally { a.close(); b.close(); await h.close(); }
});

test('verify-production fails when a public secret is missing; an unconfigured dashboard stays closed', async () => {
  const h = await start({ publicVars: { TURNSTILE_SECRET: '' }, adminVars: { ACCESS_AUD: '' } });
  const a = await serve(h.pub, 'api.test'), b = await serve(h.adm, 'admin.test');
  try {
    const r = await run(a.url, b.url);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /FAIL .*empty submission.*503: TURNSTILE_SECRET or IP_HASH_SECRET missing/);
    assert.match(r.out, /keep the website on the email hand-off/);
    assert.doesNotMatch(r.out, /FAIL  dashboard/);
  } finally { a.close(); b.close(); await h.close(); }
});

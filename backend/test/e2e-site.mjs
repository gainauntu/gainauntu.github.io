// Browser end-to-end test of direct submission against the real Worker code (local workerd via Miniflare).
//   node test/e2e-site.mjs <site build dir made with AG_INQUIRY_API=http://127.0.0.1:8799> <screenshot dir>
// Turnstile's script is replaced by a local stub (test token); Resend and Access are mocked; nothing leaves the machine.
import { Miniflare } from 'miniflare';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeOutbound, accessToken, TEAM, AUD, ADMIN } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.resolve(process.argv[2]), SHOTS = path.resolve(process.argv[3] || 'e2e-shots');
mkdirSync(SHOTS, { recursive: true });
const SITE_PORT = 5199, API = 'http://127.0.0.1:8799';
const results = []; const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' · ' + detail : '')); };

const out = makeOutbound();
const rules = [{ type: 'Text', include: ['**/*.html', '**/*.css', '**/*.dash.js'] }, { type: 'ESModule', include: ['**/*.js', '**/*.mjs'] }];
const common = { modules: true, modulesRules: rules, compatibilityDate: '2026-07-01', d1Databases: { DB: 'e2e' }, outboundService: (r) => out.handle(r), modulesRoot: ROOT };
const mf = new Miniflare({
  host: '127.0.0.1', port: 8799,
  workers: [
    { ...common, name: 'public', scriptPath: path.join(ROOT, 'src/public.js'), ratelimits: { BURST: { namespace_id: '5101', simple: { limit: 20, period: 60 } } },
      bindings: { ALLOWED_ORIGINS: 'http://127.0.0.1:' + SITE_PORT, TURNSTILE_HOSTNAMES: 'gainauntu.github.io', NOTIFY_FROM: 'Inquiries <onboarding@resend.dev>', SEND_CONFIRMATION: 'true', CONFIRM_FROM: 'Auntu Gain <noreply@example.org>',
        RETENTION_DAYS: '365', DAILY_LIMIT_PER_CLIENT: '20', DAILY_LIMIT_TOTAL: '80', TURNSTILE_SECRET: 'test', RESEND_API_KEY: 're_test', RESEND_WEBHOOK_SECRET: 'whsec_dGVzdA==', IP_HASH_SECRET: 'x', OWNER_EMAIL: ADMIN } },
    { ...common, name: 'admin', routes: ['admin.localhost/*'], scriptPath: path.join(ROOT, 'src/admin.js'),
      bindings: { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ADMIN_EMAILS: ADMIN, REPLY_FROM: '', REPLY_TO: '', RESEND_API_KEY_ADMIN: 're_test' } }
  ]
});
await mf.ready;
const db = await mf.getD1Database('DB', 'public');
for (const s of readFileSync(path.join(ROOT, 'migrations/0001_init.sql'), 'utf8').replace(/--[^\n]*/g, '').split(';').map((x) => x.trim()).filter(Boolean)) await db.prepare(s).run();
const srv = spawn('python3', ['-m', 'http.server', String(SITE_PORT), '--bind', '127.0.0.1'], { cwd: SITE, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const count = async () => (await db.prepare('SELECT COUNT(*) AS n FROM inquiries').first()).n;

const STUB = `window.turnstile = { render: function (el, o) { el.textContent = 'test widget'; setTimeout(function () { o.callback('XXXX.DUMMY.TOKEN.XXXX'); }, 50); return 'w1'; }, reset: function () {} };
  (function () { var m = /onload=([\\w$]+)/.exec(document.currentScript && document.currentScript.src || ''); if (m && window[m[1]]) window[m[1]](); })();`;
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('ag-intro-skip', '1'); } catch (e) {} });
  await ctx.route('https://challenges.cloudflare.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  const BASE = 'http://127.0.0.1:' + SITE_PORT + '/';
  async function fillProject(p, title) {
    await p.click('.chip:has(input[value="cat.embedded"])'); await p.click('[data-next]'); await p.waitForTimeout(120);
    await p.fill('#f-ptitle', title); await p.fill('#f-desc', 'A battery-powered sensor node needs on-device detection. ' + title); await p.click('[data-next]'); await p.waitForTimeout(120);
    await p.click('[data-seg="currency"] [data-v="USD"]'); await p.click('[data-csel="budget"] .csel__btn'); await p.click('[data-csel="budget"] .csel__opt[data-v="bud.usd.2"]'); await p.click('[data-next]'); await p.waitForTimeout(120);
    await p.fill('#f-name', 'Test Person'); await p.fill('#f-email', 'test@example.com'); await p.fill('#f-org', 'Example Lab'); await p.click('[data-next]'); await p.waitForTimeout(250);
    await p.click('.consent:not(.consent--board)');
  }

  // 1 board empty state before any approved activity
  await page.goto(BASE + 'hire.html'); await page.waitForTimeout(800);
  check('board shows the empty state when nothing is approved (no invented activity)', (await page.textContent('[data-board-empty]')).includes('No public inquiry activity'), await page.textContent('[data-board-empty]'));
  check('direct mode: intro, next-step text and submit label describe direct submission', /submit your inquiry directly/i.test(await page.textContent('.demo-pill')) && /binding quotation/i.test(await page.textContent('.side__info')));

  // 2 success, with board opt-in
  await fillProject(page, 'Edge pilot A');
  check('review step shows the spam check and the optional board opt-in', await page.isVisible('[data-turnstile]') && await page.isVisible('.consent--board'));
  check('submit button says "Submit project inquiry"', (await page.textContent('[data-next] .btn__label')).trim() === 'Submit project inquiry');
  await page.click('.consent--board'); await page.waitForTimeout(150);
  await page.click('[data-next]'); await page.waitForSelector('[data-done-direct]:not([hidden])', { timeout: 8000 });
  const ref = (await page.textContent('[data-ref]')).trim();
  const row = await db.prepare('SELECT * FROM inquiries WHERE ref = ?').bind(ref).first();
  check('success is shown only with a stored reference; the row matches', /^AG-/.test(ref) && row && row.board_optin === 1 && JSON.parse(row.fields_json).budget === 'bud.usd.2' && row.notify_status === 'accepted', ref);
  check('confirmation line reflects the service answer ("requested")', (await page.textContent('[data-confirm-line]')).includes('confirmation email has been requested'));
  check('no form content in browser storage', !/Edge pilot|test@example/.test(await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage)))));
  await page.screenshot({ path: path.join(SHOTS, 'direct-success-en.png'), fullPage: true });

  // 3 network failure: entries kept, retry with the same key, no duplicate
  await page.goto(BASE + 'hire.html'); await page.waitForTimeout(600);
  await fillProject(page, 'Edge pilot B');
  await page.route(API + '/v1/inquiries', (r) => r.abort('failed'));
  await page.click('[data-next]'); await page.waitForSelector('[data-submit-status]:not([hidden])');
  check('network failure: "could not confirm" message, retry and email fallback offered, entries still there',
    /could not confirm/i.test(await page.textContent('[data-submit-status]')) && await page.isVisible('[data-retry]') && await page.isVisible('[data-fallback]') && await page.isVisible('[data-review]'));
  await page.unroute(API + '/v1/inquiries');
  // response lost AFTER the service stored it: the next retry must return the same inquiry
  let stored = 0;
  await page.route(API + '/v1/inquiries', async (r) => { const res = await r.fetch(); stored++; await r.abort('failed'); });
  await page.click('[data-retry]'); await page.waitForTimeout(800);
  await page.unroute(API + '/v1/inquiries');
  const before = await count();
  await page.click('[data-retry]'); await page.waitForSelector('[data-done-direct]:not([hidden])', { timeout: 8000 });
  const refB = (await page.textContent('[data-ref]')).trim();
  check('lost response after storage + retry: same inquiry, no duplicate', stored === 1 && (await count()) === before && (await db.prepare("SELECT COUNT(*) AS n FROM inquiries WHERE fields_json LIKE '%Edge pilot B%'").first()).n === 1, refB);

  // 4 rate limit and spam answers
  await page.goto(BASE + 'hire.html'); await page.waitForTimeout(600);
  await fillProject(page, 'Edge pilot C');
  await page.route(API + '/v1/inquiries', (r) => r.fulfill({ status: 429, contentType: 'application/json', body: '{"error":"rate"}', headers: { 'access-control-allow-origin': 'http://127.0.0.1:' + SITE_PORT } }));
  await page.click('[data-next]'); await page.waitForSelector('[data-submit-status]:not([hidden])');
  check('rate limited: "Too many requests" message', /too many requests/i.test(await page.textContent('[data-submit-status]')));
  await page.unroute(API + '/v1/inquiries');
  await page.route(API + '/v1/inquiries', (r) => r.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"spam"}', headers: { 'access-control-allow-origin': 'http://127.0.0.1:' + SITE_PORT } }));
  await page.click('[data-retry]').catch(() => page.click('[data-next]'));
  await page.waitForTimeout(500);
  check('spam check failed: asks to complete the verification again', /complete the verification/i.test(await page.textContent('[data-submit-status]')));
  await page.unroute(API + '/v1/inquiries');

  // 5 Korean and Bengali direct submissions
  await page.goto(BASE + 'ko/hire.html'); await page.waitForTimeout(600);
  await fillProject(page, '엣지 파일럿 한국어');
  check('Korean submit label', (await page.textContent('[data-next] .btn__label')).trim() === '프로젝트 문의 보내기');
  await page.click('[data-next]'); await page.waitForSelector('[data-done-direct]:not([hidden])', { timeout: 8000 });
  check('Korean: received panel in Korean with a reference', (await page.textContent('[data-done-direct]')).includes('문의가 접수되었습니다') && /^AG-/.test((await page.textContent('[data-ref]')).trim()));
  await page.screenshot({ path: path.join(SHOTS, 'direct-success-ko.png'), fullPage: true });
  await page.goto(BASE + 'bn/hire.html?intent=collab'); await page.waitForTimeout(600);
  await page.click('.chip:has(input[value="topic.2"])'); await page.click('[data-next]'); await page.waitForTimeout(120);
  await page.fill('#f-cdesc', 'ছোট রোবটের জন্য অনিশ্চয়তা-সচেতন উপলব্ধি নিয়ে যৌথ গবেষণা। '.repeat(40)); await page.fill('#f-affil', 'বিশ্ববিদ্যালয়'); await page.click('[data-next]'); await page.waitForTimeout(120);
  await page.fill('#f-name', 'ড. পরীক্ষা'); await page.fill('#f-email', 'dr@example.com'); await page.click('[data-next]'); await page.waitForTimeout(250);
  await page.click('.consent:not(.consent--board)'); await page.click('[data-next]'); await page.waitForSelector('[data-done-direct]:not([hidden])', { timeout: 8000 });
  const bnRow = await db.prepare("SELECT * FROM inquiries WHERE lang = 'bn'").first();
  check('Bengali long collaboration inquiry stored intact, reply language Bengali', bnRow && bnRow.reply_lang === 'bn' && JSON.parse(bnRow.fields_json).cdesc.length > 2000 && (await page.textContent('[data-done-direct]')).includes('গ্রহণ করা হয়েছে'));

  // 6 board after approval: anonymous, localized
  await db.prepare('UPDATE inquiries SET board_approved = 1 WHERE board_optin = 1').run();
  await page.goto(BASE + 'ko/hire.html'); await page.waitForTimeout(900);
  const board = await page.textContent('[data-board-list]');
  check('board after approval: one anonymous Korean entry, no personal data', board.includes('비공개 프로젝트 문의') && board.includes('접수 완료') && !/Test Person|Example Lab|Edge pilot|test@example/.test(board), board.trim());
  await page.locator('[data-board]').screenshot({ path: path.join(SHOTS, 'board-ko.png') });

  // 7 dashboard: authentication and safe rendering of hostile content
  await db.prepare('UPDATE inquiries SET name = ? WHERE lang = ?').bind('<img src=x onerror="window.__xss=1">', 'bn').run();
  const anon = await browser.newContext(); const ap = await anon.newPage();
  const resp = await ap.goto('http://admin.localhost:8799/');
  check('dashboard without an Access identity: 401', resp.status() === 401);
  const actx = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'cf-access-jwt-assertion': accessToken() } });
  const dp = await actx.newPage(); const derr = []; dp.on('pageerror', (e) => derr.push(e.message));
  await dp.goto('http://admin.localhost:8799/'); await dp.waitForSelector('#list li');
  const items = await dp.$$eval('#list li', (l) => l.length);
  const listText = await dp.textContent('#list');
  await dp.locator('#list li button', { hasText: '<img src=x' }).click(); await dp.waitForTimeout(500);
  const xss = await dp.evaluate(() => window.__xss);
  check('dashboard lists every inquiry and shows hostile text literally (no script ran, no element created)',
    items === (await count()) && listText.includes('<img src=x') && xss === undefined && (await dp.textContent('#detail')).includes('<img src=x') && (await dp.$$('#detail img')).length === 0, items + ' items');
  await dp.selectOption('#ui-lang', 'ko'); await dp.waitForTimeout(300);
  check('dashboard language switch (Korean labels)', (await dp.textContent('h1')).trim() === '문의함' && !derr.length);
  await dp.screenshot({ path: path.join(SHOTS, 'dashboard-ko.png'), fullPage: true });
} finally {
  await browser.close(); srv.kill(); await mf.dispose();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} e2e checks passed`);
process.exit(failed ? 1 : 0);

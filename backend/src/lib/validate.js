// Server-side validation of a website inquiry. Mirrors the form, but never trusts it: every field is checked against an
// allow-list, a type and a length limit; unknown fields are rejected; option values must be known keys.
export const MAX_BODY_BYTES = 48 * 1024;

const LANGS = ['en', 'ko', 'bn'];
const OPT = {
  scope: ['cat.embedded', 'cat.vision', 'cat.edgeai', 'cat.robotics', 'cat.auto', 'cat.integration', 'cat.consult', 'cat.other'],
  topic: ['topic.1', 'topic.2', 'topic.3', 'topic.4', 'topic.5', 'topic.6'],
  stage: ['opt.notsure', 'stage.idea', 'stage.req', 'stage.proto', 'stage.prod', 'stage.fix'],
  budget: ['bud.discuss', 'bud.krw.1', 'bud.krw.2', 'bud.krw.3', 'bud.krw.4', 'bud.usd.1', 'bud.usd.2', 'bud.usd.3', 'bud.usd.4'],
  currency: ['KRW', 'USD'],
  engage: ['opt.notsure', 'eng.fixed', 'eng.hourly', 'eng.milestone', 'eng.ongoing'],
  start: ['opt.notsure', 'start.asap', 'start.m1', 'start.m3', 'start.later'],
  ctype: ['type.company', 'type.startup', 'type.university', 'type.individual', 'type.other'],
  mtype: ['mt.job', 'mt.network', 'mt.speaking', 'mt.other']
};
// [type, required, max length] per intent; contact fields are shared
const CONTACT = { name: ['text', true, 100], email: ['email', true, 160], replyLang: ['lang', true] };
const SCHEMA = {
  project: { scope: ['multi', true], ptitle: ['text', false, 120], desc: ['long', true, 3000], env: ['text', false, 200], stage: ['opt', false],
             budget: ['opt', false], currency: ['opt', false], engage: ['opt', false], start: ['opt', false], org: ['text', false, 160], ctype: ['opt', false], ...CONTACT },
  collab: { topic: ['multi', true], cdesc: ['long', true, 3000], affil: ['text', true, 160], role: ['text', false, 120], ...CONTACT },
  msg: { mtype: ['opt', false], msg: ['long', true, 3000], ...CONTACT }
};
const OPT_OF = { scope: 'scope', topic: 'topic', stage: 'stage', budget: 'budget', currency: 'currency', engage: 'engage', start: 'start', ctype: 'ctype', mtype: 'mtype' };
// one line, no control characters (also prevents header injection wherever a value reaches an email)
const ONE_LINE = /^[^\u0000-\u001f\u007f\u2028\u2029]*$/;
const LONG_OK = /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/;
// pragmatic address check: one @, no spaces/control chars, a dot in the domain, sane lengths
const EMAIL = /^[^\s@<>()[\]\\,;:"\u0000-\u001f]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function normalizeText(v) {
  return String(v).normalize('NFC').replace(/\r\n?/g, '\n').trim();
}

export function validateInquiry(b) {
  const errors = [];
  const bad = (f) => errors.push(f);
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { errors: ['body'] };
  const allowedTop = ['idemKey', 'intent', 'lang', 'fields', 'brief', 'consent', 'boardOptIn', 'website', 'token'];
  for (const k of Object.keys(b)) if (!allowedTop.includes(k)) bad('unknown:' + k);
  if (typeof b.idemKey !== 'string' || !/^[A-Za-z0-9-]{16,64}$/.test(b.idemKey)) bad('idemKey');
  if (!SCHEMA[b.intent]) return { errors: errors.concat('intent') };
  if (!LANGS.includes(b.lang)) bad('lang');
  if (b.consent !== true) bad('consent');
  if (b.boardOptIn !== undefined && typeof b.boardOptIn !== 'boolean') bad('boardOptIn');
  if (b.website !== undefined && b.website !== '') bad('website');            // honeypot must stay empty
  if (typeof b.token !== 'string' || b.token.length < 10 || b.token.length > 4096) bad('token');
  if (typeof b.brief !== 'string' || !b.brief.trim() || b.brief.length > 12000 || !LONG_OK.test(b.brief)) bad('brief');
  const f = b.fields;
  if (!f || typeof f !== 'object' || Array.isArray(f)) return { errors: errors.concat('fields') };
  const schema = SCHEMA[b.intent], out = {};
  for (const k of Object.keys(f)) if (!schema[k]) bad('unknown:' + k);
  for (const [k, [type, req, max]] of Object.entries(schema)) {
    const v = f[k];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
    if (empty) { if (req) bad(k); continue; }
    if (type === 'text' || type === 'long' || type === 'email') {
      if (typeof v !== 'string') { bad(k); continue; }
      const s = normalizeText(v);
      if (!s && req) { bad(k); continue; }
      if ([...s].length > max) { bad(k); continue; }
      if (type === 'long' ? !LONG_OK.test(s) : !ONE_LINE.test(s)) { bad(k); continue; }
      if (type === 'email' && !EMAIL.test(s)) { bad(k); continue; }
      if (type === 'long' && req && [...s].length < 20) { bad(k); continue; }
      out[k] = type === 'email' ? s.toLowerCase() : s;
    } else if (type === 'lang') {
      if (!LANGS.includes(v)) bad(k); else out[k] = v;
    } else if (type === 'opt') {
      if (typeof v !== 'string' || !OPT[OPT_OF[k]].includes(v)) bad(k); else out[k] = v;
    } else if (type === 'multi') {
      if (!Array.isArray(v) || v.length > OPT[OPT_OF[k]].length || v.some((x) => !OPT[OPT_OF[k]].includes(x)) || new Set(v).size !== v.length) bad(k);
      else out[k] = v;
    }
  }
  if (out.budget && out.budget !== 'bud.discuss') {
    const cur = out.budget.split('.')[1].toUpperCase();
    if (out.currency && out.currency !== cur) bad('currency'); else out.currency = cur;
  }
  return { errors, fields: out, brief: b.brief ? normalizeText(b.brief) : '' };
}

export const OPTIONS = OPT;

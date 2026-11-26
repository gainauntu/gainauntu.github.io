/* Hire me / contact flow, Phase 4F: prepares the inquiry and hands it to the visitor's own email app
   (mailto:) or the clipboard. Nothing is transmitted or stored by the site: there is no fetch, XHR, beacon,
   form action or storage of form contents anywhere in this file. */
(function () {
  'use strict';
  var AG = window.AG, t = AG.t;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var form = $('[data-form]'), flow = $('[data-flow]');
  if (!form) return;

  var STEPS = { project: ['scope', 'details', 'budget', 'contact', 'review'], collab: ['topic', 'cdetails', 'contact', 'review'], msg: ['message', 'contact', 'review'] };
  var STEP_KEY = { scope: 'h.s.scope', details: 'h.s.details', budget: 'h.s.budget', contact: 'h.s.contact', review: 'h.s.review', topic: 'h.s.topic', cdetails: 'h.s.details', message: 'h.s.message' };
  var INTENT_KEY = { project: 'h.i.project', collab: 'h.i.collab', msg: 'h.i.msg' };
  var S = { intent: 'project', idx: 0, reached: 0, visited: {}, currency: 'KRW', sel: { stage: 'opt.notsure', budget: 'bud.discuss', start: 'opt.notsure', ctype: null, reply: 'lang.' + AG.lang(), mtype: null } };

  /* ---------------- custom select ---------------- */
  var OPTS = {
    stage: function () { return ['opt.notsure', 'stage.idea', 'stage.req', 'stage.proto', 'stage.prod', 'stage.fix']; },
    budget: function () { var c = S.currency.toLowerCase(); return ['bud.discuss', 'bud.' + c + '.1', 'bud.' + c + '.2', 'bud.' + c + '.3', 'bud.' + c + '.4']; },
    start: function () { return ['opt.notsure', 'start.asap', 'start.m1', 'start.m3', 'start.later']; },
    ctype: function () { return ['type.company', 'type.startup', 'type.university', 'type.individual', 'type.other']; },
    reply: function () { return ['lang.en', 'lang.ko', 'lang.bn']; },
    mtype: function () { return ['mt.job', 'mt.network', 'mt.speaking', 'mt.other']; }
  };
  var CSEL = {};
  $$('[data-csel]').forEach(function (root) {
    var name = root.getAttribute('data-csel'), lab = root.getAttribute('data-labelledby');
    var bid = 'cs-' + name, lid = 'cl-' + name, focus = -1;
    root.innerHTML = '<button type="button" class="csel__btn" id="' + bid + '" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + lid + '" aria-labelledby="' + lab + ' ' + bid + '"><span class="csel__v"></span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" fill="none" stroke-width="1.4"/></svg></button><ul class="csel__list" role="listbox" id="' + lid + '" aria-labelledby="' + lab + '" tabindex="-1"></ul>';
    var btn = $('.csel__btn', root), list = $('.csel__list', root);
    function render() {
      var opts = OPTS[name](), v = S.sel[name];
      $('.csel__v', btn).textContent = v ? t(v) : t('sel.choose');
      $('.csel__v', btn).classList.toggle('muted', !v);
      list.innerHTML = opts.map(function (k, i) {
        var langAttr = k.indexOf('lang.') === 0 ? ' lang="' + k.slice(5) + '"' : '';
        return '<li class="csel__opt" role="option" id="' + lid + '-' + i + '" data-v="' + k + '" aria-selected="' + (k === v) + '"' + langAttr + '>' + t(k) + '</li>';
      }).join('');
      $$('.csel__opt', list).forEach(function (li, i) {
        li.addEventListener('click', function () { choose(li.getAttribute('data-v')); close(true); });
        li.addEventListener('pointermove', function () { setFocus(i); });
      });
    }
    function setFocus(i) {
      var items = $$('.csel__opt', list); if (!items.length) return;
      focus = (i + items.length) % items.length;
      items.forEach(function (li, k) { li.classList.toggle('is-focus', k === focus); });
      list.setAttribute('aria-activedescendant', items[focus].id);
      items[focus].scrollIntoView({ block: 'nearest' });
    }
    function open() {
      Object.keys(CSEL).forEach(function (k) { if (k !== name) CSEL[k].close(false); });
      root.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true');
      var opts = OPTS[name](); setFocus(Math.max(0, opts.indexOf(S.sel[name])));
      list.focus();
    }
    function close(refocus) { root.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); if (refocus) btn.focus(); }
    function choose(v) { S.sel[name] = v; render(); onChange(name); }
    btn.addEventListener('click', function () { root.classList.contains('is-open') ? close(false) : open(); });
    btn.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } });
    list.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocus(focus + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setFocus(focus - 1); }
      else if (e.key === 'Home') { e.preventDefault(); setFocus(0); }
      else if (e.key === 'End') { e.preventDefault(); setFocus(-1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); var li = $$('.csel__opt', list)[focus]; if (li) choose(li.getAttribute('data-v')); close(true); }
      else if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'Tab') close(false);
    });
    document.addEventListener('click', function (e) { if (!root.contains(e.target)) close(false); });
    CSEL[name] = { render: render, close: close };
    render();
  });

  /* ---------------- radiogroups (intent, currency) ---------------- */
  function radiogroup(group, onPick) {
    var btns = $$('[role="radio"]', group);
    function pick(b, focus) {
      btns.forEach(function (x) { var on = x === b; x.setAttribute('aria-checked', String(on)); x.tabIndex = on ? 0 : -1; });
      if (focus) b.focus();
      onPick(b);
    }
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { pick(b, false); });
      b.addEventListener('keydown', function (e) {
        var d = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
        if (d) { e.preventDefault(); pick(btns[(i + d + btns.length) % btns.length], true); }
      });
    });
    return { pick: function (v) { var b = btns.filter(function (x) { return x.getAttribute('data-intent') === v || x.getAttribute('data-v') === v; })[0]; if (b) pick(b, false); } };
  }
  var intentRG = radiogroup($('.intent__opts'), function (b) { setIntent(b.getAttribute('data-intent')); });
  radiogroup($('[data-seg="currency"]'), function (b) {
    var prev = S.currency; S.currency = b.getAttribute('data-v');
    if (S.sel.budget !== 'bud.discuss' && prev !== S.currency) S.sel.budget = S.sel.budget.replace(prev.toLowerCase(), S.currency.toLowerCase());
    CSEL.budget.render(); onChange('budget');
  });

  /* ---------------- helpers ---------------- */
  function val(n) { var e = form.elements[n]; return e ? (e.value || '').trim() : ''; }
  function checked(n) { return $$('input[name="' + n + '"]:checked', form).map(function (i) { return i.value; }); }
  function steps() { return STEPS[S.intent]; }
  function cur() { return steps()[S.idx]; }
  function trunc(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* ---------------- validation ---------------- */
  function rules(step) {
    var out = [];
    if (step === 'scope' && !checked('scope').length) out.push(['scope', 'v.scope']);
    if (step === 'topic' && !checked('topic').length) out.push(['topic', 'v.topic']);
    if (step === 'details' && val('desc').length < 20) out.push(['desc', 'v.desc']);
    if (step === 'cdetails') { if (val('cdesc').length < 20) out.push(['cdesc', 'v.desc']); if (!val('affil')) out.push(['affil', 'v.affil']); }
    if (step === 'message' && val('msg').length < 2) out.push(['msg', 'v.msg']);
    if (step === 'contact') {
      if (!val('name')) out.push(['name', 'v.name']);
      if (!val('email')) out.push(['email', 'v.emailReq']); else if (!EMAIL.test(val('email'))) out.push(['email', 'v.email']);
    }
    if (step === 'review' && !form.elements.consent.checked) out.push(['consent', 'v.consent']);
    return out;
  }
  function clearErr(name) {
    var p = $('#err-' + name); if (p) { p.hidden = true; p.textContent = ''; }
    var f = form.elements[name]; if (f && f.setAttribute) f.removeAttribute('aria-invalid');
    var g = $('[data-group="' + name + '"]'); if (g) g.classList.remove('is-invalid');
  }
  function showErrs(step, errs) {
    ['scope', 'topic', 'desc', 'cdesc', 'affil', 'msg', 'name', 'email', 'consent'].forEach(clearErr);
    var sum = $('[data-errsum]');
    if (!errs.length) { sum.hidden = true; return; }
    errs.forEach(function (e) {
      var p = $('#err-' + e[0]); if (p) { p.textContent = t(e[1]); p.hidden = false; }
      var f = form.elements[e[0]]; if (f && f.setAttribute) f.setAttribute('aria-invalid', 'true');
      var g = $('[data-group="' + e[0] + '"]'); if (g) g.classList.add('is-invalid');
    });
    sum.innerHTML = '<strong>' + t('v.summary') + '</strong><br>' + errs.map(function (e) { return t(e[1]); }).join('<br>');
    sum.hidden = false;
    var first = errs[0][0], target = $('[data-group="' + first + '"] input') || form.elements[first];
    if (target && target.focus) target.focus();
  }
  // live re-validation once a field has been flagged
  form.addEventListener('input', function (e) {
    var n = e.target.name;
    if (n && (e.target.getAttribute('aria-invalid') === 'true' || $('[data-group="' + n + '"].is-invalid'))) {
      var still = rules(cur()).filter(function (x) { return x[0] === n; });
      if (!still.length) { clearErr(n); if (!rules(cur()).length) $('[data-errsum]').hidden = true; }
    }
    updateBrief();
  });
  form.addEventListener('change', function () { updateBrief(); });

  /* ---------------- steps ---------------- */
  var stepLabel = $('[data-step-label]'), bar = $('[data-step-bar]');
  var backBtn = $('[data-back]', form), nextBtn = $('[data-next]', form);
  function renderProgress() {
    var st = steps();
    stepLabel.textContent = t('h.progress', { a: AG.num(S.idx + 1), b: AG.num(st.length) }) + ' · ' + t(STEP_KEY[cur()]);
    bar.innerHTML = st.map(function (s, i) {
      var cls = i < S.idx ? 'is-done' : i === S.idx ? 'is-current' : '';
      var can = i <= S.reached && i !== S.idx;
      return '<li class="' + cls + '"><button type="button" ' + (can ? '' : 'tabindex="-1" aria-disabled="true"') + ' data-goto="' + i + '"><i></i><span>' + t(STEP_KEY[s]) + '</span></button></li>';
    }).join('');
    $$('[data-goto]', bar).forEach(function (b) {
      b.addEventListener('click', function () { var i = +b.getAttribute('data-goto'); if (i <= S.reached && i !== S.idx) go(i); });
    });
    backBtn.hidden = S.idx === 0;
    var last = S.idx === st.length - 1;
    var sendKey = DIRECT ? (S.intent === 'collab' ? 'btn.submit.collab' : S.intent === 'msg' ? 'btn.submit.general' : 'btn.submit.project')
      : S.intent === 'collab' ? 'btn.send.collab' : S.intent === 'msg' ? 'btn.send.msg' : 'btn.send.project';
    $('.btn__label', nextBtn).textContent = t(last ? sendKey : 'btn.next');
  }
  function show(step, animate) {
    $$('.step', form).forEach(function (fs) { fs.hidden = fs.getAttribute('data-step') !== step; fs.classList.remove('is-entering'); });
    var fs = $('.step[data-step="' + step + '"]', form);
    $$('[data-only]', fs).forEach(function (el) { el.hidden = el.getAttribute('data-only') !== S.intent; });
    if (animate && !AG.RM.matches) { void fs.offsetWidth; fs.classList.add('is-entering'); }
    if (step === 'review') { renderReview(); if (DIRECT) loadTurnstile(); }
    if (step === 'contact') toggleCollabHint();
  }
  function go(i, focus) {
    S.visited[cur()] = true;
    S.idx = i; S.reached = Math.max(S.reached, i);
    $('[data-errsum]').hidden = true;
    show(cur(), true); renderProgress(); updateBrief();
    if (focus !== false) { var lg = $('.step[data-step="' + cur() + '"] .step__q', form); if (lg) lg.focus({ preventScroll: true }); }
    var top = flow.getBoundingClientRect().top + window.scrollY - 110;
    if (window.scrollY > top) window.scrollTo({ top: top, behavior: AG.RM.matches ? 'auto' : 'smooth' });
  }
  nextBtn.addEventListener('click', function () {
    var errs = rules(cur());
    showErrs(cur(), errs);
    if (errs.length) return;
    S.visited[cur()] = true;
    if (S.idx < steps().length - 1) go(S.idx + 1);
    else if (DIRECT) submitDirect();
    else send();
  });
  backBtn.addEventListener('click', function () { if (S.idx > 0) go(S.idx - 1); });

  function setIntent(v) {
    if (!STEPS[v]) return;
    S.intent = v; S.idx = 0; S.reached = 0; S.visited = {};
    showErrs(null, []);
    show(cur(), true); renderProgress(); updateBrief();
  }
  function toggleCollabHint() { var h = $('[data-to-collab]'); h.hidden = !(S.intent === 'project' && S.sel.ctype === 'type.university'); }
  $('[data-switch="collab"]').addEventListener('click', function () { intentRG.pick('collab'); });
  function onChange(name) { if (name === 'ctype') toggleCollabHint(); updateBrief(); }

  /* ---------------- brief + review + email: ONE serialization ----------------
     Every field that belongs to the active intent, with its localized label and the full value. The side
     brief shows the same rows shortened; the review step, the email body and the copied text show them whole.
     Hidden fields of other intents are never included. */
  var briefEl = $('[data-brief]'), lastBrief = {};
  function serialize() {
    var R = [['b.purpose', t(INTENT_KEY[S.intent]), null]];
    if (S.intent === 'project') {
      R.push(['b.scope', checked('scope').map(t).join(', '), 'scope']);
      R.push(['b.ptitle', val('ptitle'), 'details']);
      R.push(['b.desc', val('desc'), 'details']);
      R.push(['b.env', val('env'), 'details']);
      R.push(['b.stage', t(S.sel.stage), 'details']);
      R.push(['b.budget', S.sel.budget === 'bud.discuss' ? t('bud.discuss') : S.currency + ' · ' + t(S.sel.budget), 'budget']);
      R.push(['b.engage', t(checked('engage')[0] || 'opt.notsure'), 'budget']);
      R.push(['b.start', t(S.sel.start), 'budget']);
    } else if (S.intent === 'collab') {
      R.push(['b.topic', checked('topic').map(t).join(', '), 'topic']);
      R.push(['b.desc', val('cdesc'), 'cdetails']);
      R.push(['b.affil', val('affil'), 'cdetails']);
      R.push(['b.role', val('role'), 'cdetails']);
    } else {
      R.push(['b.mtype', S.sel.mtype ? t(S.sel.mtype) : '', 'message']);
      R.push(['b.desc', val('msg'), 'message']);
    }
    R.push(['b.name', val('name'), 'contact']);
    R.push(['b.email', val('email'), 'contact']);
    if (S.intent === 'project') {
      R.push(['b.org', val('org'), 'contact']);
      R.push(['b.ctype', S.sel.ctype ? t(S.sel.ctype) : '', 'contact']);
    }
    R.push(['b.reply', S.sel.reply ? t(S.sel.reply) : '', 'contact']);
    return R;
  }
  function updateBrief() {
    var R = serialize();
    briefEl.innerHTML = R.map(function (r) {
      var v = r[1] ? trunc(r[1], 90) : t('b.empty'), fresh = r[1] && lastBrief[r[0]] !== r[1];
      return '<div class="' + (fresh ? 'is-fresh' : '') + '"><dt>' + esc(t(r[0])) + '</dt><dd class="' + (r[1] ? '' : 'is-empty') + '">' + esc(v) + '</dd></div>';
    }).join('');
    R.forEach(function (r) { lastBrief[r[0]] = r[1]; });
    var st = steps().filter(function (s) { return s !== 'review'; });
    var done = st.filter(function (s) { return (S.visited[s] || steps().indexOf(s) < S.idx) && !rules(s).length; }).length;
    $('[data-brief-n]').textContent = t('b.done', { a: AG.num(done), b: AG.num(st.length) });
    $('[data-brief-bar]').style.transform = 'scaleX(' + (done / st.length).toFixed(3) + ')';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function renderReview() {
    var dl = $('[data-review]');
    dl.innerHTML = serialize().map(function (r) {
      var edit = r[2] ? '<button type="button" data-edit="' + r[2] + '">' + esc(t('btn.edit')) + '<span class="sr-only"> ' + esc(t(r[0])) + '</span></button>' : '<span></span>';
      return '<div><dt>' + esc(t(r[0])) + '</dt><dd class="' + (r[1] ? '' : 'is-empty') + '">' + esc(r[1] || t('b.empty')) + '</dd>' + edit + '</div>';
    }).join('');
    $$('[data-edit]', dl).forEach(function (b) { b.addEventListener('click', function () { go(steps().indexOf(b.getAttribute('data-edit'))); }); });
  }

  /* ---------------- email hand-off (no server, no storage) ----------------
     The visitor's own email app sends the message. The page composes a mailto: link to the configured
     address (content/site.json, contact.email), shows the full text for copying, and never claims delivery. */
  var done = $('[data-done]');
  var MAX_URL = 1900;                            // conservative limit for mailto: across browsers and mail apps
  function oneLine(s) { return String(s).replace(/[\r\n\u2028\u2029]+/g, ' ').replace(/\s{2,}/g, ' ').trim(); }
  function compose() {
    var R = serialize().filter(function (r) { return r[1]; });
    var body = [t('mail.intro'), ''];
    R.forEach(function (r) {
      var v = String(r[1]).replace(/\r\n?/g, '\n');
      if (v.indexOf('\n') > -1 || v.length > 70) body.push(t(r[0]) + ':', v, '');
      else body.push(t(r[0]) + ': ' + v);
    });
    var subject = oneLine(t(INTENT_KEY[S.intent]) + ' · ' + val('name')).slice(0, 140);
    var to = (window.AG.fact && AG.fact('contact.email')) || '';
    var text = body.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    var full = 'mailto:' + encodeURIComponent(to).replace(/%40/g, '@') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text.replace(/\n/g, '\r\n'));
    var short = 'mailto:' + encodeURIComponent(to).replace(/%40/g, '@') + '?subject=' + encodeURIComponent(subject);
    var tooLong = full.length > MAX_URL;
    return { to: to, subject: subject, text: text, href: tooLong ? short : full, tooLong: tooLong };
  }
  var mail = null;
  function send() {
    mail = compose();
    $('[data-mail-subject]').textContent = mail.subject;
    $('[data-mail-brief]').value = mail.text;
    $('[data-mail-long]').hidden = !mail.tooLong;
    var open = $('[data-mail-open]'); open.setAttribute('href', mail.href);
    // too long for the link: the main button copies the full brief first, then opens the subject-only email
    var lbl = $('.btn__label', open), key = mail.tooLong ? 'mail.copyopen' : 'mail.open';
    lbl.setAttribute('data-i18n', key); lbl.textContent = t(key);
    $('[data-copy-status]').textContent = '';
    form.hidden = true; $('.flow__progress').hidden = true;
    done.hidden = false; done.focus();
    // short brief: open the visitor's email app now (this runs inside the click); if none is set up, nothing
    // happens and the brief stays on screen to copy. Long brief: wait until the visitor copies it.
    if (!mail.tooLong) { try { open.click(); } catch (e) {} }
  }
  function copyBrief() {
    var ta = $('[data-mail-brief]'), status = $('[data-copy-status]'), ok = t(mail && mail.tooLong ? 'copy.okpaste' : 'copy.ok');
    function fail() { status.textContent = t('copy.fail'); ta.focus(); ta.select(); }
    if (!mail) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(mail.text).then(function () { status.textContent = ok; }, fail);
      } else {
        ta.focus(); ta.select();
        if (document.execCommand && document.execCommand('copy')) status.textContent = ok; else fail();
      }
    } catch (e) { fail(); }
  }
  $('[data-copy]').addEventListener('click', copyBrief);
  // the copy starts inside the click; the link's own navigation then opens the email app (the page stays)
  $('[data-mail-open]').addEventListener('click', function () { if (mail && mail.tooLong) copyBrief(); });
  $('[data-edit-again]').addEventListener('click', function () {
    done.hidden = true; form.hidden = false; $('.flow__progress').hidden = false;
    go(steps().length - 1);
  });
  $$('[data-restart]').forEach(function (rb) { rb.addEventListener('click', function () {
    form.reset(); mail = null; $('[data-mail-brief]').value = '';
    S.sel = { stage: 'opt.notsure', budget: 'bud.discuss', start: 'opt.notsure', ctype: null, reply: 'lang.' + AG.lang(), mtype: null };
    Object.keys(CSEL).forEach(function (k) { CSEL[k].render(); });
    done.hidden = true; doneDirect.hidden = true; form.hidden = false; $('.flow__progress').hidden = false; lastBrief = {};
    attempt = null; statusMsg(null); if (window.turnstile && tsWidget !== null) { try { turnstile.reset(tsWidget); } catch (e) {} } tsToken = '';
    setIntent(S.intent);
    var lg = $('.step:not([hidden]) .step__q', form); if (lg) lg.focus();
  }); });


  /* ---------------- direct submission (Phase 5) ----------------
     Active only when content/site.json inquiry.apiBase AND inquiry.turnstileSiteKey are set; otherwise the email
     hand-off above stays the only path. Success is shown only after the inquiry service answers that it stored the
     inquiry. A retry reuses the same attempt key (and the same bot-check token), so a timeout cannot create a duplicate.
     Nothing typed is written to browser storage. */
  var INQ = (window.AG_SITE && AG_SITE.inquiry) || {};
  var DIRECT = !!(INQ.apiBase && INQ.turnstileSiteKey);
  var doneDirect = $('[data-done-direct]');
  var attempt = null, tsToken = '', tsWidget = null, tsLoading = false, submitting = false;
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = crypto.getRandomValues(new Uint8Array(16)); return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }
  function statusMsg(key, retry) {
    var el = $('[data-submit-status]'), acts = $('[data-submit-actions]');
    el.hidden = !key; el.textContent = key ? t(key) : ''; el.classList.toggle('is-err', !!key);
    acts.hidden = !retry;
  }
  function loadTurnstile() {
    if (tsWidget !== null || tsLoading) return;
    var mount = $('[data-turnstile]'); if (!mount) return;
    function render() {
      tsWidget = turnstile.render(mount, {
        sitekey: INQ.turnstileSiteKey, action: 'inquiry', language: AG.lang() === 'bn' ? 'auto' : AG.lang(),
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'auto',
        callback: function (tok) { tsToken = tok; if (!$('[data-submit-status]').hidden && $('[data-submit-status]').textContent === t('s.spam')) statusMsg(null); },
        'expired-callback': function () { tsToken = ''; }, 'error-callback': function () { tsToken = ''; }
      });
    }
    if (window.turnstile) { render(); return; }
    tsLoading = true;
    window.__agTsReady = function () { tsLoading = false; render(); };
    var sc = document.createElement('script');
    sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__agTsReady';
    sc.async = true; sc.defer = true;
    sc.onerror = function () { tsLoading = false; statusMsg('h.direct.unavailable', true); $('[data-retry]').hidden = true; };
    document.head.appendChild(sc);
  }
  function payload() {
    var f = {}, put = function (k, v) { if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) f[k] = v; };
    if (S.intent === 'project') {
      put('scope', checked('scope')); put('ptitle', val('ptitle')); put('desc', val('desc')); put('env', val('env')); put('stage', S.sel.stage);
      put('budget', S.sel.budget); if (S.sel.budget !== 'bud.discuss') put('currency', S.currency);
      put('engage', checked('engage')[0] || 'opt.notsure'); put('start', S.sel.start); put('org', val('org')); put('ctype', S.sel.ctype);
    } else if (S.intent === 'collab') {
      put('topic', checked('topic')); put('cdesc', val('cdesc')); put('affil', val('affil')); put('role', val('role'));
    } else { put('mtype', S.sel.mtype); put('msg', val('msg')); }
    put('name', val('name')); put('email', val('email'));
    f.replyLang = (S.sel.reply || 'lang.' + AG.lang()).replace('lang.', '');
    return f;
  }
  function submitDirect() {
    if (submitting) return;
    var brief = compose().text;
    // a changed brief is a new attempt; an unchanged one keeps its key so the service can recognise a retry
    if (!attempt || attempt.brief !== brief) attempt = { key: uuid(), brief: brief };
    if (!tsToken) { statusMsg('s.spam'); return; }
    submitting = true; statusMsg(null);
    $('.btn__label', nextBtn).textContent = t('btn.submitting'); nextBtn.setAttribute('aria-busy', 'true'); nextBtn.disabled = true;
    var ctl = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ctl) ctl.abort(); }, 20000);
    var body = { idemKey: attempt.key, intent: S.intent, lang: AG.lang(), fields: payload(), brief: brief, consent: true,
      boardOptIn: !!(form.elements.boardOptIn && form.elements.boardOptIn.checked), website: '', token: tsToken };
    fetch(INQ.apiBase.replace(/\/$/, '') + '/v1/inquiries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined, credentials: 'omit' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (res) {
        if ((res.status === 201 || res.status === 200) && res.d.ok && res.d.ref) return received(res.d);
        if (res.status === 429) return statusMsg('s.rate', true);
        if (res.status === 403 && res.d.error === 'spam') { tsToken = ''; try { turnstile.reset(tsWidget); } catch (e) {} attempt = null; return statusMsg('s.spam'); }
        if (res.status === 400) { attempt = null; return statusMsg('s.error', true); }
        statusMsg('s.unknown', true);            // 5xx or anything unexpected: outcome unknown; retry keeps the same key
      })
      .catch(function () { statusMsg('s.unknown', true); })
      .then(function () {
        clearTimeout(timer); submitting = false; nextBtn.disabled = false; nextBtn.removeAttribute('aria-busy'); renderProgress();
      });
  }
  function received(d) {
    form.hidden = true; $('.flow__progress').hidden = true;
    $('[data-ref]', doneDirect).textContent = d.ref;
    var cl = $('[data-confirm-line]', doneDirect);
    cl.hidden = d.confirmation === 'off' || !d.confirmation;
    cl.textContent = d.confirmation === 'requested' ? t('s.confirm.sent') : d.confirmation === 'failed' ? t('s.confirm.unavailable') : '';
    doneDirect.hidden = false; doneDirect.focus();
    attempt = null; tsToken = '';
    loadBoard();
  }
  if (DIRECT) {
    document.documentElement.classList.add('inq-direct');
    $$('[data-direct-only]').forEach(function (el) { el.hidden = false; });
    var pill = $('.demo-pill'); if (pill) { pill.setAttribute('data-i18n', 'h.direct.intro'); pill.textContent = t('h.direct.intro'); }
    var bd = $('.brief__demo'); if (bd) bd.hidden = true;
    var np = $('[data-i18n="h.next.p"]'); if (np) { np.setAttribute('data-i18n', 'h.direct.next'); np.textContent = t('h.direct.next'); }
    $('[data-retry]').addEventListener('click', function () { submitDirect(); });
    $('[data-fallback]').addEventListener('click', function () { statusMsg(null); send(); });
  }

  /* ---------------- anonymous board: only what the inquiry service publishes (opted-in and approved) ---------------- */
  var BOARD_TYPE = { project: 'board.private.project', collab: 'board.private.research', msg: 'board.private.general' };
  var BOARD_STATUS = { received: 'board.received', pending: 'board.pending', replied: 'board.replied' };
  var boardData = null;
  function renderBoard() {
    var list = $('[data-board-list]'), empty = $('[data-board-empty]'); if (!list) return;
    list.textContent = '';
    if (boardData === 'error') { empty.hidden = false; empty.textContent = t('board.unavailable'); return; }
    if (!boardData) { empty.hidden = false; empty.textContent = t('board.loading'); return; }
    empty.hidden = boardData.length > 0; empty.textContent = boardData.length ? '' : t('board.empty');
    boardData.forEach(function (x) {
      if (!BOARD_TYPE[x.type] || !BOARD_STATUS[x.status] || !/^\d{4}-\d{2}$/.test(x.month)) return;
      var li = document.createElement('li'), a = document.createElement('span'), b = document.createElement('span'), m = document.createElement('span');
      a.className = 'board__type'; a.textContent = t(BOARD_TYPE[x.type]);
      m.className = 'board__month';
      try { m.textContent = new Date(x.month + '-15T00:00:00Z').toLocaleDateString(AG.lang() === 'bn' ? 'bn-BD' : AG.lang() === 'ko' ? 'ko-KR' : 'en-GB', { year: 'numeric', month: 'short', timeZone: 'UTC' }); } catch (e) { m.textContent = x.month; }
      b.className = 'board__st board__st--' + x.status; b.textContent = t(BOARD_STATUS[x.status]);
      li.appendChild(a); li.appendChild(m); li.appendChild(b); list.appendChild(li);
    });
  }
  function loadBoard() {
    if (!DIRECT) return;
    renderBoard();
    fetch(INQ.apiBase.replace(/\/$/, '') + '/v1/board', { credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('board'); return r.json(); })
      .then(function (d) { boardData = Array.isArray(d.items) ? d.items : []; renderBoard(); })
      .catch(function () { boardData = 'error'; renderBoard(); });
  }
  loadBoard();
  document.addEventListener('ag:lang', renderBoard);

  /* ---------------- init ---------------- */
  var q = (location.search.match(/intent=(\w+)/) || [])[1];
  if (q === 'collab' || q === 'msg') { intentRG.pick(q); } else { show(cur(), false); renderProgress(); updateBrief(); }
  document.addEventListener('ag:lang', function () {
    Object.keys(CSEL).forEach(function (k) { CSEL[k].render(); });
    renderProgress(); updateBrief(); if (cur() === 'review') renderReview();
    if (!done.hidden && mail) send();
    var errs = $('[data-errsum]'); if (!errs.hidden) showErrs(cur(), rules(cur()));
  });
})();

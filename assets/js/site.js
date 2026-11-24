/* Auntu Gain, Phase 4E: shared runtime.
   i18n and facts · flags · language menu · theme switch · header, nav indicator and floating menu button ·
   menu panel (focus trap) · preferences · reveals · greeting intro and hero hand-off · pointer light.
   Text lives in the generated dictionaries (assets/js/i18n/*.js, built from content/i18n/*.json) and
   facts in AG_SITE (assets/js/data/site.js, built from content/site.json). */
(function () {
  'use strict';
  var D = window.AG_DICT || {};
  var SITE = window.AG_SITE || {};
  var LANGS = ['en', 'ko', 'bn'];
  var NAMES = { en: 'English', ko: '한국어', bn: 'বাংলা' };
  var FLAG = { en: 'gb', ko: 'kr', bn: 'bd' };
  var root = document.documentElement;
  root.classList.add('js-ok');
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)');
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------------- flags: one inline sprite, drawn from the national flag specifications ---------------- */
  var SPRITE = '<svg class="flag-sprite" aria-hidden="true" focusable="false" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden">' +
    '<symbol id="flag-gb" viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice"><clipPath id="fgb-c"><rect width="60" height="30"/></clipPath><clipPath id="fgb-t"><path d="M30,15h30v15zv15h-30zh-30v-15zv-15h30z"/></clipPath>' +
    '<g clip-path="url(#fgb-c)"><rect width="60" height="30" fill="#012169"/><path d="M0,0L60,30M60,0L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0L60,30M60,0L0,30" clip-path="url(#fgb-t)" stroke="#C8102E" stroke-width="4"/>' +
    '<path d="M30,0v30M0,15h60" stroke="#fff" stroke-width="10"/><path d="M30,0v30M0,15h60" stroke="#C8102E" stroke-width="6"/></g></symbol>' +
    '<symbol id="flag-kr" viewBox="-36 -24 72 48" preserveAspectRatio="xMidYMid slice"><rect x="-36" y="-24" width="72" height="48" fill="#fff"/>' +
    '<g transform="rotate(33.69)"><circle r="12" fill="#0047A0"/><path d="M-12,0A12,12 0 0 1 12,0Z" fill="#CD2E3A"/><circle cx="-6" r="6" fill="#CD2E3A"/><circle cx="6" r="6" fill="#0047A0"/>' +
    '<g fill="#000"><rect x="-26" y="-6" width="2" height="12"/><rect x="-23" y="-6" width="2" height="12"/><rect x="-20" y="-6" width="2" height="12"/>' +
    '<rect x="18" y="-6" width="2" height="5.5"/><rect x="18" y=".5" width="2" height="5.5"/><rect x="21" y="-6" width="2" height="5.5"/><rect x="21" y=".5" width="2" height="5.5"/><rect x="24" y="-6" width="2" height="5.5"/><rect x="24" y=".5" width="2" height="5.5"/></g></g>' +
    '<g transform="rotate(-33.69)" fill="#000"><rect x="18" y="-6" width="2" height="5.5"/><rect x="18" y=".5" width="2" height="5.5"/><rect x="21" y="-6" width="2" height="12"/><rect x="24" y="-6" width="2" height="5.5"/><rect x="24" y=".5" width="2" height="5.5"/>' +
    '<rect x="-26" y="-6" width="2" height="12"/><rect x="-23" y="-6" width="2" height="5.5"/><rect x="-23" y=".5" width="2" height="5.5"/><rect x="-20" y="-6" width="2" height="12"/></g></symbol>' +
    '<symbol id="flag-bd" viewBox="0 0 10 6" preserveAspectRatio="xMidYMid slice"><rect width="10" height="6" fill="#006A4E"/><circle cx="4.5" cy="3" r="2" fill="#F42A41"/></symbol></svg>';
  document.body.insertAdjacentHTML('afterbegin', SPRITE);
  function flag(l) { return '<svg class="flag" aria-hidden="true" focusable="false"><use href="#flag-' + FLAG[l] + '"/></svg>'; }
  $$('[data-flag]').forEach(function (el) { el.insertAdjacentHTML('afterbegin', flag(el.getAttribute('data-flag'))); });

  /* ---------------- facts (one source: content/site.json) ---------------- */
  var PAGE_ROOT = root.getAttribute('data-root') || '';
  function fact(path) { return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, SITE); }
  function applyFacts(scope) {
    $$('[data-fact]', scope).forEach(function (el) { var v = fact(el.getAttribute('data-fact')); if (v != null) el.textContent = v; });
    $$('[data-fact-href]', scope).forEach(function (el) {
      var v = fact(el.getAttribute('data-fact-href'));
      if (v != null) el.setAttribute('href', /^([a-z]+:|\/|#)/.test(v) ? v : PAGE_ROOT + v);   // site-relative facts (the CV) work from subfolders
    });
    $$('[data-show-if]', scope).forEach(function (el) { el.hidden = !fact(el.getAttribute('data-show-if')); });
  }

  /* ---------------- i18n ---------------- */
  var lang = LANGS.indexOf(root.lang) > -1 ? root.lang : 'en';
  function t(key, vars) {
    var row = D[key];
    if (!row) { if (window.console) console.warn('[i18n] missing key', key); return key; }
    var s = row[LANGS.indexOf(lang)];
    if (s == null || (s === '' && lang !== 'en' && row[0] !== '')) s = row[0];
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function num(n, opts) {
    var loc = lang === 'bn' ? 'bn-BD' : lang === 'ko' ? 'ko-KR' : 'en-GB';
    try { return new Intl.NumberFormat(loc, opts).format(n); } catch (e) { return String(n); }
  }
  // project titles: the English title is the identifier; the localized title follows it
  function renderTitle(el) {
    var k = el.getAttribute('data-ptitle') + '.title';
    var en = D[k] ? D[k][0] : k;
    if (lang === 'en') { el.innerHTML = '<span class="pt">' + en + '</span>'; return; }
    el.innerHTML = '<span class="pt" lang="en">' + en + '</span><span class="pt-loc">' + t(k) + '</span>';
  }
  function apply() {
    root.lang = lang;
    $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    $$('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    $$('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var p = pair.split(':'); if (p.length === 2) el.setAttribute(p[0].trim(), t(p[1].trim()));
      });
    });
    $$('[data-ptitle]').forEach(renderTitle);
    $$('[data-lang-set]').forEach(function (b) { b.setAttribute('aria-current', String(b.getAttribute('data-lang-set') === lang)); });
    $$('[data-lang-current]').forEach(function (el) { el.textContent = NAMES[lang]; el.setAttribute('lang', lang); });
    $$('[data-lang-code]').forEach(function (el) { el.textContent = lang.toUpperCase(); });
    $$('[data-flag-current] use').forEach(function (u) { u.setAttribute('href', '#flag-' + FLAG[lang]); });
    var tk = root.getAttribute('data-title-key'); if (tk && D[tk]) document.title = t(tk);
    applyFacts(document);
    themeLabels();
    document.dispatchEvent(new CustomEvent('ag:lang', { detail: { lang: lang } }));
  }
  // Phase 4F: every page exists in each language at its own URL (/, /ko/, /bn/). Switching opens the
  // equivalent page, keeping the section (#hash) and the form intent (?intent=), never form contents.
  function setLang(l) {
    if (LANGS.indexOf(l) < 0 || l === lang) return false;
    var alt = root.getAttribute('data-alt-' + l);
    if (!alt) { lang = l; apply(); return false; }
    var q = (location.search.match(/[?&]intent=(project|collab|msg)\b/) || [])[0];
    try { localStorage.setItem('ag-lang', l); sessionStorage.setItem('ag-nav', String(Date.now())); } catch (e) {}
    location.href = alt + (q ? '?' + q.slice(1) : '') + location.hash;
    return true;
  }
  /* ---------------- theme: light (coastal, warm) or dark. Until the visitor chooses, the CSS follows
     prefers-color-scheme with no script at all; a choice is saved and applied by the inline head script
     before first paint, so there is no flash on refresh or navigation. ---------------- */
  var DARK = window.matchMedia('(prefers-color-scheme: dark)');
  function theme() { var a = root.getAttribute('data-theme'); return a === 'dark' || a === 'light' ? a : (DARK.matches ? 'dark' : 'light'); }
  function themeLabels() {
    var k = theme() === 'dark' ? 'theme.toLight' : 'theme.toDark';
    $$('[data-theme-toggle]').forEach(function (b) {
      b.setAttribute('aria-label', D[k] ? t(k) : k); b.setAttribute('title', D[k] ? t(k) : k);
      b.setAttribute('data-theme-now', theme());
    });
    var tc = theme() === 'dark' ? '#11171B' : '#F5F0E6';
    $$('meta[name="theme-color"]').forEach(function (m) { m.setAttribute('content', tc); });
  }
  function setTheme(v) {
    root.classList.add('theme-switching');
    root.setAttribute('data-theme', v);
    try { localStorage.setItem('ag-theme', v); } catch (e) {}
    themeLabels();
    // colours change in one step (no 300 ms transitions racing across the page), then transitions return
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove('theme-switching'); }); });
    document.dispatchEvent(new CustomEvent('ag:theme', { detail: { theme: v } }));
  }
  $$('[data-theme-toggle]').forEach(function (b) { b.addEventListener('click', function () { setTheme(theme() === 'dark' ? 'light' : 'dark'); }); });
  if (DARK.addEventListener) DARK.addEventListener('change', themeLabels);

  window.AG = { t: t, num: num, lang: function () { return lang; }, setLang: setLang, RM: RM, FINE: FINE, fact: fact, applyFacts: applyFacts, theme: theme, setTheme: setTheme };

  /* language dropdown */
  $$('.lang').forEach(function (box) {
    var btn = $('.lang__btn', box), list = $('.lang__list', box);
    var opts = $$('.lang__opt', list);
    function open(focusFirst) {
      list.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true');
      var cur = opts.filter(function (o) { return o.getAttribute('data-lang-set') === lang; })[0] || opts[0];
      if (focusFirst) cur.focus();
    }
    function close(refocus) { list.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); if (refocus) btn.focus(); }
    btn.addEventListener('click', function () { list.classList.contains('is-open') ? close(false) : open(false); });
    btn.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { e.preventDefault(); open(true); } });
    list.addEventListener('keydown', function (e) {
      var i = opts.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); opts[(i + 1) % opts.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); opts[(i - 1 + opts.length) % opts.length].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'Tab') close(false);
    });
    opts.forEach(function (o) { o.addEventListener('click', function (e) { e.preventDefault(); close(true); setLang(o.getAttribute('data-lang-set')); }); });
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) close(false); });
  });
  $$('.menu__langs [data-lang-set]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); setLang(b.getAttribute('data-lang-set')); }); });

  /* ---------------- menu panel (opened from the header button or the floating button) ---------------- */
  var menu = $('.menu'), opener = null;
  var openers = $$('.menu-btn, .fab');
  function menuOpen() { return menu && menu.classList.contains('is-open'); }
  if (menu) {
    var closeBtn = $('.menu__close', menu);
    var focusables = function () { return $$('a[href], button:not([disabled])', menu).filter(function (el) { return el.offsetParent !== null || el === closeBtn; }); };
    var openMenu = function (from) {
      opener = from || openers[0];
      menu.classList.add('is-open'); menu.removeAttribute('inert');
      openers.forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
      root.classList.add('menu-open');
      document.body.style.overflow = 'hidden';
      setTimeout(function () { closeBtn.focus(); }, 80);
    };
    var closeMenu = function (refocus) {
      menu.classList.remove('is-open'); menu.setAttribute('inert', '');
      openers.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      root.classList.remove('menu-open');
      document.body.style.overflow = '';
      if (refocus !== false && opener && opener.getClientRects().length) opener.focus();
    };
    menu.setAttribute('inert', '');
    openers.forEach(function (b) { b.addEventListener('click', function () { if (menuOpen()) closeMenu(); else openMenu(b); }); });
    closeBtn.addEventListener('click', function () { closeMenu(); });
    var scrim = $('.menu__scrim', menu);
    if (scrim) scrim.addEventListener('click', function () { closeMenu(); });
    menu.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
      if (e.key !== 'Tab') return;
      var f = focusables(), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    $$('.menu__nav a', menu).forEach(function (a) { a.addEventListener('click', function () { closeMenu(false); }); });
  }

  /* ---------------- preference: smooth (eased) wheel scrolling or the browser's own; saved, reversible ---------------- */
  function smoothPref() { try { return localStorage.getItem('ag-scroll') !== 'native'; } catch (e) { return true; } }
  function syncSmooth() { $$('[data-smooth-toggle]').forEach(function (b) { b.setAttribute('aria-checked', String(smoothPref())); }); }
  $$('[data-smooth-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var on = !smoothPref();
      try { if (on) localStorage.removeItem('ag-scroll'); else localStorage.setItem('ag-scroll', 'native'); } catch (e) {}
      if (window.AG.motion && window.AG.motion.setNative) window.AG.motion.setNative(!on);
      syncSmooth();
    });
  });
  syncSmooth();

  /* in-site navigation is remembered for a moment, so the homepage greeting plays on arrival and refresh but not
     when someone comes back to the homepage from a case study */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || e.defaultPrevented) return;
    var h = a.getAttribute('href');
    if (!h || h.charAt(0) === '#' || /^(mailto|tel|https?):/i.test(h) && a.host !== location.host) return;
    try { sessionStorage.setItem('ag-nav', String(Date.now())); } catch (err) {}
  }, true);

  /* ---------------- floating menu button + progress ring (runs on the shared ticker; no layout reads) ---------------- */
  function initFab() {
    var fab = $('.fab'), ring = fab && $('.fab__ring circle', fab), head = $('.site-head'), M = window.AG.motion;
    if (!fab || !M) return;
    var CIRC = 2 * Math.PI * 30.5, shown = false, lastOff = '', limit = 320;
    if (ring) ring.style.strokeDasharray = CIRC.toFixed(2);
    var measure = function () { limit = Math.max(320, (head ? head.offsetHeight : 80) + M.S.vh * 0.35); };
    measure(); M.onMeasure(measure);
    var tick = function () {
      var y = M.S.y, show = y > limit;
      if (show !== shown) { shown = show; fab.classList.toggle('is-shown', show); }
      if (ring && shown) {
        var off = (CIRC * (1 - Math.min(1, y / Math.max(1, M.S.max)))).toFixed(1);
        if (off !== lastOff) { ring.style.strokeDashoffset = off; lastOff = off; }
      }
      return false;
    };
    M.add(tick);
    window.addEventListener('scroll', function () { M.wake(); }, { passive: true });
  }

  /* ---------------- nav indicator: one dot glides between links and stretches while it travels ---------------- */
  function initNav() {
    var nav = $('.site-head .nav'), M = window.AG.motion;
    if (!nav || !M) return;
    var ind = document.createElement('span'); ind.className = 'nav__ind'; ind.setAttribute('aria-hidden', 'true'); nav.appendChild(ind);
    var links = $$('a', nav), hover = null, on = false;
    var current = links.filter(function (a) { return a.getAttribute('aria-current') === 'page'; })[0] || null;
    var st = { x: 0, w: 6, tx: 0, vis: 0, tvis: 0 };
    var target = function (a) {
      if (!a) { st.tvis = 0; return; }
      st.tx = a.offsetLeft + a.offsetWidth / 2; st.tvis = 1;
      if (st.vis < 0.05) st.x = st.tx;
    };
    var step = function (dt) {
      var px = st.x;
      if (RM.matches) { st.x = st.tx; st.w = 6; st.vis = st.tvis; }
      else {
        st.x = M.damp(st.x, st.tx, 13, dt);
        var speed = Math.abs(st.x - px) / Math.max(dt, 0.001);
        st.w = M.damp(st.w, 6 + Math.min(30, speed * 0.045), 16, dt);
        st.vis = M.damp(st.vis, st.tvis, 12, dt);
      }
      ind.style.transform = 'translate3d(' + (st.x - st.w / 2).toFixed(2) + 'px,0,0) scale(' + (0.3 + st.vis * 0.7).toFixed(3) + ')';
      ind.style.width = st.w.toFixed(2) + 'px';
      ind.style.opacity = st.vis.toFixed(3);
      var moving = Math.abs(st.tx - st.x) > 0.2 || Math.abs(st.w - 6) > 0.2 || Math.abs(st.tvis - st.vis) > 0.01;
      if (!moving) { on = false; M.remove(step); }
      return moving;
    };
    var go = function () { if (!on) { on = true; M.add(step); } else M.wake(); };
    links.forEach(function (a) {
      a.addEventListener('pointerenter', function () { hover = a; target(a); go(); });
      a.addEventListener('focus', function () { hover = a; target(a); go(); });
      a.addEventListener('blur', function () { hover = null; target(current); go(); });
    });
    nav.addEventListener('pointerleave', function () { hover = null; target(current); go(); });
    var settle = function () { target(hover || current); go(); };
    settle();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
    document.addEventListener('ag:lang', function () { requestAnimationFrame(settle); });
    window.addEventListener('resize', settle);
  }

  /* scroll-spy for the header and the menu panel: shows where you are */
  var spyLinks = $$('.menu__nav a[href^="#"], .site-head .nav a[href^="#"]');
  if (spyLinks.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        spyLinks.forEach(function (a) { a.classList.toggle('is-here', a.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    var seen = {};
    spyLinks.forEach(function (a) { var id = a.getAttribute('href').slice(1); if (seen[id]) return; seen[id] = 1; var s = document.getElementById(id); if (s) spy.observe(s); });
  }

  /* ---------------- reveals (the hero is choreographed separately) ---------------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 }) : null;
  function observe(scope) {
    $$('[data-reveal], [data-split]', scope).forEach(function (el) {
      if (el.closest('[data-hero]') || el.classList.contains('is-in')) return;
      if (io) io.observe(el); else el.classList.add('is-in');
    });
  }
  window.AG.observe = observe;

  /* ---------------- greeting intro, then the hero ----------------
     Phase 4E: plays on every reload and every arrival from outside the site (4D played it once per
     tab: a sessionStorage flag set on the first load suppressed every refresh). Decided before first
     paint by the head script: reload or external arrival = full, deep link (#section) = one word,
     in-site link, back/forward, "Skip intro" in this tab or reduced motion = none.
     Full (4F): three words, played strictly one after another (enter 170 ms, hold 150 ms, leave 130 ms):
     one of eight extra greetings, one other site language, the visitor's own language last. Overlay gone
     about 1.8-1.9 s after DOMContentLoaded (about 1.0 s for the one-word deep-link version).
     Any key, click, wheel or touch fast-forwards it; Skip also keeps it off for this tab. */
  var EXTRA = [['zh', '你好'], ['ja', 'こんにちは'], ['es', 'Hola'], ['fr', 'Bonjour'], ['ar', 'مرحباً'], ['hi', 'नमस्ते'], ['de', 'Hallo'], ['pt', 'Olá']];
  var heroStarted = false;
  function startHero() {
    if (heroStarted) return;
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function () { requestAnimationFrame(startHero); }); return; }
    heroStarted = true;
    $$('[data-hero] [data-reveal], [data-hero] [data-split]').forEach(function (el) { el.classList.add('is-in'); });
    root.classList.add('hero-ready');
  }
  window.AG.startHero = startHero;
  var intro = $('div.intro'), skipBtn = $('[data-intro-skip]');
  function dropIntro() {
    if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
    if (skipBtn && skipBtn.parentNode) skipBtn.parentNode.removeChild(skipBtn);
    root.classList.remove('ag-intro', 'ag-intro--full', 'ag-intro--short', 'ag-intro-out');
  }
  if (intro && root.classList.contains('ag-intro')) {
    var full = root.classList.contains('ag-intro--full');
    var mask = $('.intro__mask', intro);
    var n = 0;
    try { n = (+localStorage.getItem('ag-intro-n') || 0); if (full) localStorage.setItem('ag-intro-n', String(n + 1)); } catch (e) {}
    var core = $$('.intro__w', intro);
    var mine = core.filter(function (w) { return w.lang === lang; })[0] || core[0];
    var others = core.filter(function (w) { return w !== mine; });
    var seq = [mine];
    if (full) {
      // Phase 4F: three readable words. One of the eight extra greetings (all eight over eight visits), one of the
      // other two site languages (alternating, so English, Korean and Bengali all keep appearing), the visitor's last.
      var g = EXTRA[n % EXTRA.length];
      var ex = document.createElement('span'); ex.className = 'intro__w'; ex.lang = g[0]; ex.textContent = g[1];
      if (g[0] === 'ar') ex.dir = 'rtl';
      mask.appendChild(ex);
      seq = [ex, others[n % 2], mine];
    }
    core.forEach(function (w) { if (seq.indexOf(w) < 0) mask.removeChild(w); });
    // Strictly sequential: a word enters, holds, leaves, and only when it has left does the next one enter.
    // The mask shows one slot, so at most one word is legible in any frame (4E overlapped them: 270-290 ms steps
    // against 520 ms entrances and 380 ms exits in the same grid cell).
    var ENTER = 170, HOLD = 150, EXIT = 130, LAST = 190;
    var timers = [], done = false;
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    var finish = function (skip) {
      if (done) return; done = true;
      timers.forEach(clearTimeout); timers = [];
      if (skip === true) { try { sessionStorage.setItem('ag-intro-skip', '1'); } catch (e) {} }
      intro.classList.add('is-out'); root.classList.add('ag-intro-out'); window.__agIntroOut = performance.now();
      setTimeout(startHero, 140);            // the hero rises while the curtain lifts
      setTimeout(dropIntro, 560);            // the curtain transition takes 520 ms
      ['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach(function (ev) { window.removeEventListener(ev, onInput, true); });
      window.removeEventListener('pagehide', onHide);
    };
    function play(i) {
      if (done) return;
      var w = seq[i];
      w.classList.add('is-on');
      if (i === seq.length - 1) { later(function () { finish(false); }, ENTER + LAST); return; }
      later(function () {
        w.classList.remove('is-on'); w.classList.add('is-off');
        later(function () { w.classList.add('is-gone'); play(i + 1); }, EXIT);
      }, ENTER + HOLD);
    }
    var go = function () {
      intro.classList.add('is-run');
      // give the greeting fonts a moment (they are tiny subsets), never more than 150 ms
      var wait = [];
      if (document.fonts && document.fonts.load) seq.forEach(function (w) { wait.push(document.fonts.load('500 40px ' + getComputedStyle(w).fontFamily, w.textContent)); });
      var started = false, start = function () { if (!started) { started = true; later(function () { play(0); }, 20); } };
      Promise.all(wait).then(start, start); setTimeout(start, 150);
    };
    var onHide = function () { finish(false); dropIntro(); };
    window.addEventListener('pagehide', onHide);
    var onInput = function (e) { if (e.target && e.target.closest && e.target.closest('[data-intro-skip]')) return; finish(false); };
    if (skipBtn) skipBtn.addEventListener('click', function () { finish(true); });
    ['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, onInput, { capture: true, passive: true }); });
    // this script runs at the end of <body>, so the document is parsed: start now
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  } else {
    dropIntro();
    var kick = function () { requestAnimationFrame(startHero); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(kick);
    setTimeout(kick, 450);
  }
  // back/forward cache: a page restored mid-greeting must not come back covered
  window.addEventListener('pageshow', function (e) { if (e.persisted) { dropIntro(); startHero(); } });

  /* ---------------- pointer light on dark surfaces: one blob moved by transform ---------------- */
  $$('[data-light]').forEach(function (el) {
    var g = document.createElement('span'); g.className = 'glow'; g.setAttribute('aria-hidden', 'true');
    el.insertBefore(g, el.firstChild); el.classList.add('has-glow');
    var r = null, x = 0, y = 0, queued = false;
    el.addEventListener('pointerenter', function () { r = el.getBoundingClientRect(); });
    el.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || RM.matches) return;
      if (!r) r = el.getBoundingClientRect();
      x = e.clientX - r.left; y = e.clientY - r.top;
      if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; g.style.transform = 'translate3d(' + x.toFixed(0) + 'px,' + y.toFixed(0) + 'px,0)'; }); }
    });
    window.addEventListener('scroll', function () { r = null; }, { passive: true });
  });

  /* ---------------- go ---------------- */
  apply();
  observe(document);
  document.addEventListener('DOMContentLoaded', function () { initFab(); initNav(); });
})();

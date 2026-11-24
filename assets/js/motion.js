/* Auntu Gain, Phase 4E: motion core (unchanged design since 4C; 4D/4E performance passes).
   One requestAnimationFrame loop that sleeps when nothing moves. Built on top of it: wheel smoothing
   for mouse wheels, scroll velocity and direction, spring-driven magnetic elements, word and character
   reveals, scroll-linked scenes and the direction-aware signature band.

   Phase 4D performance rules (see REPORT, section C):
   - Scroll position, viewport and document height are cached and shared. Nothing reads layout per
     frame; measurements happen on resize, on font load and when the body changes size.
   - Elements are promoted to compositor layers only while they move (no permanent will-change on
     words or magnetic elements; 4C kept 122 layers alive).
   - Touchpads and other precision devices scroll natively (they already have momentum). Only stepped
     mouse wheels are smoothed, with shorter damping than 4C, and smoothing switches itself off for the
     session if frames are measurably slow. Add ?scroll=native to any URL to force native scrolling;
     Phase 4E adds a saved, reversible preference (menu > Smooth scrolling; localStorage ag-scroll).
   - Everything here is skipped or flattened for prefers-reduced-motion. */
(function () {
  'use strict';
  var AG = window.AG, RM = AG.RM, FINE = AG.FINE;
  var root = document.documentElement;
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  function rm() { return RM.matches; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function damp(a, b, lambda, dt) { return a + (b - a) * (1 - Math.exp(-lambda * dt)); }

  /* ---------------- ticker ---------------- */
  var subs = [], running = false, last = 0;
  function add(fn) { if (fn.__dead) fn.__dead = false; else if (subs.indexOf(fn) < 0) subs.push(fn); wake(); return fn; }
  var dead = false;
  // removal is deferred to the end of the frame so the loop never skips a subscriber
  function remove(fn) { fn.__dead = true; dead = true; }
  function wake() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
  function frame(now) {
    var dt = Math.min(0.064, Math.max(0.001, (now - last) / 1000)); last = now;
    var more = false;
    for (var i = 0; i < subs.length; i++) if (!subs[i].__dead && subs[i](dt, now)) more = true;
    if (dead) { subs = subs.filter(function (f) { if (f.__dead) { f.__dead = false; return false; } return true; }); dead = false; }
    if (more) requestAnimationFrame(frame); else running = false;
  }

  /* ---------------- shared scroll state ----------------
     y: scroll position, vy: smoothed velocity (px/s), dir: last direction, vh: viewport height,
     max: maximum scroll. y is written by the scroll event (cheap) and read by everyone else. */
  var sm = { active: false, mode: 'wheel', cur: 0, target: 0, expect: -1, from: 0, to: 0, t: 0, dur: 1 };
  var S = { y: window.scrollY, vy: 0, dir: 1, vh: window.innerHeight, vw: window.innerWidth, max: 0, docH: 0 };
  function measureDoc() { S.docH = root.scrollHeight; S.vh = window.innerHeight; S.vw = window.innerWidth; S.max = Math.max(0, S.docH - S.vh); }
  measureDoc();
  var prevY = S.y, scrollDirty = false;
  // the scroll event only marks the position stale; it is read once per frame at the start of the loop
  // (reading scrollY inside every scroll event forced a layout each time, measured in 4C and 4D traces)
  window.addEventListener('scroll', function () { scrollDirty = true; wake(); }, { passive: true });
  add(function (dt) {
    if (scrollDirty) { scrollDirty = false; if (!sm.active) S.y = window.scrollY; }
    var raw = (S.y - prevY) / dt;
    if (Math.abs(raw) > 30) S.dir = raw > 0 ? 1 : -1;
    prevY = S.y;
    S.vy = damp(S.vy, raw, 12, dt);
    if (Math.abs(S.vy) < 1) S.vy = 0;
    return S.vy !== 0;
  });

  /* ---------------- wheel smoothing (stepped mouse wheels only) ---------------- */
  var native = /[?&]scroll=native\b/.test(location.search), slow = false;
  try { if (localStorage.getItem('ag-scroll') === 'native') native = true; if (sessionStorage.getItem('ag-native-scroll') === '1') slow = true; } catch (e) {}
  var LAMBDA = 10;            // 95 % of a wheel step within about 300 ms (4C: 8, about 375 ms)
  function smoothOK() { return !native && !slow && FINE.matches && !rm() && !saveData; }
  function setNative(v) { native = !!v; if (native && sm.mode === 'wheel') sm.active = false; }
  // Chromium and Safari report wheelDeltaY = -3 * deltaY for precision touchpads and multiples of
  // 120 for wheels; Firefox reports wheels in lines (deltaMode 1). A gesture keeps its first verdict.
  var gesture = { pad: false, at: 0 };
  function isTouchpad(e) {
    var now = e.timeStamp || performance.now();
    if (now - gesture.at < 180) { gesture.at = now; return gesture.pad; }
    var pad;
    if (e.deltaMode !== 0) pad = false;
    else if (typeof e.wheelDeltaY === 'number' && e.wheelDeltaY !== 0) pad = Math.abs(e.wheelDeltaY) === Math.abs(e.deltaY) * 3 || Math.abs(e.wheelDeltaY) % 120 !== 0 && Math.abs(e.deltaY) < 40;
    else pad = Math.abs(e.deltaY) < 40 && e.deltaY % 1 !== 0;
    gesture.pad = pad; gesture.at = now;
    return pad;
  }
  AG.isTouchpad = isTouchpad;
  window.addEventListener('wheel', function (e) {
    if (!smoothOK() || e.ctrlKey || e.defaultPrevented || document.body.style.overflow === 'hidden') return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (e.target.closest && e.target.closest('[data-scroll-native], textarea, select, .csel__list')) return;
    if (isTouchpad(e)) { if (sm.active && sm.mode === 'wheel') sm.active = false; return; }
    e.preventDefault();
    var d = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? S.vh : 1);
    if (!sm.active || sm.mode !== 'wheel') { sm.cur = window.scrollY; sm.target = sm.cur; sm.expect = -1; }
    sm.mode = 'wheel';
    // never run more than one viewport ahead of the page: reversals feel immediate
    sm.target = clamp(clamp(sm.target + d, sm.cur - S.vh, sm.cur + S.vh), 0, S.max);
    sm.active = true; wake();
  }, { passive: false });
  function easeInOut(t) { return t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; }
  // slow-frame guard: if smoothing runs on a device that cannot keep up, hand the wheel back to the browser
  var guard = { n: 0, slow: 0 };
  add(function (dt) {
    if (!sm.active) return false;
    // the scrollbar, keyboard, find-in-page or touch moved the page: hand control back at once.
    // Checked here, before anything writes styles this frame, so reading scrollY costs no extra layout.
    if (sm.expect >= 0 && Math.abs(window.scrollY - sm.expect) > 4) { sm.active = false; sm.expect = -1; S.y = window.scrollY; return false; }
    if (sm.mode === 'tween') {
      sm.t = Math.min(1, sm.t + dt / sm.dur);
      sm.cur = sm.from + (sm.to - sm.from) * easeInOut(sm.t);
      if (sm.t >= 1) sm.active = false;
    } else {
      sm.cur = damp(sm.cur, sm.target, LAMBDA, dt);
      if (Math.abs(sm.target - sm.cur) < 0.5) { sm.cur = sm.target; sm.active = false; }
      guard.n++; if (dt > 0.034) guard.slow++;
      if (guard.n >= 90) {
        if (guard.slow / guard.n > 0.25) {
          slow = true;
          try { sessionStorage.setItem('ag-native-scroll', '1'); } catch (e) {}
          if (window.console) console.info('[motion] frames were slow while smoothing; using native scrolling for this session');
        }
        guard.n = 0; guard.slow = 0;
      }
    }
    window.scrollTo(0, sm.cur); sm.expect = Math.round(sm.cur); S.y = sm.cur;
    if (!sm.active) sm.expect = -1;
    return sm.active;
  });
  // the scrollbar, keyboard, find-in-page and touch take over immediately
  window.addEventListener('keydown', function (e) { if (sm.active && /^(Arrow|Page|Home|End| )/.test(e.key)) sm.active = false; });
  window.addEventListener('touchstart', function () { sm.active = false; }, { passive: true });

  function scrollToY(y) {
    y = clamp(y, 0, S.max);
    if (rm()) { window.scrollTo(0, y); return; }
    sm.mode = 'tween'; sm.from = window.scrollY; sm.to = y; sm.t = 0; sm.expect = -1;
    sm.dur = clamp(0.7 + Math.abs(y - sm.from) / 6000, 0.7, 1.3); sm.active = true; wake();
  }
  // in-page anchors travel instead of jumping; focus follows for keyboard and screen-reader users
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    var t = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    if (!t) return;
    e.preventDefault();
    var y = t.getBoundingClientRect().top + window.scrollY - (t.id === 'main' ? 0 : 24);
    scrollToY(y);
    if (history.pushState) history.pushState(null, '', '#' + t.id);
    if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    t.focus({ preventScroll: true });
  });

  /* ---------------- scroll-linked scenes ----------------
     progress 0 when the element's top meets the viewport bottom, 1 when its bottom leaves the top.
     Positions are measured once (and on resize), then derived from the cached scroll position. */
  var scenes = [];
  var sceneIO = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (en) { var s = en.target.__scene; if (s) { s.live = en.isIntersecting; if (s.live) wake(); } });
  }, { rootMargin: '15% 0px 15% 0px' }) : null;
  function measure(s) { var r = s.el.getBoundingClientRect(); s.top = r.top + window.scrollY; s.h = r.height; }
  var remeasureQueued = false, measureHooks = [];
  function remeasure() {
    if (remeasureQueued) return; remeasureQueued = true;
    requestAnimationFrame(function () {
      remeasureQueued = false; measureDoc();
      scenes.forEach(measure); scenes.forEach(function (s) { s.last = -1; });
      measureHooks.forEach(function (f) { f(); });
      wake();
    });
  }
  function onMeasure(fn) { measureHooks.push(fn); }
  function scene(el, fn) {
    var s = { el: el, fn: fn, top: 0, h: 0, live: !sceneIO, last: -1 };
    el.__scene = s; scenes.push(s); measure(s);
    if (sceneIO) sceneIO.observe(el);
    wake();
    return s;
  }
  add(function () {
    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i]; if (!s.live) continue;
      var p = clamp((S.y + S.vh - s.top) / (S.vh + s.h), 0, 1);
      if (Math.abs(p - s.last) > 0.0004) { s.last = p; s.fn(p, s); }
    }
    return false;
  });
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);
  window.addEventListener('resize', remeasure, { passive: true });
  window.addEventListener('load', remeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);

  /* parallax: data-parallax="0.12" moves the element inside its (unmoved) parent */
  function initParallax(scope) {
    $$('[data-parallax]', scope).forEach(function (el) {
      if (el.__px) return; el.__px = true;
      var k = parseFloat(el.getAttribute('data-parallax')) || 0.1;
      scene(el.parentElement, function (p, s) {
        if (rm()) { el.style.transform = ''; return; }
        el.style.transform = 'translate3d(0,' + ((p - 0.5) * (S.vh + s.h) * k).toFixed(1) + 'px,0)';
      });
    });
  }

  /* ---------------- word / character split for reveals ---------------- */
  function wrapText(node, chars) {
    Array.prototype.slice.call(node.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        // punctuation that directly follows an inline element (e.g. "<em>world</em>.") joins its last word
        var prev = n.previousSibling, lead = /^[^\s]+/.exec(n.nodeValue);
        if (lead && prev && prev.nodeType === 1) {
          var lastWi = prev.querySelectorAll('.wi'); lastWi = lastWi[lastWi.length - 1];
          if (lastWi) { lastWi.textContent += lead[0]; n.nodeValue = n.nodeValue.slice(lead[0].length); }
        }
        var parts = n.nodeValue.split(/(\s+)/);
        var frag = document.createDocumentFragment();
        parts.forEach(function (p) {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
          var w = document.createElement('span'); w.className = 'w';
          if (chars) {
            Array.from(p).forEach(function (ch) { var c = document.createElement('span'); c.className = 'wi wc'; c.textContent = ch; w.appendChild(c); });
          } else { var i = document.createElement('span'); i.className = 'wi'; i.textContent = p; w.appendChild(i); }
          frag.appendChild(w);
        });
        n.parentNode.replaceChild(frag, n);
      } else if (n.nodeType === 1 && !n.classList.contains('w') && !n.classList.contains('sr-only')) wrapText(n, chars);
    });
  }
  function delays(el) {
    var base = parseFloat(el.getAttribute('data-split-delay')) || 0;
    var chars = el.getAttribute('data-split') === 'chars';
    var lastTop = null, line = -1, k = 0;
    $$('.wi', el).forEach(function (wi) {
      var t = wi.parentNode.offsetTop;
      if (lastTop === null || Math.abs(t - lastTop) > 6) { line++; k = 0; lastTop = t; }
      wi.style.transitionDelay = Math.round(base + line * 80 + k * (chars ? 30 : 20)) + 'ms';
      k++;
    });
  }
  function split(el) {
    if (el.querySelector('.w')) return;
    wrapText(el, el.getAttribute('data-split') === 'chars');
    if (!el.classList.contains('is-in')) delays(el);
  }
  function splitAll(scope) { $$('[data-split]', scope).forEach(split); }

  /* stagger: children of [data-stagger] get a delay for CSS */
  function stagger(scope) {
    $$('[data-stagger]', scope).forEach(function (p) {
      var step = parseFloat(p.getAttribute('data-stagger')) || 70;
      Array.prototype.forEach.call(p.children, function (c, i) { c.style.setProperty('--d', (i * step) + 'ms'); });
    });
  }

  /* ---------------- magnetic elements (spring, slightly under-damped for an elastic return) ---------------- */
  function magnetic(el) {
    if (el.__mag) return; el.__mag = true;
    var inner = el.querySelector('.btn__label, .mag-inner');
    var st = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, on: false, r: null };
    var K = 190, C = 15;
    var tick = function (dt) {
      var h = dt / 2;
      for (var i = 0; i < 2; i++) {
        st.vx += (K * (st.tx - st.x) - C * st.vx) * h; st.vy += (K * (st.ty - st.y) - C * st.vy) * h;
        st.x += st.vx * h; st.y += st.vy * h;
      }
      var settled = Math.abs(st.vx) + Math.abs(st.vy) < 0.02 && Math.abs(st.tx - st.x) + Math.abs(st.ty - st.y) < 0.05;
      if (settled) { st.x = st.tx; st.y = st.ty; st.vx = st.vy = 0; }
      var moving = st.x || st.y;
      el.style.transform = moving ? 'translate3d(' + st.x.toFixed(2) + 'px,' + st.y.toFixed(2) + 'px,0)' : '';
      if (inner) inner.style.transform = moving ? 'translate3d(' + (st.x * 0.45).toFixed(2) + 'px,' + (st.y * 0.45).toFixed(2) + 'px,0)' : '';
      if (settled && !st.tx && !st.ty) { st.on = false; remove(tick); return false; }
      return true;
    };
    el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') st.r = el.getBoundingClientRect(); });
    el.addEventListener('pointermove', function (e) {
      if (!FINE.matches || rm() || e.pointerType !== 'mouse') return;
      var r = st.r || (st.r = el.getBoundingClientRect()), s = parseFloat(el.getAttribute('data-strength') || '14');
      st.tx = ((e.clientX - r.left - st.x) / r.width - 0.5) * s; st.ty = ((e.clientY - r.top - st.y) / r.height - 0.5) * s;
      if (!st.on) { st.on = true; add(tick); }
    });
    el.addEventListener('pointerleave', function () { st.tx = 0; st.ty = 0; st.r = null; if (st.on) wake(); });
  }

  /* ---------------- fill buttons: the fill rises in, then leaves through the top ---------------- */
  function fill(el) {
    if (el.__fill) return; el.__fill = true;
    el.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;
      el.classList.remove('f-out'); void el.offsetWidth; el.classList.add('f-in');
    });
    el.addEventListener('pointerleave', function (e) {
      if (e.pointerType !== 'mouse' || !el.classList.contains('f-in')) return;
      el.classList.remove('f-in'); el.classList.add('f-out');
    });
    el.addEventListener('animationend', function (e) { if (e.animationName === 'fill-out') el.classList.remove('f-out'); });
  }

  /* ---------------- signature band: drift follows scroll direction, velocity adds push and lean ---------------- */
  function marquee(track) {
    if (track.__mq) return; track.__mq = true;
    var group = track.firstElementChild, gw = 1, x = 0, lean = 0, live = false, last = '';
    var dir = parseFloat(track.getAttribute('data-dir') || '-1');
    var drift = parseFloat(track.getAttribute('data-drift') || '28');
    function build() {
      while (track.children.length > 1) track.removeChild(track.lastChild);
      gw = Math.max(1, group.getBoundingClientRect().width);
      var n = Math.ceil(S.vw * 1.3 / gw) + 1;
      for (var i = 0; i < n; i++) { var c = group.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.removeAttribute('id'); $$('[data-i18n]', c).forEach(function (n) { n.removeAttribute('data-i18n'); }); track.appendChild(c); }
      x = -gw * 0.35 * (dir < 0 ? 1 : 2);
      paint();
    }
    function paint() {
      var v = rm() ? '' : 'translate3d(' + x.toFixed(1) + 'px,0,0) skewX(' + lean.toFixed(2) + 'deg)';
      if (v !== last) { track.style.transform = v; last = v; }
    }
    var tick = function (dt) {
      if (!live || rm()) return false;
      var v = S.vy * 0.3;
      x += (drift * S.dir + v) * dir * dt;
      x = x % gw; if (x > 0) x -= gw;
      lean = damp(lean, clamp(-S.vy * dir * 0.003, -5, 5), 7, dt);
      paint();
      return true;
    };
    add(tick);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
      live = es[0].isIntersecting;
      track.style.willChange = live ? 'transform' : '';
      if (live) wake();
    }).observe(track.parentElement);
    else live = true;
    build();
    document.addEventListener('ag:lang', function () { requestAnimationFrame(build); });
    window.addEventListener('resize', function () { requestAnimationFrame(build); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  }

  /* ---------------- init ---------------- */
  function init(scope) {
    splitAll(scope); stagger(scope); initParallax(scope);
    $$('.magnetic', scope).forEach(magnetic);
    $$('.btn, .btn-circle', scope).forEach(fill);
    $$('[data-marquee]', scope).forEach(marquee);
  }
  init(document);
  document.addEventListener('ag:lang', function () {
    // i18n replaced the text inside split elements: split again; revealed text stays revealed
    $$('[data-split]').forEach(function (el) { split(el); });
    remeasure();
  });
  window.addEventListener('resize', function () { $$('[data-split]:not(.is-in)').forEach(delays); });

  AG.motion = { add: add, remove: remove, wake: wake, S: S, scene: scene, remeasure: remeasure, onMeasure: onMeasure, scrollToY: scrollToY, init: init, damp: damp, clamp: clamp, rm: rm, magnetic: magnetic, setNative: setNative, nativeScroll: function () { return native || !smoothOK(); } };
})();

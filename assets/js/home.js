/* Homepage and research notes, Phase 4E: project rows with one continuous floating preview, the scroll-linked
   experience timeline, the research themes, the hero's scroll hand-off and the section transitions.
   4E: the preview loop sleeps once it has settled (4D kept a rAF callback running while the preview
   was visible), rows hand the title to the case page's view transition, gated projects lose their links.
   Performance: the preview measures its own size and the row positions only on show, resize and
   font/language changes; while scrolling it works from cached document coordinates (4C called
   getBoundingClientRect and elementFromPoint on every scroll event). */
(function () {
  'use strict';
  var AG = window.AG, t = AG.t, M = AG.motion, RM = AG.RM, S = M.S;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = M.clamp, damp = M.damp;

  /* ================= project rows + floating preview ================= */
  var list = $('[data-projects]');
  var rows = list ? $$('.project__row', list) : [];
  var pv = $('.preview'), strip = pv && $('.preview__strip', pv), items = pv ? $$('.preview__item', pv) : [];
  var cap = pv && $('.preview__cap', pv), btn = $('.pv-btn'), btnLabel = btn && $('span', btn);
  var enabled = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)');
  var P = { x: 0, y: 0, tx: 0, ty: 0, rot: 0, s: 0, vs: 0, ts: 0, bx: 0, by: 0, bs: 0, vbs: 0, tbs: 0 };
  var visible = false, mode = 'off', active = -1, dockRow = null, lastX = -1, lastY = -1, hideTimer = 0, popTimer = 0, on = false;
  var size = { w: 340, h: 212 }, rowDoc = [], lastPaint = '', lastBtn = '';

  function measureRows() {
    if (!pv) return;
    size.w = pv.offsetWidth || size.w; size.h = pv.offsetHeight || size.h;
    rowDoc = rows.map(function (r) { var b = r.getBoundingClientRect(); return { top: b.top + window.scrollY, bottom: b.bottom + window.scrollY, left: b.left, right: b.right }; });
  }
  function rowAtDocY(y) { for (var i = 0; i < rowDoc.length; i++) if (y >= rowDoc[i].top && y < rowDoc[i].bottom) return i; return -1; }
  function label(i) {
    var r = rows[i]; if (!r || !btnLabel) return;
    btnLabel.textContent = t('work.cur.view');
    if (cap) cap.textContent = r.getAttribute('data-art-key') === 'p1' ? t('work.illus.syn') : t('work.illus');
  }
  function setActive(i, instant) {
    if (i === active) return;
    if (active > -1 && window.AG_ART) AG_ART.setLive(items[active], false);
    active = i; label(i);
    if (instant) strip.classList.add('no-anim');
    strip.style.transform = 'translate3d(0,' + (-i * 100) + '%,0)';
    if (instant) { void strip.offsetWidth; strip.classList.remove('no-anim'); }
    if (window.AG_ART) AG_ART.setLive(items[i], true);
  }
  function hot(i, instant) {
    rows.forEach(function (r, k) { r.classList.toggle('is-hot', k === i); });
    list.classList.add('is-hovering');
    setActive(i, instant);
  }
  function show() {
    clearTimeout(hideTimer);
    if (visible) return;
    visible = true; pv.classList.add('is-visible'); P.ts = 1;
    pv.style.willChange = 'transform'; if (btn) btn.style.willChange = 'transform';
    clearTimeout(popTimer);
    popTimer = setTimeout(function () { if (visible) { P.tbs = 1; if (btn) btn.classList.add('is-visible'); run(); } }, 90);
    run();
  }
  function hide(now) {
    clearTimeout(hideTimer);
    var go = function () {
      visible = false; mode = 'off'; dockRow = null;
      pv.classList.remove('is-visible'); if (btn) btn.classList.remove('is-visible');
      P.ts = 0; P.tbs = 0; clearTimeout(popTimer);
      rows.forEach(function (r) { r.classList.remove('is-hot'); });
      list.classList.remove('is-hovering');
      if (active > -1 && window.AG_ART) AG_ART.setLive(items[active], false);
      run();
    };
    if (now) go(); else hideTimer = setTimeout(go, 90);   // grace period: no flicker across row borders
  }
  function paint() {
    var v = 'translate3d(' + (P.x - size.w / 2).toFixed(1) + 'px,' + (P.y - size.h / 2).toFixed(1) + 'px,0) rotate(' + P.rot.toFixed(2) + 'deg) scale(' + Math.max(0, P.s).toFixed(3) + ')';
    if (v !== lastPaint) { pv.style.transform = v; lastPaint = v; }
    if (btn) {
      var b = 'translate3d(' + (P.bx - 40).toFixed(1) + 'px,' + (P.by - 40).toFixed(1) + 'px,0) scale(' + Math.max(0, P.bs).toFixed(3) + ')';
      if (b !== lastBtn) { btn.style.transform = b; lastBtn = b; }
    }
  }
  function spring(v, vel, target, k, c, dt) {
    var h = dt / 2;
    for (var i = 0; i < 2; i++) { vel += (k * (target - v) - c * vel) * h; v += vel * h; }
    return [v, vel];
  }
  // while scrolling with the pointer over the list, the hovered row is found from cached coordinates
  function followScroll() {
    if (mode === 'dock' || mode === 'dock-kbd') { var m = mode; if (dockRow) dockTo(dockRow, true); mode = m; return; }
    if (mode !== 'cursor' || lastX < 0) return;
    var i = rowAtDocY(lastY + S.y);
    if (i < 0) { hide(true); return; }
    var top = rowDoc[i].top - S.y, bottom = rowDoc[i].bottom - S.y;
    P.ty = top - size.h / 2 - 16; if (P.ty - size.h / 2 < 12) P.ty = bottom + size.h / 2 + 16;
    if (i !== active || !rows[i].classList.contains('is-hot')) hot(i);
  }
  var lastScrollY = -1;
  function step(dt) {
    if (visible && S.y !== lastScrollY) { lastScrollY = S.y; followScroll(); }
    if (RM.matches) { P.x = P.tx; P.y = P.ty; P.s = P.ts; P.rot = 0; P.bs = P.tbs; }
    else {
      var px = P.x;
      P.x = damp(P.x, P.tx, 11, dt); P.y = damp(P.y, P.ty, 11, dt);
      var vx = (P.x - px) / Math.max(dt, 0.001);
      P.rot = damp(P.rot, mode === 'cursor' ? clamp(vx * 0.01, -6, 6) : 0, 9, dt);
      var sp = spring(P.s, P.vs, P.ts, 260, P.ts ? 22 : 30, dt); P.s = sp[0]; P.vs = sp[1];
      var bp = spring(P.bs, P.vbs, P.tbs, 420, 20, dt); P.bs = bp[0]; P.vbs = bp[1];
    }
    var cx = P.x + size.w / 2 - 18, cy = P.y + size.h / 2 - 18;      // the action circle rides the bottom-right corner
    P.bx = RM.matches ? cx : damp(P.bx, cx, 16, dt); P.by = RM.matches ? cy : damp(P.by, cy, 16, dt);
    paint();
    var springing = Math.abs(P.ts - P.s) > 0.001 || Math.abs(P.vs) > 0.01 || Math.abs(P.tbs - P.bs) > 0.001 || Math.abs(P.vbs) > 0.01;
    if (!visible && !springing) { on = false; M.remove(step); pv.style.willChange = ''; if (btn) btn.style.willChange = ''; return false; }
    var moving = springing || Math.abs(P.tx - P.x) > 0.1 || Math.abs(P.ty - P.y) > 0.1 || Math.abs(P.rot) > 0.01 || Math.abs(P.bx - cx) > 0.1 || Math.abs(P.by - cy) > 0.1;
    // settled while visible: the loop sleeps (4D kept it running); pointer movement and scrolling wake it
    if (!moving) { on = false; M.remove(step); return false; }
    return true;
  }
  function run() { if (!on) { on = true; M.add(step); } else M.wake(); }
  function jump() { P.x = P.tx; P.y = P.ty; P.rot = 0; P.bx = P.x + size.w / 2 - 18; P.by = P.y + size.h / 2 - 18; }
  function textRect(el) { var rg = document.createRange(); rg.selectNodeContents(el); return rg.getBoundingClientRect(); }
  function dockTo(row, quiet) {
    var title = $('.project__title', row), period = $('.project__period', row);
    var tR = textRect(title), pR = period.getBoundingClientRect(), rR = row.getBoundingClientRect();
    var w = size.w, h = size.h, room = pR.left - tR.right - 40;
    if (room > w * 0.75) { P.tx = (tR.right + pR.left) / 2; P.ty = rR.top + rR.height / 2; }
    else { P.tx = clamp(pR.left - w / 2 - 24, w / 2 + 16, S.vw - w / 2 - 16); P.ty = rR.top - h / 2 - 12; if (P.ty - h / 2 < 16) P.ty = rR.bottom + h / 2 + 12; }
    if (quiet) return;
    var wasHidden = !visible;
    mode = 'dock'; dockRow = row;
    hot(rows.indexOf(row), wasHidden); if (wasHidden) jump();
    show(); run();
  }
  if (list && pv) {
    M.onMeasure(measureRows);
    list.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse' && enabled.matches) measureRows(); });
    list.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || !enabled.matches) return;
      lastX = e.clientX; lastY = e.clientY;
      var row = e.target.closest('.project__row');
      if (!row) { if (mode === 'cursor') hide(); return; }
      if (RM.matches) { if (dockRow !== row) dockTo(row); return; }
      // float above the hovered row (below it when there is no room), following the pointer sideways,
      // so the title being read is never covered
      var i = rows.indexOf(row), rd = rowDoc[i] || { top: 0, bottom: 0 };
      var top = rd.top - S.y, bottom = rd.bottom - S.y;
      P.tx = clamp(e.clientX + size.w * 0.2, size.w / 2 + 16, S.vw - size.w / 2 - 16);
      P.ty = top - size.h / 2 - 16;
      if (P.ty - size.h / 2 < 12) P.ty = bottom + size.h / 2 + 16;
      var wasHidden = !visible;
      if (mode !== 'cursor') { mode = 'cursor'; dockRow = null; }
      if (!row.classList.contains('is-hot')) hot(i, wasHidden);
      if (wasHidden) { jump(); P.s = 0.2; P.vs = 0; }
      show(); run();
    });
    list.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && mode === 'cursor') hide(); });
    list.addEventListener('focusin', function (e) {
      var row = e.target.closest('.project__row');
      if (!row || !enabled.matches || !row.matches(':focus-visible')) return;
      measureRows(); dockTo(row); mode = 'dock-kbd';
    });
    list.addEventListener('focusout', function (e) {
      if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('.project__row')) { if (mode === 'dock-kbd') hide(true); }
    });
    window.addEventListener('resize', function () { if (!enabled.matches) hide(true); });
    window.addEventListener('scroll', function () { if (visible) run(); }, { passive: true });
    // the clicked title becomes the case page's title in the cross-document view transition
    rows.forEach(function (r) { r.addEventListener('click', function () { var tt = $('.project__title', r); if (tt) tt.style.viewTransitionName = 'case-title'; }); });
    window.addEventListener('pageshow', function () { rows.forEach(function (r) { var tt = $('.project__title', r); if (tt) tt.style.viewTransitionName = ''; }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && visible) hide(true); });
    measureRows();
  }

  /* ================= hero hand-off: the hero recedes as the signature band arrives ================= */
  var hero = $('.hero'), heroText = $('.hero__text'), heroPhoto = $('.hero__photo .photo__frame');
  if (hero && heroText) {
    M.scene(hero, function (p, s) {
      if (RM.matches) { heroText.style.transform = ''; heroText.style.opacity = ''; if (heroPhoto) heroPhoto.style.transform = ''; return; }
      var k = clamp((p - 0.5) / 0.5, 0, 1);
      heroText.style.transform = k ? 'translate3d(0,' + (-k * s.h * 0.12).toFixed(1) + 'px,0)' : '';
      heroText.style.opacity = k ? (1 - k * 0.6).toFixed(3) : '';
      if (heroPhoto) heroPhoto.style.transform = k ? 'translate3d(0,' + (-k * s.h * 0.04).toFixed(1) + 'px,0) scale(' + (1 - k * 0.04).toFixed(4) + ')' : '';
    });
  }

  /* ================= section transitions (transform only, composited) ================= */
  // research: the forest-green sheet grows from an inset card to full bleed as it arrives.
  // 4C animated clip-path on the whole section (a full repaint every frame); 4D scales a background layer.
  $$('[data-open-in]').forEach(function (sec) {
    var bg = $('.sheet-bg', sec);
    if (!bg) return;
    var promoted = false;
    M.scene(sec, function (p) {
      if (RM.matches) { bg.style.transform = ''; return; }
      var k = clamp((p - 0.02) / 0.28, 0, 1), e = 1 - Math.pow(1 - k, 3);
      // promote only while it moves (4E perf: the sheet has gradient edges, which cost a re-raster on every scale change)
      var moving = e > 0 && e < 1;
      if (moving !== promoted) { promoted = moving; bg.style.willChange = moving ? 'transform' : ''; }
      bg.style.transform = e >= 1 ? '' : 'scaleX(' + (0.93 + 0.07 * e).toFixed(4) + ')';
    });
  });
  // the page above the contact band ends in a curve that flattens as the band rises underneath
  var curve = $('.curve'), band = $('.contact-band'), bandIn = band && $('.contact-band__in', band);
  if (curve && band) {
    M.scene(band, function (p) {
      var k = clamp(p / 0.45, 0, 1);
      if (RM.matches) { curve.style.transform = 'scaleY(0)'; if (bandIn) bandIn.style.transform = ''; return; }
      curve.style.transform = 'scaleY(' + (1 - k).toFixed(3) + ')';
      if (bandIn) bandIn.style.transform = k < 1 ? 'translate3d(0,' + ((1 - k) * -80).toFixed(1) + 'px,0)' : '';
    });
  }

  /* ================= research themes ================= */
  var rx = $('[data-rx]');
  if (rx) {
    var tabs = $$('[role="tab"]', rx), panels = $$('[role="tabpanel"]', rx), cur = 0;
    rx.classList.add('is-tabbed');
    var rxSelect = function (i, focus) {
      if (i === cur && panels[i].classList.contains('is-active')) { if (focus) tabs[i].focus(); return; }
      var dir = i > cur ? 1 : -1;
      tabs.forEach(function (b, k) { var a = k === i; b.setAttribute('aria-selected', String(a)); b.tabIndex = a ? 0 : -1; });
      panels.forEach(function (p, k) {
        p.classList.remove('is-enter', 'is-enter-back');
        p.hidden = k !== i; p.classList.toggle('is-active', k === i);
      });
      if (!RM.matches) { var p = panels[i]; void p.offsetWidth; p.classList.add(dir > 0 ? 'is-enter' : 'is-enter-back'); }
      rx.setAttribute('data-rx-active', tabs[i].getAttribute('data-rx-theme'));
      cur = i;
      if (focus) tabs[i].focus();
      M.remeasure();
    };
    tabs.forEach(function (b, i) {
      b.addEventListener('click', function () { rxSelect(i, false); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (e.key === 'Home') { e.preventDefault(); rxSelect(0, true); return; }
        if (e.key === 'End') { e.preventDefault(); rxSelect(tabs.length - 1, true); return; }
        if (d) { e.preventDefault(); rxSelect((i + d + tabs.length) % tabs.length, true); }
      });
    });
    panels.forEach(function (p, k) { p.hidden = k !== 0; p.classList.toggle('is-active', k === 0); });
    tabs.forEach(function (b, k) { b.setAttribute('aria-selected', String(k === 0)); b.tabIndex = k === 0 ? 0 : -1; });
    // the theme motifs move only while the section is on screen
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { rx.classList.toggle('is-live', es[0].isIntersecting); }).observe(rx);
  }
  // research notes page: each theme's motif moves only while that theme is on screen
  if ('IntersectionObserver' in window) {
    var rqIO = new IntersectionObserver(function (es) { es.forEach(function (en) { en.target.classList.toggle('is-live', en.isIntersecting); }); });
    $$('.rq').forEach(function (a) { rqIO.observe(a); });
  }

  /* ================= timeline ================= */
  var root = $('[data-timeline]');
  var START = 2017, END = 2028.5;
  var TODAY = (window.AG_SITE && AG_SITE.today) || [2026, 11];
  var E = [
    { id: 'jbnu', lane: 'edu', row: 0, from: [2017, 1], to: [2021, 2] },
    { id: 'dml', lane: 'edu', row: 1, from: [2018, 1], to: [2019, 12] },
    { id: 'skku', lane: 'edu', row: 0, from: [2027, 3], to: null, expected: true },
    { id: 'hy', lane: 'work', row: 1, point: [2021, 2] },
    { id: 'fluton', lane: 'work', row: 0, from: [2021, 4], to: [2023, 6] },
    { id: 'approtec', lane: 'work', row: 1, from: [2023, 6], to: [2024, 6] },
    // current role: an open bar up to today. The owner-confirmed planned end (content/site.json) is shown as a
    // note in the detail, never as an end date, while the role is ongoing.
    { id: 'gt', lane: 'work', row: 0, from: [2024, 7], to: TODAY, openEnded: true, plan: 'tl.gt.plan' },
    { id: 'pill', lane: 'ind', row: 1, from: [2026, 1], to: [2026, 1], link: 'work/pill-sorting.html' },
    
  ];
  // a gated entry may leave an empty row in its lane: renumber the rows that are left
  ['edu', 'work', 'ind'].forEach(function (lane) {
    var used = E.filter(function (e) { return e.lane === lane; }).map(function (e) { return e.row; }).filter(function (r, i, a) { return a.indexOf(r) === i; }).sort();
    E.forEach(function (e) { if (e.lane === lane) e.row = used.indexOf(e.row); });
  });
  var ORDER_MOBILE = ['skku', 'wm', 'gt', 'pill', 'approtec', 'fluton', 'hy', 'dml', 'jbnu'].filter(function (id) { return E.some(function (e) { return e.id === id; }); });
  var LANES = [['edu', 'tl.lane.edu'], ['work', 'tl.lane.work'], ['ind', 'tl.lane.ind']];
  var selected = 'gt', sweep = 0, lines = [], trackW = 0, nowEl = null, chart = null, lastSweep = -1;
  function pct(ym) { return ((ym[0] + (ym[1] - 1) / 12) - START) / (END - START) * 100; }
  function byId(id) { return E.filter(function (e) { return e.id === id; })[0]; }
  function kindKey(e) { return e.lane === 'edu' ? 'tl.kind.edu' : e.lane === 'work' ? 'tl.kind.work' : 'tl.kind.ind'; }
  var GT = window.AG_SITE && AG_SITE.employment && AG_SITE.employment.gt;
  function planNote(e) { return e.plan && GT && GT.showPlannedEnd && !GT.end ? ' <span class="tl__plan">' + t(e.plan) + '</span>' : ''; }
  function span(e) {
    if (e.point) return [pct(e.point), pct(e.point)];
    var l = pct(e.from), r = e.to ? pct([e.to[0], e.to[1] + 1]) : 100;
    return [l, Math.max(l + 1.1, r)];
  }
  function renderDetail(swap) {
    var e = byId(selected), d = $('.tl__detail', root);
    var link = e.link ? '<a class="link tl__d-link" href="' + e.link + '">' + t('tl.seeProject') + '</a>' : '';
    d.setAttribute('data-kind', e.lane);
    d.innerHTML = '<div><p class="tl__d-kind"><i aria-hidden="true"></i>' + t(kindKey(e)) + '</p><h3 class="tl__d-title">' + t('tl.' + e.id + '.t') + '</h3>' +
      '<p class="tl__d-org">' + t('tl.' + e.id + '.o') + '</p><p class="tl__d-per">' + t('tl.' + e.id + '.p') + planNote(e) + '</p></div>' +
      '<div><p class="tl__d-body">' + t('tl.' + e.id + '.d') + '</p>' + link + '</div>';
    if (swap && !RM.matches) { d.classList.remove('tl__swap'); void d.offsetWidth; d.classList.add('tl__swap'); }
    var r = $('.tl__range', root), sp = span(e);
    if (r) { r.style.left = sp[0].toFixed(2) + '%'; r.style.width = Math.max(0.6, sp[1] - sp[0]).toFixed(2) + '%'; r.setAttribute('data-kind', e.lane); }
  }
  function select(id, swap) {
    if (id === selected && swap) return;
    selected = id;
    $$('.tl__item', root).forEach(function (b) {
      var on = b.getAttribute('data-id') === id;
      b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
    });
    renderDetail(swap);
  }
  function paintSweep() {
    if (!chart || Math.abs(sweep - lastSweep) < 0.02) return;
    lastSweep = sweep;
    if (nowEl) nowEl.style.transform = 'translate3d(' + (trackW * sweep / 100).toFixed(1) + 'px,0,0)';
    lines.forEach(function (L) {
      var k = L.point ? (sweep >= L.l ? 1 : 0) : clamp((sweep - L.l) / (L.r - L.l), 0, 1);
      var v = 'scaleX(' + k.toFixed(3) + ')';
      if (v !== L.v) { L.fill.style.transform = v; L.v = v; }
      var reached = sweep >= L.l - 0.2;
      if (reached !== L.reached) { L.btn.classList.toggle('is-reached', reached); L.reached = reached; }
    });
  }
  function render() {
    var html = '<div class="tl__chart" role="group" aria-label="' + t('tl.label') + '">';
    LANES.forEach(function (L) {
      var es = E.filter(function (e) { return e.lane === L[0]; });
      var rowsN = Math.max.apply(null, es.map(function (e) { return e.row; })) + 1;
      html += '<div class="tl__lane" data-kind="' + L[0] + '"><span class="tl__lane-k"><i aria-hidden="true"></i>' + t(L[1]) + '</span><div class="tl__track" style="height:' + (rowsN * 58 + 6) + 'px">';
      es.forEach(function (e) {
        var sp = span(e), cls = 'tl__item' + (e.point ? ' is-point' : '') + (e.expected ? ' is-expected' : '') + (e.openEnded ? ' is-open-ended' : '');
        var style = 'left:' + sp[0].toFixed(2) + '%;top:' + (e.row * 58) + 'px;' + (e.point ? '' : 'width:' + (sp[1] - sp[0]).toFixed(2) + '%;');
        html += '<button type="button" class="' + cls + '" data-id="' + e.id + '" data-kind="' + e.lane + '" aria-pressed="false" style="' + style + '">' +
          '<span class="tl__label">' + t('tl.' + e.id + '.s') + '<span class="sr-only">, ' + t('tl.' + e.id + '.p') + '</span></span>' +
          '<span class="tl__line" aria-hidden="true"><span class="tl__fill"></span></span></button>';
      });
      html += '</div></div>';
    });
    html += '<div class="tl__axis" aria-hidden="true"><span class="tl__range"></span>';
    for (var yr = START; yr <= 2028; yr++) html += '<span class="tl__year" style="left:' + pct([yr, 1]).toFixed(2) + '%">' + AG.num(yr, { useGrouping: false }) + '</span>';
    html += '</div><div class="tl__now" aria-hidden="true"></div>';
    html += '<div class="tl__today" aria-hidden="true" style="--x:' + (pct(TODAY) / 100).toFixed(4) + '"><span>' + t('tl.today') + '</span></div></div>';
    html += '<div class="tl__detail" aria-live="polite"></div>';
    html += '<ol class="tl__list" data-reveal="list" data-stagger="60">';
    ORDER_MOBILE.forEach(function (id) {
      var e = byId(id);
      var link = e.link ? '<a class="link" href="' + e.link + '">' + t('tl.seeProject') + '</a>' : '';
      html += '<li class="tl__li" data-kind="' + e.lane + '"><button type="button" aria-expanded="false" aria-controls="tlm-' + id + '">' +
        '<span class="tl__li-k"><i aria-hidden="true"></i>' + t(kindKey(e)) + '</span><span class="tl__li-t">' + t('tl.' + id + '.t') + '</span>' +
        '<span class="tl__li-p">' + t('tl.' + id + '.o') + ' · ' + t('tl.' + id + '.p') + planNote(e) + '</span><span class="tl__li-i" aria-hidden="true"></span></button>' +
        '<div class="tl__li-body" id="tlm-' + id + '"><div><p>' + t('tl.' + id + '.d') + '</p>' + (link ? '<p>' + link + '</p>' : '') + '</div></div></li>';
    });
    html += '</ol>';
    root.innerHTML = html;
    chart = $('.tl__chart', root); nowEl = $('.tl__now', root); lastSweep = -1;
    if (RM.matches) sweep = pct(TODAY);
    lines = $$('.tl__item', root).map(function (b) {
      var e = byId(b.getAttribute('data-id')), sp = span(e);
      return { btn: b, fill: $('.tl__fill', b), l: sp[0], r: sp[1], point: !!e.point, v: '', reached: null };
    });
    $$('.tl__item', root).forEach(function (b) {
      var id = b.getAttribute('data-id');
      b.addEventListener('click', function () { select(id, true); });
      b.addEventListener('focus', function () { select(id, true); });
      b.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse') select(id, true); });
    });
    $$('.tl__li > button', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var open = b.getAttribute('aria-expanded') !== 'true';
        b.setAttribute('aria-expanded', String(open)); b.parentNode.classList.toggle('is-open', open);
      });
    });
    M.init(root);
    var tr = $('.tl__track', root); trackW = tr ? tr.clientWidth : 0;
    var keep = selected; selected = null; select(keep, false);
    paintSweep();
  }
  if (root) {
    M.onMeasure(function () { var tr = $('.tl__track', root); trackW = tr ? tr.clientWidth : 0; lastSweep = -1; paintSweep(); });
    render();
    // scroll-linked progress: time sweeps from 2017 to today while the chart crosses the viewport
    M.scene(root, function (p) {
      var target = pct(TODAY);
      sweep = RM.matches ? target : target * clamp((p - 0.1) / 0.34, 0, 1);
      paintSweep();
    });
    AG.observe(root);
  }

  document.addEventListener('ag:lang', function () {
    if (root) { render(); var l2 = $('.tl__list', root); if (l2) l2.classList.add('is-in'); M.remeasure(); }
    if (active > -1) label(active);
    measureRows();
  });
})();

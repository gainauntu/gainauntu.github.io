/* Case studies, Phase 4E: one diagram engine for every project and two small demos (a third 4D demo was
   removed in 4E for confidentiality).
   The diagram is laid out automatically from content/cases/<slug>.json (lanes of nodes, optional loop,
   cross-lane links), so every page shares one visual language. It shows only relationships the CV
   states. Demos use synthetic data and are labelled as such; none reconstructs a client's method.
   Performance: path geometry is sampled once; the travelling dots are persistent elements moved at
   30 fps only while the diagram is on screen (4C rebuilt the dots with innerHTML every frame). */
(function () {
  'use strict';
  var AG = window.AG, t = AG.t, RM = AG.RM, CFG = window.AG_CASE || {};
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var NS = 'http://www.w3.org/2000/svg';
  var SLUG = CFG.slug, D = CFG.diagram;
  function key(k) { return SLUG + '.' + k; }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }
  function lut(path) {
    var L = path.getTotalLength(), n = Math.max(24, Math.round(L / 6)), pts = [];
    for (var i = 0; i <= n; i++) { var p = path.getPointAtLength(L * i / n); pts.push(p.x, p.y); }
    return { L: L, n: n, pts: pts };
  }
  function at(P, f) { f = Math.max(0, Math.min(1, f)) * P.n; var i = Math.min(P.n - 1, Math.floor(f)), k = f - i, a = P.pts; return [a[2 * i] + (a[2 * i + 2] - a[2 * i]) * k, a[2 * i + 1] + (a[2 * i + 3] - a[2 * i + 1]) * k]; }

  /* ================= diagram: automatic layout ================= */
  var canvas = $('[data-diagram]'), note = $('[data-diagram-note]');
  var selected = null, nodes = {}, order = [], flows = [], inView = false, raf = 0, last = 0;

  function layout(wide) {
    var L = { nodes: {}, edges: [], labels: [], w: wide ? 1000 : 360, h: 0 };
    var y = 0;
    D.lanes.forEach(function (lane, li) {
      L.labels.push([lane.label, 20, y + 22]);
      var top = y + 38;
      if (wide) {
        var n = lane.nodes.length, gap = 34, w = Math.min(230, (960 - (n - 1) * gap) / n), h = 66;
        // a single-node lane that is the target of a link sits under (or over) its source
        var anchor = n === 1 ? (D.links || []).filter(function (l) { return l[1] === lane.nodes[0] || l[0] === lane.nodes[0]; })[0] : null;
        lane.nodes.forEach(function (id, i) {
          var x = 20 + i * (w + gap);
          if (anchor) { var other = anchor[0] === id ? anchor[1] : anchor[0]; if (L.nodes[other]) x = L.nodes[other].x; else x = 20; }
          L.nodes[id] = { x: x, y: top, w: w, h: h, lane: li, ctx: !!lane.ctx };
          if (i > 0) L.edges.push({ a: lane.nodes[i - 1], b: id, d: 'M' + (x - gap + 2) + ' ' + (top + h / 2) + ' H' + (x - 6), head: [x - 2, top + h / 2, 'r'], ctx: !!lane.ctx, flow: !lane.ctx });
        });
        y = top + h + (lane.loop ? 52 : 34);
        if (lane.loop && n > 1) {
          var f = L.nodes[lane.nodes[0]], l = L.nodes[lane.nodes[n - 1]], by = top + h + 26;
          L.edges.push({ a: lane.nodes[n - 1], b: lane.nodes[0], d: 'M' + (l.x + l.w / 2) + ' ' + (top + h) + ' V' + by + ' H' + (f.x + f.w / 2) + ' V' + (top + h + 8), head: [f.x + f.w / 2, top + h + 2, 'u'], flow: true, loop: true });
        }
      } else {
        var hh = 52, gp = 22;
        lane.nodes.forEach(function (id, i) {
          var yy = top + i * (hh + gp), x = lane.ctx ? 36 : 20, w = lane.ctx ? 300 : 300;
          L.nodes[id] = { x: x, y: yy, w: w, h: hh, lane: li, ctx: !!lane.ctx };
          if (i > 0) L.edges.push({ a: lane.nodes[i - 1], b: id, d: 'M' + (x + w / 2) + ' ' + (yy - gp + 2) + ' V' + (yy - 6), head: [x + w / 2, yy - 2, 'd'], ctx: !!lane.ctx, flow: !lane.ctx });
        });
        var n2 = lane.nodes.length, endY = top + n2 * (hh + gp) - gp;
        if (lane.loop && n2 > 1) {
          var f2 = L.nodes[lane.nodes[0]], l2 = L.nodes[lane.nodes[n2 - 1]];
          L.edges.push({ a: lane.nodes[n2 - 1], b: lane.nodes[0], d: 'M' + (l2.x + l2.w) + ' ' + (l2.y + hh / 2) + ' H' + 340 + ' V' + (f2.y + hh / 2) + ' H' + (f2.x + f2.w + 8), head: [f2.x + f2.w + 2, f2.y + hh / 2, 'l'], flow: true, loop: true });
        }
        y = endY + 34;
      }
    });
    (D.links || []).forEach(function (lk) {
      var a = L.nodes[lk[0]], b = L.nodes[lk[1]]; if (!a || !b) return;
      var d, head;
      if (wide) {
        var ax = a.x + a.w / 2, bx = b.x + b.w / 2;
        if (b.y > a.y) { var my = a.y + a.h + (b.y - a.y - a.h) / 2; d = 'M' + ax + ' ' + (a.y + a.h) + ' V' + my + ' H' + bx + ' V' + (b.y - 6); head = [bx, b.y - 2, 'd']; }
        else { var my2 = b.y + b.h + (a.y - b.y - b.h) / 2; d = 'M' + ax + ' ' + a.y + ' V' + my2 + ' H' + bx + ' V' + (b.y + b.h + 6); head = [bx, b.y + b.h + 2, 'u']; }
      } else {
        var sy = a.y + a.h / 2, ty = b.y + b.h / 2;
        d = 'M' + (a.x + a.w) + ' ' + sy + ' H' + 350 + ' V' + ty + ' H' + (b.x + b.w + 8); head = [b.x + b.w + 2, ty, 'l'];
      }
      L.edges.push({ a: lk[0], b: lk[1], d: d, head: head, link: true });
    });
    L.h = y + 4;
    return L;
  }
  function headPts(p) {
    var x = p[0], y = p[1], s = 6;
    if (p[2] === 'r') return (x - s * 1.4) + ',' + (y - s) + ' ' + x + ',' + y + ' ' + (x - s * 1.4) + ',' + (y + s);
    if (p[2] === 'l') return (x + s * 1.4) + ',' + (y - s) + ' ' + x + ',' + y + ' ' + (x + s * 1.4) + ',' + (y + s);
    if (p[2] === 'd') return (x - s) + ',' + (y - s * 1.4) + ' ' + x + ',' + y + ' ' + (x + s) + ',' + (y - s * 1.4);
    return (x - s) + ',' + (y + s * 1.4) + ' ' + x + ',' + y + ' ' + (x + s) + ',' + (y + s * 1.4);
  }
  function build() {
    if (!canvas || !D) return;
    var wide = canvas.clientWidth >= 640 || window.innerWidth >= 760;
    var L = layout(wide);
    var svg = el('svg', { viewBox: '0 0 ' + L.w + ' ' + L.h, role: 'group', 'aria-label': t('cs.system') });
    L.labels.forEach(function (lb) { var tx = el('text', { x: lb[1], y: lb[2], class: 'dg-group-k' }, svg); tx.textContent = t(key(lb[0])); });
    flows = [];
    L.edges.forEach(function (e, i) {
      var p = el('path', { d: e.d, class: 'dg-edge' + (e.ctx ? ' dg-edge--ctx' : '') + (e.link ? ' dg-edge--link' : '') + (!e.ctx ? ' draw' : ''), 'data-a': e.a, 'data-b': e.b }, svg);
      if (!e.ctx) { p.setAttribute('pathLength', '1'); p.style.transitionDelay = (250 + i * 110) + 'ms'; }
      el('polygon', { points: headPts(e.head), class: 'dg-head', 'data-a': e.a, 'data-b': e.b }, svg);
      if (e.flow) flows.push({ path: p, dot: null, P: null, off: i * 0.37 });
    });
    var dots = el('g', { class: 'dg-dots' }, svg);
    flows.forEach(function (f) { f.dot = el('circle', { class: 'dg-dot', r: '3.6', cx: '-10', cy: '-10', opacity: '0' }, dots); });
    order = [];
    D.lanes.forEach(function (lane) { lane.nodes.forEach(function (id) { order.push(id); }); });
    nodes = {};
    order.forEach(function (id, i) {
      var r = L.nodes[id];
      var g = el('g', { class: 'dg-node' + (r.ctx ? ' dg-node--ctx' : ''), tabindex: '0', role: 'button', 'aria-pressed': 'false', 'data-id': id }, svg);
      g.style.transitionDelay = (i * 60) + 'ms';
      el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 10 }, g);
      var tx = el('text', { x: r.x + 14, y: r.y + r.h / 2 + 6 }, g);
      tx.textContent = t(key('n.' + id));
      g.setAttribute('aria-label', t(key('n.' + id)));
      nodes[id] = { g: g, r: r, tx: tx };
    });
    canvas.innerHTML = ''; canvas.appendChild(svg);
    // keep labels inside their boxes in every script
    var base = AG.lang() === 'bn' ? 16 : AG.lang() === 'ko' ? 16.5 : 17;
    Object.keys(nodes).forEach(function (id) {
      var n = nodes[id], size = base, room = n.r.w - 24, label = n.tx.textContent;
      n.tx.style.fontSize = size + 'px';
      // too long for one line: break at the word closest to the middle, then shrink only if still needed
      var words = label.split(' ');
      if (n.tx.getComputedTextLength() > room && words.length > 1) {
        var best = 1, diff = 1e9;
        for (var i = 1; i < words.length; i++) { var d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length); if (d < diff) { diff = d; best = i; } }
        n.tx.textContent = '';
        var cy = n.r.y + n.r.h / 2;
        [words.slice(0, best).join(' '), words.slice(best).join(' ')].forEach(function (line, k) {
          var ts = el('tspan', { x: n.r.x + 14, y: (cy + (k ? 13 : -5)).toFixed(1) }, n.tx); ts.textContent = line;
        });
      }
      while (n.tx.getComputedTextLength() / (n.tx.childNodes.length > 1 ? 1.8 : 1) > room && size > 11) { size -= .5; n.tx.style.fontSize = size + 'px'; }
    });
    flows.forEach(function (f) { f.P = lut(f.path); });
    order.forEach(function (id) {
      var g = nodes[id].g;
      g.addEventListener('click', function () { select(id, true); });
      g.addEventListener('focus', function () { select(id, true); });
      g.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') select(id, true); });
      g.addEventListener('keydown', function (e) {
        var i = order.indexOf(id);
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(id, true); }
        else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nodes[order[(i + 1) % order.length]].g.focus(); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); nodes[order[(i - 1 + order.length) % order.length]].g.focus(); }
      });
    });
    var keep = selected || D.first || order[0]; selected = null; select(keep, false);
    if (inView) start();
  }
  function laneOf(id) { for (var i = 0; i < D.lanes.length; i++) if (D.lanes[i].nodes.indexOf(id) > -1) return D.lanes[i]; return D.lanes[0]; }
  function select(id, swap) {
    if (id === selected) return;
    selected = id;
    Object.keys(nodes).forEach(function (k) { var on = k === id; nodes[k].g.classList.toggle('is-on', on); nodes[k].g.setAttribute('aria-pressed', String(on)); });
    $$('[data-a]', canvas).forEach(function (p) { p.classList.toggle('is-on', p.getAttribute('data-a') === id || p.getAttribute('data-b') === id); });
    note.innerHTML = '<p class="arch__note-k">' + t(key(laneOf(id).label)) + '</p><h3 class="arch__note-t">' + t(key('n.' + id)) + '</h3><p class="arch__note-d">' + t(key('n.' + id + '.d')) + '</p>';
    if (swap && !RM.matches) { note.classList.remove('swap'); void note.offsetWidth; note.classList.add('swap'); }
  }
  function tick(now) {
    raf = 0;
    if (!inView || RM.matches) { flows.forEach(function (f) { f.dot.setAttribute('opacity', '0'); }); return; }
    if (now - last > 32) {
      last = now;
      flows.forEach(function (f) {
        var k = ((now / 1400) + f.off) % 1, p = at(f.P, k), a = k < .12 ? k / .12 : k > .88 ? (1 - k) / .12 : 1;
        f.dot.setAttribute('cx', p[0].toFixed(1)); f.dot.setAttribute('cy', p[1].toFixed(1)); f.dot.setAttribute('opacity', a.toFixed(2));
      });
    }
    raf = requestAnimationFrame(tick);
  }
  function start() { if (!raf) raf = requestAnimationFrame(tick); }
  if (canvas && D) {
    build();
    var wasWide = canvas.clientWidth >= 640 || window.innerWidth >= 760;
    window.addEventListener('resize', function () { var w = canvas.clientWidth >= 640 || window.innerWidth >= 760; if (w !== wasWide) { wasWide = w; build(); } });
    new IntersectionObserver(function (en) { inView = en[0].isIntersecting; if (inView) start(); }, { threshold: .15 }).observe(canvas);
    document.addEventListener('ag:lang', build);
    // label widths depend on the web fonts (Bengali especially): measure again once they are ready
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  }

  /* ================= demo: sort or set aside (synthetic predictions) ================= */
  function pillDemo() {
    var box = $('[data-demo="pill-threshold"]'); if (!box) return;
    var plot = $('[data-plot]', box), thr = $('[data-thr]', box), out = $('[data-thr-out]', box);
    function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
    var r = rng(7), P = [];
    // 300 synthetic predictions: correct ones lean confident, wrong ones spread lower. Not project data.
    for (var i = 0; i < 300; i++) {
      var ok = r() < 0.9, c = ok ? 1 - Math.pow(r(), 1.8) * 0.62 : 0.32 + Math.pow(r(), 0.9) * 0.55;
      P.push({ c: Math.max(0.3, Math.min(0.995, c)), ok: ok, j: r() });
    }
    function X(c) { return 20 + (c - 0.3) / 0.7 * 960; }
    function render() {
      var th = +thr.value, auto = 0, wrong = 0;
      var s = '<svg viewBox="0 0 1000 170" role="img" aria-label="' + t('pill-sorting.demo.title') + '">';
      s += '<rect class="demo-reject" x="20" y="10" width="' + (X(th) - 20).toFixed(1) + '" height="120"/>';
      P.forEach(function (p) {
        var y = 20 + p.j * 100;
        if (p.c >= th) { auto++; if (!p.ok) wrong++; }
        s += '<circle class="' + (p.ok ? 'pt-ok' : 'pt-bad') + (p.c < th ? ' pt-out' : '') + '" cx="' + X(p.c).toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (p.ok ? 3.4 : 4.2) + '"/>';
      });
      s += '<line class="demo-thr" x1="' + X(th).toFixed(1) + '" x2="' + X(th).toFixed(1) + '" y1="4" y2="136"/>';
      s += '<line class="demo-axis" x1="20" x2="980" y1="140" y2="140"/>';
      [0.3, 0.5, 0.7, 0.9].forEach(function (v) { s += '<text class="demo-tick" x="' + X(v) + '" y="158">' + AG.num(v, { minimumFractionDigits: 1 }) + '</text>'; });
      s += '<text class="demo-tick demo-tick--k" x="980" y="158" text-anchor="end">' + t('pill-sorting.demo.axis') + '</text></svg>';
      plot.innerHTML = s;
      out.textContent = AG.num(th, { minimumFractionDigits: 2 });
      var pct = function (n) { return AG.num(Math.round(n / P.length * 100)) + '%'; };
      $('[data-stat="auto"]', box).textContent = pct(auto);
      $('[data-stat="manual"]', box).textContent = pct(P.length - auto);
      $('[data-stat="wrong"]', box).textContent = auto ? AG.num(Math.round(wrong / auto * 1000) / 10, { maximumFractionDigits: 1 }) + '%' : '–';
    }
    thr.addEventListener('input', render);
    render();
    document.addEventListener('ag:lang', render);
  }

  /* ================= demo: arm-raise angle (illustrative cut-off) ================= */
  function armDemo() {
    var box = $('[data-demo="arm-angle"]'); if (!box) return;
    var fig = $('[data-fig]', box), arm = $('[data-arm]', box), out = $('[data-arm-out]', box), state = $('[data-state]', box);
    var CUT = 130; // made up for the demonstration
    function render() {
      var a = +arm.value, rad = a * Math.PI / 180, sx = 150, sy = 92, L = 74;
      var ex = sx + Math.sin(rad) * L, ey = sy + Math.cos(rad) * L, flag = a > CUT;
      var arcR = 30, ax = sx + Math.sin(rad) * arcR, ay = sy + Math.cos(rad) * arcR;
      var s = '<svg viewBox="0 0 300 230" role="img" aria-label="' + t('lifeguard-usv.demo.title') + '">';
      s += '<path class="fig-water" d="M10 176 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/>';
      s += '<path class="fig-cut" d="M' + sx + ' ' + sy + ' L' + (sx + Math.sin(CUT * Math.PI / 180) * 96).toFixed(1) + ' ' + (sy + Math.cos(CUT * Math.PI / 180) * 96).toFixed(1) + '"/>';
      s += '<circle class="fig-head" cx="' + (sx - 26) + '" cy="58" r="17"/>';
      s += '<path class="fig-body" d="M' + (sx - 26) + ' 76 L' + (sx - 26) + ' 168 M' + (sx - 26) + ' 92 H' + sx + ' M' + (sx - 26) + ' 92 L' + (sx - 58) + ' 150"/>';
      s += '<path class="fig-ref" d="M' + sx + ' ' + sy + ' V' + (sy + 70) + '"/>';
      s += '<path class="fig-arc' + (flag ? ' is-flag' : '') + '" d="M' + sx + ' ' + (sy + arcR) + ' A' + arcR + ' ' + arcR + ' 0 ' + (a > 180 ? 1 : 0) + ' 0 ' + ax.toFixed(1) + ' ' + ay.toFixed(1) + '"/>';
      s += '<path class="fig-arm' + (flag ? ' is-flag' : '') + '" d="M' + sx + ' ' + sy + ' L' + ex.toFixed(1) + ' ' + ey.toFixed(1) + '"/>';
      [[sx - 26, 76], [sx, sy], [ex, ey], [sx - 26, 168]].forEach(function (p) { s += '<circle class="fig-lm" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4"/>'; });
      if (flag) s += '<circle class="fig-alert" cx="262" cy="36" r="10"/><path class="fig-alert-i" d="M262 30 V37 M262 41 V42"/>';
      s += '</svg>';
      fig.innerHTML = s;
      out.textContent = AG.num(a) + '°';
      state.textContent = t(flag ? 'lifeguard-usv.demo.flag' : 'lifeguard-usv.demo.ok');
      state.classList.toggle('is-flag', flag);
    }
    arm.addEventListener('input', render);
    render();
    document.addEventListener('ag:lang', render);
  }

  /* ================= demo: one shared-bicycle ride, step by step (illustrative; Phase 5) =================
     A conceptual walk-through of what the lock firmware handles during one rental. States and indicators are words,
     not measurements; no device data, settings or product models. */
  function lockJourney() {
    var box = $('[data-demo="lock-journey"]'); if (!box) return;
    var k = function (x) { return 'bike-lock.' + x; };
    var stage = $('[data-stage]', box), read = $('[data-state]', box), steps = $$('[data-step]', box), nodes = $$('[data-node]', box), info = $('[data-node-info]', box);
    var playBtn = $('[data-j-play]', box), prev = $('[data-j-prev]', box), next = $('[data-j-next]', box), rows = $$('[data-k]', box);
    var BASE = { lock: 'locked', mcu: 'asleep', ble: 'idle', gps: 'idle', modem: 'idle', battery: 'ok', temp: 'ok', hum: 'ok', tilt: 'upright', state: 'saved', wdt: 'watch' };
    var S = [
      { on: ['lock', 'mcu'], lines: [], set: {} },
      { on: ['mcu'], lines: [], set: { mcu: 'awake' } },
      { on: ['nfc', 'mcu'], lines: ['nfc'], set: { mcu: 'awake' } },
      { on: ['phone'], lines: [], set: { mcu: 'awake' } },
      { on: ['phone', 'ble', 'mcu'], lines: ['ble'], set: { mcu: 'awake', ble: 'linked' } },
      { on: ['phone', 'ble', 'mcu', 'lock'], lines: ['ble'], set: { mcu: 'awake', ble: 'linked' }, pulse: true },
      { on: ['lock', 'store'], lines: [], set: { mcu: 'awake', ble: 'linked', lock: 'unlocked', state: 'saved' }, open: true },
      { on: ['gps', 'sensors'], lines: ['gps'], set: { mcu: 'awake', lock: 'unlocked', gps: 'fix', tilt: 'moving', state: 'ready' }, open: true, ride: true },
      { on: ['lock', 'store'], lines: [], set: { mcu: 'awake', lock: 'locked', state: 'saved' } },
      { on: ['modem', 'gps', 'sensors'], lines: ['modem'], set: { mcu: 'awake', modem: 'sending', gps: 'fix' } },
      { on: ['mcu'], lines: [], set: {} }
    ];
    var cur = 0, playing = false, timer = 0, DWELL = 2800;
    function render(focus) {
      var st = S[cur], v = {}; for (var key in BASE) v[key] = BASE[key]; for (var key2 in st.set) v[key2] = st.set[key2];
      steps.forEach(function (b, i) { var on = i === cur; b.setAttribute('aria-current', on ? 'step' : 'false'); b.classList.toggle('is-done', i < cur); if (on && focus) b.focus(); });
      var bar = steps[0].closest('.lj-steps'), cb = steps[cur];
      if (bar && cb && bar.scrollWidth > bar.clientWidth) { var l = cb.getBoundingClientRect().left - bar.getBoundingClientRect().left + bar.scrollLeft; if (l < bar.scrollLeft || l + cb.offsetWidth > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = Math.max(0, l - 24); }
      nodes.forEach(function (b) { b.classList.toggle('is-active', st.on.indexOf(b.getAttribute('data-node')) > -1); });
      ['ble', 'nfc', 'gps', 'modem'].forEach(function (l) { stage.classList.toggle('line-' + l, st.lines.indexOf(l) > -1); });
      stage.classList.toggle('is-open', !!st.open); stage.classList.toggle('is-ride', !!st.ride); stage.classList.toggle('is-pulse', !!st.pulse);
      stage.classList.toggle('is-asleep', v.mcu === 'asleep');
      rows.forEach(function (r) {
        var key = r.getAttribute('data-k'), val = v[key], el = $('[data-v]', r);
        var txt = t(k('demo.v.' + (val === 'fix' ? 'fix' : val))); if (el.textContent !== txt) { el.textContent = txt; r.classList.remove('is-changed'); void r.offsetWidth; r.classList.add('is-changed'); }
        r.setAttribute('data-val', val);
      });
      read.textContent = t(k('demo.d' + (cur + 1)));
      $('.btn__label', playBtn).textContent = t(k('demo.' + (playing ? 'pause' : (cur === S.length - 1 ? 'replay' : 'play'))));
      prev.disabled = cur === 0; next.disabled = cur === S.length - 1;
    }
    function go(i, focus) { cur = Math.max(0, Math.min(S.length - 1, i)); render(focus); }
    function stop() { playing = false; clearInterval(timer); render(); }
    function play() {
      if (cur === S.length - 1) cur = 0;
      playing = true; render();
      timer = setInterval(function () { if (cur >= S.length - 1) { stop(); return; } go(cur + 1); }, RM.matches ? DWELL * 1.4 : DWELL);
    }
    playBtn.addEventListener('click', function () { if (playing) stop(); else play(); });
    prev.addEventListener('click', function () { stop(); go(cur - 1); });
    next.addEventListener('click', function () { stop(); go(cur + 1); });
    steps.forEach(function (b, i) {
      b.addEventListener('click', function () { stop(); go(i); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault(); stop(); go(cur + d, true);
      });
    });
    nodes.forEach(function (b) {
      var show = function () {
        nodes.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        var id = b.getAttribute('data-node'), m = { phone: 'ble', store: 'store', sensors: 'sensors', mcu: 'mcu', lock: 'lock', nfc: 'nfc', gps: 'gps', modem: 'modem', ble: 'ble' }[id];
        info.innerHTML = ''; var h = document.createElement('strong'); h.textContent = t(k('n.' + m)); var p = document.createElement('span'); p.textContent = t(k('n.' + m + '.d'));
        info.appendChild(h); info.appendChild(p); info.hidden = false;
      };
      b.addEventListener('click', show); b.addEventListener('mouseenter', function () { if (matchMedia('(hover: hover)').matches) show(); });
    });
    render();
    if ('IntersectionObserver' in window) {
      var seen = false;
      new IntersectionObserver(function (es) { if (es[0].isIntersecting && !seen && !RM.matches) { seen = true; play(); } }, { threshold: 0.4 }).observe(stage);
    }
    document.addEventListener('ag:lang', function () { render(); var a = nodes.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0]; if (a) a.click(); });
  }

  /* ================= demo: intake tank and pump control, simulated (synthetic; Phase 5) =================
     A live simulation with invented inflow, levels, flows and control settings. It illustrates what the system does
     (monitoring, automatic pump control, manual control, role-based access); it does not reproduce the project's
     hardware, settings or results. */
  function pumpSim() {
    var box = $('[data-demo="pump-sim"]'); if (!box) return;
    var k = function (x) { return 'pump-control.demo.' + x; };
    var plot = $('[data-plot]', box), read = $('[data-state]', box), clock = $('[data-clock]', box), playBtn = $('[data-p-play]', box), resetBtn = $('[data-p-reset]', box);
    var inBtns = $$('[data-inflow]', box), roleBtns = $$('[data-role]', box), modeBtns = $$('[data-mode]', box);
    var startBtn = $('[data-p-start]', box), stopBtn = $('[data-p-stop]', box), lock = $('[data-locked]', box), logEl = $('[data-log]', box);
    var gauge = $('[data-gauge-fill]', box), lv = $('[data-v="level"]', box), fv = $('[data-v="flow"]', box), pv = $('[data-v="pump"]', box), lamp = $('[data-lamp]', box), spark = $('[data-spark]', box);
    var START = 72, STOP = 28, W = 144, STEP = 5, TICK = 170;                 // illustrative settings; 5 simulated minutes per step
    var IN = { dry: 0.9, normal: 1.7, storm: 3.3 };
    var st, r, timer = 0, playing = false, log = [];
    function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
    function reset() {
      r = rng(23); log = []; logEl.textContent = '';
      st = { t: 6 * 60, level: 44, pump: false, auto: true, inflow: st ? st.inflow : 'normal', role: st ? st.role : 'operator', hist: [] };
      for (var i = 0; i < (RM.matches ? W : 30); i++) step(true);
    }
    function addLog(key, p) {
      var e = { tm: st.t, key: key, p: p }; log.unshift(e); if (log.length > 6) log.pop();
      var li = document.createElement('li'); li.__e = e; logEl.insertBefore(li, logEl.firstChild);
      while (logEl.children.length > 6) logEl.removeChild(logEl.lastChild);
      fillLog(li); requestAnimationFrame(function () { li.classList.add('is-in'); });
    }
    function hhmm(m) { m = ((m % 1440) + 1440) % 1440; return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }
    function fillLog(li) { var e = li.__e; li.textContent = hhmm(e.tm) + '  ' + t(k(e.key), e.p ? { x: t(k('in.' + e.p)) } : undefined); }
    function step(quiet) {
      var inflow = IN[st.inflow] * (1 + 0.3 * Math.sin(st.t / 95)) + (r() - 0.5) * 0.5;
      if (st.auto) {
        if (!st.pump && st.level >= START) { st.pump = true; if (!quiet) addLog('e.autostart'); }
        else if (st.pump && st.level <= STOP) { st.pump = false; if (!quiet) addLog('e.autostop'); }
      }
      var flow = st.pump ? 62 + 18 * Math.sin(st.t / 40) + (r() - 0.5) * 6 : 0;
      var prev = st.level;
      st.level = Math.max(0, Math.min(100, st.level + inflow - (st.pump ? 3.5 : 0)));
      st.hist.push({ t: st.t, level: st.level, flow: flow, on: st.pump, d: st.level - prev });
      if (st.hist.length > W) st.hist.shift();
      st.t += STEP;
    }
    var B = 236, H = 318, FS = '';                                     // phones: a taller chart with larger labels
    function X(i) { return 40 + i / (W - 1) * 940; }
    function Y(v) { return B - v / 100 * (B - 30); }
    function FY(v) { return (H - (FS ? 52 : 22)) - v / 100 * (FS ? 90 : 30); }
    function render() {
      var narrow = plot.clientWidth > 0 && plot.clientWidth < 600;
      H = narrow ? 760 : 318; B = narrow ? 560 : 236; FS = narrow ? ' style="font-size:40px"' : '';
      var FL = ' style="text-anchor:start' + (narrow ? ';font-size:40px' : '') + '"';
      var h = st.hist, n = h.length, s = '<svg viewBox="0 0 1000 ' + H + '" role="img" aria-label="' + t(k('title')) + '">';
      var a = -1;
      for (var i = 0; i <= n; i++) {
        var on = i < n && h[i].on;
        if (on && a < 0) a = i;
        if (!on && a >= 0) { s += '<rect class="pump-run" x="' + X(a).toFixed(1) + '" y="30" width="' + Math.max(3, X(i - 1) - X(a)).toFixed(1) + '" height="' + (B - 30) + '"/>'; a = -1; }
      }
      s += '<line class="pump-line pump-line--start" x1="40" x2="980" y1="' + Y(START) + '" y2="' + Y(START) + '"/><text class="demo-tick pump-line-t"' + FL + ' x="46" y="' + (Y(START) - (FS ? 12 : 7)) + '">' + t(k('startline')) + '</text>';
      s += '<line class="pump-line pump-line--stop" x1="40" x2="980" y1="' + Y(STOP) + '" y2="' + Y(STOP) + '"/><text class="demo-tick pump-line-t"' + FL + ' x="46" y="' + (Y(STOP) + (FS ? 44 : 17)) + '">' + t(k('stopline')) + '</text>';
      s += '<line class="demo-axis" x1="40" x2="980" y1="' + B + '" y2="' + B + '"/><line class="demo-axis" x1="40" x2="980" y1="' + (H - (FS ? 52 : 22)) + '" y2="' + (H - (FS ? 52 : 22)) + '"/>';
      var area = 'M' + X(0).toFixed(1) + ' ' + B, line = '', fl = '';
      for (var j = 0; j < n; j++) { area += ' L' + X(j).toFixed(1) + ' ' + Y(h[j].level).toFixed(1); line += X(j).toFixed(1) + ',' + Y(h[j].level).toFixed(1) + ' '; fl += X(j).toFixed(1) + ',' + FY(h[j].flow).toFixed(1) + ' '; }
      if (n) area += ' L' + X(n - 1).toFixed(1) + ' ' + B + ' Z';
      s += '<path class="pump-area" d="' + area + '"/><polyline class="pump-level" points="' + line + '"/><polyline class="pump-flow" points="' + fl + '"/>';
      for (var q = 0; q < n; q++) if (h[q].t % 120 === 0) s += '<text class="demo-tick"' + (X(q) < 90 ? ' style="text-anchor:start' + (FS ? ';font-size:40px' : '') + '"' : FS) + ' x="' + Math.max(40, X(q)).toFixed(1) + '" y="' + (H - 2) + '" text-anchor="middle">' + hhmm(h[q].t) + '</text>';
      if (n) s += '<circle class="pump-head" cx="' + X(n - 1).toFixed(1) + '" cy="' + Y(h[n - 1].level).toFixed(1) + '" r="' + (FS ? 9 : 5) + '"/>';
      plot.innerHTML = s + '</svg>';
      var last = h[n - 1] || { level: st.level, flow: 0, d: 0 };
      clock.textContent = hhmm(st.t);
      gauge.style.height = last.level.toFixed(1) + '%';
      lv.textContent = AG.num(Math.round(last.level)) + '%';
      fv.textContent = AG.num(Math.round(last.flow)) + '%';
      pv.textContent = t(k(st.pump ? 'on' : 'off')); lamp.classList.toggle('is-on', st.pump);
      var sp = ''; h.slice(-36).forEach(function (o, i) { sp += (i * 3.4).toFixed(1) + ',' + (30 - o.flow / 100 * 26).toFixed(1) + ' '; });
      spark.setAttribute('points', sp);
      var msg = !st.auto ? 'n.manual' : (!st.pump && st.level >= 96 ? 'n.high' : st.pump ? (last.d < -0.4 ? 'n.fall' : 'n.hold') : 'n.rise');
      var txt = t(k(msg)); if (read.textContent !== txt) read.textContent = txt;
      $('.btn__label', playBtn).textContent = t(k(playing ? 'pause' : 'play'));
      controls();
    }
    function controls() {
      var op = st.role === 'operator';
      roleBtns.forEach(function (b) { var on = b.getAttribute('data-role') === st.role; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
      modeBtns.forEach(function (b) { var on = (b.getAttribute('data-mode') === 'auto') === st.auto; b.setAttribute('aria-checked', String(on)); b.disabled = !op; b.tabIndex = on ? 0 : -1; });
      inBtns.forEach(function (b) { var on = b.getAttribute('data-inflow') === st.inflow; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
      startBtn.disabled = !op || st.auto || st.pump; stopBtn.disabled = !op || st.auto || !st.pump;
      lock.hidden = op; box.classList.toggle('is-viewer', !op);
    }
    function tick() { step(false); render(); }
    function play() { if (playing) return; playing = true; timer = setInterval(tick, TICK); render(); }
    function pause() { playing = false; clearInterval(timer); render(); }
    function radio(btns, attr, set) {
      btns.forEach(function (b, i) {
        b.addEventListener('click', function () { if (!b.disabled) set(b.getAttribute(attr)); });
        b.addEventListener('keydown', function (e) {
          var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
          if (!d || b.disabled) return; e.preventDefault(); var nb = btns[(i + d + btns.length) % btns.length]; set(nb.getAttribute(attr)); nb.focus();
        });
      });
    }
    radio(inBtns, 'data-inflow', function (v) { if (v === st.inflow) return; st.inflow = v; addLog('e.inflow', v); render(); });
    radio(roleBtns, 'data-role', function (v) { st.role = v; render(); });
    radio(modeBtns, 'data-mode', function (v) {
      if (st.role !== 'operator' || (v === 'auto') === st.auto) return;
      st.auto = v === 'auto'; addLog(st.auto ? 'e.auto' : 'e.manual'); render();
    });
    startBtn.addEventListener('click', function () { if (st.role !== 'operator' || st.auto || st.pump) return; st.pump = true; addLog('e.manstart'); render(); });
    stopBtn.addEventListener('click', function () { if (st.role !== 'operator' || st.auto || !st.pump) return; st.pump = false; addLog('e.manstop'); render(); });
    playBtn.addEventListener('click', function () { if (playing) pause(); else play(); });
    resetBtn.addEventListener('click', function () { var was = playing; pause(); reset(); render(); if (was) play(); });
    reset(); render();
    // runs only while visible; never starts by itself when reduced motion is preferred
    if ('IntersectionObserver' in window) {
      var seen = false, held = false;                       // held: paused only because it scrolled away
      new IntersectionObserver(function (es) {
        var vis = es[0].isIntersecting;
        if (vis && ((!seen && !RM.matches) || held)) { seen = true; held = false; play(); }
        else if (!vis && playing) { pause(); held = true; }
      }, { threshold: 0.35 }).observe(plot);
    }
    document.addEventListener('ag:lang', function () { Array.prototype.forEach.call(logEl.children, fillLog); render(); });
  }


  /* ================= demo: a week on one meter, played back (synthetic; Phase 5) =================
     A made-up week of household use at half-hour resolution with three hand-placed illustrative events. Playback,
     scrubbing and highlighting follow the earlier simulation's presentation; the highlighted spans are drawn by hand
     for each event. Nothing here detects anything. */
  function wmDemo() {
    var box = $('[data-demo="wm-events"]'); if (!box) return;
    var plot = $('[data-plot]', box), read = $('[data-state]', box), range = $('[data-wm-range]', box), playBtn = $('[data-wm-play]', box), feed = $('[data-wm-feed]', box);
    var k = function (x) { return 'water-meter.demo.' + x; };
    function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
    var N = 336, SPD = 48, r = rng(11), d = [];
    for (var i = 0; i < N; i++) {            // 7 days x 48 half-hours, litres per hour (made up)
      var h = (i % SPD) / 2, g = function (c, w, a) { var z = (h - c) / w; return a * Math.exp(-z * z / 2); };
      d.push(Math.max(0, 0.4 + g(7.5, 1.1, 32 + r() * 10) + g(19.5, 1.6, 26 + r() * 10) + g(13, 2.2, 7) + r() * 2.6));
    }
    // illustrative events, in half-hour indices
    var EV = [
      { id: 'stuck', a: 61, b: 109 },          // day 2 midday to day 3 midday: the reading does not change
      { id: 'leak', a: 144, b: N - 1 },        // from day 4: a small flow that never stops
      { id: 'burst', a: 220, b: 224 }          // day 5: two hours far above the rest of the week
    ];
    for (var q = EV[0].a; q <= EV[0].b; q++) d[q] = d[EV[0].a - 1];
    for (q = EV[1].a; q < N; q++) d[q] += 6;
    for (q = EV[2].a; q < EV[2].b; q++) d[q] += 92 + r() * 8;
    var T = N - 1, playing = false, raf2 = 0, t0 = 0, tStart = 0, DUR = 11000, shown = {};
    var H = 290, FS = '', FT = '';
    function X(i) { return 40 + i / (N - 1) * 940; }
    function Y(v) { return (H - 40) - Math.min(v, 140) / 140 * (H - 76); }
    function render() {
      var narrow = plot.clientWidth > 0 && plot.clientWidth < 600;          // phones: taller chart, larger labels
      H = narrow ? 620 : 290; FS = narrow ? ' style="font-size:34px"' : ''; FT = narrow ? ' style="font-size:36px"' : '';
      var s = '<svg viewBox="0 0 1000 ' + H + '" role="img" aria-label="' + t(k('title')) + '">';
      for (var day = 0; day < 7; day++) {
        s += '<rect class="wm-night" x="' + X(day * SPD).toFixed(1) + '" y="30" width="' + (X(12) - X(0)).toFixed(1) + '" height="' + (H - 70) + '"/>';
        s += '<text class="demo-tick"' + FS + ' x="' + X(day * SPD + 24).toFixed(1) + '" y="' + (H - (FS ? 2 : 14)) + '">' + (FS ? AG.num(day + 1) : t(k('day'), { n: AG.num(day + 1) })) + '</text>';
      }
      s += '<line class="demo-axis" x1="40" x2="980" y1="' + (H - 40) + '" y2="' + (H - 40) + '"/>';
      var active = null;
      EV.forEach(function (e) {
        if (T < e.a) return;
        var end = Math.min(T, e.b), w = Math.max(6, X(end) - X(e.a));
        var op = Math.min(1, (T - e.a + 1) / 10);          // fades in over the first five hours of playback
        s += '<g class="wm-ev wm-ev--' + e.id + '" style="opacity:' + op.toFixed(2) + '"><rect class="wm-ev__area" x="' + X(e.a).toFixed(1) + '" y="30" width="' + w.toFixed(1) + '" height="' + (H - 70) + '" rx="3"/>';
        s += '<line class="wm-ev__start" x1="' + X(e.a).toFixed(1) + '" x2="' + X(e.a).toFixed(1) + '" y1="30" y2="' + (H - 40) + '"/>';
        var ty = FT ? [72, 116, 160][EV.indexOf(e)] : 48;
        s += '<text class="wm-ev__tag"' + FT + ' x="' + (X(e.a) + 8).toFixed(1) + '" y="' + ty + '"' + (X(e.a) > (FT ? 560 : 760) ? ' text-anchor="end" dx="-16"' : '') + '>' + t(k(e.id)) + '</text></g>';
        if (T <= e.b && T < N - 1) active = e;
      });
      var pts = ''; for (var p2 = 0; p2 <= T; p2++) pts += X(p2).toFixed(1) + ',' + Y(d[p2]).toFixed(1) + ' ';
      s += '<polyline class="wm-use" points="' + pts + '"/>';
      s += '<line class="sim-cursor" x1="' + X(T).toFixed(1) + '" x2="' + X(T).toFixed(1) + '" y1="26" y2="' + (H - 36) + '"/>';
      s += '<circle class="wm-head" cx="' + X(T).toFixed(1) + '" cy="' + Y(d[T]).toFixed(1) + '" r="' + (FS ? 9 : 4.5) + '"/></svg>';
      plot.innerHTML = s;
      range.value = T;
      var passed = EV.filter(function (e) { return T >= e.a; });
      var msg = active ? t(k('s.' + active.id)) : (passed.length === EV.length ? t(k('done')) : t(k('s.none')));
      if (read.textContent !== msg) read.textContent = msg;
      read.classList.toggle('is-flag', !!active);
      EV.forEach(function (e) {
        var on = T >= e.a, li = shown[e.id];
        if (on && !li) {
          li = document.createElement('li'); var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'wm-feed__item wm-feed__item--' + e.id;
          bt.addEventListener('click', function () { stop(); T = Math.min(e.b, e.a + 12); render(); });
          li.appendChild(bt); shown[e.id] = li;
          var after = null; EV.forEach(function (o) { if (o.a > e.a && shown[o.id] && !after) after = shown[o.id]; });
          feed.insertBefore(li, after); requestAnimationFrame(function () { li.classList.add('is-in'); });
        }
        if (!on && li) { li.remove(); delete shown[e.id]; }
        if (li) li.firstChild.textContent = t(k('day'), { n: AG.num(Math.floor(e.a / SPD) + 1) }) + ' · ' + t(k(e.id));
      });
      feed.parentNode.classList.toggle('is-empty', !passed.length);
      $('.btn__label', playBtn).textContent = playing ? t(k('pause')) : (T >= N - 1 ? t(k('replay')) : t(k('play')));
    }
    function stop() { playing = false; cancelAnimationFrame(raf2); raf2 = 0; render(); }
    function step(now) {
      if (!t0) t0 = now;
      T = Math.min(N - 1, Math.round(tStart + (now - t0) / DUR * (N - 1)));
      render();
      if (T >= N - 1) { stop(); return; }
      raf2 = requestAnimationFrame(step);
    }
    function play() {
      if (T >= N - 1) T = 0;
      if (RM.matches) { T = N - 1; render(); return; }
      playing = true; t0 = 0; tStart = T; raf2 = requestAnimationFrame(step);
    }
    playBtn.addEventListener('click', function () { if (playing) stop(); else play(); });
    range.addEventListener('input', function () { if (playing) { playing = false; cancelAnimationFrame(raf2); raf2 = 0; } T = +range.value; render(); });
    // start at the beginning and play once when the demo first scrolls into view (full week at once with reduced motion)
    T = RM.matches ? N - 1 : 0; render();
    if (!RM.matches && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); if (!playing && T === 0) play(); } }, { threshold: 0.45 });
      io.observe(plot);
    } else if (!RM.matches) play();
    document.addEventListener('ag:lang', render);
    var rz = 0; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(render, 150); });
  }

  if (CFG.demo === 'wm-events') wmDemo();

  if (CFG.demo === 'pill-threshold') pillDemo();
  if (CFG.demo === 'pump-sim') pumpSim();
  if (CFG.demo === 'lock-journey') lockJourney();
  if (CFG.demo === 'arm-angle') armDemo();
})();

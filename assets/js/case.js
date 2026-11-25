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


  if (CFG.demo === 'pill-threshold') pillDemo();
  if (CFG.demo === 'arm-angle') armDemo();
})();

/* Auntu Gain, Phase 4C design (4D performance pass, 4E framing fix): project illustrations.
   Original line drawings for the lit surface. Each one shows the verified system for its project
   (sources: the October 2026 CV and the current website). Everything is conceptual and not to scale:
   no sensor placements, algorithms, thresholds or data from the real projects. Any data-like
   chart is synthetic. Simple loops run in CSS; choreographed motion runs from one shared ticker
   and only while an illustration is visible. Reduced motion shows one representative still frame. */
(function () {
  'use strict';
  var FG = '#EEE9DF', AC = '#E1B470', OK = '#9FC2A9', WA = '#9DBFD3', NIGHT = '#1B2329';
  function f(n) { return Math.round(n * 10) / 10; }
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function svg(body) {
    // decorative: every placement carries a localized caption, so the drawing is hidden from assistive tech.
    // Phase 4E: "meet", not "slice". Every container shows the whole 800 x 500 drawing; containers are sized
    // near 8:5 and the dark surface continues behind any spare width (4D cropped the top and bottom).
    return '<svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
  }
  function s(o) { return 'stroke="' + (o.c || FG) + '"' + (o.o != null ? ' stroke-opacity="' + o.o + '"' : '') + (o.w ? ' stroke-width="' + o.w + '"' : ''); }
  function q(root, sel) { return root.querySelector(sel); }
  function qa(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); }
  function win(t, a, b) { return ease((t - a) / (b - a)); }                       // 0 to 1 between a and b
  function pulse(t, a, b, c, d) { return Math.min(win(t, a, b), 1 - win(t, c, d)); } // up a..b, down c..d
  // Phase 4D: SVG path geometry is sampled once into a lookup table (4C called getPointAtLength
  // several times per frame per illustration)
  function lut(path) {
    var L = path.getTotalLength(), n = Math.max(48, Math.min(400, Math.round(L / 4))), pts = new Float32Array((n + 1) * 2);
    for (var i = 0; i <= n; i++) { var p = path.getPointAtLength(L * i / n); pts[2 * i] = p.x; pts[2 * i + 1] = p.y; }
    return { L: L, n: n, pts: pts };
  }
  function at(path, len) {
    var P = path.__lut || (path.__lut = lut(path));
    var f = Math.max(0, Math.min(1, len / P.L)) * P.n, i = Math.min(P.n - 1, Math.floor(f)), k = f - i, a = P.pts;
    return [a[2 * i] + (a[2 * i + 2] - a[2 * i]) * k, a[2 * i + 1] + (a[2 * i + 3] - a[2 * i + 1]) * k];
  }
  function heading(path, len) { var a = at(path, len - 2), b = at(path, len + 2); return Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; }
  function lerpAngle(a, b, k) { var d = ((b - a + 540) % 360) - 180; return a + d * k; }
  var A = {};


  /* =====================================================================
     1 · Adaptive edge anomaly detection (flagship). A household supply line, the meter, an edge
     device, and a synthetic consumption trace in which a small continuous night flow appears.
     Generic and synthetic by design: no method, band, threshold or real data. */
  A.p1 = {
    rmT: 6.2,
    svg: function () {
      var b = '';
      b += '<path d="M44 198 V114 L94 76 L144 114 V198" ' + s({ o: .5 }) + '/><path d="M30 198 H160" ' + s({ o: .25 }) + '/>';
      b += '<rect x="82" y="152" width="22" height="46" ' + s({ o: .28 }) + '/><rect x="58" y="122" width="18" height="16" ' + s({ o: .22 }) + '/>';
      b += '<path d="M144 128 H780 M144 152 H780" ' + s({ o: .3 }) + '/>';
      b += '<path class="a-flow a-rev" d="M780 140 H146" ' + s({ c: WA, o: .75, w: 2 }) + '/>';
      b += '<path data-drip d="M176 156 c4 7 4 11 0 13 c-4 -2 -4 -6 0 -13z" fill="' + WA + '" fill-opacity=".8"/>';
      b += '<circle cx="280" cy="140" r="46" fill="' + NIGHT + '" ' + s({ o: .75, w: 1.5 }) + '/><circle cx="280" cy="140" r="35" ' + s({ o: .16 }) + '/>';
      for (var k = 0; k < 24; k++) {
        var an = k / 24 * Math.PI * 2, r1 = k % 6 ? 39 : 37;
        b += '<line x1="' + f(280 + Math.cos(an) * r1) + '" y1="' + f(140 + Math.sin(an) * r1) + '" x2="' + f(280 + Math.cos(an) * 42) + '" y2="' + f(140 + Math.sin(an) * 42) + '" ' + s({ o: k % 6 ? .2 : .45 }) + '/>';
      }
      b += '<rect x="262" y="112" width="36" height="12" rx="2" ' + s({ o: .4 }) + '/>';
      for (k = 0; k < 4; k++) b += '<rect x="' + (266 + k * 8) + '" y="115" width="5" height="6" rx="1" fill="' + FG + '" fill-opacity="' + (k === 3 ? .7 : .3) + '"/>';
      b += '<g data-dial><line x1="280" y1="150" x2="280" y2="132" ' + s({ c: AC, w: 2 }) + '/></g><circle cx="280" cy="150" r="3" fill="' + AC + '"/>';
      b += '<path d="M280 186 V226" ' + s({ o: .3 }) + ' stroke-dasharray="2 5"/><circle data-pkt cx="280" cy="186" r="3.2" fill="' + AC + '"/>';
      b += '<rect x="222" y="226" width="116" height="72" rx="10" fill="#222B32" ' + s({ o: .6 }) + '/>';
      b += '<rect x="258" y="241" width="44" height="42" rx="4" ' + s({ o: .7 }) + '/>';
      for (k = 0; k < 5; k++) b += '<path d="M250 ' + (247 + k * 7) + ' h8 M302 ' + (247 + k * 7) + ' h8" ' + s({ o: .4 }) + '/>';
      b += '<rect x="268" y="251" width="24" height="22" rx="2" fill="' + AC + '" fill-opacity=".16" ' + s({ c: AC, o: .6 }) + '/>';
      b += '<circle class="a-blink-slow" cx="326" cy="238" r="3" fill="' + OK + '"/>';
      b += '<path d="M338 262 H384" ' + s({ o: .3 }) + '/><path class="a-flow" d="M338 262 H384" ' + s({ c: AC, o: .8, w: 2 }) + '/>';
      b += '<rect x="384" y="204" width="384" height="232" rx="12" fill="' + FG + '" fill-opacity=".025" ' + s({ o: .16 }) + '/>';
      for (k = 1; k < 5; k++) b += '<path d="M' + f(400 + k * 70.4) + ' 220 V420" ' + s({ o: .07 }) + '/>';
      b += '<rect x="400" y="396" width="352" height="14" fill="' + FG + '" fill-opacity=".06"/>';
      b += '<path d="M400 410 H752" ' + s({ o: .25 }) + '/>';
      // synthetic five-day consumption: morning and evening use, near-zero nights, then a small continuous flow
      var r = rng(29), norm = [], leak = [], onset = 3.35;
      for (var x = 400; x <= 752; x += 2) {
        var d = (x - 400) / 70.4, h = (d % 1) * 24;
        var g = function (c, w, a) { var z = (h - c) / w; return a * Math.exp(-z * z / 2); };
        var v = 1.5 + g(7.2, 1.1, 52 + r() * 10) + g(19.4, 1.5, 40 + r() * 10) + g(13, 2.2, 12) + r() * 3;
        if (d >= onset) v += 10;
        var p = [x, f(410 - v * 2.3)];
        if (d < onset) norm.push(p); else { if (!leak.length) leak.push(norm[norm.length - 1]); leak.push(p); }
      }
      var pts = function (a) { return a.map(function (p) { return p[0] + ',' + p[1]; }).join(' '); };
      b += '<polyline data-series points="' + pts(norm) + '" ' + s({ o: .85, w: 1.6 }) + '/>';
      b += '<polyline data-leak points="' + pts(leak) + '" ' + s({ c: AC, w: 1.9 }) + '/>';
      var ex = f(400 + (4 + 3 / 24) * 70.4);
      b += '<g data-event><path d="M' + ex + ' 384 V236" ' + s({ c: AC, o: .55 }) + ' stroke-dasharray="3 5"/>' +
        '<path d="M' + (ex - 11) + ' 236 h22 l-4 -6 v-9 a7 7 0 0 0 -14 0 v9 z" fill="' + AC + '" fill-opacity=".14" ' + s({ c: AC, w: 1.4 }) + '/>' +
        '<circle cx="' + ex + '" cy="385" r="4.5" fill="' + AC + '"/><circle class="a-pulse" cx="' + ex + '" cy="385" r="9" ' + s({ c: AC, o: .6 }) + '/></g>';
      return svg(b);
    },
    setup: function (el) {
      var series = q(el, '[data-series]'), lk = q(el, '[data-leak]'), ev = q(el, '[data-event]');
      var dial = q(el, '[data-dial]'), pkt = q(el, '[data-pkt]'), drip = q(el, '[data-drip]');
      var L1 = series.getTotalLength(), L2 = lk.getTotalLength();
      series.style.strokeDasharray = L1; lk.style.strokeDasharray = L2;
      return function (T) {
        var t = T % 8;
        var p = win(t, 0.2, 4.6), share = L1 / (L1 + L2), fade = 1 - win(t, 7.3, 7.9);
        series.style.strokeDashoffset = f(L1 * (1 - Math.min(1, p / share)));
        lk.style.strokeDashoffset = f(L2 * (1 - Math.max(0, (p - share) / (1 - share))));
        series.style.opacity = lk.style.opacity = fade;
        ev.style.opacity = pulse(t, 4.6, 5.0, 7.3, 7.9);
        dial.setAttribute('transform', 'rotate(' + f(T * 140 % 360) + ' 280 150)');
        var k = (T % 1.2) / 1.2; pkt.setAttribute('cy', f(186 + k * 40)); pkt.style.opacity = 1 - win(k, .8, 1);
        var dk = (T % 2.6) / 2.6; drip.setAttribute('transform', 'translate(0 ' + f(dk * 18) + ')'); drip.style.opacity = 1 - win(dk, .55, .95);
      };
    }
  };


  /* =====================================================================
     2 · Autonomous water-treatment skimmer. Top-down pool, repeatable coverage mission, LiDAR
     scan near the walls, GNSS fix, then AprilTag-guided docking, electromagnetic retention and
     wireless charging. Hull shape and sensor positions are schematic. */
  A.p2 = {
    rmT: 14.6,
    svg: function () {
      var b = '';
      b += '<rect x="70" y="70" width="560" height="360" rx="34" ' + s({ o: .5, w: 1.4 }) + '/><rect x="84" y="84" width="532" height="332" rx="24" ' + s({ o: .12 }) + '/>';
      for (var k = 0; k < 5; k++) b += '<path class="a-ripple" style="animation-delay:-' + k * 1.1 + 's" d="M' + (120 + k * 90) + ' ' + (110 + (k % 3) * 120) + ' q12 -6 24 0 t24 0" ' + s({ c: WA, o: .22 }) + '/>';
      var d = 'M140 130', down = true;
      for (var x = 140; x <= 500; x += 60) { d += ' L' + x + ' ' + (down ? 370 : 130); if (x < 500) d += ' L' + (x + 60) + ' ' + (down ? 370 : 130); down = !down; }
      d += ' L556 250 L572 250';
      b += '<path data-route d="' + d + '" ' + s({ o: .2, w: 1.5 }) + ' stroke-dasharray="1 8"/>';
      b += '<path data-trail d="' + d + '" ' + s({ c: WA, o: .55, w: 2 }) + '/>';
      // dock, tag, retention magnet, charging coil
      b += '<rect x="630" y="192" width="84" height="116" rx="8" fill="#202830" ' + s({ o: .55 }) + '/>';
      b += '<rect x="606" y="234" width="32" height="32" rx="2" fill="' + FG + '" fill-opacity=".92"/>';
      [[1, 1, 0, 1], [0, 1, 1, 0], [1, 0, 0, 1], [1, 1, 0, 0]].forEach(function (row, i) { row.forEach(function (c, j) { if (c) b += '<rect x="' + (610 + j * 6) + '" y="' + (238 + i * 6) + '" width="6" height="6" fill="' + NIGHT + '"/>'; }); });
      b += '<rect x="609" y="237" width="26" height="26" ' + s({ c: NIGHT, w: 1.2 }) + '/>';
      b += '<g data-coil><circle cx="676" cy="232" r="8" ' + s({ c: AC, o: .8 }) + '/><circle cx="676" cy="232" r="14" ' + s({ c: AC, o: .5 }) + '/><circle cx="676" cy="232" r="20" ' + s({ c: AC, o: .25 }) + '/></g>';
      b += '<g data-mag><path d="M666 266 v14 a10 10 0 0 0 20 0 v-14" ' + s({ c: AC, w: 3 }) + '/><path d="M660 266 h12 M680 266 h12" ' + s({ c: AC, w: 2 }) + '/></g>';
      // vessel, drawn at the origin heading +x; camera cone and LiDAR scan ride with it
      b += '<g data-boat>' +
        '<path data-cone d="M26 0 L92 -24 L92 24 Z" fill="' + FG + '" fill-opacity=".07" ' + s({ o: .28 }) + '/>' +
        '<path d="M6 0 L80 -46 A90 90 0 0 1 80 46 Z" fill="' + AC + '" fill-opacity=".05"/>' +
        '<path data-scan d="M6 0 L86 0" ' + s({ c: AC, o: .7 }) + '/>' +
        '<path d="M-24 -13 H10 Q26 -13 28 0 Q26 13 10 13 H-24 Q-28 13 -28 0 Q-28 -13 -24 -13 Z" fill="' + NIGHT + '" ' + s({ w: 1.5 }) + '/>' +
        '<rect x="-20" y="-7" width="14" height="14" rx="2" ' + s({ o: .5 }) + '/><path d="M-17 -7 v14 M-13 -7 v14 M-9 -7 v14" ' + s({ o: .25 }) + '/>' +
        '<circle cx="6" cy="0" r="4.5" fill="' + AC + '" fill-opacity=".25" ' + s({ c: AC, w: 1.4 }) + '/>' +
        '<circle cx="-22" cy="9" r="2.4" fill="' + OK + '"/><circle class="a-pulse" cx="-22" cy="9" r="6" ' + s({ c: OK, o: .6 }) + '/>' +
        '</g>';
      return svg(b);
    },
    setup: function (el) {
      var route = q(el, '[data-route]'), trail = q(el, '[data-trail]'), boat = q(el, '[data-boat]');
      var cone = q(el, '[data-cone]'), scan = q(el, '[data-scan]'), coil = q(el, '[data-coil]'), mag = q(el, '[data-mag]');
      var L = route.getTotalLength(), Lm = L - 148.4, hd = 90, lastT = -9;
      trail.style.strokeDasharray = L;
      return function (T) {
        var t = T % 16;
        var len = t < 12.4 ? (t / 12.4) * Lm : Lm + (L - Lm) * win(t, 12.4, 14);
        var p = at(route, len);
        var want = heading(route, Math.min(L - 3, len));
        hd = Math.abs(T - lastT) > 0.5 ? want : lerpAngle(hd, want, 0.16); lastT = T;
        boat.setAttribute('transform', 'translate(' + f(p[0]) + ' ' + f(p[1]) + ') rotate(' + f(hd) + ')');
        boat.style.opacity = Math.min(win(t, 0, .4), 1 - win(t, 15.5, 16));
        trail.style.strokeDashoffset = f(L - len); trail.style.opacity = 1 - win(t, 15.4, 16);
        scan.setAttribute('transform', 'rotate(' + f(Math.sin(T * 3.2) * 40) + ' 6 0)');
        scan.style.opacity = 1 - win(t, 12, 12.6);
        cone.style.opacity = pulse(t, 11.8, 12.4, 14.4, 15);
        var dock = pulse(t, 14, 14.3, 15.4, 15.9);
        coil.style.opacity = .25 + .75 * dock; mag.style.opacity = .35 + .65 * dock;
      };
    }
  };

  /* =====================================================================
     3 · Robotic pill-sorting vision system. Feed, camera station, front and back images, class
     confidences, then either a class output or rejection to manual handling. The output
     mechanism is drawn as routes only; the real hardware is not depicted. */
  A.p3 = {
    rmT: 7.4,
    svg: function () {
      var b = '';
      b += '<path d="M40 291 H520 M40 309 H520" ' + s({ o: .3 }) + '/>';
      b += '<path class="a-flow" d="M40 300 H520" ' + s({ o: .16, w: 1.2 }) + '/>';
      b += '<path d="M276 186 L248 290 H352 L324 186 Z" fill="' + FG + '" fill-opacity=".04"/><path d="M276 186 L248 290 M324 186 L352 290" ' + s({ o: .14 }) + '/>';
      b += '<rect x="278" y="146" width="44" height="32" rx="5" fill="#222B32" ' + s({ o: .7 }) + '/><circle cx="300" cy="182" r="7" fill="' + NIGHT + '" ' + s({ c: AC, w: 1.4 }) + '/><path d="M300 120 V146" ' + s({ o: .3 }) + '/>';
      // front and back image pair
      b += '<g data-tiles>' +
        '<rect x="368" y="104" width="64" height="64" rx="6" fill="' + FG + '" fill-opacity=".04" ' + s({ o: .45 }) + '/><rect x="446" y="104" width="64" height="64" rx="6" fill="' + FG + '" fill-opacity=".04" ' + s({ o: .45 }) + '/>' +
        '<rect x="380" y="126" width="40" height="20" rx="10" ' + s({ w: 1.4 }) + '/><path d="M392 136 h7 M403 132 v8" ' + s({ o: .6 }) + '/>' +
        '<rect x="458" y="126" width="40" height="20" rx="10" ' + s({ w: 1.4 }) + '/><path d="M478 128 v16" ' + s({ o: .6 }) + '/>' +
        '<path d="M330 160 C346 160 352 140 366 136" ' + s({ o: .3 }) + ' stroke-dasharray="2 4"/></g>';
      // class confidences, one bar per class
      b += '<path d="M540 196 H760" ' + s({ o: .3 }) + '/>';
      for (var i = 0; i < 16; i++) b += '<rect data-bar x="' + f(544 + i * 13.6) + '" y="196" width="8" height="0" rx="1.5" fill="' + FG + '" fill-opacity=".55"/>';
      b += '<path d="M514 136 C528 136 530 160 540 170" ' + s({ o: .3 }) + ' stroke-dasharray="2 4"/>';
      // decision to the sorting controller, controller to the outputs
      b += '<path d="M650 206 V236" ' + s({ o: .3 }) + ' stroke-dasharray="2 4"/>';
      b += '<rect x="612" y="236" width="76" height="34" rx="6" fill="#222B32" ' + s({ o: .6 }) + '/><circle data-led cx="628" cy="253" r="3.5" fill="' + OK + '"/><path d="M640 248 h36 M640 258 h24" ' + s({ o: .3 }) + '/>';
      b += '<path d="M650 270 V284" ' + s({ o: .25 }) + ' stroke-dasharray="2 4"/>';
      [580, 630, 680, 730].forEach(function (x, k) { b += '<path d="M' + (x - 18) + ' 378 V428 H' + (x + 18) + ' V378" ' + s({ o: k === 1 ? .7 : .38, w: 1.4 }) + '/>'; });
      b += '<path d="M760 404 h2 M770 404 h2" ' + s({ o: .4, w: 2 }) + '/>';
      b += '<path data-tray d="M468 386 V428 H532 V386" ' + s({ c: AC, w: 1.6 }) + ' stroke-dasharray="4 4"/>';
      b += '<path data-ra d="M40 300 H540 C590 300 630 330 630 404" stroke="none"/>';
      b += '<path data-rb d="M40 300 H420 C470 300 500 330 500 408" stroke="none"/>';
      b += '<path d="M540 300 C590 300 630 330 630 378 M420 300 C470 300 500 330 500 386" ' + s({ o: .14 }) + ' stroke-dasharray="2 6"/>';
      var pill = function (id) { return '<g data-' + id + '><rect x="-17" y="-8" width="34" height="16" rx="8" fill="' + NIGHT + '" ' + s({ w: 1.5 }) + '/><path d="M0 -8 V8" ' + s({ o: .5 }) + '/></g>'; };
      b += pill('pa') + pill('pb');
      return svg(b);
    },
    setup: function (el) {
      var ra = q(el, '[data-ra]'), rb = q(el, '[data-rb]'), pa = q(el, '[data-pa]'), pb = q(el, '[data-pb]');
      var tiles = q(el, '[data-tiles]'), bars = qa(el, '[data-bar]'), tray = q(el, '[data-tray]'), led = q(el, '[data-led]');
      var La = ra.getTotalLength(), Lb = rb.getTotalLength();
      var sure = bars.map(function (_, i) { return i === 5 ? 92 : 6 + (i * 37 % 11); });
      var unsure = bars.map(function (_, i) { return 18 + (i * 53 % 23); });
      function place(g, path, L, t) {
        if (t < 0) { g.style.opacity = 0; return; }
        var len = t < 1.6 ? win(t, 0, 1.6) * 260 : t < 2.8 ? 260 : 260 + (L - 260) * win(t, 2.8, 4.3);
        var p = at(path, len);
        g.setAttribute('transform', 'translate(' + f(p[0]) + ' ' + f(p[1]) + ')');
        g.style.opacity = Math.min(win(t, 0, .3), 1 - win(t, 4.4, 4.9));
      }
      return function (T) {
        var t = T % 10;
        place(pa, ra, La, t < 5 ? t : -1);
        place(pb, rb, Lb, t >= 5 ? t - 5 : -1);
        tiles.style.opacity = Math.max(pulse(t, 1.5, 1.8, 2.8, 3.2), pulse(t, 6.5, 6.8, 7.8, 8.2));
        var ka = pulse(t, 1.8, 2.4, 3.6, 4.2), kb = pulse(t, 6.8, 7.4, 8.6, 9.2);
        bars.forEach(function (bar, i) {
          var h = sure[i] * ka + unsure[i] * kb;
          bar.setAttribute('y', f(196 - h)); bar.setAttribute('height', f(h));
          bar.setAttribute('fill', i === 5 && ka > .1 ? AC : FG);
        });
        tray.style.opacity = .45 + .55 * pulse(t, 8.8, 9.1, 9.6, 9.95);
        led.setAttribute('fill', kb > .3 ? AC : OK);
      };
    }
  };

  /* =====================================================================
     4 · Lifeguard autonomous surface vehicle. Camera and LiDAR on the vessel, a person in the
     water with a raised arm, detection, pose landmarks with the arm-raise angle, and an alert to
     the operator's ground station. It shows a flagged posture and an alert, not a rescue. */
  A.p4 = {
    rmT: 5.2,
    svg: function () {
      var b = '';
      b += '<path d="M30 196 H170" ' + s({ o: .3 }) + '/><path d="M170 196 Q190 200 210 214" ' + s({ o: .2 }) + '/>';
      b += '<g data-gs><rect x="70" y="150" width="62" height="38" rx="4" fill="#222B32" ' + s({ o: .6 }) + '/><path d="M62 192 H140" ' + s({ o: .6 }) + '/><rect data-gscreen x="76" y="156" width="50" height="26" rx="2" fill="' + AC + '" fill-opacity="0"/></g>';
      b += '<path d="M210 214 H790" ' + s({ o: .14 }) + '/>';
      b += '<g class="a-waves">';
      for (var k = 0; k < 7; k++) {
        var y = 232 + k * 30, d = 'M-40 ' + y;
        for (var x = -40; x <= 840; x += 40) d += ' q10 -' + f(5 - k * .4) + ' 20 0 t20 0';
        b += '<path d="' + d + '" ' + s({ c: WA, o: (.34 - k * .035).toFixed(2) }) + '/>';
      }
      b += '</g>';
      // an obstacle and its LiDAR returns
      b += '<path d="M430 268 l10 -22 l10 22 z" fill="' + NIGHT + '" ' + s({ o: .6 }) + '/>';
      for (k = 0; k < 5; k++) b += '<circle cx="' + (428 + k * 2) + '" cy="' + (262 - k * 4) + '" r="1.6" fill="' + AC + '" fill-opacity=".8"/>';
      // vessel
      b += '<g data-usv><path d="M176 268 H318 L298 290 H196 Z" fill="' + NIGHT + '" ' + s({ w: 1.6 }) + '/><path d="M214 268 V250 H262 V268" ' + s({ o: .6 }) + '/>' +
        '<path d="M238 250 V200" ' + s({ o: .7 }) + '/><rect x="227" y="214" width="22" height="9" rx="2" fill="' + AC + '" fill-opacity=".2" ' + s({ c: AC }) + '/>' +
        '<rect x="228" y="192" width="20" height="12" rx="3" fill="#222B32" ' + s({ o: .8 }) + '/><circle cx="244" cy="198" r="2.6" fill="' + AC + '"/>' +
        '<path class="a-pulse" d="M322 276 a8 8 0 0 1 0 -12" ' + s({ o: .5 }) + '/></g>';
      b += '<path d="M248 198 L560 150 L560 300 Z" fill="' + FG + '" fill-opacity=".035"/><path data-sweep d="M248 198 L560 226" ' + s({ o: .35 }) + '/>';
      // a person in the water with one arm raised
      b += '<g data-person><circle cx="566" cy="244" r="11" fill="' + NIGHT + '" ' + s({ w: 1.6 }) + '/>' +
        '<path d="M548 268 Q566 256 584 268" ' + s({ w: 1.6 }) + '/><path d="M581 262 L594 232 L600 202" ' + s({ w: 2 }) + '/>' +
        '<path d="M540 270 q13 -6 26 0 t26 0" ' + s({ c: WA, o: .7 }) + '/></g>';
      b += '<g data-box>';
      [[530, 188, 1, 1], [612, 188, -1, 1], [530, 284, 1, -1], [612, 284, -1, -1]].forEach(function (c) {
        b += '<path d="M' + c[0] + ' ' + (c[1] + 14 * c[3]) + ' V' + c[1] + ' H' + (c[0] + 14 * c[2]) + '" ' + s({ c: AC, w: 2 }) + '/>';
      });
      b += '</g>';
      b += '<g data-pose><path d="M566 244 V262 M552 262 H581 L594 232 L600 202" ' + s({ c: AC, o: .85, w: 1.2 }) + '/>' +
        '<circle cx="566" cy="244" r="2.6" fill="' + AC + '"/><circle cx="581" cy="262" r="2.6" fill="' + AC + '"/><circle cx="552" cy="262" r="2.6" fill="' + AC + '"/><circle cx="594" cy="232" r="2.6" fill="' + AC + '"/><circle cx="600" cy="202" r="2.6" fill="' + AC + '"/>' +
        '<path data-angle d="M581 238 A24 24 0 0 1 590.6 240" ' + s({ c: AC, w: 1.6 }) + '/><path d="M581 262 V232" ' + s({ c: AC, o: .45 }) + ' stroke-dasharray="2 3"/></g>';
      b += '<path data-link d="M238 196 C220 120 160 110 120 148" ' + s({ c: AC, o: .4 }) + ' stroke-dasharray="3 5"/><circle data-alert r="4" fill="' + AC + '"/>';
      return svg(b);
    },
    setup: function (el) {
      var sweep = q(el, '[data-sweep]'), box = q(el, '[data-box]'), pose = q(el, '[data-pose]'), ang = q(el, '[data-angle]');
      var link = q(el, '[data-link]'), alert = q(el, '[data-alert]'), scr = q(el, '[data-gscreen]'), person = q(el, '[data-person]'), usv = q(el, '[data-usv]');
      var LL = link.getTotalLength(), LA = ang.getTotalLength();
      ang.style.strokeDasharray = LA;
      return function (T) {
        var t = T % 8, bob = 'translate(0 ' + f(Math.sin(T * 1.9) * 2.5) + ')';
        sweep.setAttribute('transform', 'rotate(' + f(Math.sin(T * 1.6) * 9) + ' 248 198)');
        person.setAttribute('transform', bob); pose.setAttribute('transform', bob); box.setAttribute('transform', bob);
        usv.setAttribute('transform', 'translate(0 ' + f(Math.sin(T * 1.5 + 1) * 1.6) + ')');
        var on = 1 - win(t, 7.3, 7.9);
        box.style.opacity = win(t, 1.2, 1.5) * on;
        pose.style.opacity = win(t, 1.9, 2.3) * on;
        ang.style.strokeDashoffset = f(LA * (1 - win(t, 2.4, 3.1)));
        var p = at(link, win(t, 3.4, 4.7) * LL);
        alert.setAttribute('cx', f(p[0])); alert.setAttribute('cy', f(p[1]));
        alert.style.opacity = pulse(t, 3.4, 3.5, 4.6, 4.75);
        link.style.opacity = .15 + .5 * pulse(t, 3.3, 3.5, 6.8, 7.4);
        scr.setAttribute('fill-opacity', f(pulse(t, 4.7, 4.8, 7, 7.5) * (0.5 + 0.5 * Math.sin(T * 9)) * 60) / 100);
      };
    }
  };

  /* =====================================================================
     5 · Agricultural follow-me transport vehicle (a ground vehicle, per the CV). Top-down field:
     the operator carries a UWB tag, the vehicle ranges to it, identifies the target with its
     camera, keeps a following distance and steers around an obstacle; BLDC traction at the rear. */
  A.p5 = {
    rmT: 11,
    svg: function () {
      var b = '';
      for (var r = 0; r < 4; r++) {
        var y1 = 74 + r * 26, y2 = 352 + r * 26;
        b += '<path d="M30 ' + y1 + ' H770 M30 ' + y2 + ' H770" ' + s({ o: .1 }) + '/>';
        for (var x = 40; x < 770; x += 22) b += '<circle cx="' + x + '" cy="' + y1 + '" r="3" fill="' + OK + '" fill-opacity=".3"/><circle cx="' + (x + 11) + '" cy="' + y2 + '" r="3" fill="' + OK + '" fill-opacity=".3"/>';
      }
      b += '<path d="M430 236 c10 -16 34 -14 40 0 c6 16 -10 24 -22 22 c-12 0 -24 -8 -18 -22 z" fill="#232C33" ' + s({ o: .55 }) + '/>';
      b += '<path data-lane d="M-80 250 C80 250 160 206 290 210 S410 300 520 292 S700 212 880 244" ' + s({ o: .14, w: 22 }) + ' stroke-linecap="butt"/>';
      b += '<path d="M-80 250 C80 250 160 206 290 210 S410 300 520 292 S700 212 880 244" ' + s({ o: .3 }) + ' stroke-dasharray="2 9"/>';
      b += '<path data-gap ' + s({ c: AC, o: .7, w: 1.4 }) + ' stroke-dasharray="4 5"/>';
      b += '<g data-veh>' +
        '<path d="M34 0 L120 -30 L120 30 Z" fill="' + FG + '" fill-opacity=".05" ' + s({ o: .16 }) + '/>' +
        '<rect x="-44" y="-22" width="78" height="44" rx="6" fill="' + NIGHT + '" ' + s({ w: 1.5 }) + '/>' +
        '<path d="M-36 -14 h26 v28 h-26 z M-23 -14 v28 M-36 0 h26" ' + s({ o: .3 }) + '/>' +
        '<rect x="-38" y="-30" width="16" height="7" rx="2" fill="' + FG + '" fill-opacity=".5"/><rect x="-38" y="23" width="16" height="7" rx="2" fill="' + FG + '" fill-opacity=".5"/>' +
        '<g data-fl><rect x="-8" y="-3.5" width="16" height="7" rx="2" fill="' + FG + '" fill-opacity=".8"/></g><g data-fr><rect x="-8" y="-3.5" width="16" height="7" rx="2" fill="' + FG + '" fill-opacity=".8"/></g>' +
        '<circle cx="-30" cy="0" r="6" ' + s({ c: AC, o: .8 }) + '/><path d="M-30 -6 V6 M-35 -3 L-25 3 M-35 3 L-25 -3" ' + s({ c: AC, o: .6 }) + '/>' +
        '<rect x="22" y="-6" width="8" height="12" rx="2" fill="#222B32" ' + s({ o: .8 }) + '/>' +
        '<circle cx="12" cy="-12" r="2.6" fill="' + AC + '"/><circle class="a-ring" cx="12" cy="-12" r="10" ' + s({ c: AC, o: .7 }) + '/><circle class="a-ring a-ring2" cx="12" cy="-12" r="10" ' + s({ c: AC, o: .7 }) + '/>' +
        '</g>';
      b += '<g data-op><path d="M6 -15 L14 -19 M6 15 L14 19" ' + s({ w: 2 }) + '/><ellipse cx="0" cy="0" rx="8" ry="18" fill="' + NIGHT + '" ' + s({ w: 1.6 }) + '/><circle cx="1" cy="0" r="7.5" fill="' + FG + '" fill-opacity=".85"/><circle cx="-4" cy="13" r="3.2" fill="' + AC + '"/></g>';
      return svg(b);
    },
    setup: function (el) {
      var lane = q(el, '[data-lane]'), veh = q(el, '[data-veh]'), op = q(el, '[data-op]'), gap = q(el, '[data-gap]');
      var fl = q(el, '[data-fl]'), fr = q(el, '[data-fr]');
      var L = lane.getTotalLength(), GAP = 150, hv = null, steer = 0;
      return function (T) {
        var so = (T * 46) % (L + 120) + 40, sv = so - GAP;
        var po = at(lane, so), pv = at(lane, sv);
        var ho = heading(lane, so), h = heading(lane, sv), hAhead = heading(lane, sv + 40);
        hv = hv == null || sv < 0 ? h : lerpAngle(hv, h, 0.2);
        var target = Math.max(-26, Math.min(26, ((hAhead - h + 540) % 360) - 180)) * 1.2;
        steer += (target - steer) * 0.15;
        op.setAttribute('transform', 'translate(' + f(po[0]) + ' ' + f(po[1]) + ') rotate(' + f(ho) + ')');
        veh.setAttribute('transform', 'translate(' + f(pv[0]) + ' ' + f(pv[1]) + ') rotate(' + f(hv) + ')');
        fl.setAttribute('transform', 'translate(26 -26) rotate(' + f(steer) + ')');
        fr.setAttribute('transform', 'translate(26 26) rotate(' + f(steer) + ')');
        var rad = hv * Math.PI / 180, fx = pv[0] + Math.cos(rad) * 34, fy = pv[1] + Math.sin(rad) * 34;
        gap.setAttribute('d', 'M' + f(fx) + ' ' + f(fy) + ' L' + f(po[0]) + ' ' + f(po[1]));
        var vis = Math.min(win(sv, -20, 30), 1 - win(so, L - 10, L + 60));
        veh.style.opacity = op.style.opacity = gap.style.opacity = vis;
      };
    }
  };

  /* =====================================================================
     6 · Flow-battery monitoring and protection. Two electrolyte tanks, pumps, the cell stack,
     flow, temperature and pressure sensing over CAN and RS485, a monitor with a configurable
     alarm line, and inverter-driven charge and discharge between the stack and a grid or load. */
  A.p6 = {
    rmT: 9.6,
    svg: function () {
      var b = '';
      var tank = function (x, c) {
        return '<rect x="' + x + '" y="84" width="112" height="196" rx="14" ' + s({ o: .55, w: 1.4 }) + '/>' +
          '<rect data-level="' + c + '" x="' + (x + 8) + '" y="180" width="96" height="92" rx="8" fill="' + (c === 'a' ? WA : AC) + '" fill-opacity=".14"/>';
      };
      b += tank(56, 'a') + tank(632, 'b');
      b += '<rect x="330" y="104" width="140" height="160" rx="8" fill="#202830" ' + s({ o: .55 }) + '/>';
      for (var i = 0; i < 9; i++) b += '<rect data-plate x="' + f(342 + i * 13.4) + '" y="116" width="7" height="136" rx="2" ' + s({ o: .45 }) + '/>';
      b += '<path d="M168 110 H330 M168 256 H222 M262 256 H330 M470 110 H632 M470 256 H538 M578 256 H632" ' + s({ o: .4, w: 1.4 }) + '/>';
      b += '<path class="a-flow" d="M168 256 H330 M330 110 H168" ' + s({ c: WA, o: .8, w: 2 }) + '/>';
      b += '<path class="a-flow" d="M632 256 H470 M470 110 H632" ' + s({ c: AC, o: .8, w: 2 }) + '/>';
      b += '<circle cx="242" cy="256" r="16" fill="' + NIGHT + '" ' + s({ o: .8 }) + '/><g data-imp="a"><path d="M242 244 V268 M230 256 H254" ' + s({ o: .7 }) + '/></g>';
      b += '<circle cx="558" cy="256" r="16" fill="' + NIGHT + '" ' + s({ o: .8 }) + '/><g data-imp="b"><path d="M558 244 V268 M546 256 H570" ' + s({ o: .7 }) + '/></g>';
      var sensor = function (x, y, kind) {
        var g = '<circle cx="' + x + '" cy="' + y + '" r="11" fill="' + NIGHT + '" ' + s({ o: .7 }) + '/>';
        if (kind === 't') g += '<path d="M' + x + ' ' + (y - 6) + ' V' + (y + 2) + '" ' + s({ w: 1.6 }) + '/><circle cx="' + x + '" cy="' + (y + 4) + '" r="2.6" fill="' + FG + '"/>';
        if (kind === 'p') g += '<path d="M' + (x - 6) + ' ' + (y + 3) + ' A6 6 0 1 1 ' + (x + 6) + ' ' + (y + 3) + ' M' + x + ' ' + (y + 2) + ' L' + (x + 4) + ' ' + (y - 4) + '" ' + s({ w: 1.3 }) + '/>';
        if (kind === 'f') g += '<path d="M' + (x - 6) + ' ' + y + ' H' + (x + 6) + ' M' + (x + 2) + ' ' + (y - 4) + ' L' + (x + 6) + ' ' + y + ' L' + (x + 2) + ' ' + (y + 4) + '" ' + s({ w: 1.3 }) + '/>';
        return g + '<path d="M' + x + ' ' + (y + 11) + ' V312" ' + s({ o: .22 }) + ' stroke-dasharray="2 4"/>';
      };
      b += sensor(200, 110, 't') + sensor(296, 256, 'f') + sensor(504, 256, 'p') + sensor(600, 110, 't');
      b += '<path d="M40 312 H780 M40 320 H780" ' + s({ o: .28 }) + '/><path class="a-flow" d="M40 316 H780" ' + s({ c: AC, o: .35, w: 1 }) + '/>';
      // inverter between the stack and a grid or load
      b += '<path d="M400 264 V340" ' + s({ o: .5, w: 1.4 }) + '/><path data-arrow d="M392 302 L400 292 L408 302" ' + s({ c: AC, w: 1.6 }) + '/>';
      b += '<rect x="352" y="340" width="96" height="62" rx="8" fill="#222B32" ' + s({ o: .6 }) + '/><path d="M368 372 q8 -14 16 0 t16 0 t16 0" ' + s({ c: OK, w: 1.4 }) + '/>';
      b += '<path d="M352 371 H296" ' + s({ o: .45, w: 1.4 }) + '/><rect x="200" y="346" width="96" height="50" rx="6" ' + s({ o: .4 }) + '/><path d="M252 354 l-10 16 h12 l-8 16" ' + s({ c: AC, o: .8, w: 1.4 }) + '/>';
      // monitor with a configurable alarm line
      b += '<rect x="500" y="336" width="268" height="100" rx="10" fill="#202830" ' + s({ o: .5 }) + '/>';
      b += '<path d="M512 362 H756" ' + s({ c: AC, o: .6 }) + ' stroke-dasharray="4 5"/><polyline data-trend ' + s({ o: .85, w: 1.4 }) + '/>';
      b += '<g data-bell><path d="M736 352 h14 l-3 -4 v-6 a4.5 4.5 0 0 0 -9 0 v6 z" fill="' + AC + '" fill-opacity=".2" ' + s({ c: AC, w: 1.2 }) + '/></g>';
      return svg(b);
    },
    setup: function (el) {
      var la = q(el, '[data-level="a"]'), lb = q(el, '[data-level="b"]'), ia = q(el, '[data-imp="a"]'), ib = q(el, '[data-imp="b"]');
      var trend = q(el, '[data-trend]'), bell = q(el, '[data-bell]'), arrow = q(el, '[data-arrow]'), plates = qa(el, '[data-plate]');
      var flows = qa(el, '.a-flow');
      return function (T) {
        var ph = Math.sin(T * 0.45), charge = Math.cos(T * 0.45) > 0;
        var ha = 92 + ph * 46, hb = 92 - ph * 46;
        la.setAttribute('y', f(272 - ha)); la.setAttribute('height', f(ha));
        lb.setAttribute('y', f(272 - hb)); lb.setAttribute('height', f(hb));
        arrow.setAttribute('transform', charge ? '' : 'rotate(180 400 297)');
        var c = T % 9, alarm = c > 6.2 && c < 7.6;
        ia.setAttribute('transform', 'rotate(' + f((alarm ? 0 : T * 260) % 360) + ' 242 256)');
        ib.setAttribute('transform', 'rotate(' + f((alarm ? 0 : -T * 260) % 360) + ' 558 256)');
        flows.forEach(function (p) { p.style.animationPlayState = alarm ? 'paused' : ''; });
        plates.forEach(function (p, i) { p.setAttribute('stroke', i % 2 ? (charge ? WA : AC) : FG); });
        var pts = [];
        for (var x = 0; x <= 236; x += 4) {
          var u = T * 30 + x, spike = Math.max(0, 1 - Math.abs(((u % 270) - 200) / 14));
          pts.push((514 + x) + ',' + f(396 - Math.sin(u / 23) * 9 - Math.sin(u / 7.3) * 3 - spike * 46));
        }
        trend.setAttribute('points', pts.join(' '));
        bell.style.opacity = alarm ? (Math.sin(T * 14) > 0 ? 1 : .35) : .35;
      };
    }
  };

  /* =====================================================================
     7 · Instrument-cluster software and test automation. A commercial vehicle's CAN and LIN
     signals, the Yocto-based software stack with the Qt/QML HMI on top, the cluster display, and
     host-side automation over ADB that sets parameters, captures the display and checks it.
     Original artwork; no OEM design or screens. */
  A.p7 = {
    rmT: 4.4,
    svg: function () {
      var b = '';
      b += '<path d="M40 344 H230" ' + s({ o: .25 }) + '/><path d="M52 330 V244 Q52 232 64 232 H118 L132 262 V330 Z" fill="#202830" ' + s({ o: .6, w: 1.4 }) + '/>';
      b += '<path d="M62 242 H112 L122 262 H62 Z" ' + s({ o: .35 }) + '/><path d="M132 286 H224 V330 H132" ' + s({ o: .45 }) + '/>';
      b += '<circle cx="84" cy="334" r="15" fill="' + NIGHT + '" ' + s({ o: .7 }) + '/><circle cx="196" cy="334" r="15" fill="' + NIGHT + '" ' + s({ o: .7 }) + '/>';
      b += '<path d="M150 302 H360 M150 310 H360" ' + s({ o: .4 }) + '/>';
      b += '<path data-can d="M150 306 H360" stroke="none"/>';
      for (var i = 0; i < 3; i++) b += '<rect data-frame x="-9" y="-6" width="18" height="12" rx="2" fill="' + AC + '" fill-opacity=".25" ' + s({ c: AC }) + '/>';
      b += '<path d="M190 310 V386 H300" ' + s({ o: .3 }) + ' stroke-dasharray="5 4"/><rect x="300" y="374" width="34" height="24" rx="4" ' + s({ o: .45 }) + '/><circle class="a-blink-slow" cx="317" cy="386" r="3" fill="' + OK + '"/>';
      b += '<rect x="360" y="232" width="112" height="140" rx="10" fill="#202830" ' + s({ o: .6 }) + '/>';
      [[340, .35], [316, .45], [292, .55]].forEach(function (l) { b += '<rect x="374" y="' + l[0] + '" width="84" height="18" rx="3" ' + s({ o: l[1] }) + '/>'; });
      b += '<rect x="374" y="246" width="84" height="38" rx="4" fill="' + AC + '" fill-opacity=".12" ' + s({ c: AC, o: .8 }) + '/><path d="M386 258 h30 M386 268 h48 M386 276 h20" ' + s({ c: AC, o: .55 }) + '/>';
      b += '<path d="M472 270 C500 270 494 220 520 214" ' + s({ o: .35 }) + '/><path class="a-flow" d="M472 270 C500 270 494 220 520 214" ' + s({ c: AC, o: .7, w: 1.6 }) + '/>';
      b += '<rect x="500" y="92" width="276" height="160" rx="26" fill="#151B20" ' + s({ o: .7, w: 1.5 }) + '/>';
      [[572, 172], [704, 172]].forEach(function (c, n) {
        b += '<path d="M' + (c[0] - 44) + ' ' + (c[1] + 26) + ' A52 52 0 1 1 ' + (c[0] + 44) + ' ' + (c[1] + 26) + '" ' + s({ o: .4 }) + '/>';
        for (var k = 0; k <= 12; k++) {
          var a = (150 + k * 20) * Math.PI / 180;
          b += '<line x1="' + f(c[0] + Math.cos(a) * 46) + '" y1="' + f(c[1] + Math.sin(a) * 46) + '" x2="' + f(c[0] + Math.cos(a) * (k % 3 ? 41 : 38)) + '" y2="' + f(c[1] + Math.sin(a) * (k % 3 ? 41 : 38)) + '" ' + s({ o: k % 3 ? .3 : .6 }) + '/>';
        }
        b += '<g data-needle="' + n + '"><line x1="' + c[0] + '" y1="' + c[1] + '" x2="' + (c[0] + 36) + '" y2="' + c[1] + '" ' + s({ c: AC, w: 2 }) + '/></g><circle cx="' + c[0] + '" cy="' + c[1] + '" r="4" fill="' + AC + '"/>';
      });
      b += '<rect x="626" y="128" width="24" height="58" rx="3" ' + s({ o: .3 }) + '/><rect data-fuel x="630" y="160" width="16" height="22" rx="2" fill="' + OK + '" fill-opacity=".6"/>';
      [[590, 'c'], [616, 't'], [662, 'c'], [688, 't']].forEach(function (tt, k) {
        b += tt[1] === 'c' ? '<circle class="a-blink" style="animation-delay:-' + k * .7 + 's" cx="' + tt[0] + '" cy="226" r="5" ' + s({ c: k % 2 ? OK : AC, w: 1.4 }) + '/>'
          : '<path class="a-blink" style="animation-delay:-' + k * .5 + 's" d="M' + tt[0] + ' 221 l6 10 h-12 z" ' + s({ c: AC, w: 1.4 }) + '/>';
      });
      b += '<g data-cap>' + [[492, 84, 1, 1], [784, 84, -1, 1], [492, 260, 1, -1], [784, 260, -1, -1]].map(function (c) {
        return '<path d="M' + c[0] + ' ' + (c[1] + 16 * c[3]) + ' V' + c[1] + ' H' + (c[0] + 16 * c[2]) + '" ' + s({ c: AC, w: 1.6 }) + '/>';
      }).join('') + '</g>';
      // host-side automation over ADB
      b += '<rect x="500" y="300" width="96" height="62" rx="5" fill="#202830" ' + s({ o: .6 }) + '/><path d="M490 368 H606" ' + s({ o: .6 }) + '/><path d="M512 316 h40 M512 328 h60 M512 340 h30" ' + s({ o: .35 }) + '/>';
      b += '<path d="M548 300 V266" ' + s({ o: .4 }) + ' stroke-dasharray="3 4"/>';
      for (var r = 0; r < 4; r++) for (var cc = 0; cc < 8; cc++) {
        var x = 626 + cc * 19, y = 300 + r * 19;
        b += '<rect x="' + x + '" y="' + y + '" width="13" height="13" rx="2" ' + s({ o: .25 }) + '/><path data-chk d="M' + (x + 3) + ' ' + (y + 7) + ' l3 3 l5 -6" ' + s({ c: OK, w: 1.6 }) + '/>';
      }
      return svg(b);
    },
    setup: function (el) {
      var can = q(el, '[data-can]'), frames = qa(el, '[data-frame]'), n0 = q(el, '[data-needle="0"]'), n1 = q(el, '[data-needle="1"]');
      var fuel = q(el, '[data-fuel]'), cap = q(el, '[data-cap]'), chk = qa(el, '[data-chk]');
      var L = can.getTotalLength();
      return function (T) {
        frames.forEach(function (fr, i) {
          var k = (T * 0.55 + i / 3) % 1, p = at(can, k * L);
          fr.setAttribute('transform', 'translate(' + f(p[0]) + ' ' + f(p[1]) + ')'); fr.style.opacity = Math.min(win(k, 0, .1), 1 - win(k, .9, 1));
        });
        var sp = 0.5 + 0.45 * Math.sin(T * 0.7), rpm = 0.45 + 0.4 * Math.sin(T * 1.3 + 1);
        n0.setAttribute('transform', 'rotate(' + f(150 + sp * 240) + ' 572 172)');
        n1.setAttribute('transform', 'rotate(' + f(150 + rpm * 240) + ' 704 172)');
        var fh = 14 + 8 * Math.sin(T * 0.3); fuel.setAttribute('y', f(182 - fh)); fuel.setAttribute('height', f(fh));
        var t = T % 7, n = Math.floor(win(t, 0.4, 5.6) * chk.length + 0.0001), out = 1 - win(t, 6.4, 7);
        chk.forEach(function (c, i) { c.style.opacity = i < n ? out : 0; c.setAttribute('stroke', i === 13 ? AC : OK); });
        cap.style.opacity = .2 + .8 * ((T * 0.6) % 1 < 0.12 ? 1 : 0);
      };
    }
  };

  /* =====================================================================
     8 · Automated water intake and pump control (Approtec). Intake tank with level and flow sensing over RS-485,
     Raspberry Pi software, an automatically controlled pump sending water on toward recharge, a Qt dashboard with
     role-based access, and MySQL / Google Cloud SQL. Conceptual: no site, hardware models or settings.
     ===================================================================== */
  A.p8 = {
    rmT: 7.2,
    svg: function () {
      var b = '';
      // inflow channel and intake tank
      b += '<path d="M24 132 H70" ' + s({ o: .45, w: 1.4 }) + '/><path class="a-flow" d="M24 132 H70" ' + s({ c: WA, o: .7, w: 2 }) + '/>';
      b += '<rect x="70" y="110" width="180" height="224" rx="12" ' + s({ o: .55, w: 1.4 }) + '/>';
      b += '<rect data-water x="78" y="220" width="164" height="106" rx="7" fill="' + WA + '" fill-opacity=".16"/>';
      b += '<path data-surface d="M78 220 q20 -5 41 0 t41 0 t41 0 t41 0" ' + s({ c: WA, o: .8, w: 1.4 }) + '/>';
      b += '<path d="M78 176 H242" ' + s({ c: AC, o: .35 }) + ' stroke-dasharray="3 6"/><path d="M78 282 H242" ' + s({ c: OK, o: .35 }) + ' stroke-dasharray="3 6"/>';
      // level sensor on the tank roof with its beam
      b += '<rect x="196" y="92" width="34" height="18" rx="4" fill="' + NIGHT + '" ' + s({ o: .8 }) + '/>';
      b += '<path data-beam d="M213 112 V220" ' + s({ c: WA, o: .45 }) + ' stroke-dasharray="2 5"/>';
      // outlet: flow sensor, pump, pipe down to the recharge well
      b += '<path d="M250 300 H358 M402 300 H476 V372" ' + s({ o: .45, w: 1.4 }) + '/><path class="a-flow" data-outflow d="M250 300 H358 M402 300 H476 V372" ' + s({ c: WA, o: .8, w: 2 }) + '/>';
      b += '<circle cx="298" cy="300" r="12" fill="' + NIGHT + '" ' + s({ o: .75 }) + '/><path d="M291 300 H305 M300 295 L305 300 L300 305" ' + s({ w: 1.3 }) + '/>';
      b += '<circle cx="380" cy="300" r="22" fill="' + NIGHT + '" ' + s({ o: .85, w: 1.4 }) + '/><g data-imp><path d="M380 284 V316 M364 300 H396 M369 289 L391 311 M391 289 L369 311" ' + s({ o: .7 }) + '/></g>';
      b += '<circle data-lamp cx="402" cy="276" r="5" fill="' + OK + '"/>';
      // ground and recharge well with infiltration
      b += '<path d="M300 372 H560" ' + s({ o: .3 }) + '/><path d="M310 380 l-10 10 M340 380 l-10 10 M370 380 l-10 10 M520 380 l-10 10 M550 380 l-10 10" ' + s({ o: .18 }) + '/>';
      b += '<path d="M462 372 V468 M490 372 V468" ' + s({ o: .45, w: 1.2 }) + '/>';
      for (var i = 0; i < 6; i++) b += '<circle data-drop cx="' + (468 + (i % 3) * 8) + '" cy="390" r="2.2" fill="' + WA + '"/>';
      // RS-485 bus from both sensors to the Raspberry Pi
      b += '<path d="M213 92 V64 H150 V36 M298 312 V420" ' + s({ o: .3 }) + ' stroke-dasharray="2 4"/>';
      b += '<path d="M60 420 H520" ' + s({ o: .32 }) + '/><path class="a-flow" d="M60 420 H520" ' + s({ c: AC, o: .55, w: 1.2 }) + '/>';
      b += '<path d="M150 36 H40 V420 H60" ' + s({ o: .3 }) + ' stroke-dasharray="2 4"/>';
      b += '<circle data-pkt r="3.2" fill="' + AC + '"/>';
      // Raspberry Pi board
      b += '<rect x="520" y="392" width="128" height="78" rx="8" fill="#1f3a2c" ' + s({ c: OK, o: .6 }) + '/>';
      b += '<rect x="556" y="414" width="34" height="30" rx="3" fill="' + NIGHT + '" ' + s({ o: .6 }) + '/>';
      for (var j = 0; j < 10; j++) b += '<rect x="' + (532 + j * 10.5) + '" y="398" width="5" height="5" rx="1" fill="' + AC + '" fill-opacity=".7"/>';
      b += '<path d="M604 420 h30 M604 432 h22 M604 444 h26" ' + s({ o: .45 }) + '/>';
      // control line to the pump
      b += '<path d="M520 430 H420 V322" ' + s({ c: OK, o: .45 }) + ' stroke-dasharray="4 4"/>';
      // Qt dashboard window
      b += '<rect x="540" y="70" width="230" height="186" rx="10" fill="#202830" ' + s({ o: .55 }) + '/>';
      b += '<path d="M540 92 H770" ' + s({ o: .3 }) + '/><circle cx="554" cy="81" r="3" fill="' + AC + '"/><circle cx="565" cy="81" r="3" fill="' + FG + '" fill-opacity=".35"/><circle cx="576" cy="81" r="3" fill="' + FG + '" fill-opacity=".35"/>';
      b += '<rect x="556" y="106" width="34" height="96" rx="5" ' + s({ o: .45 }) + '/><rect data-gauge x="560" y="160" width="26" height="38" rx="3" fill="' + WA + '" fill-opacity=".45"/>';
      b += '<polyline data-trend ' + s({ c: WA, o: .85, w: 1.4 }) + '/>';
      b += '<rect x="604" y="208" width="72" height="34" rx="6" ' + s({ o: .4 }) + '/><circle data-dlamp cx="620" cy="225" r="6" fill="' + OK + '"/><path d="M634 225 h30" ' + s({ o: .5 }) + '/>';
      b += '<g ' + s({ c: AC, o: .8, w: 1.3 }) + '><rect x="712" y="216" width="20" height="16" rx="3"/><path d="M716 216 v-5 a6 6 0 0 1 12 0 v5"/></g>';
      b += '<path d="M584 392 V256" ' + s({ o: .35 }) + ' stroke-dasharray="3 4"/>';
      // databases: local MySQL and Google Cloud SQL
      b += '<path d="M648 430 H690 M716 380 V350" ' + s({ o: .35 }) + ' stroke-dasharray="3 4"/>';
      b += '<g ' + s({ o: .7 }) + '><ellipse cx="716" cy="392" rx="26" ry="8"/><path d="M690 392 V436 a26 8 0 0 0 52 0 V392"/><path d="M690 414 a26 8 0 0 0 52 0" stroke-opacity=".5"/></g>';
      b += '<path d="M692 334 a18 18 0 0 1 34 -10 a14 14 0 0 1 22 14 a12 12 0 0 1 -4 22 H700 a14 14 0 0 1 -8 -26 z" fill="' + NIGHT + '" ' + s({ c: WA, o: .7 }) + '/>';
      b += '<circle data-sync r="2.6" fill="' + WA + '"/>';
      return svg(b);
    },
    setup: function (el) {
      var water = q(el, '[data-water]'), surf = q(el, '[data-surface]'), beam = q(el, '[data-beam]'), imp = q(el, '[data-imp]');
      var lamp = q(el, '[data-lamp]'), dl = q(el, '[data-dlamp]'), gauge = q(el, '[data-gauge]'), trend = q(el, '[data-trend]');
      var out = q(el, '[data-outflow]'), drops = qa(el, '[data-drop]'), pkt = q(el, '[data-pkt]'), sync = q(el, '[data-sync]');
      function lvl(t) { var c = ((t % 10) + 10) % 10; return c < 6 ? 0.28 + 0.46 * c / 6 : 0.74 - 0.46 * (c - 6) / 4; }
      return function (T) {
        var c = T % 10, on = c >= 6, L = lvl(T), top = 326 - L * 210;
        water.setAttribute('y', f(top)); water.setAttribute('height', f(326 - top));
        surf.setAttribute('d', 'M78 ' + f(top) + ' q20 ' + f(-4 * Math.sin(T * 3)) + ' 41 0 t41 0 t41 0 t41 0');
        beam.setAttribute('d', 'M213 112 V' + f(top));
        imp.setAttribute('transform', on ? 'rotate(' + f((T * 300) % 360) + ' 380 300)' : '');
        out.style.animationPlayState = on ? '' : 'paused'; out.setAttribute('stroke-opacity', on ? .8 : .2);
        lamp.setAttribute('fill', on ? OK : FG); lamp.setAttribute('fill-opacity', on ? 1 : .25);
        dl.setAttribute('fill', on ? OK : FG); dl.setAttribute('fill-opacity', on ? 1 : .25);
        gauge.setAttribute('y', f(198 - L * 88)); gauge.setAttribute('height', f(L * 88));
        drops.forEach(function (d, i) { var k = ((T * 0.9 + i / 6) % 1); d.setAttribute('cy', f(384 + k * 80)); d.setAttribute('fill-opacity', on ? f(0.85 * (1 - k)) : 0); });
        var pts = []; for (var x = 0; x <= 150; x += 5) pts.push((604 + x) + ',' + f(194 - lvl(T - (150 - x) / 30) * 80));
        trend.setAttribute('points', pts.join(' '));
        var u = (T * 0.35) % 1, px = u < 0.5 ? 60 + u * 2 * 460 : 520, py = 420;
        pkt.setAttribute('cx', f(px)); pkt.setAttribute('cy', py); pkt.setAttribute('fill-opacity', u < 0.5 ? 1 : 0);
        var v = (T * 0.5) % 1; sync.setAttribute('cx', f(648 + v * 42)); sync.setAttribute('cy', 430); sync.setAttribute('fill-opacity', v < 0.95 ? .9 : 0);
      };
    }
  };

  /* =====================================================================
     9 · Shared-bicycle lock firmware (Fluton). A stylized step-through shared bicycle with the smart lock at the rear
     wheel, and the firmware's world around it: phone app over BLE, an NFC tap, a GPS fix, modem telemetry to a server,
     sensing (humidity, temperature, battery, tilt), stored state, and sleep and wake under a watchdog.
     One 12 s loop: sleep, wake, NFC, BLE, unlock, ride, relock, sync, sleep. Conceptual: no product or chip models.
     ===================================================================== */
  A.p9 = {
    rmT: 7.4,
    svg: function () {
      var b = '';
      var wheel = function (cx, id) {
        var g = '<circle cx="' + cx + '" cy="332" r="92" ' + s({ o: .7, w: 2 }) + '/><circle cx="' + cx + '" cy="332" r="84" ' + s({ o: .18 }) + '/>';
        g += '<g data-spokes="' + id + '">';
        for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6; g += '<path d="M' + cx + ' 332 L' + f(cx + Math.cos(a) * 84) + ' ' + f(332 + Math.sin(a) * 84) + '" ' + s({ o: .28 }) + '/>'; }
        return g + '</g><circle cx="' + cx + '" cy="332" r="7" fill="' + NIGHT + '" ' + s({ o: .8 }) + '/>';
      };
      b += '<path d="M60 428 H760" ' + s({ o: .2 }) + '/>';
      b += wheel(232, 'r') + wheel(578, 'f');
      // step-through frame, seat, handlebar and front basket
      b += '<path d="M232 332 L388 332 L344 196 M388 332 L520 196 M232 332 L332 226 M520 196 L540 150 M512 150 H566 M540 150 L578 332" ' + s({ c: '#B7A6D8', o: .9, w: 4 }) + '/>';
      b += '<path d="M318 186 H372" ' + s({ w: 7 }) + '/><path d="M344 196 V186" ' + s({ w: 3 }) + '/>';
      b += '<path d="M560 168 H636 L626 214 H570 Z M574 180 H630 M572 192 H628 M571 204 H627" ' + s({ o: .45, w: 1.2 }) + '/>';
      b += '<circle cx="388" cy="332" r="14" ' + s({ o: .6, w: 1.4 }) + '/>';
      // the smart lock at the rear wheel: housing, bolt ring through the spokes, status lamp
      b += '<g data-lockglow><rect x="186" y="236" width="92" height="44" rx="10" fill="' + AC + '" fill-opacity=".08" ' + s({ c: AC, o: .9, w: 1.6 }) + '/></g>';
      b += '<rect x="204" y="246" width="30" height="20" rx="3" fill="' + NIGHT + '" ' + s({ o: .6 }) + '/><path d="M210 256 h18 M213 251 v10 M219 251 v10 M225 251 v10" ' + s({ o: .45 }) + '/>';
      b += '<circle data-llamp cx="262" cy="256" r="5" fill="' + AC + '"/>';
      b += '<path data-bolt d="M204 280 A62 62 0 0 0 260 280" ' + s({ c: AC, w: 4 }) + '/>';
      // phone with BLE waves toward the lock
      b += '<rect x="54" y="74" width="62" height="112" rx="12" fill="' + NIGHT + '" ' + s({ o: .8, w: 1.4 }) + '/><rect x="62" y="88" width="46" height="74" rx="4" ' + s({ o: .25 }) + '/>';
      b += '<g data-applock ' + s({ c: OK, w: 1.6 }) + '><rect x="76" y="118" width="18" height="14" rx="2"/><path d="M80 118 v-5 a5 5 0 0 1 10 0"/></g>';
      b += '<g data-ble>'; for (var w = 0; w < 3; w++) b += '<path d="M' + (128 + w * 16) + ' ' + (118 - w * 10) + ' q12 ' + (12 + w * 10) + ' 0 ' + (24 + w * 20) + '" ' + s({ c: WA, w: 1.8 }) + '/>'; b += '</g>';
      b += '<path data-blepath d="M120 140 Q170 210 200 238" ' + s({ c: WA, o: .55 }) + ' stroke-dasharray="3 6"/>';
      // NFC tap at the lock
      b += '<g data-nfc><rect x="112" y="248" width="40" height="26" rx="5" fill="' + NIGHT + '" ' + s({ c: OK, o: .9 }) + '/>';
      for (var n = 0; n < 3; n++) b += '<path d="M' + (158 + n * 8) + ' 252 q6 9 0 18" ' + s({ c: OK, o: .8, w: 1.4 }) + '/>';
      b += '</g>';
      // GPS satellite and ping
      b += '<g ' + s({ o: .8, w: 1.4 }) + '><rect x="384" y="58" width="32" height="20" rx="3"/><path d="M362 68 H384 M416 68 H438 M362 60 V76 M438 60 V76"/></g>';
      b += '<path data-gpsline d="M400 80 L246 234" ' + s({ c: WA, o: .5 }) + ' stroke-dasharray="2 7"/><circle data-gpsping cx="232" cy="236" r="10" ' + s({ c: WA, w: 1.4 }) + '/>';
      // server / cloud and modem uplink
      b += '<path d="M650 104 a22 22 0 0 1 42 -12 a17 17 0 0 1 28 16 a15 15 0 0 1 -6 28 H664 a17 17 0 0 1 -14 -32 z" fill="' + NIGHT + '" ' + s({ c: WA, o: .8 }) + '/>';
      b += '<path data-uplink d="M278 248 C420 160 560 140 660 128" ' + s({ c: AC, o: .45 }) + ' stroke-dasharray="3 6"/>';
      for (var p = 0; p < 3; p++) b += '<circle data-packet r="3.6" fill="' + AC + '"/>';
      // firmware chip: memory / state, sleep moon and watchdog heartbeat
      b += '<rect x="196" y="440" width="96" height="42" rx="6" fill="#222B32" ' + s({ o: .6 }) + '/>';
      for (var c = 0; c < 6; c++) b += '<rect data-mem x="' + (204 + c * 14) + '" y="452" width="9" height="18" rx="1.5" fill="' + WA + '" fill-opacity=".2"/>';
      b += '<path d="M244 440 V286" ' + s({ o: .25 }) + ' stroke-dasharray="2 4"/>';
      b += '<g data-moon><path d="M312 446 a14 14 0 1 0 14 22 a11 11 0 1 1 -14 -22 z" fill="' + FG + '" fill-opacity=".7"/><text x="334" y="446" fill="' + FG + '" fill-opacity=".6" font-size="12" font-family="Schibsted Grotesk, sans-serif">z z</text></g>';
      b += '<polyline data-heart points="300,474 318,474 324,462 332,486 338,468 344,474 372,474" ' + s({ c: OK, w: 1.6 }) + '/>';
      // sensor and status chips: humidity, temperature, battery, tilt
      var chip = function (x, inner, id) { return '<g data-chip="' + id + '"><rect x="' + x + '" y="444" width="44" height="34" rx="8" fill="' + NIGHT + '" ' + s({ o: .55 }) + '/>' + inner + '</g>'; };
      b += chip(470, '<path d="M492 452 q-9 11 0 18 q9 -7 0 -18 z" ' + s({ c: WA, w: 1.4 }) + '/>', 'hum');
      b += chip(524, '<path d="M546 452 v12" ' + s({ w: 1.6 }) + '/><circle cx="546" cy="468" r="3.5" fill="' + AC + '"/>', 'temp');
      b += chip(578, '<rect x="587" y="454" width="22" height="12" rx="2" ' + s({ w: 1.3 }) + '/><rect data-batt x="589" y="456" width="15" height="8" rx="1" fill="' + OK + '"/><path d="M610 458 v4" ' + s({ w: 1.6 }) + '/>', 'bat');
      b += chip(632, '<g data-tilt><path d="M642 470 H666 M654 470 V452" ' + s({ w: 1.6 }) + '/></g>', 'tilt');
      return svg(b);
    },
    setup: function (el) {
      var sr = q(el, '[data-spokes="r"]'), sf = q(el, '[data-spokes="f"]'), bolt = q(el, '[data-bolt]'), lamp = q(el, '[data-llamp]'), glow = q(el, '[data-lockglow]');
      var ble = q(el, '[data-ble]'), blep = q(el, '[data-blepath]'), app = q(el, '[data-applock]'), nfc = q(el, '[data-nfc]');
      var gl = q(el, '[data-gpsline]'), gp = q(el, '[data-gpsping]'), up = q(el, '[data-uplink]'), pk = qa(el, '[data-packet]');
      var moon = q(el, '[data-moon]'), heart = q(el, '[data-heart]'), mem = qa(el, '[data-mem]'), tilt = q(el, '[data-tilt]'), chips = qa(el, '[data-chip]');
      var ride = 0;
      return function (T) {
        var c = T % 12;
        var asleep = c < 2 || c > 11.4, unlocked = c > 6 && c < 9.4, riding = c > 6.6 && c < 9.2;
        if (riding) ride += 0.06;
        sr.setAttribute('transform', 'rotate(' + f(ride * 57.3) + ' 232 332)'); sf.setAttribute('transform', 'rotate(' + f(ride * 57.3) + ' 578 332)');
        var open = c < 6 ? 0 : c < 6.6 ? (c - 6) / 0.6 : c < 9.4 ? 1 : c < 10 ? 1 - (c - 9.4) / 0.6 : 0;
        bolt.setAttribute('transform', 'translate(0 ' + f(-open * 26) + ')'); bolt.setAttribute('stroke-opacity', f(1 - open * 0.6));
        lamp.setAttribute('fill', unlocked ? OK : AC);
        glow.style.opacity = f(0.55 + 0.45 * Math.abs(Math.sin(T * 2)));
        var bleOn = c > 3.8 && c < 6.4; ble.style.opacity = bleOn ? f(0.4 + 0.6 * Math.abs(Math.sin(T * 6))) : 0.12; blep.style.opacity = bleOn ? 1 : 0.15;
        app.setAttribute('stroke', c > 3.4 && c < 10 ? OK : FG); app.setAttribute('stroke-opacity', c > 3.4 && c < 10 ? 1 : .35);
        var nfcOn = c > 2.8 && c < 3.9; nfc.style.opacity = nfcOn ? f(0.5 + 0.5 * Math.abs(Math.sin(T * 7))) : 0.18;
        var gpsOn = riding || (c > 9.8 && c < 11.2); gl.style.opacity = gpsOn ? 0.9 : 0.15;
        var ping = (T * 1.4) % 1; gp.setAttribute('r', f(6 + ping * 16)); gp.setAttribute('stroke-opacity', gpsOn ? f(1 - ping) : 0);
        var sync = c > 10 && c < 11.4; up.style.opacity = sync ? 0.9 : 0.15;
        pk.forEach(function (p, i) {
          var u = ((c - 10) / 1.4 + i / 3) % 1, x = 278 + (660 - 278) * u, y = 248 - 120 * Math.sin(u * Math.PI * 0.8) - (u * 0);
          p.setAttribute('cx', f(x)); p.setAttribute('cy', f(y - u * 0)); p.setAttribute('fill-opacity', sync ? f(1 - Math.abs(u - 0.5)) : 0);
        });
        moon.style.opacity = asleep ? 0.9 : 0.12;
        heart.setAttribute('stroke-opacity', asleep ? 0.35 : f(0.5 + 0.5 * Math.abs(Math.sin(T * 5))));
        mem.forEach(function (m, i) { var on = (c > 6 && c < 6.8 && i < 3) || (c > 9.6 && c < 10.4) || (Math.floor(T * 3) % 6 === i && !asleep); m.setAttribute('fill-opacity', on ? .85 : .2); });
        tilt.setAttribute('transform', riding ? 'rotate(' + f(Math.sin(T * 5) * 12) + ' 654 470)' : '');
        chips.forEach(function (ch, i) { ch.style.opacity = asleep ? 0.45 : f(0.75 + 0.25 * Math.sin(T * 2 + i)); });
      };
    }
  };

  /* ---------------- mounting and live control ---------------- */
  var RMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var live = [], subscribed = false;
  /* labelled version for case studies: the compact preview stays unlabelled so it reads at small sizes */
  var LABELS = {
    p1: [[94, 56, 'lbl.p1.house'], [280, 84, 'lbl.p1.meter'], [280, 318, 'lbl.p1.edge'], [576, 196, 'lbl.p1.chart']],
    p2: [[350, 56, 'lbl.p2.mission'], [672, 182, 'lbl.p2.dock'], [622, 284, 'lbl.p2.tag']],
    p3: [[300, 116, 'lbl.p3.camera'], [439, 94, 'lbl.p3.pair'], [650, 92, 'lbl.p3.conf'], [650, 296, 'lbl.p3.ctrl'], [500, 452, 'lbl.p3.manual'], [655, 452, 'lbl.p3.out']],
    p4: [[101, 140, 'lbl.p4.gs'], [247, 314, 'lbl.p4.usv'], [566, 172, 'lbl.p4.pose'], [440, 292, 'lbl.p4.obs']],
    p5: [[400, 40, 'lbl.p5.legend'], [450, 286, 'lbl.p5.obs']],
    p6: [[112, 72, 'lbl.p6.tank'], [688, 72, 'lbl.p6.tank'], [400, 92, 'lbl.p6.stack'], [120, 336, 'lbl.p6.bus'], [400, 422, 'lbl.p6.inv'], [634, 456, 'lbl.p6.mon']],
    p7: [[92, 222, 'lbl.p7.veh'], [416, 222, 'lbl.p7.stack'], [638, 80, 'lbl.p7.cluster'], [548, 386, 'lbl.p7.host'], [702, 386, 'lbl.p7.checks']],
    p8: [[128, 100, 'lbl.p8.tank'], [300, 338, 'lbl.p8.sensors'], [380, 252, 'lbl.p8.pump'], [476, 488, 'lbl.p8.recharge'], [584, 488, 'lbl.p8.pi'], [655, 62, 'lbl.p8.ui'], [716, 296, 'lbl.p8.db']],
    p9: [[86, 62, 'lbl.p9.phone'], [232, 226, 'lbl.p9.lock'], [400, 44, 'lbl.p9.gps'], [690, 66, 'lbl.p9.cloud'], [132, 238, 'lbl.p9.nfc'], [244, 498, 'lbl.p9.fw']]
  };
  function labels(el) {
    var key = el.getAttribute('data-art'), svgEl = el.querySelector('svg'), L = LABELS[key];
    if (!L || !svgEl || !window.AG) return;
    var old = svgEl.querySelector('.art-labels'); if (old) old.remove();
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('class', 'art-labels');
    L.forEach(function (l) {
      var tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tx.setAttribute('x', l[0]); tx.setAttribute('y', l[1]); tx.setAttribute('text-anchor', 'middle');
      tx.textContent = window.AG.t(l[2]); g.appendChild(tx);
    });
    svgEl.appendChild(g);
  }
  function mount(el) {
    var def = A[el.getAttribute('data-art')]; if (!def || el.__art) return;
    el.insertAdjacentHTML('afterbegin', def.svg());
    if (el.hasAttribute('data-art-labels')) { labels(el); document.addEventListener('ag:lang', function () { labels(el); }); }
    el.__art = { tick: null, t: def.rmT * 0.35, def: def };
    arm(el);
  }
  // path geometry can be unavailable while an element is not rendered (some browsers throw); retry when shown
  function arm(el) {
    var a = el.__art; if (a.tick || !a.def.setup) return;
    try { a.tick = a.def.setup(el.querySelector('svg')); a.tick(RMQ.matches ? a.def.rmT : a.t); } catch (e) { a.tick = null; }
  }
  // decorative loops are drawn at 30 fps: half the SVG repaints of 4C, no visible difference at this speed
  var acc = 0;
  function step(dt) {
    acc += dt;
    if (acc >= 1 / 31) {
      var d = acc; acc = 0;
      for (var i = 0; i < live.length; i++) { var a = live[i].__art; a.t += d; a.tick(a.t); }
    }
    return live.length > 0;
  }
  function setLive(el, on) {
    if (!el.__art) return;
    if (on) arm(el);
    el.classList.toggle('is-live', on);
    var i = live.indexOf(el);
    if (RMQ.matches || !el.__art.tick) { if (i > -1) live.splice(i, 1); if (el.__art.tick) el.__art.tick(el.__art.def.rmT); return; }
    if (on && i < 0) live.push(el); else if (!on && i > -1) live.splice(i, 1);
    var M = window.AG && window.AG.motion;
    if (M) { if (!subscribed) { subscribed = true; M.add(step); } else M.wake(); }
  }
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (en) { setLive(en.target, en.isIntersecting); });
  }, { rootMargin: '60px 0px' }) : null;

  Array.prototype.forEach.call(document.querySelectorAll('[data-art]'), function (el) {
    mount(el);
    if (io && !el.closest('.preview')) io.observe(el);
  });
  if (RMQ.addEventListener) RMQ.addEventListener('change', function () { live.slice().forEach(function (el) { setLive(el, true); }); });
  window.AG_ART = { defs: A, setLive: setLive, mount: mount };
})();

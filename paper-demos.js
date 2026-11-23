/* Interactive toy demos for the publication pages.
   Each one runs a small simulation of an idea from a paper. None of them runs the papers' trained models. */
(function () {
  var NAVY = "#304472", LIGHT = "#4a6aa8", GOLD = "#e0a458", DGOLD = "#9a6b1f", GRID = "#d3dcee", TXT = "#25304d", RED = "#c0504d", GREEN = "#3f8f6b", MUT = "#8a97b8";

  function $(id) { return document.getElementById(id); }
  function setup(canvas, ratio) {
    var dpr = window.devicePixelRatio || 1, w = canvas.clientWidth || 700, h = Math.round(w * ratio);
    canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.height = h + "px";
    var c = canvas.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    return { c: c, w: w, h: h };
  }
  function seeded(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function label(c, s, x, y, col, size, align) { c.font = (size || 12) + "px sans-serif"; c.fillStyle = col || TXT; c.textAlign = align || "left"; c.fillText(s, x, y); c.textAlign = "left"; }
  function dot(c, x, y, r, col) { c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fillStyle = col; c.fill(); }
  function kern(x, m, s) { var z = (x - m) / s; return Math.exp(-0.5 * z * z) / (s * Math.sqrt(2 * Math.PI)); }
  function cosine(a, b) { var n = 0, x = 0, y = 0; for (var i = 0; i < a.length; i++) { n += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return n / (Math.sqrt(x * y) + 1e-12); }
  function curve(c, arr, X, Y, col, lw, dash, fill) {
    c.beginPath();
    for (var i = 0; i < arr.length; i++) { i ? c.lineTo(X(i), Y(arr[i])) : c.moveTo(X(i), Y(arr[i])); }
    if (fill) { c.lineTo(X(arr.length - 1), Y(0)); c.lineTo(X(0), Y(0)); c.closePath(); c.fillStyle = fill; c.fill(); }
    c.setLineDash(dash || []); c.strokeStyle = col; c.lineWidth = lw || 2; c.stroke(); c.setLineDash([]);
  }
  function animator(fn) {
    var raf = 0, on = false;
    function tick() { if (!on) return; if (fn() === false) { on = false; return; } raf = requestAnimationFrame(tick); }
    return { start: function () { if (!on) { on = true; raf = requestAnimationFrame(tick); } }, stop: function () { on = false; cancelAnimationFrame(raf); }, running: function () { return on; } };
  }

  var Sims = {};

  /* ---------- Joint versus independent ensemble guidance ---------- */
  var JN = 200, JS = 0.45, JG = [], JF = [];
  (function () { for (var i = 0; i < JN; i++) { var g = -4 + 8 * i / (JN - 1); JG.push(g); JF.push(0.6 * kern(g, -1.5, JS) + 0.4 * kern(g, 1.5, JS)); } })();
  Sims.jointInit = function () { var r = seeded(11), x = []; for (var i = 0; i < 10; i++) x.push(-1.15 + 0.62 * gauss(r)); return x; };
  Sims.jointDensity = function (x) { var o = []; for (var i = 0; i < JN; i++) { var v = 0; for (var m = 0; m < x.length; m++) v += kern(JG[i], x[m], JS); o.push(v / x.length); } return o; };
  /* Like a diffusion sampler, the step starts at a coarse resolution and sharpens over time. */
  Sims.jointWidth = function (step, max) { return JS + (1.15 - JS) * Math.max(0, 1 - step / (0.7 * max)); };
  Sims.jointStep = function (x, joint, width) {
    var s = width || JS, dx = 8 / (JN - 1), o = [], fc = [], tg = [], i, m;
    for (i = 0; i < JN; i++) {
      tg.push(0.6 * kern(JG[i], -1.5, s) + 0.4 * kern(JG[i], 1.5, s));
      var v = 0; if (joint) { for (m = 0; m < x.length; m++) v += kern(JG[i], x[m], s); } fc.push(v / x.length);
    }
    for (m = 0; m < x.length; m++) {
      var g = 0;
      for (i = 0; i < JN; i++) {
        var k = kern(JG[i], x[m], s), res = tg[i] - (joint ? fc[i] : k);
        g += res * k * (JG[i] - x[m]) / (s * s) * dx;
      }
      o.push(Math.max(-3.9, Math.min(3.9, x[m] + 0.42 * s / JS * s / JS * g)));
    }
    return o;
  };
  Sims.jointFit = function (x) { return cosine(JF, Sims.jointDensity(x)); };

  window.jointDemo = function (o) {
    var cv = $(o.canvas), mode = $(o.mode), run = $(o.run), reset = $(o.reset), read = $(o.read), x = Sims.jointInit(), step = 0, MAX = 260;
    function draw() {
      var s = setup(cv, 0.46), c = s.c, W = s.w, H = s.h, p = 26, fc = Sims.jointDensity(x), top = 0.72;
      function X(i) { return p + i / (JN - 1) * (W - 2 * p); } function Y(v) { return H - 44 - v / top * (H - 76); } function PX(v) { return p + (v + 4) / 8 * (W - 2 * p); }
      c.strokeStyle = GRID; c.beginPath(); c.moveTo(p, Y(0)); c.lineTo(W - p, Y(0)); c.stroke();
      curve(c, JF, X, Y, GOLD, 2.4, [6, 4]); curve(c, fc, X, Y, NAVY, 2.2, null, "rgba(74,106,168,.28)");
      x.forEach(function (v, i) { dot(c, PX(v), H - 28 - (i % 2) * 8, 5, LIGHT); });
      label(c, "conformation coordinate →", W / 2, H - 5, MUT, 12, "center");
      c.fillStyle = GOLD; c.fillRect(p, 13, 16, 3); label(c, "measured density", p + 22, 18);
      c.fillStyle = NAVY; c.fillRect(p + 142, 13, 16, 3); label(c, "density of the ensemble", p + 164, 18);
      var a = x.filter(function (v) { return v < 0; }).length, b = x.length - a;
      read.innerHTML = "Step " + step + ". Left state: <strong>" + a + "</strong> of 10 members, right state: <strong>" + b + "</strong> (the measured density has 60% of its weight on the left, 40% on the right). Cosine similarity with the density: <strong>" + Sims.jointFit(x).toFixed(3) + "</strong>.";
    }
    var an = animator(function () { for (var i = 0; i < 2; i++) { x = Sims.jointStep(x, mode.value === "joint", Sims.jointWidth(step, MAX)); step++; } draw(); if (step >= MAX) { run.textContent = "Run"; return false; } });
    function restart() { an.stop(); x = Sims.jointInit(); step = 0; run.textContent = "Run"; draw(); }
    run.addEventListener("click", function () { if (an.running()) { an.stop(); run.textContent = "Run"; return; } if (step >= MAX) restart(); run.textContent = "Pause"; an.start(); });
    reset.addEventListener("click", restart); mode.addEventListener("change", restart); window.addEventListener("resize", draw); draw();
  };

  /* ---------- Matching-pursuit ensemble pruning ---------- */
  var PS = 0.38, PC = [-3.3, -2.45, -2.05, -1.95, -1.1, -0.45, 0.15, 0.3, 0.95, 1.55, 2.15, 2.3, 3.05, 3.55];
  function pTarget() { var o = []; for (var i = 0; i < JN; i++) o.push(0.5 * kern(JG[i], -2, PS) + 0.3 * kern(JG[i], 0.2, PS) + 0.2 * kern(JG[i], 2.2, PS)); return o; }
  function pDensity(set) { var o = []; for (var i = 0; i < JN; i++) { var v = 0; set.forEach(function (j) { v += kern(JG[i], PC[j], PS); }); o.push(set.length ? v / set.length : 0); } return o; }
  function pLoss(t, f) { var e = 0; for (var i = 0; i < t.length; i++) e += Math.abs(t[i] - f[i]); return e * 8 / (JN - 1); }
  Sims.pursuitNext = function (set) {
    var t = pTarget(), cur = set.length ? pLoss(t, pDensity(set)) : Infinity, best = -1, bl = cur;
    for (var j = 0; j < PC.length; j++) { if (set.indexOf(j) >= 0) continue; var l = pLoss(t, pDensity(set.concat([j]))); if (l < bl - 1e-6) { bl = l; best = j; } }
    return best;
  };
  Sims.pursuitLoss = function (set) { return pLoss(pTarget(), pDensity(set)); };
  window.pursuitDemo = function (o) {
    var cv = $(o.canvas), next = $(o.next), reset = $(o.reset), read = $(o.read), set = [], done = false, target = pTarget();
    function draw() {
      var s = setup(cv, 0.46), c = s.c, W = s.w, H = s.h, p = 26, f = pDensity(set), top = 0.68;
      function X(i) { return p + i / (JN - 1) * (W - 2 * p); } function Y(v) { return H - 48 - v / top * (H - 80); } function PX(v) { return p + (v + 4) / 8 * (W - 2 * p); }
      c.strokeStyle = GRID; c.beginPath(); c.moveTo(p, Y(0)); c.lineTo(W - p, Y(0)); c.stroke();
      curve(c, target, X, Y, GOLD, 2.4, [6, 4]); if (set.length) curve(c, f, X, Y, NAVY, 2.2, null, "rgba(74,106,168,.28)");
      PC.forEach(function (v, j) { var on = set.indexOf(j) >= 0; dot(c, PX(v), H - 30, on ? 6.5 : 4.5, on ? NAVY : "#c3cce0"); });
      label(c, "generated candidates (dark = kept)", W / 2, H - 7, MUT, 12, "center");
      c.fillStyle = GOLD; c.fillRect(p, 13, 16, 3); label(c, "measured data", p + 22, 18);
      c.fillStyle = NAVY; c.fillRect(p + 124, 13, 16, 3); label(c, "density of the kept ensemble", p + 146, 18);
      read.innerHTML = set.length ? "Kept <strong>" + set.length + "</strong> of " + PC.length + " candidates. L1 error against the data: <strong>" + Sims.pursuitLoss(set).toFixed(3) + "</strong>." + (done ? " No remaining candidate improves the fit, so the selection stops." : "") : "Nothing selected yet. Each step adds the single candidate that most improves the fit.";
      next.disabled = done; next.style.opacity = done ? 0.5 : 1;
    }
    next.addEventListener("click", function () { var j = Sims.pursuitNext(set); if (j < 0) done = true; else { set = set.concat([j]); if (Sims.pursuitNext(set) < 0) done = true; } draw(); });
    reset.addEventListener("click", function () { set = []; done = false; draw(); });
    window.addEventListener("resize", draw); draw();
  };

  /* ---------- Genetic search on a non-differentiable objective ---------- */
  function peak(x, y, a, b, h, w) { return h * Math.exp(-((x - a) * (x - a) + (y - b) * (y - b)) / (2 * w * w)); }
  function smooth(x, y) { return peak(x, y, 1.4, 0.9, 1, 0.6) + peak(x, y, -1.4, 1.1, 0.62, 0.6) + peak(x, y, 0.9, -1.5, 0.42, 0.5) + peak(x, y, -1.6, -1.4, 0.35, 0.45); }
  Sims.gaScore = function (x, y) { return Math.floor(smooth(x, y) * 10) / 10; };
  Sims.gaGrad = function (x, y) { var e = 1e-3; return Math.hypot(Sims.gaScore(x + e, y) - Sims.gaScore(x - e, y), Sims.gaScore(x, y + e) - Sims.gaScore(x, y - e)) / (2 * e); };
  Sims.gaInit = function (seed) { var r = seeded(seed), p = []; for (var i = 0; i < 30; i++) p.push([-1.4 + 0.22 * gauss(r), 1.1 + 0.22 * gauss(r)]); return { pop: p, r: r, gen: 0 }; };
  Sims.gaSigma = function (gen, K, anneal) { return anneal ? 1.7 + (0.05 - 1.7) * gen / K : 1; };
  Sims.gaStep = function (st, K, anneal) {
    var fit = function (p) { return smooth(p[0], p[1]) * 0.001 + Sims.gaScore(p[0], p[1]); }, r = st.r;
    var sorted = st.pop.slice().sort(function (a, b) { return fit(b) - fit(a); }), next = sorted.slice(0, 3).map(function (p) { return p.slice(); }), sig = Sims.gaSigma(st.gen, K, anneal);
    while (next.length < st.pop.length) {
      var par = st.pop[Math.floor(r() * st.pop.length)];
      for (var t = 0; t < 2; t++) { var q = st.pop[Math.floor(r() * st.pop.length)]; if (fit(q) > fit(par)) par = q; }
      var ch = par.slice(), a = r() < 0.5 ? 0 : 1; ch[a] = Math.max(-3, Math.min(3, ch[a] + sig * gauss(r))); next.push(ch);
    }
    st.pop = next; st.gen++; return st;
  };
  Sims.gaBest = function (st) { var b = -1; st.pop.forEach(function (p) { b = Math.max(b, Sims.gaScore(p[0], p[1])); }); return b; };
  window.geneticDemo = function (o) {
    var cv = $(o.canvas), an0 = $(o.anneal), run = $(o.run), reset = $(o.reset), read = $(o.read), K = 70, seed = 5, st = Sims.gaInit(seed), heat = null, wait = 0, start = Sims.gaBest(st);
    function makeHeat() {
      var n = 150; heat = document.createElement("canvas"); heat.width = n; heat.height = n; var h = heat.getContext("2d"), im = h.createImageData(n, n);
      for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) {
        var v = Math.max(0, Math.min(1, Sims.gaScore(-3 + 6 * i / (n - 1), 3 - 6 * j / (n - 1)))), k = (j * n + i) * 4;
        im.data[k] = 245 + (48 - 245) * v; im.data[k + 1] = 248 + (68 - 248) * v; im.data[k + 2] = 252 + (114 - 252) * v; im.data[k + 3] = 255;
      }
      h.putImageData(im, 0, 0);
    }
    function draw() {
      var s = setup(cv, 0.68), c = s.c, W = s.w, H = s.h, size = Math.min(W - 16, H - 16), x0 = (W - size) / 2, y0 = (H - size) / 2;
      if (!heat) makeHeat(); c.imageSmoothingEnabled = false; c.drawImage(heat, x0, y0, size, size);
      function X(v) { return x0 + (v + 3) / 6 * size; } function Y(v) { return y0 + (3 - v) / 6 * size; }
      st.pop.forEach(function (p) { c.beginPath(); c.arc(X(p[0]), Y(p[1]), 3.6, 0, 6.3); c.fillStyle = GOLD; c.fill(); c.strokeStyle = "#fff"; c.lineWidth = 1; c.stroke(); });
      var b = st.pop.slice().sort(function (p, q) { return Sims.gaScore(q[0], q[1]) - Sims.gaScore(p[0], p[1]); })[0];
      c.beginPath(); c.arc(X(b[0]), Y(b[1]), 7, 0, 6.3); c.strokeStyle = RED; c.lineWidth = 2.2; c.stroke();
      var grad = Sims.gaGrad(b[0], b[1]);
      read.innerHTML = "Generation <strong>" + st.gen + "</strong> of " + K + ". Best score <strong>" + Sims.gaBest(st).toFixed(1) + "</strong> (started at " + start.toFixed(1) + ", global maximum 1.0). Perturbation size: " + Sims.gaSigma(Math.min(st.gen, K), K, an0.checked).toFixed(2) + ". Local gradient at the best sample: <strong>" + (grad === 0 ? "exactly 0" : grad.toFixed(1)) + "</strong>" + (grad === 0 ? ", so gradient guidance would not move it." : ".");
    }
    var an = animator(function () { if (++wait % 4) return; Sims.gaStep(st, K, an0.checked); draw(); if (st.gen >= K) { run.textContent = "Run"; return false; } });
    function restart() { an.stop(); seed = (seed * 13 + 7) % 9973; st = Sims.gaInit(seed); start = Sims.gaBest(st); run.textContent = "Run"; draw(); }
    run.addEventListener("click", function () { if (an.running()) { an.stop(); run.textContent = "Run"; return; } if (st.gen >= K) restart(); run.textContent = "Pause"; an.start(); });
    reset.addEventListener("click", restart); an0.addEventListener("change", restart); window.addEventListener("resize", draw); draw();
  };

  /* ---------- Ring current, point-dipole approximation ---------- */
  Sims.ring = function (deg, r) { var a = deg * Math.PI / 180, ca = Math.cos(a); return (1 - 3 * ca * ca) / (r * r * r); };
  window.ringDemo = function (o) {
    var cv = $(o.canvas), ang = $(o.angle), dist = $(o.dist), read = $(o.read);
    function draw() {
      var deg = +ang.value, r = +dist.value / 10, s = setup(cv, 0.46), c = s.c, W = s.w, H = s.h, mid = W * 0.42, cy = H / 2 + 8, sc = Math.min(mid - 40, 250) / 11, rx = 42;
      label(c, "side view of the aromatic ring", 12, 18);
      var a = deg * Math.PI / 180, ux = -Math.sin(a), uy = Math.cos(a), nx = Math.cos(a), ny = Math.sin(a);
      c.strokeStyle = NAVY; c.lineWidth = 7; c.lineCap = "round"; c.beginPath(); c.moveTo(rx - ux * 28, cy + uy * 28); c.lineTo(rx + ux * 28, cy - uy * 28); c.stroke(); c.lineCap = "butt";
      c.strokeStyle = GOLD; c.lineWidth = 2; c.beginPath(); c.moveTo(rx - nx * 24, cy + ny * 24); c.lineTo(rx + nx * 24, cy - ny * 24); c.stroke();
      var px = rx + r * sc; c.strokeStyle = GRID; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(rx, cy); c.lineTo(px, cy); c.stroke(); c.setLineDash([]);
      dot(c, px, cy, 7, RED); label(c, "Cα at " + r.toFixed(1) + " Å", Math.min(px, mid - 70) - 6, cy + 26, RED);
      var x0 = mid + 42, x1 = W - 14, y0 = 30, y1 = H - 34, ymax = 2 / 27;
      function X(d) { return x0 + (d + 180) / 360 * (x1 - x0); } function Y(v) { return (y0 + y1) / 2 - v / ymax * (y1 - y0) / 2; }
      c.strokeStyle = GRID; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, Y(0)); c.lineTo(x1, Y(0)); c.moveTo(x0, y0); c.lineTo(x0, y1); c.stroke();
      [-180, 0, 180].forEach(function (d) { label(c, d + "°", X(d), H - 16, MUT, 11, "center"); });
      label(c, "ring angle χ₂", (x0 + x1) / 2, H - 3, MUT, 11, "center"); label(c, "ring-current effect on the shift (arb. units)", x0, 18);
      var pts = []; for (var i = 0; i <= 180; i++) pts.push(Sims.ring(-180 + i * 2, r));
      curve(c, pts, function (j) { return X(-180 + j * 2); }, function (v) { return Y(Math.max(-ymax, Math.min(ymax, v))); }, NAVY, 2.2);
      dot(c, X(deg), Y(Math.max(-ymax, Math.min(ymax, Sims.ring(deg, r)))), 5.5, RED);
      read.innerHTML = "Rotating the ring by 180° returns the same value. At " + r.toFixed(1) + " Å the effect is <strong>" + Math.round(100 * Math.pow(3 / r, 3)) + "%</strong> of its size at 3 Å, because it falls as 1/r³.";
    }
    ang.addEventListener("input", draw); dist.addEventListener("input", draw); window.addEventListener("resize", draw); draw();
  };

  /* ---------- Marginal matching on a 2-D flow ---------- */
  var MODES = [], MS = 0.16; (function () { for (var i = 0; i < 8; i++) MODES.push([3 * Math.cos(i * Math.PI / 4), 3 * Math.sin(i * Math.PI / 4)]); })();
  function vel(x, y, t, err) {
    var tt = Math.min(t, 0.995), s2 = (1 - tt) * (1 - tt) + tt * tt * MS * MS, tmp = s2 * (1 + 7 * err), W = 0, vx = 0, vy = 0, c = (tt * MS * MS - (1 - tt)) / s2, l = [], m = Infinity, k;
    for (k = 0; k < 8; k++) { var dx = x - tt * MODES[k][0], dy = y - tt * MODES[k][1], e = (dx * dx + dy * dy) / (2 * tmp); l.push(e); if (e < m) m = e; }
    for (k = 0; k < 8; k++) { var w = Math.exp(m - l[k]); W += w; vx += w * (MODES[k][0] + c * (x - tt * MODES[k][0])); vy += w * (MODES[k][1] + c * (y - tt * MODES[k][1])); }
    vx /= W; vy /= W; var sh = 1 - 0.28 * err;
    return [sh * vx - 0.55 * err * vy * 0.25, sh * vy + 0.55 * err * vx * 0.25];
  }
  function rk2(p, t, h, err) { var a = vel(p[0], p[1], t, err), b = vel(p[0] + h / 2 * a[0], p[1] + h / 2 * a[1], t + h / 2, err); return [p[0] + h * b[0], p[1] + h * b[1]]; }
  /* Stand-in for the learned corrector. It transports samples toward the backward marginal by matching
     sorted 1-D projections, so it moves the distribution without shrinking the clusters. */
  function transport(ps, ref, lam) {
    var n = ps.length, x = ps.map(function (p) { return p.slice(); }), idx = [], i;
    for (i = 0; i < n; i++) idx.push(i);
    for (var it = 0; it < 48; it++) {
      var a = it * 2.399963, ux = Math.cos(a), uy = Math.sin(a), rv = ref.map(function (p) { return p[0] * ux + p[1] * uy; }).sort(function (u, v) { return u - v; });
      var pv = x.map(function (p) { return p[0] * ux + p[1] * uy; }), ord = idx.slice().sort(function (u, v) { return pv[u] - pv[v]; });
      for (i = 0; i < n; i++) { var k = ord[i], d = rv[i] - pv[k]; x[k][0] += 0.7 * d * ux; x[k][1] += 0.7 * d * uy; }
    }
    return ps.map(function (p, q) { return [p[0] + lam * (x[q][0] - p[0]), p[1] + lam * (x[q][1] - p[1])]; });
  }
  Sims.flow = function (err, when, N) {
    N = N || 260; var K = 10, r = seeded(2026), data = [], base = [], i, n;
    for (i = 0; i < N; i++) { var m = MODES[i % 8]; data.push([m[0] + MS * gauss(r), m[1] + MS * gauss(r)]); base.push([gauss(r), gauss(r)]); }
    var back = new Array(K + 1); back[K] = data;
    for (n = K; n > 0; n--) { back[n - 1] = back[n].map(function (p) { return rk2(p, n / K, -1 / K, err); }); }
    var plain = [base], fixed = [base];
    function doFix(k) { return when === "all" || (when === "last" && k === K); }
    for (n = 0; n < K; n++) {
      plain.push(plain[n].map(function (p) { return rk2(p, n / K, 1 / K, err); }));
      var nx = fixed[n].map(function (p) { return rk2(p, n / K, 1 / K, err); });
      if (doFix(n + 1)) nx = transport(nx, back[n + 1], when === "all" ? 0.5 : 0.8);
      fixed.push(nx);
    }
    return { plain: plain, fixed: fixed, back: back };
  };
  Sims.flowSW = function (a, b) {
    var t = 0, K = 32;
    for (var k = 0; k < K; k++) {
      var th = Math.PI * k / K, ux = Math.cos(th), uy = Math.sin(th), f = function (p) { return p[0] * ux + p[1] * uy; }, o = function (u, v) { return u - v; }, A = a.map(f).sort(o), B = b.map(f).sort(o);
      for (var i = 0; i < A.length; i++) t += (A[i] - B[i]) * (A[i] - B[i]) / A.length;
    }
    return Math.sqrt(t / K);
  };
  Sims.flowWidth = function (ps) {
    var g = MODES.map(function () { return []; }), v = 0;
    ps.forEach(function (p) { var b = 0, d = Infinity; MODES.forEach(function (m, i) { var e = Math.hypot(p[0] - m[0], p[1] - m[1]); if (e < d) { d = e; b = i; } }); g[b].push(p); });
    g.forEach(function (c) { if (!c.length) return; var x = 0, y = 0; c.forEach(function (p) { x += p[0]; y += p[1]; }); x /= c.length; y /= c.length; c.forEach(function (p) { v += (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y); }); });
    return Math.sqrt(v / ps.length / 2);
  };
  Sims.flowError = function (ps) { var s = 0; ps.forEach(function (p) { var b = Infinity; MODES.forEach(function (m) { b = Math.min(b, Math.hypot(p[0] - m[0], p[1] - m[1])); }); s += b; }); return s / ps.length; };
  window.marginalDemo = function (o) {
    var cv = $(o.canvas), errS = $(o.err), when = $(o.when), tS = $(o.t), play = $(o.play), read = $(o.read), sim = null, wait = 0;
    function compute() { sim = Sims.flow(+errS.value / 100, when.value); }
    function panel(c, x0, w, h, ps, ref, title) {
      c.save(); c.beginPath(); c.rect(x0, 24, w, h - 24); c.clip(); var sc = Math.min(w, h - 24) / 9, cx = x0 + w / 2, cy = 24 + (h - 24) / 2;
      ref.forEach(function (p) { dot(c, cx + p[0] * sc, cy - p[1] * sc, 2.2, "rgba(224,164,88,.55)"); });
      ps.forEach(function (p) { dot(c, cx + p[0] * sc, cy - p[1] * sc, 1.9, NAVY); }); c.restore(); label(c, title, x0 + w / 2, 16, TXT, 12, "center");
    }
    function draw() {
      var n = +tS.value, s = setup(cv, 0.55), c = s.c, W = s.w, H = s.h - 18, g = 10, pw = (W - g) / 2;
      panel(c, 0, pw, H, sim.plain[n], sim.back[n], "flow alone"); panel(c, pw + g, pw, H, sim.fixed[n], sim.back[n], "flow + corrector");
      c.strokeStyle = GRID; c.beginPath(); c.moveTo(pw + g / 2, 4); c.lineTo(pw + g / 2, H); c.stroke();
      dot(c, 16, s.h - 7, 3, GOLD); label(c, "backward marginal", 24, s.h - 3, MUT, 11); dot(c, 150, s.h - 7, 3, NAVY); label(c, "forward samples", 158, s.h - 3, MUT, 11);
      var data = sim.back[10], a = Sims.flowSW(sim.plain[10], data), b = Sims.flowSW(sim.fixed[10], data), w0 = Sims.flowWidth(data), w1 = Sims.flowWidth(sim.plain[10]) / w0, w2 = Sims.flowWidth(sim.fixed[10]) / w0;
      read.innerHTML = "t = " + (n / 10).toFixed(1) + ". Final sliced Wasserstein distance to the data: <strong>" + a.toFixed(2) + "</strong> without correction, <strong>" + b.toFixed(2) + "</strong> with it. Cluster width relative to the data (1.0 is ideal): " + w1.toFixed(2) + " without, <strong>" + w2.toFixed(2) + "</strong> with.";
    }
    var an = animator(function () { if (++wait % 22) return; var v = +tS.value; if (v >= 10) { play.textContent = "Play"; return false; } tS.value = v + 1; draw(); });
    play.addEventListener("click", function () { if (an.running()) { an.stop(); play.textContent = "Play"; return; } if (+tS.value >= 10) tS.value = 0; play.textContent = "Pause"; an.start(); });
    function redo() { compute(); draw(); }
    errS.addEventListener("input", redo); when.addEventListener("change", redo); tS.addEventListener("input", draw); window.addEventListener("resize", draw); redo();
  };

  /* ---------- Which correction step matters in the bound ---------- */
  /* Error bound over time with d0 = 1: it grows by e^(L dt) and drops once at correction step k. */
  Sims.boundPath = function (l, add, e, k, N) {
    var pts = [], d = 1;
    for (var i = 0; i <= N; i++) {
      if (i) d *= Math.exp(l / N);
      pts.push([i / N, d]);
      if (i === k) { d = add ? d - e : d * (1 - e); pts.push([i / N, d]); }
    }
    return pts;
  };
  window.boundDemo = function (o) {
    var cv = $(o.canvas), L = $(o.l), mode = $(o.mode), val = $(o.val), eps = $(o.eps), epsVal = $(o.epsVal), step = $(o.step), stepVal = $(o.stepVal), read = $(o.read);
    function draw() {
      var l = +L.value / 10, add = mode.value === "add", e = +eps.value / 100, k = +step.value, N = 10, t = k / N, s = setup(cv, 0.42), c = s.c, W = s.w, H = s.h, x0 = 48, x1 = W - 14, y0 = 32, y1 = H - 34;
      var pts = Sims.boundPath(l, add, e, k, N), plain = Math.exp(l), final = pts[pts.length - 1][1], lo = Infinity, hi = plain;
      pts.forEach(function (p) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); });
      lo = Math.log(Math.min(lo, 1)) - 0.08; hi = Math.log(hi) + 0.08;
      function X(v) { return x0 + v * (x1 - x0); } function Y(v) { return y1 - (Math.log(v) - lo) / (hi - lo) * (y1 - y0); }
      c.strokeStyle = GRID; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0, y1); c.lineTo(x1, y1); c.moveTo(x0, Y(1)); c.lineTo(x1, Y(1)); c.stroke();
      [0, 0.5, 1].forEach(function (v) { label(c, "t = " + v, X(v), H - 16, MUT, 11, "center"); });
      label(c, "d₀ = 1", x0 - 5, Y(1) + 4, MUT, 11, "right"); label(c, plain.toFixed(1), x0 - 5, Y(plain) + 4, MUT, 11, "right");
      c.beginPath(); for (var i = 0; i <= 40; i++) { var u = i / 40, py = Y(Math.exp(l * u)); i ? c.lineTo(X(u), py) : c.moveTo(X(u), py); } c.setLineDash([6, 4]); c.strokeStyle = GOLD; c.lineWidth = 2.2; c.stroke(); c.setLineDash([]);
      c.beginPath(); pts.forEach(function (p, j) { j ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1])); }); c.strokeStyle = NAVY; c.lineWidth = 2.4; c.stroke();
      var after = pts[k + 1]; dot(c, X(after[0]), Y(after[1]), 5, RED); dot(c, X(1), Y(final), 4, NAVY);
      c.fillStyle = GOLD; c.fillRect(x0, 13, 16, 3); label(c, "no correction", x0 + 22, 18);
      c.fillStyle = NAVY; c.fillRect(x0 + 124, 13, 16, 3); label(c, "with one correction (log scale)", x0 + 146, 18);
      val.textContent = l.toFixed(1); epsVal.textContent = e.toFixed(2); stepVal.textContent = "t = " + t.toFixed(1);
      var gain = plain - final;
      read.innerHTML = "Final bound falls from <strong>" + plain.toFixed(2) + "</strong> to <strong>" + final.toFixed(2) + "</strong> (" + (plain > 0 ? Math.round(100 * gain / plain) : 0) + "% lower). " + (add ? "A fixed-size correction is worth more when it happens earlier, because later flow would have amplified the error it removes. At t = 0 this one would lower the bound by " + (e * plain).toFixed(2) + ", and at t = 1 by " + e.toFixed(2) + "." : "A proportional correction multiplies the bound by (1 − ε), so moving it to another time leaves the final bound unchanged.");
    }
    [L, eps, step].forEach(function (el) { el.addEventListener("input", draw); }); mode.addEventListener("change", draw); window.addEventListener("resize", draw); draw();
  };

  /* ---------- Mutation operator: an exact diffusion on a toy Gaussian chain ----------
     Chains follow N(mu, Sigma), so every noise level is Gaussian and the probability-flow ODE has a closed form.
     Noise level s runs from 0 (clean) to 1, with alpha = cos(pi s / 2) and sigma = sin(pi s / 2). */
  var OP = null, OP_K = 48;
  function jacobiEig(S) {
    var n = S.length, A = S.map(function (r) { return r.slice(); }), V = [], i, j, k, sw, a, b;
    for (i = 0; i < n; i++) { V.push([]); for (j = 0; j < n; j++) V[i].push(i === j ? 1 : 0); }
    for (sw = 0; sw < 40; sw++) {
      var off = 0; for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
      if (off < 1e-20) break;
      for (i = 0; i < n - 1; i++) for (j = i + 1; j < n; j++) {
        if (Math.abs(A[i][j]) < 1e-14) continue;
        var th = (A[j][j] - A[i][i]) / (2 * A[i][j]), t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1)), co = 1 / Math.sqrt(t * t + 1), si = t * co;
        for (k = 0; k < n; k++) { a = A[k][i]; b = A[k][j]; A[k][i] = co * a - si * b; A[k][j] = si * a + co * b; }
        for (k = 0; k < n; k++) { a = A[i][k]; b = A[j][k]; A[i][k] = co * a - si * b; A[j][k] = si * a + co * b; }
        for (k = 0; k < n; k++) { a = V[k][i]; b = V[k][j]; V[k][i] = co * a - si * b; V[k][j] = si * a + co * b; }
      }
    }
    return { val: A.map(function (r, q) { return r[q]; }), vec: V };
  }
  function opKit() {
    if (OP) return OP;
    var N = 26, mu = [], S = [], i, j;
    for (i = 0; i < N; i++) {
      if (i < 12) mu.push([-2.6 + i * 0.42, 0.78 + 0.36 * Math.sin(i * 1.75)]);
      else if (i < 16) { var an = Math.PI / 2 - (i - 11) * Math.PI / 5; mu.push([2.02 + 0.78 * Math.cos(an), 0.78 * Math.sin(an)]); }
      else mu.push([2.02 - (i - 16) * 0.51, -0.78 + (i % 2 ? 0.13 : -0.13)]);
    }
    for (i = 0; i < N; i++) { S.push([]); for (j = 0; j < N; j++) S[i].push(0.2 * Math.exp(-(i - j) * (i - j) / (2 * 1.6 * 1.6)) + (i === j ? 0.004 : 0)); }
    var e = jacobiEig(S);
    OP = { N: N, mu: mu, lam: e.val.map(function (v) { return Math.max(v, 1e-6); }), V: e.vec };
    return OP;
  }
  function opAB(s) { return [Math.cos(Math.PI * s / 2), Math.sin(Math.PI * s / 2)]; }
  function opMap(v, f) {
    var K = opKit(), N = K.N, o = [], d, i, k;
    for (i = 0; i < N; i++) o.push([0, 0]);
    for (d = 0; d < 2; d++) for (k = 0; k < N; k++) {
      var q = 0; for (i = 0; i < N; i++) q += K.V[i][k] * v[i][d];
      q *= f(K.lam[k]); for (i = 0; i < N; i++) o[i][d] += K.V[i][k] * q;
    }
    return o;
  }
  /* Exact ODE from a clean chain to noise level s, and back. */
  Sims.opAt = function (x, s) {
    var K = opKit(), ab = opAB(s), m = opMap(x.map(function (p, i) { return [p[0] - K.mu[i][0], p[1] - K.mu[i][1]]; }), function (l) { return Math.sqrt((ab[0] * ab[0] * l + ab[1] * ab[1]) / l); });
    return m.map(function (p, i) { return [ab[0] * K.mu[i][0] + p[0], ab[0] * K.mu[i][1] + p[1]]; });
  };
  Sims.opInv = function (z, s) {
    var K = opKit(), ab = opAB(s), m = opMap(z.map(function (p, i) { return [p[0] - ab[0] * K.mu[i][0], p[1] - ab[0] * K.mu[i][1]]; }), function (l) { return Math.sqrt(l / (ab[0] * ab[0] * l + ab[1] * ab[1])); });
    return m.map(function (p, i) { return [K.mu[i][0] + p[0], K.mu[i][1] + p[1]]; });
  };
  function opRmsd(a, b) { var t = 0; a.forEach(function (p, i) { t += (p[0] - b[i][0]) * (p[0] - b[i][0]) + (p[1] - b[i][1]) * (p[1] - b[i][1]); }); return Math.sqrt(t / a.length); }
  Sims.opMutation = function (seed, t, swap) {
    var K = opKit(), N = K.N, pr = seeded(77), w = [], i, k;
    for (i = 0; i < N; i++) w.push([gauss(pr), gauss(pr)]);
    var parent = opMap(w, function (l) { return Math.sqrt(l); }).map(function (p, q) { return [K.mu[q][0] + p[0], K.mu[q][1] + p[1]]; });
    var r = seeded(seed), a = Math.floor(r() * N), path = [parent], cur = parent;
    for (k = 1; k <= OP_K; k++) {
      var ra = opAB(t * k / OP_K)[0] / opAB(t * (k - 1) / OP_K)[0], nn = Math.sqrt(Math.max(0, 1 - ra * ra));
      cur = cur.map(function (p) { return [ra * p[0] + nn * gauss(r), ra * p[1] + nn * gauss(r)]; });
      path.push(cur);
    }
    var h = path[OP_K], z = Sims.opAt(parent, t), zc = z.map(function (p) { return p.slice(); });
    if (swap) zc[a] = h[a].slice();
    var child = Sims.opInv(zc, t), full = Sims.opInv(h, t), axis = Math.abs(h[a][0] - z[a][0]) >= Math.abs(h[a][1] - z[a][1]) ? 0 : 1, ode = [], sde = [], dec = [], odeXY = [], sdeXY = [], decXY = [];
    for (k = 0; k <= OP_K; k++) {
      var s = t * k / OP_K, oa = Sims.opAt(parent, s)[a], da = Sims.opAt(child, s)[a];
      odeXY.push(oa); sdeXY.push(path[k][a]); decXY.push(da); ode.push(oa[axis]); sde.push(path[k][a][axis]); dec.push(da[axis]);
    }
    var near = 0, all = 0;
    child.forEach(function (p, q) { var e = (p[0] - parent[q][0]) * (p[0] - parent[q][0]) + (p[1] - parent[q][1]) * (p[1] - parent[q][1]); all += e; if (Math.abs(q - a) <= 3) near += e; });
    return { t: t, swap: swap, a: a, parent: parent, path: path, z: z, h: h, zc: zc, child: child, full: full, ode: ode, sde: sde, dec: dec, odeXY: odeXY, sdeXY: sdeXY, decXY: decXY, moved: opRmsd(parent, child), fullMoved: opRmsd(parent, full), near: all > 0 ? near / all : 0 };
  };
  window.mutationDemo = function (o) {
    var cv = $(o.canvas), play = $(o.play), next = $(o.next), fresh = $(o.fresh), noise = $(o.noise), swapBox = $(o.swap), read = $(o.read), steps = $(o.steps).children, seed = 12, p = 0, target = 0, last = 0, m, lastText = "";
    var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches, DUR = [2800, 1600, 2800];
    var ODE_PAL = [[219, 228, 245], [48, 68, 114]], SDE_PAL = [[251, 233, 207], [154, 107, 31]];
    function ease(u) { return u * u * (3 - 2 * u); }
    function build() { m = Sims.opMutation(seed, +noise.value / 100, swapBox.checked); }
    function shade(q, pal) {
      var u = 0.5 + 0.5 * Math.tanh((q[0] + q[1]) * 0.55), f = function (i) { return Math.round(pal[0][i] + (pal[1][i] - pal[0][i]) * u); };
      return "rgb(" + f(0) + "," + f(1) + "," + f(2) + ")";
    }
    function bez(r, u) {
      var v = 1 - u, f = function (d) { return v * v * v * r[0][d] + 3 * v * v * u * r[1][d] + 3 * v * u * u * r[2][d] + u * u * u * r[3][d]; };
      return [f(0), f(1)];
    }
    function cy(b) { return b.y + b.h / 2; }
    function layout(W, H, narrow) {
      var L;
      if (narrow) {
        var pb = Math.round(H * 0.15), sb = Math.round(H * 0.19), sh = Math.round(H * 0.17), sT = sb + sh + 3, oT = sT + 36, ob = oT + 24, oh = sh, top = ob + oh + 44, half = W / 2;
        L = { P: { x: W * 0.14, y: 20, w: W * 0.72, h: pb - 20 }, SB: { x: 34, y: sb, w: W - 68, h: sh }, S: { x: 34, y: sT, w: W - 68, h: 20 }, O: { x: 34, y: oT, w: W - 68, h: 20 }, OB: { x: 34, y: ob, w: W - 68, h: oh }, C: { x: 4, y: top, w: half - 8, h: H - top - 4 }, D: { x: half + 4, y: top, w: half - 8, h: H - top - 4 } };
        L.OL = [34, ob + oh + 11]; L.SL = [34, sb - 6]; L.CT = [half / 2, top - 6]; L.DT = [half * 1.5, top - 6]; L.names = ["ODE latent: keeps the parent", "SDE latent: fresh noise", "Child", "All of SDE"];
        L.rO = [[W * 0.24, pb], [7, pb + 20], [7, cy(L.OB)], [34, cy(L.OB)]];
        L.rS = [[W * 0.76, pb], [W - 7, pb + 8], [W - 7, cy(L.SB)], [W - 34, cy(L.SB)]];
        L.rD = [[W * 0.25, ob + oh + 16], [W * 0.25, ob + oh + 20], [W * 0.25, top - 24], [W * 0.25, top - 18]];
        L.rE = [[W - 34, sT + 10], [W - 6, sT + 10], [W - 6, top - 34], [W * 0.75, top - 18]];
      } else {
        var pw = Math.round(W * 0.2), rw = Math.round(W * 0.31), x0 = pw + 30, tw = W - rw - 28 - x0, lane = (H - 22) / 2, mid = 22 + lane, oY = Math.round(mid - 40), sY = Math.round(mid + 16), th = 24;
        L = { P: { x: 0, y: 22, w: pw, h: H - 22 }, OB: { x: x0, y: 22, w: tw, h: oY - 27 }, O: { x: x0, y: oY, w: tw, h: th }, S: { x: x0, y: sY, w: tw, h: th }, SB: { x: x0, y: sY + th + 5, w: tw, h: H - sY - th - 26 }, C: { x: W - rw, y: 22, w: rw, h: lane - 8 }, D: { x: W - rw, y: mid + 20, w: rw, h: lane - 22 } };
        L.OL = [x0, 15]; L.SL = [x0, H - 7]; L.CT = [W - rw / 2, 15]; L.DT = [W - rw / 2, mid + 13]; L.names = ["ODE latent: still encodes the parent", "SDE latent: a fresh alternative", "Child (the real mutation)", "If we decoded all of SDE"];
        L.rO = [[pw - 3, mid], [pw + 16, mid], [x0 - 16, cy(L.OB)], [x0, cy(L.OB)]];
        L.rS = [[pw - 3, mid], [pw + 16, mid], [x0 - 16, cy(L.SB)], [x0, cy(L.SB)]];
        L.rD = [[x0 + tw, cy(L.OB)], [x0 + tw + 12, cy(L.OB)], [W - rw - 12, cy(L.C)], [W - rw, cy(L.C)]];
        L.rE = [[x0 + tw, cy(L.SB)], [x0 + tw + 12, cy(L.SB)], [W - rw - 12, cy(L.D)], [W - rw, cy(L.D)]];
      }
      return L;
    }
    function smoothPts(r) { var a = []; for (var i = 0; i <= OP_K; i++) a.push(bez(r, i / OP_K)); return a; }
    /* The SDE route wiggles with the residue's real noise path, pinned to both endpoints. */
    function noisyPts(r) {
      var a = [], br = [], mx = 1e-6, i, n = m.sde[OP_K] - m.sde[0];
      for (i = 0; i <= OP_K; i++) { var b = m.sde[i] - m.sde[0] - i / OP_K * n; br.push(b); mx = Math.max(mx, Math.abs(b)); }
      for (i = 0; i <= OP_K; i++) {
        var q = bez(r, i / OP_K), e = bez(r, Math.min(1, i / OP_K + 0.01)), f = bez(r, Math.max(0, i / OP_K - 0.01)), dx = e[0] - f[0], dy = e[1] - f[1], l = Math.hypot(dx, dy) || 1, off = br[i] / mx * 9;
        a.push([q[0] - dy / l * off, q[1] + dx / l * off]);
      }
      return a;
    }
    function line(c, pts, to, col, lw, dash) {
      if (to < 1) return;
      c.beginPath(); for (var i = 0; i <= to; i++) { i ? c.lineTo(pts[i][0], pts[i][1]) : c.moveTo(pts[i][0], pts[i][1]); }
      c.setLineDash(dash || []); c.strokeStyle = col; c.lineWidth = lw; c.lineJoin = "round"; c.stroke(); c.setLineDash([]);
    }
    function route(c, pts, u, col, lw) {
      line(c, pts, OP_K, GRID, 1.5, [3, 4]);
      var n = Math.round(u * OP_K); line(c, pts, n, col, lw);
      if (u > 0 && u < 1) dot(c, pts[n][0], pts[n][1], 4.5, col);
    }
    function fit(b) {
      var sc = Math.min(b.w / 7.6, b.h / 5.2), cx = b.x + b.w / 2, y = cy(b);
      return { sc: sc, P: function (q) { return [cx + q[0] * sc, y - q[1] * sc]; } };
    }
    function chain(c, ch, P, col, lw, r) {
      c.beginPath(); ch.forEach(function (q, i) { var a = P(q); i ? c.lineTo(a[0], a[1]) : c.moveTo(a[0], a[1]); }); c.strokeStyle = col; c.lineWidth = lw; c.lineJoin = "round"; c.stroke();
      if (r) ch.forEach(function (q) { var a = P(q); dot(c, a[0], a[1], r, col); });
    }
    function marker(c, a, r) { c.beginPath(); c.arc(a[0], a[1], r, 0, 6.3); c.fillStyle = "#fff"; c.fill(); c.strokeStyle = RED; c.lineWidth = 2.2; c.stroke(); dot(c, a[0], a[1], r * 0.42, RED); }
    function structure(c, b, ch, col, ghost, alpha) {
      var f = fit(b), r = Math.max(1.7, f.sc * 0.08);
      c.save(); c.globalAlpha = alpha === undefined ? 1 : alpha; c.beginPath(); c.rect(b.x, b.y, b.w, b.h); c.clip();
      if (ghost) { c.setLineDash([4, 3]); chain(c, ghost, f.P, MUT, 1.3); c.setLineDash([]); }
      chain(c, ch, f.P, col, 1.8, r); marker(c, f.P(ch[m.a]), Math.max(4, f.sc * 0.17)); c.restore();
    }
    function tape(c, b, arr, pal, alpha, splice) {
      var cw = b.w / arr.length;
      c.save(); c.globalAlpha = alpha;
      arr.forEach(function (q, i) { c.fillStyle = shade(q, i === splice ? SDE_PAL : pal); c.fillRect(b.x + i * cw, b.y, Math.max(1, cw - 1), b.h); });
      c.restore();
      c.strokeStyle = RED; c.lineWidth = 2; c.strokeRect(b.x + m.a * cw - 1, b.y - 2, cw + 1, b.h + 4);
    }
    function text() {
      var r = "residue " + (m.a + 1);
      if (p === 0) return "<strong>Parent.</strong> Start from a clean structure. This mutation will change <strong>" + r + "</strong>, marked in red.";
      if (p <= 1) return "<strong>Go back.</strong> Both copies of the structure become noisy. The ODE follows a smooth, reversible path, so its noisy structure still encodes the parent. The SDE follows a random path and becomes a new alternative.";
      if (p <= 2) return m.swap ? "<strong>Splice.</strong> Copy only " + r + " from the SDE latent into the ODE latent. In the ODE structure, that one residue jumps while the others stay put." : "<strong>No splice.</strong> The ODE latent stays unchanged.";
      if (p < 3) return "<strong>Decode.</strong> The ODE denoises both latents. The top one is the real child. The bottom one shows what would happen if the whole SDE latent were used. Dashed lines track the parent.";
      if (!m.swap) return "<strong>Child = parent.</strong> With no splice, the reversible ODE returns exactly to the parent, while the whole SDE latent still decodes to a different chain.";
      return "<strong>Result.</strong> The real child stays on the dashed parent except around " + r + " (RMSD <strong>" + m.moved.toFixed(2) + "</strong>). Decoding the whole SDE latent changes the entire chain (RMSD <strong>" + m.fullMoved.toFixed(2) + "</strong>).";
    }
    function draw() {
      var w0 = cv.clientWidth || 700, narrow = w0 < 520, g = setup(cv, narrow ? 2.1 : 0.76), c = g.c, W = g.w, H = g.h, L = layout(W, H, narrow), u1, u3 = 0, q = 0, odeL, sdeL;
      if (p <= 1) {
        u1 = ease(p);
        var s = m.t * u1, f = s / m.t * OP_K, i0 = Math.min(OP_K - 1, Math.floor(f)), v = f - i0;
        odeL = Sims.opAt(m.parent, s);
        sdeL = m.path[i0].map(function (a, i) { var b = m.path[i0 + 1][i]; return [a[0] + v * (b[0] - a[0]), a[1] + v * (b[1] - a[1])]; });
      } else { u1 = 1; odeL = m.z; sdeL = m.h; q = Math.min(1, p - 1); if (p > 2) u3 = ease(p - 2); }
      var landed = m.swap && p > 1 && q >= 0.72, shown = landed ? m.zc : odeL, a0 = Math.min(1, 0.16 + p * 2);

      label(c, "Parent", L.P.x + L.P.w / 2, 14, TXT, 13, "center");
      structure(c, L.P, m.parent, NAVY);

      route(c, smoothPts(L.rO), u1, NAVY, 2.5);
      route(c, noisyPts(L.rS), u1, GOLD, 2.3);
      route(c, smoothPts(L.rD), u3, NAVY, 2.5);
      route(c, smoothPts(L.rE), u3, GOLD, 2.3);

      structure(c, L.OB, shown, NAVY, null, Math.min(1, 0.35 + p * 2));
      structure(c, L.SB, sdeL, DGOLD, null, Math.min(1, 0.35 + p * 2));
      tape(c, L.O, shown, ODE_PAL, a0, landed ? m.a : -1);
      tape(c, L.S, sdeL, SDE_PAL, a0, -1);

      if (m.swap && p > 1) {
        var cw = L.S.w / m.parent.length, x = L.S.x + (m.a + 0.5) * cw, ys = cy(L.S), yo = cy(L.O), e = Math.min(1, q / 0.72), y = ys + (yo - ys) * ease(e), t0 = yo < ys ? L.O.y + L.O.h + 2 : L.S.y + L.S.h + 2, t1 = yo < ys ? L.S.y - 2 : L.O.y - 2;
        c.setLineDash([3, 3]); c.strokeStyle = RED; c.lineWidth = 1.8; c.beginPath(); c.moveTo(x, t0); c.lineTo(x, t1); c.stroke(); c.setLineDash([]);
        if (!landed) { c.fillStyle = shade(m.h[m.a], SDE_PAL); c.fillRect(x - 6, y - 11, 12, 22); c.strokeStyle = RED; c.lineWidth = 2.2; c.strokeRect(x - 6, y - 11, 12, 22); }
      }
      [[L.names[0], L.OL, NAVY], [L.names[1], L.SL, DGOLD]].forEach(function (l) {
        c.font = "12px sans-serif"; c.fillStyle = "#fff"; c.fillRect(l[1][0] - 2, l[1][1] - 12, c.measureText(l[0]).width + 4, 16); label(c, l[0], l[1][0], l[1][1], l[2], 12);
      });

      label(c, L.names[2], L.CT[0], L.CT[1], TXT, 12, "center");
      label(c, L.names[3], L.DT[0], L.DT[1], DGOLD, 12, "center");
      if (u3 > 0) {
        var ds = m.t * (1 - u3), ghost = Sims.opAt(m.parent, ds), al = Math.min(1, u3 * 4);
        structure(c, L.C, Sims.opAt(m.child, ds), NAVY, ghost, al);
        structure(c, L.D, Sims.opAt(m.full, ds), DGOLD, ghost, al);
      } else {
        label(c, "?", L.C.x + L.C.w / 2, cy(L.C) + 8, GRID, 24, "center");
        label(c, "?", L.D.x + L.D.w / 2, cy(L.D) + 8, GRID, 24, "center");
      }

      var active = p === 0 ? 0 : p <= 1 ? 1 : p <= 2 ? 2 : p < 3 ? 3 : 4;
      for (var i = 0; i < steps.length; i++) { if (i === active) steps[i].setAttribute("aria-current", "step"); else steps[i].removeAttribute("aria-current"); }
      var t = text(); if (t !== lastText) { read.innerHTML = t; lastText = t; }
    }
    var an = animator(function () {
      var now = performance.now(), dt = now - last; last = now;
      p = Math.min(target, p + dt / DUR[Math.min(2, Math.floor(p))]); draw();
      if (p >= target) { play.textContent = "Play"; return false; }
    });
    function go(to) { target = to; if (calm) { p = to; draw(); play.textContent = "Play"; return; } last = performance.now(); play.textContent = to === 3 ? "Pause" : "Play"; an.start(); }
    function reset() { an.stop(); p = 0; target = 0; play.textContent = "Play"; build(); draw(); }
    play.addEventListener("click", function () { if (an.running()) { an.stop(); play.textContent = "Play"; return; } if (p >= 3) p = 0; go(3); });
    next.addEventListener("click", function () { an.stop(); if (p >= 3) p = 0; go(Math.min(3, Math.floor(p + 1e-9) + 1)); });
    fresh.addEventListener("click", function () { seed = (seed * 17 + 5) % 9973; reset(); });
    noise.addEventListener("input", reset); swapBox.addEventListener("change", reset); window.addEventListener("resize", draw);
    build(); draw();
  };

  window.PaperSims = Sims;
})();

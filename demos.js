/* Small illustrative toy demos. They are cartoons of the ideas, not the papers' actual models. */
(function () {
  var NAVY = "#304472", LIGHT = "#4a6aa8", GOLD = "#e0a458", GRID = "#d3dcee", TXT = "#25304d";

  function setup(canvas) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || 700, h = Math.round(w * 0.42);
    canvas.width = w * dpr; canvas.height = h * dpr;
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }
  function seeded(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rand) {
    var u = 1 - rand(), v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ---------- Demo 1: experiment guidance turns a collapsed prior into the measured ensemble ---------- */
  function normal(x, m, s) { return Math.exp(-0.5 * Math.pow((x - m) / s, 2)) / (s * Math.sqrt(2 * Math.PI)); }
  window.guidanceDemo = function (id, sliderId, readId) {
    var canvas = document.getElementById(id), slider = document.getElementById(sliderId), read = document.getElementById(readId);
    if (!canvas) return;
    function draw() {
      var lam = +slider.value / 100;
      var s = setup(canvas), c = s.ctx, W = s.w, H = s.h, pad = 28, N = 240;
      var xs = [], prior = [], expt = [], guided = [];
      for (var i = 0; i < N; i++) {
        var x = -4 + (8 * i) / (N - 1); xs.push(x);
        var p = 0.9 * normal(x, -1.5, 0.55) + 0.1 * normal(x, 1.5, 0.55);
        var e = 0.55 * normal(x, -1.5, 0.55) + 0.45 * normal(x, 1.5, 0.55);
        prior.push(p); expt.push(e);
        guided.push(Math.pow(p + 1e-9, 1 - lam) * Math.pow(e + 1e-9, lam));
      }
      var z = guided.reduce(function (a, b) { return a + b; }, 0) * (8 / (N - 1));
      guided = guided.map(function (g) { return g / z; });
      var ymax = 0.85;
      function X(x) { return pad + ((x + 4) / 8) * (W - 2 * pad); }
      function Y(y) { return H - pad - (y / ymax) * (H - 2 * pad); }
      c.strokeStyle = GRID; c.lineWidth = 1;
      c.beginPath(); c.moveTo(pad, H - pad); c.lineTo(W - pad, H - pad); c.stroke();
      function path(arr, color, fill, dash) {
        c.beginPath();
        for (var i = 0; i < N; i++) { var px = X(xs[i]), py = Y(arr[i]); i ? c.lineTo(px, py) : c.moveTo(px, py); }
        if (fill) { c.lineTo(X(4), Y(0)); c.lineTo(X(-4), Y(0)); c.closePath(); c.fillStyle = fill; c.fill(); }
        c.setLineDash(dash || []); c.strokeStyle = color; c.lineWidth = 2; c.stroke(); c.setLineDash([]);
      }
      path(guided, NAVY, "rgba(74,106,168,0.35)");
      path(expt, GOLD, null, [6, 4]);
      path(prior, "#8a97b8", null, [2, 3]);
      c.font = "13px sans-serif"; c.fillStyle = TXT;
      c.fillText("conformation coordinate", W / 2 - 60, H - 8);
      var lx = W - 190, ly = 22;
      [[NAVY, "guided ensemble"], [GOLD, "experimental density"], ["#8a97b8", "unguided prior"]].forEach(function (l, i) {
        c.fillStyle = l[0]; c.fillRect(lx, ly + i * 18 - 9, 14, 3); c.fillStyle = TXT; c.fillText(l[1], lx + 20, ly + i * 18);
      });
      var maxIdx = 0, a = 0, b = 0;
      for (var j = 0; j < N; j++) { if (xs[j] < 0) a += guided[j]; else b += guided[j]; }
      read.textContent = "Weight in the minor conformation: " + Math.round((100 * b) / (a + b)) + "%  (prior 10%, experiment 45%)";
    }
    slider.addEventListener("input", draw);
    window.addEventListener("resize", draw);
    draw();
  };

  /* ---------- Demo 2: red noise looks periodic ---------- */
  window.quasarDemo = function (id, tauId, ampId, btnId, readId) {
    var canvas = document.getElementById(id), tauS = document.getElementById(tauId), ampS = document.getElementById(ampId),
        btn = document.getElementById(btnId), read = document.getElementById(readId);
    if (!canvas) return;
    var seed = 7, n = 400;
    function draw() {
      var tau = +tauS.value, amp = +ampS.value / 10, rand = seeded(seed), s = setup(canvas), c = s.ctx, W = s.w, H = s.h;
      var x = [], v = gauss(rand), a = Math.exp(-1 / tau), b = Math.sqrt(1 - a * a);
      for (var i = 0; i < n; i++) { v = a * v + b * gauss(rand); x.push(v + amp * Math.sin((2 * Math.PI * i) / 50)); }
      var top = H * 0.58, pad = 24;
      // light curve
      var mn = Math.min.apply(null, x), mx = Math.max.apply(null, x);
      c.strokeStyle = GRID; c.beginPath(); c.moveTo(pad, top); c.lineTo(W - pad, top); c.stroke();
      c.beginPath();
      for (i = 0; i < n; i++) {
        var px = pad + (i / (n - 1)) * (W - 2 * pad), py = top - 8 - ((x[i] - mn) / (mx - mn + 1e-9)) * (top - 30);
        i ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.strokeStyle = NAVY; c.lineWidth = 1.6; c.stroke();
      c.font = "12px sans-serif"; c.fillStyle = TXT; c.fillText("light curve (time →)", pad, 14);
      // periodogram
      var K = 100, pw = [], best = 0, bi = 1;
      for (var k = 1; k <= K; k++) {
        var re = 0, im = 0, f = k / (2 * K);
        for (i = 0; i < n; i++) { re += x[i] * Math.cos(2 * Math.PI * f * i); im += x[i] * Math.sin(2 * Math.PI * f * i); }
        var p = (re * re + im * im) / n; pw.push(p); if (p > best) { best = p; bi = k; }
      }
      var base = H - 22, ph = H - top - 48;
      c.fillStyle = TXT; c.fillText("periodogram (frequency →)", pad, top + 20);
      for (k = 0; k < K; k++) {
        var bx = pad + (k / K) * (W - 2 * pad), bh = (pw[k] / best) * ph;
        c.fillStyle = k + 1 === bi ? GOLD : LIGHT; c.fillRect(bx, base - bh, (W - 2 * pad) / K - 1, bh);
      }
      c.strokeStyle = GRID; c.beginPath(); c.moveTo(pad, base); c.lineTo(W - pad, base); c.stroke();
      read.textContent = amp === 0
        ? "No injected signal, yet the strongest peak sits at frequency bin " + bi + (bi < 15 ? " (low frequency: pure red noise mimics slow 'periodicity')." : ".")
        : "Injected a period-50 sinusoid. Strongest peak: bin " + bi + " (true signal at bin 4).";
    }
    tauS.addEventListener("input", draw); ampS.addEventListener("input", draw);
    btn.addEventListener("click", function () { seed = (seed * 31 + 11) % 100000; draw(); });
    window.addEventListener("resize", draw);
    draw();
  };
})();

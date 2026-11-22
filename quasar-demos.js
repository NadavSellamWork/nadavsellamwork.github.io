/* Interactive toy demos for the Nullasar page.
   They illustrate the ideas with simple AR(1) simulators; they are not our trained model. */
(function () {
  var NAVY = "#304472", LIGHT = "#4a6aa8", GOLD = "#e0a458", GRID = "#d3dcee", TXT = "#25304d", RED = "#c0504d", GREEN = "#3f8f6b", MUT = "#8a97b8";
  var T = 256, K = 127;

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function setup(canvas, ratio) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || 700, h = Math.round(w * (ratio || 0.5));
    canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.height = h + "px";
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { c: ctx, w: w, h: h };
  }
  function seeded(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rand) { var u = 1 - rand(), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function standardize(x) {
    var n = x.length, m = 0, v = 0, i;
    for (i = 0; i < n; i++) m += x[i]; m /= n;
    for (i = 0; i < n; i++) v += (x[i] - m) * (x[i] - m); v = Math.sqrt(v / n) + 1e-12;
    var o = new Float64Array(n); for (i = 0; i < n; i++) o[i] = (x[i] - m) / v; return o;
  }
  var BURN = 60;
  function noiseStream(rand, n) { var e = new Float64Array(n + BURN); for (var i = 0; i < e.length; i++) e[i] = gauss(rand); return e; }
  function ar1FromNoise(phi, eps) {
    var x = new Float64Array(T), v = 0, i;
    for (i = 0; i < BURN; i++) v = phi * v + eps[i];
    for (i = 0; i < T; i++) { v = phi * v + eps[BURN + i]; x[i] = v; }
    return standardize(x);
  }
  function addSine(x, snr, period, phase) {
    var o = new Float64Array(T), a = snr * Math.SQRT2;
    for (var i = 0; i < T; i++) o[i] = x[i] + a * Math.sin(2 * Math.PI * i / period + phase);
    return standardize(o);
  }

  /* Hann-windowed periodogram, bins k = 1..K (frequency k/T) */
  var hann = new Float64Array(T), COS = new Float64Array(K * T), SIN = new Float64Array(K * T);
  (function () {
    for (var t = 0; t < T; t++) hann[t] = 0.5 - 0.5 * Math.cos(2 * Math.PI * t / (T - 1));
    for (var k = 1; k <= K; k++) for (t = 0; t < T; t++) {
      COS[(k - 1) * T + t] = Math.cos(2 * Math.PI * k * t / T);
      SIN[(k - 1) * T + t] = Math.sin(2 * Math.PI * k * t / T);
    }
  })();
  function periodogram(x) {
    var xs = standardize(x), w = new Float64Array(T), i, k, re, im, p = new Float64Array(K);
    for (i = 0; i < T; i++) w[i] = xs[i] * hann[i];
    for (k = 0; k < K; k++) {
      re = 0; im = 0; var o = k * T;
      for (i = 0; i < T; i++) { re += w[i] * COS[o + i]; im += w[i] * SIN[o + i]; }
      p[k] = re * re + im * im;
    }
    return p;
  }
  function maxPower(x) { var p = periodogram(x), m = 0; for (var k = 0; k < K; k++) if (p[k] > m) m = p[k]; return m; }

  function drawCurve(c, x, X0, Y0, W, H, color, lw) {
    var mn = Infinity, mx = -Infinity, i;
    for (i = 0; i < x.length; i++) { if (x[i] < mn) mn = x[i]; if (x[i] > mx) mx = x[i]; }
    c.beginPath();
    for (i = 0; i < x.length; i++) {
      var px = X0 + (i / (x.length - 1)) * W, py = Y0 + H - ((x[i] - mn) / (mx - mn + 1e-9)) * H;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.strokeStyle = color || NAVY; c.lineWidth = lw || 1.5; c.stroke();
    return { mn: mn, mx: mx };
  }
  function label(c, s, x, y, color, size) { c.font = (size || 12) + "px sans-serif"; c.fillStyle = color || TXT; c.fillText(s, x, y); }

  /* ================= Demo 0: zoom out from black holes to a point ================= */
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  var BH_FS = [
"precision highp float;varying vec2 vUv;uniform vec2 uRes;uniform float uT,uD,uFade,uGlow,uMode;uniform vec3 uA;",
"float h(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}",
"float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}",
"float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n3(p);p=p*2.03+vec3(1.7,.3,2.1);a*=.5;}return s;}",
"vec3 stars(vec3 d){vec3 c=vec3(0.);float m=n3(d*2.4+3.)*.6+n3(d*5.1)*.4;m=smoothstep(.48,.85,m);c+=m*mix(vec3(.018,.03,.085),vec3(.075,.03,.10),n3(d*1.7+9.));",
"for(int l=0;l<2;l++){float sc=l==0?70.:165.;vec3 p=d*sc,id=floor(p),f=fract(p)-.5;float r=h(id);if(r>.965){float b=(r-.965)/.035;vec3 tint=mix(vec3(1.,.78,.58),vec3(.62,.78,1.),h(id+2.));c+=tint*b*b*1.6*exp(-dot(f,f)*(l==0?42.:30.));}}return c;}",
"vec3 ramp(float x){x=clamp(x,0.,1.);vec3 a=mix(vec3(.42,.055,.012),vec3(1.,.36,.07),smoothstep(0.,.42,x));a=mix(a,vec3(1.,.78,.42),smoothstep(.35,.72,x));return mix(a,vec3(.92,.95,1.),smoothstep(.72,1.,x));}",
"vec4 disk(vec3 q,vec3 c,vec3 ray,float a,float b,float seed,float gain){vec3 r=q-c;float R=length(r.xz);if(R<a||R>b)return vec4(0.);float x=(R-a)/(b-a),ang=atan(r.z,r.x),om=1.25*pow(a/R,1.5),th=ang-om*uT+1.7*log(R)+seed;",
"float k=2.1;float t=fbm(vec3(cos(th)*k,sin(th)*k,R*1.25+seed));float fine=fbm(vec3(cos(th*2.)*k*2.4,sin(th*2.)*k*2.4,R*5.5-seed));float den=smoothstep(.2,.72,t*.72+fine*.42);",
"float edge=smoothstep(0.,.05,x)*pow(1.-x,1.5);vec3 tan_=normalize(vec3(-r.z,0.,r.x));float bt=min(.72,.62*sqrt(a/R));float g=sqrt(1.-bt*bt)/(1.+bt*dot(tan_,ray));float I=pow(g,3.2);float temp=pow(a/R,1.05)*(.62+.5*den)*pow(g,.7);",
"vec3 col=ramp(temp)*I*(.28+1.75*den)*edge*gain*(1.2+2.3*pow(a/R,2.));return vec4(col,clamp((.35+.62*den)*smoothstep(0.,.14,edge),0.,.96));}",
"vec3 acc(vec3 p,vec3 v,vec3 c,float rs){vec3 r=p-c;float r2=dot(r,r);vec3 l=cross(r,v);return -1.5*rs*dot(l,l)*r/(r2*r2*sqrt(r2)+1e-4);}",
"void main(){float asp=uRes.x/uRes.y;vec2 uv=vUv*vec2(asp,1.);float e=.2;vec3 ro=vec3(0.,uD*sin(e),-uD*cos(e)),f=-normalize(ro),rt=normalize(cross(vec3(0,1,0),f)),up=cross(f,rt),rd=normalize(f*1.9+rt*uv.x+up*uv.y);vec3 col=stars(rd);",
"if(uFade>.001){float B=dot(ro,rd),C=dot(ro,ro)-81.,D=B*B-C;if(D>0.){vec3 p=ro+rd*(-B-sqrt(D)),v=rd,em=vec3(0.);float al=0.;bool cap=false;bool bin=uMode>.5;vec3 c1=bin?uA:vec3(0.),c2=-uA;float rs=bin?.5:1.;",
"for(int i=0;i<84;i++){float d1=length(p-c1),d2=bin?length(p-c2):99.;if(min(d1,d2)<rs){cap=true;break;}float dt=clamp(.2*(min(d1,d2)-rs*.6),.035,.6);vec3 a=acc(p,v,c1,rs);if(bin)a+=acc(p,v,c2,rs);v=normalize(v+a*dt);vec3 pr=p;p+=v*dt;",
"if(pr.y*p.y<0.&&al<.985){vec3 q=pr+(p-pr)*pr.y/(pr.y-p.y);vec4 s;if(bin){s=disk(q,c1,v,1.32,2.05,0.,.62);if(s.a<.001)s=disk(q,c2,v,1.32,2.05,5.3,.62);if(s.a<.001)s=disk(q,vec3(0.),v,5.15,8.8,2.4,.15);}else s=disk(q,vec3(0.),v,2.75,8.8,0.,1.);em+=(1.-al)*s.rgb;al+=(1.-al)*s.a;}",
"if(dot(p,p)>82.&&dot(p,v)>0.)break;}vec3 bg=cap?vec3(0.):stars(v);col=mix(col,em+(1.-al)*bg,uFade);}}",
"if(uGlow>.001){float r=length(uv);vec3 w=vec3(1.,.72,.42);col+=uGlow*(vec3(1.,.95,.86)*2.6*exp(-r*r/.00032)+w*.8*exp(-r*r/.0032)+vec3(.45,.27,.42)*.14*exp(-r/.11));col+=uGlow*w*.62*(exp(-abs(uv.y)*260.)*exp(-abs(uv.x)*8.)+exp(-abs(uv.x)*260.)*exp(-abs(uv.y)*8.));}",
"col*=1.-.32*dot(vUv,vUv)*.5;col=clamp((col*(2.51*col+.03))/(col*(2.43*col+.59)+.14),0.,1.);col=pow(col,vec3(.4545));col+=(h(vec3(gl_FragCoord.xy,uT))-.5)/255.;gl_FragColor=vec4(col,1.);}"
  ].join("\n");

  function bhRenderer() {
    var gc = document.createElement("canvas"), gl = gc.getContext("webgl", { antialias: false, alpha: false, depth: false, powerPreference: "high-performance" });
    if (!gl) return null;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; }
    var vs = sh(gl.VERTEX_SHADER, "attribute vec2 a;varying vec2 vUv;void main(){vUv=a;gl_Position=vec4(a,0.,1.);}"), fs = sh(gl.FRAGMENT_SHADER, BH_FS);
    if (!vs || !fs) return null;
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var u = {}; ["uRes", "uT", "uD", "uFade", "uGlow", "uMode", "uA"].forEach(function (n) { u[n] = gl.getUniformLocation(pr, n); });
    return { canvas: gc, render: function (rw, rh, time, D, fade, glow, th) {
      if (gc.width !== rw * 2 || gc.height !== rh) { gc.width = rw * 2; gc.height = rh; }
      gl.uniform2f(u.uRes, rw, rh); gl.uniform1f(u.uT, time); gl.uniform1f(u.uD, D); gl.uniform1f(u.uFade, fade); gl.uniform1f(u.uGlow, glow);
      gl.uniform3f(u.uA, 2.75 * Math.cos(th), 0, 2.75 * Math.sin(th));
      for (var m = 0; m < 2; m++) { gl.viewport(m * rw, 0, rw, rh); gl.uniform1f(u.uMode, m); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    } };
  }

  window.bhDemo = function (o) {
    var cv = $(o.canvas), dS = $(o.dist), bPlay = $(o.play), bFly = $(o.fly), bReset = $(o.reset), read = $(o.read);
    var c = cv.getContext("2d"), N = 300, PER = 60, SR = 30, W = 0, H = 0, d = 0, flying = false, t = 0, acc = 0, last = 0, raf = 0, visible = true, quality = 1, slow = 0, fast = 0;
    var playing = !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    var bufC = [], bufES = [], bufEB = [], nS = 0, nB = 0, gpu = bhRenderer(), bloom = document.createElement("canvas"), bc = bloom.getContext("2d");
    function sigma(x) { return 0.02 + 0.3 * Math.pow(x, 1.3); }
    function smooth(a, b, x) { x = Math.max(0, Math.min(1, (x - a) / (b - a))); return x * x * (3 - 2 * x); }
    function sample() {
      var phi = 0.8, inn = Math.sqrt(1 - phi * phi);
      nS = phi * nS + inn * gauss(Math.random); nB = phi * nB + inn * gauss(Math.random);
      bufES.push(nS); bufEB.push(nB); bufC.push(1 + 0.3 * Math.sin(2 * Math.PI * t / PER));
      if (bufC.length > N) { bufES.shift(); bufEB.shift(); bufC.shift(); }
      t++;
    }
    function prefill() { bufC = []; bufES = []; bufEB = []; nS = 0; nB = 0; for (var k = 0; k < N; k++) sample(); }
    function size() {
      var dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 700, narrow = w < 520, gap = narrow ? 6 : 10, pw = (w - gap) / 2, h = Math.round(pw * 0.86 + gap + pw * 0.46);
      if (w !== W || h !== H) { W = w; H = h; cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + "px"; cv.style.background = "#070b1a"; c.setTransform(dpr, 0, 0, dpr, 0, 0); }
      return { gap: gap, pw: pw, sH: pw * 0.86, cH: pw * 0.46, dpr: dpr };
    }
    function scenes(L, time, zoomD, fade, glow, th) {
      if (gpu) {
        var rw = Math.max(150, Math.round(Math.min(L.pw * L.dpr, 620) * quality)), rh = Math.round(rw * L.sH / L.pw);
        gpu.render(rw, rh, time, zoomD, fade, glow, th);
        var bw = 150, bh = Math.round(bw * rh / rw); if (bloom.width !== bw * 2 || bloom.height !== bh) { bloom.width = bw * 2; bloom.height = bh; }
        bc.imageSmoothingEnabled = true; bc.drawImage(gpu.canvas, 0, 0, bw * 2, bh);
        for (var p = 0; p < 2; p++) {
          var x0 = p * (L.pw + L.gap); c.save(); rr(c, x0, 0, L.pw, L.sH, 10); c.clip(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
          c.drawImage(gpu.canvas, p * rw, 0, rw, rh, x0, 0, L.pw, L.sH);
          c.globalCompositeOperation = "screen"; c.globalAlpha = 0.34; c.drawImage(bloom, p * bw, 0, bw, bh, x0 - 3, -3, L.pw + 6, L.sH + 6); c.globalAlpha = 1; c.globalCompositeOperation = "source-over"; c.restore();
        }
      } else {
        for (var q = 0; q < 2; q++) {
          var x = q * (L.pw + L.gap), cx = x + L.pw / 2, cy = L.sH / 2, s = 13 / zoomD; c.save(); rr(c, x, 0, L.pw, L.sH, 10); c.clip(); c.fillStyle = "#070b1a"; c.fillRect(x, 0, L.pw, L.sH);
          (q ? [1, -1] : [0]).forEach(function (sg) { var px = cx + sg * L.pw * 0.25 * s * Math.cos(th), py = cy + sg * L.pw * 0.08 * s * Math.sin(th), r = Math.max(2, L.pw * (q ? 0.07 : 0.14) * s), g = c.createRadialGradient(px, py, r * 0.8, px, py, r * 2.6); g.addColorStop(0, "#ffd58a"); g.addColorStop(1, "rgba(255,120,40,0)"); c.fillStyle = g; c.beginPath(); c.arc(px, py, r * 2.6, 0, 6.3); c.fill(); c.fillStyle = "#000"; c.beginPath(); c.arc(px, py, r, 0, 6.3); c.fill(); });
          c.restore();
        }
      }
    }
    function draw() {
      var L = size(), pw = L.pw, sH = L.sH, cH = L.cH, small = W < 520, time = (t + acc * SR) / SR, zoomD = 13 * Math.exp(5.2 * d), i, p;
      c.fillStyle = "#070b1a"; c.fillRect(0, 0, W, H);
      scenes(L, time, zoomD, 1 - smooth(0.5, 0.72, d), smooth(0.43, 0.72, d), Math.PI * (t + acc * SR) / PER);
      for (p = 0; p < 2; p++) {
        var x0 = p * (pw + L.gap), y0 = sH + L.gap, buf = p === 0 ? bufES : bufEB, sg = sigma(d), accent = p === 0 ? "125,190,255" : "255,190,105";
        c.font = "600 " + (small ? 10 : 12) + "px -apple-system,Segoe UI,sans-serif"; c.textAlign = "left"; c.fillStyle = "rgba(255,255,255,.92)"; c.fillText(p === 0 ? "SINGLE BLACK HOLE" : (small ? "BINARY" : "BINARY · TWO BLACK HOLES"), x0 + 12, 21);
        c.textAlign = "right"; c.font = (small ? 9 : 11) + "px ui-monospace,Menlo,monospace"; c.fillStyle = "rgba(205,220,255,.72)"; c.fillText("ZOOM ×" + (zoomD / 13 < 10 ? (zoomD / 13).toFixed(1) : Math.round(zoomD / 13)), x0 + pw - 12, 20);
        var cg = c.createLinearGradient(0, y0, 0, y0 + cH); cg.addColorStop(0, "#111a35"); cg.addColorStop(1, "#0b1126"); c.fillStyle = cg; rr(c, x0, y0, pw, cH, 10); c.fill(); c.strokeStyle = "rgba(150,175,235,.18)"; c.lineWidth = 1; c.stroke();
        c.strokeStyle = "rgba(170,190,240,.08)"; c.beginPath(); for (i = 1; i < 8; i++) { var gx = x0 + i / 8 * pw; c.moveTo(gx, y0 + 1); c.lineTo(gx, y0 + cH - 1); } for (i = 1; i < 4; i++) { var gy = y0 + i / 4 * cH; c.moveTo(x0 + 1, gy); c.lineTo(x0 + pw - 1, gy); } c.stroke();
        var pts = [], lastX = 0, lastY = 0;
        for (i = 0; i < buf.length; i++) { var v = Math.max(0.05, Math.min(1.95, (p === 0 ? 1 : bufC[i]) + sg * buf[i])); lastX = x0 + 8 + i / (N - 1) * (pw - 18); lastY = y0 + cH - (v / 2) * (cH - 12) - 6; pts.push(lastX, lastY); }
        function line() { c.beginPath(); for (var k = 0; k < pts.length; k += 2) k ? c.lineTo(pts[k], pts[k + 1]) : c.moveTo(pts[k], pts[k + 1]); }
        c.save(); rr(c, x0, y0, pw, cH, 10); c.clip(); line(); c.lineTo(lastX, y0 + cH); c.lineTo(x0 + 8, y0 + cH); c.closePath(); var fg = c.createLinearGradient(0, y0, 0, y0 + cH); fg.addColorStop(0, "rgba(" + accent + ",.2)"); fg.addColorStop(1, "rgba(" + accent + ",0)"); c.fillStyle = fg; c.fill();
        line(); c.lineJoin = "round"; c.strokeStyle = "rgba(" + accent + ",.2)"; c.lineWidth = 5; c.stroke(); c.strokeStyle = "rgb(" + accent + ")"; c.lineWidth = 1.5; c.stroke(); c.fillStyle = "rgba(" + accent + ",.3)"; c.beginPath(); c.arc(lastX, lastY, 7, 0, 6.3); c.fill(); c.fillStyle = "#fff"; c.beginPath(); c.arc(lastX, lastY, 2.4, 0, 6.3); c.fill(); c.restore();
        c.textAlign = "left"; c.font = (small ? 9 : 11) + "px ui-monospace,Menlo,monospace"; c.fillStyle = "rgba(205,220,255,.7)"; c.fillText(p === 0 ? "BRIGHTNESS · STEADY + NOISE" : "BRIGHTNESS · PERIODIC + NOISE", x0 + 10, y0 + 16);
      }
      c.textAlign = "left";
      var msg = d < 0.3 ? "Close up you can see the two black holes orbiting. Assuming a binary produces a periodic signal, the clean curves are steady for one black hole and a regular wave for two."
        : d < 0.7 ? "Farther away the two black holes blur together, and noise creeps into the light curves. The wave on the right is getting harder to see."
        : "Now both are just a single point of light. Under the periodic-signal assumption, only the light curve could tell them apart, and with this much noise that is hard to see by eye.";
      if (read.textContent !== msg) read.textContent = msg;
    }
    function frame(ts) {
      raf = 0;
      var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts;
      if (dt > 0) { if (dt > 0.03) { slow++; fast = 0; } else { fast++; slow = 0; } if (slow > 12 && quality > 0.42) { quality *= 0.84; slow = 0; } if (fast > 150 && quality < 1) { quality = Math.min(1, quality * 1.08); fast = 0; } }
      if (playing) { acc += dt; while (acc >= 1 / SR) { sample(); acc -= 1 / SR; } }
      if (flying) { d = Math.min(1, d + dt / 14); dS.value = Math.round(d * 100); if (d >= 1) { flying = false; bFly.textContent = "Fly away"; } }
      draw();
      if (visible && (playing || flying)) raf = requestAnimationFrame(frame);
    }
    function kick() { last = 0; if (!raf) raf = requestAnimationFrame(frame); }
    dS.addEventListener("input", function () { d = +dS.value / 100; flying = false; bFly.textContent = "Fly away"; draw(); });
    bFly.addEventListener("click", function () { if (flying) { flying = false; bFly.textContent = "Fly away"; return; } if (d >= 1) { d = 0; dS.value = 0; } flying = true; bFly.textContent = "Stop"; if (!playing) { playing = true; bPlay.textContent = "Pause"; } kick(); });
    bPlay.addEventListener("click", function () { playing = !playing; bPlay.textContent = playing ? "Pause" : "Play"; if (playing) kick(); });
    bReset.addEventListener("click", function () { d = 0; dS.value = 0; flying = false; bFly.textContent = "Fly away"; prefill(); draw(); });
    window.addEventListener("resize", draw);
    if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible && (playing || flying)) kick(); }, { threshold: 0.05 }).observe(cv);
    bPlay.textContent = playing ? "Pause" : "Play";
    prefill(); draw(); if (playing) kick();
  };

  /* ================= Demo 2: Monte Carlo null test with a possibly wrong null ================= */
  window.nullDemo = function (o) {
    var cv = $(o.canvas), procS = $(o.proc), modelS = $(o.model), snrS = $(o.snr), bNew = $(o.next), bFit = $(o.fit), read = $(o.read);
    var NN = 300, M = 300, PROC = { main: [0.3, 0.4], small: [0.1, 0.2] }, rBase = seeded(12345), nullEps = [], popEps = [], i;
    for (i = 0; i < NN; i++) nullEps.push(noiseStream(rBase, T));
    for (i = 0; i < M; i++) popEps.push(noiseStream(rBase, T));
    var obsSeed = 1, popT = null, sigT = null, popKey = "", queued = false, fitted = false;
    function ar2(a, b, eps) {
      var x = new Float64Array(T), v = 0, u = 0, w, j;
      for (j = 0; j < BURN; j++) { w = a * v + b * u + eps[j]; u = v; v = w; }
      for (j = 0; j < T; j++) { w = a * v + b * u + eps[BURN + j]; u = v; v = w; x[j] = w; }
      return standardize(x);
    }
    function frac(x) { return x - Math.floor(x); }
    function ensurePop(key, a, b) {
      if (popKey === key) return; popKey = key; popT = new Float64Array(M); sigT = new Float64Array(M);
      for (var j = 0; j < M; j++) {
        var x = ar2(a, b, popEps[j]); popT[j] = maxPower(x);
        sigT[j] = maxPower(addSine(x, 0.8 + 0.4 * frac(j * 0.618), 30 + 50 * frac(j * 0.381), j * 2.399));
      }
    }
    function acf(x, lag) { var n = 0, d = 0, j; for (j = 0; j < T; j++) d += x[j] * x[j]; for (j = lag; j < T; j++) n += x[j] * x[j - lag]; return n / d; }
    function run() {
      queued = false;
      var pr = PROC[procS.value], a = pr[0], b = pr[1], snr = +snrS.value / 10, wrong = modelS.value === "ar1", j;
      ensurePop(procS.value, a, b);
      var obs = ar2(a, b, noiseStream(seeded(obsSeed), T));
      if (snr > 0) obs = addSine(obs, snr, 42, 1.3);
      var r1 = acf(obs, 1), r2 = acf(obs, 2), n1, n2;
      if (wrong) { n1 = fitted ? r1 : a / (1 - b); n2 = 0; }
      else { n1 = fitted ? r1 * (1 - r2) / (1 - r1 * r1) : a; n2 = fitted ? (r2 - r1 * r1) / (1 - r1 * r1) : b; }
      var tobs = maxPower(obs), tn = new Float64Array(NN), cnt = 0;
      for (j = 0; j < NN; j++) { tn[j] = maxPower(wrong ? ar1FromNoise(n1, nullEps[j]) : ar2(n1, n2, nullEps[j])); if (tn[j] >= tobs) cnt++; }
      var p = (cnt + 1) / (NN + 1), sorted = Array.prototype.slice.call(tn).sort(function (x, y) { return y - x; }), thr = sorted[Math.floor(0.05 * (NN + 1)) - 1], fp = 0, tp = 0;
      for (j = 0; j < M; j++) { if (popT[j] > thr) fp++; if (sigT[j] > thr) tp++; }
      fp /= M; tp /= M;
      var s = setup(cv, 0.62), c = s.c, W = s.w, H = s.h, pad = 16, topH = H * 0.36;
      label(c, "observed light curve, from AR(2)" + (snr > 0 ? " + injected sinusoid" : " (no signal)"), pad, 14);
      label(c, "ILLUSTRATION", W - 100, 14, "#9a6b1f", 11);
      drawCurve(c, obs, pad, 22, W - 2 * pad, topH - 22, NAVY, 1.5);
      var y0 = topH + 34, hh = H - y0 - 26, nb = 24, mx = Math.max(tobs, sorted[0]) * 1.05, counts = new Array(nb).fill(0);
      for (j = 0; j < NN; j++) counts[Math.min(nb - 1, Math.floor(tn[j] / mx * nb))]++;
      var cm = Math.max.apply(null, counts);
      label(c, "peak power T of " + NN + " noise-only curves from the null: " + (wrong ? "wrong AR(1)" : "AR(2)"), pad, topH + 24);
      for (j = 0; j < nb; j++) {
        var bh = counts[j] / cm * hh, bx = pad + j * (W - 2 * pad) / nb;
        c.fillStyle = (j + 0.5) / nb * mx >= tobs ? "rgba(192,80,77,0.7)" : "rgba(74,106,168,0.55)";
        c.fillRect(bx + 1, y0 + hh - bh, (W - 2 * pad) / nb - 2, bh);
      }
      var ox = pad + (tobs / mx) * (W - 2 * pad);
      c.strokeStyle = GOLD; c.lineWidth = 3; c.beginPath(); c.moveTo(ox, y0 - 4); c.lineTo(ox, y0 + hh); c.stroke();
      label(c, "observed T", Math.min(ox + 6, W - 80), y0 + 6, "#9a6b1f", 12);
      c.strokeStyle = GRID; c.lineWidth = 1; c.beginPath(); c.moveTo(pad, y0 + hh); c.lineTo(W - pad, y0 + hh); c.stroke();
      label(c, "red bars = noise curves at least as 'periodic' as the observed one", pad, H - 8, RED, 12);
      read.innerHTML = "<strong>" + (wrong ? "Wrong null" : "Correct family") + ":</strong> " + (wrong ? "AR(1) with φ = " + n1.toFixed(2) : "AR(2) with φ₁ = " + n1.toFixed(2) + ", φ₂ = " + n2.toFixed(2)) + (fitted ? ", fitted to this curve." : wrong ? ", the best AR(1) for this process." : ", the true coefficients.") +
        "<br><strong>p-value = " + p.toFixed(3) + "</strong> &nbsp;" + (p < 0.05 ? "(flagged as a periodic candidate)" : "(consistent with noise)") +
        "<br>Using this same null on 300 test curves: <strong>" + Math.round(fp * 100) + "%</strong> of signal-free curves flagged (target 5%), <strong>" + Math.round(tp * 100) + "%</strong> of curves with a sinusoid flagged.";
    }
    function schedule() { if (!queued) { queued = true; requestAnimationFrame(run); } }
    function reset() { fitted = false; schedule(); }
    [procS, modelS].forEach(function (e) { e.addEventListener("change", reset); });
    snrS.addEventListener("input", reset);
    bFit.addEventListener("click", function () { fitted = true; schedule(); });
    bNew.addEventListener("click", function () { obsSeed = Math.floor(Math.random() * 1e9); reset(); });
    window.addEventListener("resize", schedule);
    run();
  };

  /* ================= Demo 3: flow matching path from noise to a light curve ================= */
  window.flowDemo = function (o) {
    var cv = $(o.canvas), tS = $(o.t), bPlay = $(o.play), read = $(o.read);
    var rand = seeded(2026), x1 = ar1FromNoise(0.92, noiseStream(rand, T)), x0 = standardize(noiseStream(rand, T).subarray(BURN)), timer = null;
    var p1 = periodogram(x1), pm = 0, k0;
    for (k0 = 0; k0 < K; k0++) if (p1[k0] > pm) pm = p1[k0];
    var lgMax = Math.log10(pm) + 0.4, lgMin = lgMax - 5.5;
    function draw() {
      var t = +tS.value / 100, x = new Float64Array(T), i, k;
      for (i = 0; i < T; i++) x[i] = (1 - t) * x0[i] + t * x1[i];
      var s = setup(cv, 1.0), c = s.c, W = s.w, H = s.h, pad = 16, topH = H * 0.28;
      label(c, "xₜ = (1 − t)·noise + t·data    (t = " + t.toFixed(2) + ")", pad, 14);
      var lo = Math.min(-3.2, Math.min.apply(null, x1)), hi = Math.max(3.2, Math.max.apply(null, x1));
      function Y(v) { return 24 + (1 - (v - lo) / (hi - lo)) * (topH - 30); }
      c.beginPath(); for (i = 0; i < T; i++) { var px = pad + i / (T - 1) * (W - 2 * pad); i ? c.lineTo(px, Y(x1[i])) : c.moveTo(px, Y(x1[i])); }
      c.strokeStyle = "rgba(224,164,88,0.8)"; c.lineWidth = 1.2; c.setLineDash([4, 3]); c.stroke(); c.setLineDash([]);
      c.beginPath(); for (i = 0; i < T; i++) { px = pad + i / (T - 1) * (W - 2 * pad); i ? c.lineTo(px, Y(x[i])) : c.moveTo(px, Y(x[i])); }
      c.strokeStyle = NAVY; c.lineWidth = 1.8; c.stroke();
      var p = periodogram(x);
      // linear spectrum
      var y0 = topH + 34, hh = H * 0.2;
      label(c, "power spectrum, linear scale (frequency →)", pad, topH + 24);
      for (k = 0; k < K; k++) {
        var bh = Math.min(1, p[k] / pm) * hh, bx = pad + k * (W - 2 * pad) / K;
        c.fillStyle = LIGHT; c.fillRect(bx, y0 + hh - bh, (W - 2 * pad) / K - 0.6, bh);
      }
      c.strokeStyle = GRID; c.beginPath(); c.moveTo(pad, y0 + hh); c.lineTo(W - pad, y0 + hh); c.stroke();
      // log-log spectrum
      var yl = y0 + hh + 36, hl = H - yl - 34, xl = pad + 34, wl = W - xl - pad, lx1 = Math.log10(K);
      label(c, "same spectrum, log–log scale", pad, yl - 8);
      function LX(kk) { return xl + (Math.log10(kk) / lx1) * wl; }
      function LY(v) { return yl + hl - ((Math.log10(v + 1e-12) - lgMin) / (lgMax - lgMin)) * hl; }
      c.strokeStyle = GRID; c.lineWidth = 1; c.font = "11px sans-serif";
      for (var e = Math.ceil(lgMin); e <= Math.floor(lgMax); e++) {
        var gy = yl + hl - ((e - lgMin) / (lgMax - lgMin)) * hl; c.beginPath(); c.moveTo(xl, gy); c.lineTo(xl + wl, gy); c.stroke();
        c.fillStyle = MUT; c.fillText("10^" + e, pad, gy + 4);
      }
      [1, 10, 100].forEach(function (kk) { var gx = LX(kk); c.beginPath(); c.moveTo(gx, yl); c.lineTo(gx, yl + hl); c.stroke(); c.fillStyle = MUT; c.fillText(String(kk), gx - 4, yl + hl + 14); });
      label(c, "frequency bin", xl + wl / 2 - 30, yl + hl + 28, MUT, 11);
      c.beginPath(); for (k = 1; k <= K; k++) { var qx = LX(k), qy = Math.max(yl, Math.min(yl + hl, LY(p1[k - 1]))); k > 1 ? c.lineTo(qx, qy) : c.moveTo(qx, qy); }
      c.strokeStyle = "rgba(224,164,88,0.85)"; c.lineWidth = 1.2; c.setLineDash([4, 3]); c.stroke(); c.setLineDash([]);
      c.beginPath(); for (k = 1; k <= K; k++) { qx = LX(k); qy = Math.max(yl, Math.min(yl + hl, LY(p[k - 1]))); k > 1 ? c.lineTo(qx, qy) : c.moveTo(qx, qy); }
      c.strokeStyle = NAVY; c.lineWidth = 1.6; c.stroke();
      label(c, "gold dashed = target light curve x₁ and its spectrum", pad, H - 4, "#9a6b1f");
      read.textContent = t < 0.05 ? "t = 0: pure white noise. The log–log spectrum is flat." : t > 0.95 ? "t = 1: a red-noise light curve. On the log–log plot the power falls steadily with frequency, the signature of red noise." : "Halfway: the slow, red-noise structure is gradually appearing, and the log–log slope is building up.";
    }
    tS.addEventListener("input", draw);
    bPlay.addEventListener("click", function () {
      if (timer) { clearInterval(timer); timer = null; bPlay.textContent = "Play"; return; }
      if (+tS.value >= 100) tS.value = 0; bPlay.textContent = "Pause";
      timer = setInterval(function () { tS.value = +tS.value + 1; draw(); if (+tS.value >= 100) { clearInterval(timer); timer = null; bPlay.textContent = "Play"; } }, 40);
    });
    window.addEventListener("resize", draw);
    draw();
  };

  /* ================= Demo 4: PCA projection of the conditioning vector ================= */
  window.pcaDemo = function (o) {
    var cv = $(o.canvas), sS = $(o.sig), pS = $(o.phi), chk = $(o.proj), read = $(o.read);
    var rand = seeded(77), ang = 28 * Math.PI / 180, u1 = [Math.cos(ang), Math.sin(ang)], u2 = [-Math.sin(ang), Math.cos(ang)], pts = [];
    for (var i = 0; i < 260; i++) { var a = gauss(rand) * 1.0, b = gauss(rand) * 0.22; pts.push([a * u1[0] + b * u2[0], a * u1[1] + b * u2[1]]); }
    var impAng = 88 * Math.PI / 180, imp = [Math.cos(impAng) * u1[0] + Math.sin(impAng) * u2[0], Math.cos(impAng) * u1[1] + Math.sin(impAng) * u2[1]];
    function draw() {
      var s = setup(cv, 0.62), c = s.c, W = s.w, H = s.h, R = 2.4, cx = W / 2, cy = H / 2, sc = Math.min(W, H) / (2 * R) * 0.98;
      function X(v) { return cx + v * sc; } function Y(v) { return cy - v * sc; }
      c.strokeStyle = GRID; c.lineWidth = 1; c.beginPath(); c.moveTo(0, cy); c.lineTo(W, cy); c.moveTo(cx, 0); c.lineTo(cx, H); c.stroke();
      // leading direction
      c.strokeStyle = "rgba(48,68,114,0.35)"; c.lineWidth = 2; c.setLineDash([8, 6]); c.beginPath(); c.moveTo(X(-R * u1[0]), Y(-R * u1[1])); c.lineTo(X(R * u1[0]), Y(R * u1[1])); c.stroke(); c.setLineDash([]);
      label(c, "leading principal direction", X(2.0 * u1[0]) - 40, Y(2.0 * u1[1]) - 12, NAVY, 12);
      c.fillStyle = "rgba(74,106,168,0.35)"; pts.forEach(function (p) { c.beginPath(); c.arc(X(p[0]), Y(p[1]), 2.4, 0, 6.3); c.fill(); });
      var phi = +pS.value / 60, sig = +sS.value / 60;
      var q0 = [phi * u1[0], phi * u1[1]], z = [q0[0] + sig * imp[0], q0[1] + sig * imp[1]];
      var dot = z[0] * u1[0] + z[1] * u1[1], zp = [dot * u1[0], dot * u1[1]];
      function pt(p, col, r, hollow) { c.beginPath(); c.arc(X(p[0]), Y(p[1]), r, 0, 6.3); if (hollow) { c.strokeStyle = col; c.lineWidth = 2.5; c.stroke(); } else { c.fillStyle = col; c.fill(); } }
      pt(q0, GREEN, 8, true);
      c.strokeStyle = "rgba(192,80,77,0.5)"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(X(q0[0]), Y(q0[1])); c.lineTo(X(z[0]), Y(z[1])); c.stroke();
      pt(z, RED, 7);
      var used = z, dist0 = Math.hypot(z[0] - q0[0], z[1] - q0[1]), dist1;
      if (chk.checked) {
        c.strokeStyle = "rgba(48,68,114,0.7)"; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(X(z[0]), Y(z[1])); c.lineTo(X(zp[0]), Y(zp[1])); c.stroke(); c.setLineDash([]);
        pt(zp, NAVY, 7); used = zp;
      }
      dist1 = Math.hypot(used[0] - q0[0], used[1] - q0[1]);
      var lx = 12, ly = 20;
      [[GREEN, "encoding of the same curve without the signal", true], [RED, "encoding z of the observed curve (signal imprint)", false], [NAVY, "projected z (lands almost on the green ring)", false]].forEach(function (l, i) {
        if (i === 2 && !chk.checked) return; pt2(lx + 6, ly + i * 18 - 4, l[0], l[2]); label(c, l[1], lx + 20, ly + i * 18, TXT, 12);
      });
      function pt2(x, y, col, hollow) { c.beginPath(); c.arc(x, y, 5, 0, 6.3); if (hollow) { c.strokeStyle = col; c.lineWidth = 2; c.stroke(); } else { c.fillStyle = col; c.fill(); } }
      label(c, "(2-D toy of a 128-D encoding space)", W - 220, H - 8, MUT, 11);
      read.innerHTML = "Distance between the generator's condition and the signal-free encoding: <strong>" + dist1.toFixed(2) + "</strong>" +
        (chk.checked ? " &nbsp;(without projection: " + dist0.toFixed(2) + ")" : "") +
        (chk.checked ? "<br>The projected condition is almost identical to the signal-free encoding: the noise-model information (position along the dashed line) is kept, the signal imprint is projected out." : "<br>Turn projection on to discard the weak directions.");
    }
    [sS, pS, chk].forEach(function (e) { e.addEventListener("input", draw); e.addEventListener("change", draw); });
    window.addEventListener("resize", draw);
    draw();
  };
  /* ================= Demo 5: choosing k from the PCA spectrum ================= */
  window.screeDemo = function (o) {
    var cv = $(o.canvas), kS = $(o.k), kV = $(o.kv), read = $(o.read), M = 32, lam = [], noise = [], imp = [], i, sn = 0, si = 0;
    /* Illustrative spectrum: six strong directions, a sharp drop, then a weak tail. */
    for (i = 0; i < M; i++) {
      lam.push(i < 6 ? 10 * Math.pow(0.66, i) : 0.075 * Math.pow(0.95, i - 6));
      noise.push(i < 6 ? lam[i] : lam[i] * 2); /* a little noise-process variation remains in the weak tail */
      imp.push(i < 6 ? 0.012 : Math.exp(-(i - 6) / 9));
      sn += noise[i]; si += imp[i];
    }
    function cum(a, total, k) { var x = 0; for (var j = 0; j < k; j++) x += a[j]; return x / total; }
    function draw() {
      var k = +kS.value, s = setup(cv, 0.86), c = s.c, W = s.w, H = s.h, l = 48, r = 14, x1 = W - r, pw = x1 - l, t1 = 28, h1 = H * 0.42, t2 = t1 + h1 + 58, h2 = H - t2 - 38, j;
      var lo = -2, hi = 1.2;
      function X(n) { return l + (n / M) * pw; }
      function Y(v) { return t1 + h1 - ((Math.log10(v) - lo) / (hi - lo)) * h1; }
      label(c, "PCA spectrum of the encodings (variance per direction, log scale)", 12, 16); label(c, "ILLUSTRATION", W - 96, 16, "#9a6b1f", 11);
      c.font = "11px sans-serif";
      [-2, -1, 0, 1].forEach(function (e) { var y = Y(Math.pow(10, e)); c.strokeStyle = GRID; c.lineWidth = 1; c.beginPath(); c.moveTo(l, y); c.lineTo(x1, y); c.stroke(); c.fillStyle = MUT; c.fillText("10^" + e, 12, y + 4); });
      for (j = 0; j < M; j++) { var y = Y(lam[j]); c.fillStyle = j < k ? NAVY : "#b8c3da"; c.fillRect(X(j) + 1, y, pw / M - 2, t1 + h1 - y); }
      c.strokeStyle = GOLD; c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(X(6), t1); c.lineTo(X(6), t1 + h1); c.stroke(); c.setLineDash([]);
      label(c, "sharp drop after 6", X(6) + 7, t1 + 13, "#9a6b1f", 12);
      label(c, "principal component", l + pw / 2 - 55, t1 + h1 + 18, MUT, 11);
      label(c, "What the condition keeps as k grows", 12, t2 - 12);
      function Y2(v) { return t2 + h2 - v * h2; }
      [0, 0.5, 1].forEach(function (v) { c.strokeStyle = GRID; c.lineWidth = 1; c.beginPath(); c.moveTo(l, Y2(v)); c.lineTo(x1, Y2(v)); c.stroke(); label(c, Math.round(v * 100) + "%", 12, Y2(v) + 4, MUT, 11); });
      function curve(a, total, col) { c.beginPath(); for (var n = 1; n <= M; n++) { var px = X(n - 0.5), py = Y2(cum(a, total, n)); n > 1 ? c.lineTo(px, py) : c.moveTo(px, py); } c.strokeStyle = col; c.lineWidth = 2.4; c.stroke(); }
      curve(noise, sn, NAVY); curve(imp, si, RED);
      var kx = X(k - 0.5); c.strokeStyle = TXT; c.lineWidth = 1.2; c.beginPath(); c.moveTo(kx, t2); c.lineTo(kx, t2 + h2); c.stroke();
      [[noise, sn, NAVY], [imp, si, RED]].forEach(function (q) { c.fillStyle = q[2]; c.beginPath(); c.arc(kx, Y2(cum(q[0], q[1], k)), 4.5, 0, 6.3); c.fill(); });
      label(c, "noise-process variation", X(8), Y2(0.85), NAVY, 12); label(c, "signal imprint", X(17), Y2(0.42), RED, 12);
      label(c, "number of kept directions k", l + pw / 2 - 75, H - 8, MUT, 11);
      kV.textContent = k;
      var a = Math.round(cum(noise, sn, k) * 100), b = Math.round(cum(imp, si, k) * 100);
      read.innerHTML = "k = " + k + ": keeps <strong>" + a + "%</strong> of the noise-process variation and <strong>" + b + "%</strong> of the signal imprint. " +
        (k < 6 ? "Too few: real noise variation is thrown away." : k === 6 ? "At the drop: most of the noise-process variation is kept, with almost none of the imprint. The small part of the noise in the weak directions is the price of removing the contamination." : "Too many: a little more noise variation is recovered, but the imprint leaks back into the condition.");
    }
    kS.addEventListener("input", draw); window.addEventListener("resize", draw); draw();
  };
})();

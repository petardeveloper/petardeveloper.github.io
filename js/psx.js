(function () {
  'use strict';

  var cv = document.getElementById('psx');
  if (!cv || !cv.getContext) return;

  var W = cv.width;
  var H = cv.height;
  var ctx = cv.getContext('2d');
  var frame = ctx.createImageData(W, H);
  var px = frame.data;

  var LEVELS = 15;
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (var b = 0; b < 16; b++) BAYER[b] = BAYER[b] / 16 - 0.5;

  var TS = 32;

  function hash(x, y) {
    var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function makeTex(fn) {
    var t = new Float32Array(TS * TS * 3);
    for (var y = 0; y < TS; y++) {
      for (var x = 0; x < TS; x++) {
        var c = fn(x, y);
        var i = (y * TS + x) * 3;
        t[i] = c[0]; t[i + 1] = c[1]; t[i + 2] = c[2];
      }
    }
    return t;
  }

  var WOOD = makeTex(function (x, y) {
    var ring = Math.sin(x * 0.85 + Math.sin(y * 0.3) * 2.4 + Math.sin(y * 0.11) * 3) * 0.5 + 0.5;
    var k = 0.5 + ring * 0.35 + hash(x, y) * 0.18;
    if (x % 16 === 0) k *= 0.55;
    return [0.38 * k, 0.13 * k, 0.1 * k];
  });

  var BRASS = makeTex(function (x, y) {
    var k = 0.75 + hash(x, y) * 0.25;
    return [0.86 * k, 0.63 * k, 0.32 * k];
  });

  var mesh = [];

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(v) {
    var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  function tri(a, b, c, tex, out) {
    var n = norm(cross(sub(b, a), sub(c, a)));
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) {
      var t = b; b = c; c = t;
      n = [-n[0], -n[1], -n[2]];
    }
    mesh.push({ p: [a, b, c], n: n, tex: tex });
  }

  function quad(a, b, c, d, tex, out) {
    tri(a, b, c, tex, out);
    tri(a, c, d, tex, out);
  }

  var shape = [[0.32, 1.0], [-0.32, 1.0], [-0.52, 0.5], [-0.25, -1.0], [0.25, -1.0], [0.52, 0.5]];
  var D = 0.2;
  var center = [0, 0.18];

  [[-D, -1], [D, 1]].forEach(function (side) {
    var z = side[0];
    var c = [center[0], center[1], z, 0.5, (1 - center[1]) * 0.75];
    for (var i = 0; i < shape.length; i++) {
      var p = shape[i];
      var q = shape[(i + 1) % shape.length];
      tri(
        c,
        [p[0], p[1], z, (p[0] + 0.52) / 1.04, (1 - p[1]) * 0.75],
        [q[0], q[1], z, (q[0] + 0.52) / 1.04, (1 - q[1]) * 0.75],
        WOOD, [0, 0, side[1]]
      );
    }
  });

  var run = 0;
  for (var s = 0; s < shape.length; s++) {
    var p = shape[s];
    var q = shape[(s + 1) % shape.length];
    var len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    var out = norm([(p[0] + q[0]) / 2 - center[0], (p[1] + q[1]) / 2 - center[1], 0]);
    quad(
      [p[0], p[1], -D, 0, run],
      [q[0], q[1], -D, 0, run + len],
      [q[0], q[1], D, 0.4, run + len],
      [p[0], p[1], D, 0.4, run],
      WOOD, out
    );
    run += len;
  }

  function box(x0, x1, y0, y1, z0, z1, tex) {
    quad([x0, y0, z0, 0, 0], [x1, y0, z0, 1, 0], [x1, y1, z0, 1, 1], [x0, y1, z0, 0, 1], tex, [0, 0, -1]);
    quad([x0, y1, z0, 0, 0], [x1, y1, z0, 1, 0], [x1, y1, z1, 1, .2], [x0, y1, z1, 0, .2], tex, [0, 1, 0]);
    quad([x0, y0, z0, 0, 0], [x1, y0, z0, 1, 0], [x1, y0, z1, 1, .2], [x0, y0, z1, 0, .2], tex, [0, -1, 0]);
    quad([x0, y0, z0, 0, 0], [x0, y1, z0, 1, 0], [x0, y1, z1, 1, .2], [x0, y0, z1, 0, .2], tex, [-1, 0, 0]);
    quad([x1, y0, z0, 0, 0], [x1, y1, z0, 1, 0], [x1, y1, z1, 1, .2], [x1, y0, z1, 0, .2], tex, [1, 0, 0]);
  }

  var zf = -D - 0.05;
  box(-0.055, 0.055, -0.5, 0.36, zf, -D, BRASS);
  box(-0.055, 0.055, 0.48, 0.8, zf, -D, BRASS);
  box(-0.27, 0.27, 0.36, 0.48, zf, -D, BRASS);

  var motes = [];
  for (var m = 0; m < 26; m++) {
    motes.push({ x: hash(m, 1) * W, y: hash(m, 2) * H, s: 0.05 + hash(m, 3) * 0.12, w: hash(m, 4) * 6.28 });
  }

  var DIST = 3.1;
  var FOCAL = 138;
  var angle = 0.6;
  var spin = 0.0009;
  var BASE_SPIN = 0.0009;
  var tilt = 0;
  var flick = 1;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function put(x, y, r, g, bl) {
    var d = BAYER[(y & 3) * 4 + (x & 3)];
    var o = (y * W + x) * 4;
    px[o] = Math.round(clamp01(r) * LEVELS + d) * 17;
    px[o + 1] = Math.round(clamp01(g) * LEVELS + d) * 17;
    px[o + 2] = Math.round(clamp01(bl) * LEVELS + d) * 17;
    px[o + 3] = 255;
  }

  function background() {
    for (var y = 0; y < H; y++) {
      var t = y / H;
      var r = 0.07 - t * 0.05, g = 0.03 - t * 0.02, bl = 0.09 - t * 0.06;
      for (var x = 0; x < W; x++) {
        var dx = (x - W / 2) / W, dy = (y - H * 0.45) / H;
        var glow = Math.max(0, 0.14 - (dx * dx + dy * dy) * 0.5) * flick;
        put(x, y, r + glow * 1.1, g + glow * 0.6, bl + glow * 0.3);
      }
    }
  }

  function raster(t) {
    var a = t.s[0], b = t.s[1], c = t.s[2];
    var minX = Math.max(0, Math.min(a[0], b[0], c[0]));
    var maxX = Math.min(W - 1, Math.max(a[0], b[0], c[0]));
    var minY = Math.max(0, Math.min(a[1], b[1], c[1]));
    var maxY = Math.min(H - 1, Math.max(a[1], b[1], c[1]));
    var area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (area === 0) return;
    var inv = 1 / area;
    var tex = t.tex;
    var sh = t.shade;

    for (var y = minY; y <= maxY; y++) {
      for (var x = minX; x <= maxX; x++) {
        var w0 = ((b[0] - x) * (c[1] - y) - (c[0] - x) * (b[1] - y)) * inv;
        var w1 = ((c[0] - x) * (a[1] - y) - (a[0] - x) * (c[1] - y)) * inv;
        var w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        var u = a[2] * w0 + b[2] * w1 + c[2] * w2;
        var v = a[3] * w0 + b[3] * w1 + c[3] * w2;
        var ti = ((((v * TS) | 0) & 31) * TS + (((u * TS) | 0) & 31)) * 3;
        put(x, y, tex[ti] * sh[0], tex[ti + 1] * sh[1], tex[ti + 2] * sh[2]);
      }
    }
  }

  var L = norm([-0.45, 0.55, -0.7]);
  var RIM = norm([0.7, 0.25, 0.65]);

  function render(now) {
    flick = 0.85 + Math.sin(now * 0.013) * 0.05 + Math.sin(now * 0.037) * 0.04 + hash(now | 0, 7) * 0.05;

    background();

    var ca = Math.cos(angle), sa = Math.sin(angle);
    var rx = -0.18 + tilt + Math.sin(now * 0.0007) * 0.06;
    var cx = Math.cos(rx), sx = Math.sin(rx);
    var bob = Math.sin(now * 0.0011) * 0.05;
    var list = [];

    for (var i = 0; i < mesh.length; i++) {
      var tr = mesh[i];
      var scr = [];
      var zsum = 0;

      for (var k = 0; k < 3; k++) {
        var v = tr.p[k];
        var x = v[0] * ca + v[2] * sa;
        var z = -v[0] * sa + v[2] * ca;
        var y = v[1] * cx - z * sx;
        z = v[1] * sx + z * cx + DIST;
        y += bob;
        var f = FOCAL / z;
        scr.push([Math.round(W / 2 + x * f), Math.round(H / 2 - y * f), v[3], v[4]]);
        zsum += z;
      }

      var area = (scr[1][0] - scr[0][0]) * (scr[2][1] - scr[0][1]) - (scr[2][0] - scr[0][0]) * (scr[1][1] - scr[0][1]);
      if (area <= 0) continue;

      var n = tr.n;
      var nx = n[0] * ca + n[2] * sa;
      var nz = -n[0] * sa + n[2] * ca;
      var ny = n[1] * cx - nz * sx;
      nz = n[1] * sx + nz * cx;

      var diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      var fog = clamp01(1.25 - (zsum / 3 - (DIST - 0.6)) * 0.35);
      var lit = (0.28 + diff * 1.15 * flick) * fog;
      var rim = Math.max(0, nx * RIM[0] + ny * RIM[1] + nz * RIM[2]) * 0.9;

      list.push({ s: scr, z: zsum, tex: tr.tex, shade: [lit * 1.05 + rim * 0.5, lit * 0.9 + rim * 0.9, lit * 0.78 + rim * 1.6] });
    }

    list.sort(function (p, q) { return q.z - p.z; });
    for (var j = 0; j < list.length; j++) raster(list[j]);

    for (var d = 0; d < motes.length; d++) {
      var mo = motes[d];
      mo.y -= mo.s;
      mo.x += Math.sin(now * 0.001 + mo.w) * 0.08;
      if (mo.y < 0) { mo.y = H; mo.x = hash(d, now | 0) * W; }
      var gx = mo.x | 0, gy = mo.y | 0;
      if (gx >= 0 && gx < W && gy >= 0 && gy < H) put(gx, gy, 0.85 * flick, 0.6 * flick, 0.3);
    }

    ctx.putImageData(frame, 0, 0);
  }

  var visible = true;
  var dragging = false;
  var lastX = 0;
  var lastY = 0;
  var lastT = 0;
  var lastFrame = 0;
  var dragId = null;
  var lastMove = 0;

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }).observe(cv);
  }

  function still() {
    return document.documentElement.classList.contains('no-fx');
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) { lastT = now; return; }
    if (now - lastFrame < 40) return;
    lastFrame = now;

    var dt = Math.min(100, now - (lastT || now));
    lastT = now;

    if (!still() || dragging) {
      if (!dragging) {
        spin += (BASE_SPIN - spin) * 0.02;
        angle += spin * dt;
      }
      tilt *= 0.95;
      render(now);
    } else if (!render.once) {
      render(now);
      render.once = true;
    }
  }

  cv.addEventListener('pointerdown', function (e) {
    if (dragging && !e.isPrimary) return;
    dragging = true;
    dragId = e.pointerId;
    lastMove = e.timeStamp;
    lastX = e.clientX;
    lastY = e.clientY;
    render.once = false;
    if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', function (e) {
    if (!dragging || e.pointerId !== dragId) return;
    lastMove = e.timeStamp;
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    angle += dx * 0.012;
    spin = dx * 0.0006;
    tilt = Math.max(-0.6, Math.min(0.6, tilt + dy * 0.006));
  });
  function drop(e) {
    if (e.pointerId !== dragId) return;
    dragging = false;
    if (e.timeStamp - lastMove > 80) spin = 0;
  }
  cv.addEventListener('pointerup', drop);
  cv.addEventListener('pointercancel', drop);

  render(performance.now());
  requestAnimationFrame(loop);
})();

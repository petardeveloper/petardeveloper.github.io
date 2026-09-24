(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function load(key, session) {
    try { return (session ? sessionStorage : localStorage).getItem(key); } catch (e) { return null; }
  }
  function save(key, val, session) {
    try { (session ? sessionStorage : localStorage).setItem(key, val); } catch (e) {}
  }

  var fxPref = load('inat-fx');
  var fxOn = fxPref ? fxPref === 'on' : !reduceMotion;
  var sndOn = load('inat-snd') !== 'off';
  root.classList.toggle('no-fx', !fxOn);

  var ch = body.getAttribute('data-ch') || '00';
  var mode = body.getAttribute('data-osd') || 'PLAY';

  var fx = document.createElement('div');
  fx.className = 'fx';
  fx.setAttribute('aria-hidden', 'true');
  fx.innerHTML =
    '<canvas class="fx-noise" width="160" height="120"></canvas>' +
    '<div class="fx-scan"></div>' +
    '<div class="fx-track"></div>' +
    '<div class="fx-vignette"></div>';
  body.appendChild(fx);

  var icons = { PLAY: '►', STOP: '■', PAUSE: '‖', REC: '●' };
  var osd = document.createElement('div');
  osd.className = 'osd';
  osd.setAttribute('aria-hidden', 'true');
  osd.innerHTML =
    '<div class="osd-tl"><span class="osd-mode">' + (icons[mode] || icons.PLAY) + '</span> ' + mode + '</div>' +
    '<div class="osd-tr">SP&nbsp;&nbsp;CH' + ch + '</div>' +
    '<div class="osd-bl"><span class="osd-counter">0:00:00</span></div>' +
    '<div class="osd-br"><span class="osd-time"></span><span class="osd-date"></span></div>';
  body.appendChild(osd);

  var sw = document.createElement('div');
  sw.className = 'switch';
  sw.setAttribute('aria-hidden', 'true');
  sw.innerHTML = '<span class="switch-osd"></span>';
  body.appendChild(sw);

  var t0 = parseInt(load('inat-t0', true), 10);
  if (!t0) {
    t0 = Date.now();
    save('inat-t0', String(t0), true);
  }

  var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var elCounter = osd.querySelector('.osd-counter');
  var elTime = osd.querySelector('.osd-time');
  var elDate = osd.querySelector('.osd-date');

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function tick() {
    var s = Math.floor((Date.now() - t0) / 1000);
    elCounter.textContent = Math.floor(s / 3600) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);

    var d = new Date();
    var h = d.getHours();
    elTime.textContent = (h < 12 ? 'AM ' : 'PM ') + ((h % 12) || 12) + ':' + pad(d.getMinutes());
    elDate.textContent = MONTHS[d.getMonth()] + '.' + pad(d.getDate()) + ' ' + d.getFullYear();
  }
  tick();
  setInterval(tick, 1000);

  var noise = fx.querySelector('.fx-noise');
  var nctx = noise.getContext('2d');
  var nimg, npx;
  var lastGrain = 0;

  function sizeNoise() {
    noise.width = 160;
    noise.height = Math.max(1, Math.round(160 * window.innerHeight / window.innerWidth));
    nimg = nctx.createImageData(noise.width, noise.height);
    npx = new Uint32Array(nimg.data.buffer);
  }
  sizeNoise();
  window.addEventListener('resize', sizeNoise);

  function grain(t) {
    if (fxOn && !document.hidden && t - lastGrain > 70) {
      lastGrain = t;
      for (var i = 0; i < npx.length; i++) {
        var v = (Math.random() * 255) | 0;
        npx[i] = 0xff000000 | (v << 16) | (v << 8) | v;
      }
      nctx.putImageData(nimg, 0, 0);
    }
    requestAnimationFrame(grain);
  }
  requestAnimationFrame(grain);

  var actx = null;

  function audio() {
    if (!actx) {
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  function beep(freq, dur, type, vol) {
    if (!sndOn) return;
    if (!audio()) return;
    try {
      var now = actx.currentTime;
      var o = actx.createOscillator();
      var g = actx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(vol || 0.025, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.connect(g);
      g.connect(actx.destination);
      o.start(now);
      o.stop(now + dur + 0.02);
    } catch (e) {}
  }

  function clunk() {
    if (!sndOn) return;
    if (!audio()) return;
    try {
      var now = actx.currentTime;
      var len = Math.floor(actx.sampleRate * 0.09);
      var buf = actx.createBuffer(1, len, actx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      var src = actx.createBufferSource();
      var lp = actx.createBiquadFilter();
      var g = actx.createGain();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      g.gain.value = 0.35;
      src.buffer = buf;
      src.connect(lp);
      lp.connect(g);
      g.connect(actx.destination);
      src.start(now);
    } catch (e) {}
  }

  var lastHover = null;
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest ? e.target.closest('a, button, summary') : null;
    if (el && el !== lastHover) beep(1760, 0.03, 'square', 0.012);
    lastHover = el;
  });

  function paintKnobs() {
    var bFx = document.querySelectorAll('[data-toggle="fx"]');
    var bSnd = document.querySelectorAll('[data-toggle="snd"]');
    for (var i = 0; i < bFx.length; i++) {
      bFx[i].setAttribute('aria-pressed', fxOn ? 'true' : 'false');
      bFx[i].textContent = 'fx ' + (fxOn ? 'on' : 'off');
    }
    for (var j = 0; j < bSnd.length; j++) {
      bSnd[j].setAttribute('aria-pressed', sndOn ? 'true' : 'false');
      bSnd[j].textContent = 'snd ' + (sndOn ? 'on' : 'off');
    }
  }
  paintKnobs();

  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-toggle]') : null;
    if (!b) return;
    var what = b.getAttribute('data-toggle');
    if (what === 'fx') {
      fxOn = !fxOn;
      root.classList.toggle('no-fx', !fxOn);
      save('inat-fx', fxOn ? 'on' : 'off');
    } else if (what === 'snd') {
      sndOn = !sndOn;
      save('inat-snd', sndOn ? 'on' : 'off');
      if (sndOn) beep(880, 0.08, 'square', 0.03);
    }
    paintKnobs();
  });

  var menuBtn = document.querySelector('.menu-btn');
  var menu = document.getElementById('menu');
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.textContent = open ? 'close' : 'menu';
    });
  }

  var swOsd = sw.querySelector('.switch-osd');

  function isPage(url) {
    var p = url.pathname;
    return /\.html?$/i.test(p) || /\/$/.test(p) || !/\.[a-z0-9]+$/i.test(p);
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;

    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.protocol !== location.protocol || url.host !== location.host) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    if (!isPage(url)) return;

    clunk();
    if (!fxOn) return;

    e.preventDefault();
    var to = parseInt(a.getAttribute('data-ch'), 10);
    var back = !isNaN(to) && to < parseInt(ch, 10);
    swOsd.textContent = back ? '◄◄ REW' : '►► FF';
    root.classList.add('switching');
    setTimeout(function () { location.href = a.href; }, 260);
    setTimeout(function () { root.classList.remove('switching'); }, 3000);
  });

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) root.classList.remove('switching');
  });

  var boot = document.getElementById('boot');

  function bootDone() {
    root.classList.remove('booting');
    root.classList.add('booted');
    save('inat-booted', '1', true);
    document.removeEventListener('keydown', bootSkip);
    if (boot) boot.removeEventListener('pointerdown', bootSkip);
  }

  var bootTimers = [];
  function bootSkip() {
    for (var i = 0; i < bootTimers.length; i++) clearTimeout(bootTimers[i]);
    boot.setAttribute('data-stage', 'static');
    beep(120, 0.12, 'sawtooth', 0.02);
    setTimeout(bootDone, 180);
  }

  if (boot && !root.classList.contains('booted')) {
    if (!fxOn) {
      bootDone();
    } else {
      root.classList.add('booting');
      document.addEventListener('keydown', bootSkip);
      boot.addEventListener('pointerdown', bootSkip);
      bootTimers.push(setTimeout(function () { boot.setAttribute('data-stage', 'warn'); }, 900));
      bootTimers.push(setTimeout(function () { boot.setAttribute('data-stage', 'static'); }, 4100));
      bootTimers.push(setTimeout(bootDone, 4450));
    }
  }

  var said = document.createElement('p');
  said.className = 'sr-only';
  said.setAttribute('aria-live', 'polite');
  body.appendChild(said);

  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-copy]') : null;
    if (!b) return;
    var src = document.querySelector(b.getAttribute('data-copy'));
    if (!src) return;
    var text = src.textContent.trim();
    var old = b.getAttribute('data-label') || b.innerHTML;
    b.setAttribute('data-label', old);

    function done(ok) {
      if (!ok) {
        var r = document.createRange();
        r.selectNodeContents(src);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      }
      b.textContent = ok ? 'copied' : 'ctrl+c it';
      said.textContent = ok ? 'copied' : 'could not copy it, it is selected now, press ctrl+c';
      setTimeout(function () { b.innerHTML = old; said.textContent = ''; }, 1600);
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.opacity = '0';
      body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) {}
      body.removeChild(ta);
      b.focus();
      done(ok);
    }
  });

  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-embed-load]') : null;
    if (!b) return;
    var box = b.closest('[data-embed]');
    if (!box) return;
    var f = document.createElement('iframe');
    f.className = 'steam-widget';
    f.src = box.getAttribute('data-embed');
    f.title = box.getAttribute('data-embed-title') || 'embedded content';
    box.innerHTML = '';
    box.classList.add('loaded');
    box.appendChild(f);
    f.focus();
  });

  var years = document.querySelectorAll('[data-year]');
  for (var y = 0; y < years.length; y++) years[y].textContent = new Date().getFullYear();

  var jumps = document.querySelectorAll('a[href^="404.html#"]');
  for (var jm = 0; jm < jumps.length; jm++) jumps[jm].href = location.pathname + location.search + jumps[jm].hash;

  var konami = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  var kpos = 0;
  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    if (!/^[a-z]$/.test(k) && /^Key[A-Z]$/.test(e.code || '')) k = e.code.slice(3).toLowerCase();
    if (k === konami[kpos]) kpos++;
    else if (k === 'arrowup') kpos = kpos === 2 ? 2 : 1;
    else kpos = 0;
    if (kpos === konami.length) {
      kpos = 0;
      var on = root.classList.toggle('possessed');
      beep(on ? 55 : 440, 0.9, 'sawtooth', 0.05);
    }
  });

  console.log(
    '%cinat%c\nhey. if you are reading this you probably make stuff too.\ntry the konami code.',
    'font: 42px "UnifrakturMaguntia", serif; color: #ec2f3b;',
    'font: 14px monospace; color: #a0978a;'
  );
})();

(function (global) {
  'use strict';

  var GAME_URL = '../part2-frozen-rush/game/index.html';
  var OPENING_LINES = [
    { t: 'Momo needs your help.', vo: 'sw1' },
    { t: 'But to help Momo, you need to learn about polygons.', vo: 'sw2' }
  ];
  var DITCH_LINES = [
    { t: 'Now let’s help Momo.', vo: 'sw3' }
  ];
  var SNOW_LEAD = 420, SNOW_FADE = 1300, CURTAIN_IN = 340, CURTAIN_OUT = 580;
  var OPENING_LOAD_CAP = 45000, OPENING_PLAY_CAP = 180000, READY_CAP = 20000;

  var doc = global.document, loc = global.location || {};
  var search = loc.search || '';
  var dev = /[?&]dev=1\b/.test(search);
  var devAt = (/[?&]devat=([a-z0-9]+)/.exec(search) || [])[1] || '';

  function enabled() {
    if (/[?&]intro=0\b/.test(search)) return false;
    if (/[?&]intro=1\b/.test(search)) return true;
    var nav = global.navigator || {};
    if (nav.webdriver) return false;                            // the suites drive the lesson alone
    if (/jsdom/i.test(nav.userAgent || '')) return false;
    return true;
  }
  var on = !!doc && enabled();

  function keepLan(u) { return (global.I18N && I18N.keep) ? I18N.keep(u) : u; }
  function url(part, at) {
    var q = 'lesson=' + part + (dev ? '&dev=1' : '') + (at ? '&devat=' + at : '');
    return keepLan(GAME_URL + '?' + q);
  }
  function frame(id, src, shown) {
    var f = doc.createElement('iframe');
    f.id = id;
    f.className = 'runner-frame' + (shown ? '' : ' unseen');
    f.setAttribute('title', 'Frozen Rush');
    f.setAttribute('allow', 'autoplay; fullscreen');
    f.src = src;
    doc.body.appendChild(f);
    return f;
  }
  function post(f, word) {
    try { if (f && f.contentWindow) f.contentWindow.postMessage({ iceAge: word }, '*'); } catch (e) { /* gone */ }
  }

  var SILENT = (function () {
    // a twentieth of a second of 8 kHz silence, built here rather than pasted in
    var n = 400, b = new Uint8Array(44 + n * 2), v = new DataView(b.buffer);
    var w = function (o, str) { for (var i = 0; i < str.length; i++) b[o + i] = str.charCodeAt(i); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, n * 2, true);
    var bin = ''; for (var i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
    try { return 'data:audio/wav;base64,' + global.btoa(bin); } catch (e) { return ''; }
  }());
  function unlock() {
    try { if (global.SFX && SFX.unlock) SFX.unlock(); } catch (e) {}
    try { var a = new global.Audio(SILENT); a.volume = 0; var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }
  global.__lessonUnlock = unlock;

  var flurry = (function () {
    var cv = null, ctx = null, flakes = [], raf = 0, blowing = false, t0 = 0;
    function make(W, H, fresh, dpr) {
      var r = 12 + Math.pow(Math.random(), 1.6) * 64;
      return { x: fresh ? W + Math.random() * W * 0.6 : Math.random() * W, y: -H * 0.2 + Math.random() * H * 1.1,
               r: r, vx: -(380 + Math.random() * 520) * (0.6 + r / 60), vy: 60 + Math.random() * 160,
               a: Math.random() * 6.28, va: (Math.random() - 0.5) * 2.4, o: 0.55 + Math.random() * 0.45,
               p: global.Path2D && global.Snowflake ? new global.Path2D(Snowflake.path(r * dpr, Math.floor(Math.random() * 1e6))) : null,
               w: Math.max(1.2, r * 2.2 * 0.012) * dpr };
    }
    function frameStep(last) {
      return function step(ts) {
        var dt = Math.min(0.05, (ts - last) / 1000); last = ts;
        var W = cv.width, H = cv.height, dpr = cv._dpr;
        ctx.clearRect(0, 0, W, H);
        var alive = 0;
        for (var i = 0; i < flakes.length; i++) {
          var f = flakes[i];
          f.x += f.vx * dt * dpr; f.y += f.vy * dt * dpr; f.a += f.va * dt;
          if (f.x < -f.r * 2 * dpr || f.y > H + f.r * 2 * dpr) { if (blowing) { flakes[i] = make(W, H, true, dpr); } continue; }
          alive++;
          ctx.save();
          ctx.translate(f.x, f.y); ctx.rotate(f.a);
          ctx.globalAlpha = f.o;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          if (f.p) {
            ctx.strokeStyle = 'rgba(150, 205, 245, 0.8)'; ctx.lineWidth = f.w * 3.4; ctx.stroke(f.p);
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = f.w; ctx.stroke(f.p);
          } else { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, f.r * dpr * 0.3, 0, 6.29); ctx.fill(); }
          ctx.restore();
        }
        if (!blowing && !alive) { stop(true); return; }
        raf = global.requestAnimationFrame(step);
      };
    }
    function start() {
      blowing = true;
      if (cv) return;
      cv = doc.createElement('canvas');
      cv.className = 'runner-flurry';
      var dpr = Math.min(2, global.devicePixelRatio || 1);
      cv._dpr = dpr;
      cv.width = Math.round(global.innerWidth * dpr); cv.height = Math.round(global.innerHeight * dpr);
      doc.body.appendChild(cv);
      ctx = cv.getContext('2d');
      flakes = [];
      var n = Math.round(Math.min(120, Math.max(60, global.innerWidth / 13)));
      for (var i = 0; i < n; i++) flakes.push(make(cv.width, cv.height, i > n * 0.35, dpr));
      t0 = global.performance ? performance.now() : 0;
      raf = global.requestAnimationFrame(frameStep(t0));
    }
    function ease() { blowing = false; }                         // the flakes still in the air blow out
    function stop(now) {
      blowing = false;
      if (!now) return;
      if (raf) global.cancelAnimationFrame(raf);
      raf = 0;
      if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
      cv = null; ctx = null; flakes = [];
    }
    return { start: start, ease: ease, stop: stop };
  }());

  /* ---- the messages, from either frame ---- */
  var open = null, back = null, gen = 0;          // gen: bumped by a review jump (leave)
  var openState = { ready: false, played: false, handed: false };
  var backState = { ready: false, running: false, unlocked: false, waiters: [] };
  function onMessage(e) {
    var d = e.data;
    if (!d || typeof d !== 'object' || !d.iceAge) return;
    var fromOpen = open && e.source === open.contentWindow, fromBack = back && e.source === back.contentWindow;
    if (fromOpen) {
      if (d.iceAge === 'ready') openState.ready = true;
      else if (d.iceAge === 'play') { openState.played = true; unlock(); armPlayCap(); }
      else if (d.iceAge === 'lesson') atBreak(d.where);
    } else if (fromBack) {
      if (d.iceAge === 'ready') { backState.ready = true; flushWaiters(); }
      else if (d.iceAge === 'running') backState.running = true;
      else if (d.iceAge === 'swiftee') atDitch(d.where);
    }
  }

  /* ======================= BEFORE THE LESSON ======================= */
  var gateOpen = false, gateResolve = null;
  var gate = new Promise(function (r) { gateResolve = r; });
  function release() { if (gateOpen) return; gateOpen = true; gateResolve(); }

  function liftReviewBar() {
    var bar = doc.getElementById('jump');
    if (bar && bar.parentNode !== doc.body) doc.body.appendChild(bar);
  }
  function opening() {
    liftReviewBar();
    if (doc.documentElement) doc.documentElement.classList.add('runner-opening');
    open = frame('runner-open', url('intro', devAt === 'break' ? 'break' : ''), true);
    open.addEventListener('load', function () { focusFrame(open); });
    if (global.SwifteeVisit) SwifteeVisit.load();
    setTimeout(function () { if (!openState.ready && !openState.played) giveUp(); }, OPENING_LOAD_CAP);
  }
  var playCap = 0;
  function armPlayCap() {
    if (playCap) return;
    playCap = setTimeout(function () { if (!openState.handed) toLesson(); }, OPENING_PLAY_CAP);
  }
  /* the opening could not run: off the screen, and the lesson as it always was */
  function giveUp() {
    if (openState.handed) return;
    openState.handed = true;
    if (open && open.parentNode) open.parentNode.removeChild(open);
    open = null;
    if (doc.documentElement) doc.documentElement.classList.remove('runner-opening');
    release();
    if (global.Lesson && Lesson.showTitle) Lesson.showTitle();
  }
  function atBreak(where) {
    if (openState.handed) return;
    openState.handed = true;
    var g0 = gen;
    var visit = global.SwifteeVisit ? SwifteeVisit.run({ frame: open, where: where || {}, lines: OPENING_LINES, exit: 'left',
      // as he takes off, the snow comes in and the game's music goes
      onLeave: function () { flurry.start(); post(open, 'quiet'); } }) : Promise.resolve();
    visit.then(function () { if (g0 === gen) toLesson(true); });
  }
  function toLesson(snowing) {
    openState.handed = true;
    if (!snowing) { flurry.start(); post(open, 'quiet'); }
    var lessonIn = global.Preload && Preload.done ? Preload.done : Promise.resolve();
    setTimeout(function () {
      lessonIn.then(function () {
        release();
        if (global.Lesson && Lesson.startHosted) Lesson.startHosted();
        var f = open;
        if (f) f.classList.add('fading');
        setTimeout(function () {
          if (f && f.parentNode) f.parentNode.removeChild(f);
          if (open === f) open = null;
          if (doc.documentElement) doc.documentElement.classList.remove('runner-opening');
          flurry.ease();
        }, SNOW_FADE);
      });
    }, SNOW_LEAD);
  }

  /* ======================= AFTER THE LESSON ======================= */
  function preload(at) {
    if (!on || back) return;
    backState = { ready: false, running: false, unlocked: false, waiters: [] };
    back = frame('runner-back', url('end', at || ''), false);
    setTimeout(function () { if (!backState.ready) { backState.ready = true; flushWaiters(); } }, READY_CAP);
  }
  function flushWaiters() { var w = backState.waiters; backState.waiters = []; w.forEach(function (f) { f(); }); }
  /* every tap on the lesson opens the return frame's sound, until it says it is open */
  function unlockBack() {
    if (!back || backState.unlocked) return;
    try { var w = back.contentWindow; if (w && w.iceAgeUnlock && w.iceAgeUnlock()) backState.unlocked = true; } catch (e) { /* another origin: Chrome needs none */ }
  }
  var started = false;
  function start() {
    if (!on || started) return false;
    started = true;
    if (!back) preload();
    var go = function () {
      flurry.start();
      var curtain = doc.createElement('div');
      curtain.className = 'runner-curtain';
      doc.body.appendChild(curtain);
      global.requestAnimationFrame(function () { curtain.classList.add('on'); });
      setTimeout(function () {
        try { if (global.Music && Music.stop) Music.stop(); } catch (e) {}
        try { if (global.VO && VO.stop) VO.stop(); } catch (e) {}
        if (doc.documentElement) doc.documentElement.classList.add('runner-back');
        back.classList.remove('unseen');
        focusFrame(back);
        var tries = 0;
        (function begin() {
          if (backState.running || tries++ > 40) return;
          post(back, 'begin');
          setTimeout(begin, 500);
        })();
        setTimeout(function () {
          curtain.classList.remove('on');
          setTimeout(function () { if (curtain.parentNode) curtain.parentNode.removeChild(curtain); }, CURTAIN_OUT + 60);
          flurry.ease();
        }, 120);
      }, CURTAIN_IN);
    };
    if (backState.ready) go(); else backState.waiters.push(go);
    return true;
  }
  function atDitch(where) {
    var g0 = gen, f = back;
    var visit = global.SwifteeVisit ? SwifteeVisit.run({ frame: back, where: where || {}, lines: DITCH_LINES, exit: 'right' }) : Promise.resolve();
    visit.then(function () { if (g0 === gen && f === back) post(back, 'said'); });
  }

  function leave() {
    if (!on) return;
    gen++;
    openState.handed = true;
    flurry.stop(true);
    if (open && open.parentNode) open.parentNode.removeChild(open);
    open = null;
    if (back) { post(back, 'quiet'); if (back.parentNode) back.parentNode.removeChild(back); }
    back = null; started = false;
    backState = { ready: false, running: false, unlocked: false, waiters: [] };
    [].forEach.call(doc.querySelectorAll('.runner-curtain, .visit'), function (el) { el.remove(); });
    if (doc.documentElement) doc.documentElement.classList.remove('runner-opening', 'runner-back');
    try { if (global.VO && VO.stop) VO.stop(); } catch (e) {}
    release();
    if (global.Lesson && Lesson.showTitle) Lesson.showTitle();
  }

  /* ---- review (?dev=1): the jump list's Start and End entries ---- */
  function devJump(what) {
    var base = loc.pathname || '';
    var q = 'dev=1';
    if (what === 'start1') { loc.assign(keepLan(base + '?' + q + '&intro=1')); return; }
    if (what === 'start2') { loc.assign(keepLan(base + '?' + q + '&intro=1&devat=break')); return; }
    if (what === 'end1' || what === 'end2') {
      leave();
      preload(what === 'end2' ? 'break' : '');
      if (global.Lesson && Lesson.devReady && what === 'end1') Lesson.devReady();
      else start();
    }
  }

  function keyToGame(e) {
    var f = open || (back && !back.classList.contains('unseen') ? back : null);
    if (!f) return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      if (e.repeat) return;
      e.preventDefault();
      post(f, 'jump');
      try { f.contentWindow.focus(); } catch (x) {}
    }
  }
  function focusFrame(f) { try { f.focus(); if (f.contentWindow) f.contentWindow.focus(); } catch (e) {} }
  if (on) {
    if (doc.documentElement) doc.documentElement.classList.add('runner-on');
    global.addEventListener('message', onMessage);
    doc.addEventListener('pointerdown', unlockBack, true);
    doc.addEventListener('keydown', unlockBack, true);
    doc.addEventListener('keydown', keyToGame);
    // once the pictures' format is known, as the lesson's boot does (game.js start)
    var begin = function () {
      var F = global.ImgFormat;
      if (F && F.ready && !F.settled) F.ready.then(opening); else opening();
    };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', begin); else begin();
  } else {
    release();
  }

  global.RunnerStage = {
    get on() { return on; },
    get opening() { return on && !gateOpen; },
    gate: gate,
    preload: preload,
    start: start,
    devJump: devJump,
    leave: leave,
    _flurry: flurry,                                       // review and tests: the snow on its own
    OPENING_LINES: OPENING_LINES,
    DITCH_LINES: DITCH_LINES
  };
})(typeof window !== 'undefined' ? window : this);

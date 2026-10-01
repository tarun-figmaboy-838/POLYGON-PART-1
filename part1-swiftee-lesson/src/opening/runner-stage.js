/*!
 * runner-stage.js — Frozen Rush around the lesson (the user's game-lesson kit).
 *
 * BEFORE THE LESSON the game opens the experience. This page starts with the game in a frame over
 * everything: its cover and Play, its avalanche, its tutorial up to the broken path, where it holds
 * still and says where Momo and the hole are ('lesson'). Swiftee flies in over it and says why the
 * lesson comes first; snow blows across, he flies off, the game's music fades, and the game fades
 * away onto the lesson's first screen, already starting underneath. No title, no Play, no blank or
 * white screen between the broken path and the lesson.
 *
 * AFTER THE LESSON the game comes back by itself. A second frame is loaded, unseen, a screen
 * before the end. After the lesson's last line snow blows across, and the game appears under it
 * and starts on its own — no cover, no Play — with the avalanche and the run, and nothing said
 * until the first ditch, where it holds still ('swiftee'). Swiftee flies in, says "Now let's help
 * Momo.", flies off, and the game goes on to its plank, its question and its praise ('said').
 *
 * The game always runs in a frame so its styles, its audio and its URL flags never mix with the
 * lesson's, and it talks to this page only by postMessage (off the disk too):
 *
 *   game -> page   { iceAge: 'ready' }            its art is in
 *                  { iceAge: 'play' }             the learner pressed Play (the opening)
 *                  { iceAge: 'running' }          the hosted run has begun (the return)
 *                  { iceAge: 'lesson', where }    the opening's tutorial is over; held at the break
 *                  { iceAge: 'swiftee', id, where }  the return is held at the ditch for Swiftee
 *   page -> game   { iceAge: 'begin' }  'said'  'quiet'
 *
 * SOUND. A tap in a frame is not a tap on this page in Safari, so the game's Play calls
 * window.__lessonUnlock in the same gesture (same origin), which opens this page's sound. And the
 * other way round: the return frame is never tapped, so every tap on the lesson opens ITS sound
 * (iceAgeUnlock), until it says it is open. Measured in WebKit and Chromium both.
 *
 * Off for automated browsers (the lesson's own suites drive the lesson alone) unless ?intro=1, and
 * for ?intro=0. Without it the lesson is exactly as it was: its title, Play, and Part 2's button.
 */
(function (global) {
  'use strict';

  var GAME_URL = '../part2-frozen-rush/game/index.html';
  /* SWIFTEE'S LINES over the game. Every one has its clip in assets/vo (tools/vo-lines.js reads
     these pairs): sw2 and sw3 are joined from his recorded words (tools/vo-joins.js); sw1 is
     generated until it is recorded — "needs" is in none of his takes. */
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

  function url(part, at) {
    var q = 'lesson=' + part + (dev ? '&dev=1' : '') + (at ? '&devat=' + at : '');
    return GAME_URL + '?' + q;
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

  /* THIS PAGE'S SOUND, opened from the game's Play press (and again on its 'play', for the browsers
     that need nothing more). The silent sample is what Safari counts. */
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

  /* ---- the snow: crystals blowing across, the lesson's own (src/fx/snowflake.js) ---- */
  var flurry = (function () {
    var cv = null, ctx = null, flakes = [], raf = 0, blowing = false, t0 = 0;
    function make(W, H, fresh, dpr) {
      // (big crystals in front, small ones far off — the kit's flurry is weather, not dust)
      var r = 12 + Math.pow(Math.random(), 1.6) * 64;
      return { x: fresh ? W + Math.random() * W * 0.6 : Math.random() * W, y: -H * 0.2 + Math.random() * H * 1.1,
               r: r, vx: -(380 + Math.random() * 520) * (0.6 + r / 60), vy: 60 + Math.random() * 160,
               a: Math.random() * 6.28, va: (Math.random() - 0.5) * 2.4, o: 0.55 + Math.random() * 0.45,
               // the crystal at its own size (the path's numbers are rounded to hundredths), drawn
               // the way the lesson draws its flakes: a soft frosted stroke under a fine white one
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
  /** Resolves when the lesson may begin: at once without the opening, after the snow with it. */
  var gate = new Promise(function (r) { gateResolve = r; });
  function release() { if (gateOpen) return; gateOpen = true; gateResolve(); }

  /* THE REVIEW BAR OVER THE GAME. It lives inside #game, which is position:fixed and so a layer of
     its own: its z-index counted only among the lesson's elements, and the game's frame lay over
     it — the bar could not be reached while the game was up. On the page itself it is over both. */
  function liftReviewBar() {
    var bar = doc.getElementById('jump');
    if (bar && bar.parentNode !== doc.body) doc.body.appendChild(bar);
  }
  function opening() {
    liftReviewBar();
    if (doc.documentElement) doc.documentElement.classList.add('runner-opening');
    open = frame('runner-open', url('intro', devAt === 'break' ? 'break' : ''), true);
    if (global.SwifteeVisit) SwifteeVisit.load();
    // a game that never shows its cover is not waited for: the lesson's own title comes up
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
  /* THE SNOW CARRIES THE GAME AWAY. The lesson starts underneath (its first screen, its Swiftee
     already on his way to his rock), and the game fades off it under the snow. */
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
  /** Load the return frame, unseen. Called a screen before the end, so a tap is still to come. */
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
  /** The lesson's last line has been read: the game takes the screen, and starts by itself. */
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
        // the lesson is over: its tune and its voice stop, its Swiftee is not left under the game
        try { if (global.Music && Music.stop) Music.stop(); } catch (e) {}
        try { if (global.VO && VO.stop) VO.stop(); } catch (e) {}
        if (doc.documentElement) doc.documentElement.classList.add('runner-back');
        back.classList.remove('unseen');
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

  /* REVIEW (?dev=1): A JUMP TO A LESSON SCREEN TAKES THE GAME OFF THE SCREEN. The lesson is under
     the game's frame, so picking a screen while the game was up changed the lesson behind it and
     showed nothing (the user: "jump not working"). The frames, the snow, the curtain and any visit
     go, and nothing from before the jump carries on (gen). */
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
    if (what === 'start1') { loc.assign(base + '?' + q + '&intro=1'); return; }
    if (what === 'start2') { loc.assign(base + '?' + q + '&intro=1&devat=break'); return; }
    // the end: straight to the game's return, from the lesson's last screen or from its ditch
    if (what === 'end1' || what === 'end2') {
      leave();
      preload(what === 'end2' ? 'break' : '');
      if (global.Lesson && Lesson.devReady && what === 'end1') Lesson.devReady();
      else start();
    }
  }

  if (on) {
    if (doc.documentElement) doc.documentElement.classList.add('runner-on');
    global.addEventListener('message', onMessage);
    doc.addEventListener('pointerdown', unlockBack, true);
    doc.addEventListener('keydown', unlockBack, true);
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', opening); else opening();
  } else {
    release();
  }

  global.RunnerStage = {
    get on() { return on; },
    /** true while the game's opening is on the screen (the lesson's title stays out of sight) */
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

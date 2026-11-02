// swiftee.js — the companion, driven by the real sprite sheets.
(function (global) {
  'use strict';

  var F = global.SwifteeFrames;

  /** One cell, always rendered at this CSS size; the wrapper scales. */
  var CELL_PX = 256;

  var STATES = {
    idle:        { rig: 'blinking',    hold: true, level: 1, tier: 'idle' },

    // narration and attention
    explain:     { rig: 'talking',     hold: true, level: 1, tier: 'present' },
    think:       { rig: 'thinking',    hold: true, level: 2, tier: 'present' },
    inspect:     { rig: 'focussed',    hold: true, level: 2, tier: 'present' },
    look:        { rig: 'curious',     loops: 2,  lean: true, level: 2, tier: 'present' },
    point:       { rig: 'playful',     loops: 1,  lean: true, level: 2, tier: 'present' },

    // reactions
    wave:        { rig: 'waving',      loops: 2, cut: true },
    nod:         { rig: 'happy',       brief: 6, mood: 'glad', cut: true, react: true, body: 'notice', level: 2, tier: 'feedback' },
    celebrate:   { rig: 'celebrating', loops: 1, mood: 'glad', cut: true, react: true, body: 'cheer', level: 3, tier: 'feedback' },
    encourage:   { rig: 'happy',       brief: 6, mood: 'glad', level: 2, tier: 'present' },
    confused:    { rig: 'confused',    brief: 8, cut: true, react: true, level: 2, tier: 'feedback' },
    surprised:   { rig: 'surprised',   brief: 8, cut: true, react: true, mood: 'amazed', level: 2, tier: 'feedback' },
    mischief:    { rig: 'playful',     loops: 2, level: 2, tier: 'present' },
    'step-back': { rig: 'proud',       loops: 1, shift: -34, level: 1, tier: 'present' },

    proud:       { rig: 'proud',       loops: 2, mood: 'glad', cut: true, level: 2, tier: 'feedback' },
    peek:        { rig: 'blinking',    hold: true, level: 1, tier: 'idle' },
    excited:     { rig: 'excited',     loops: 1, mood: 'glad', cut: true, react: true, body: 'cheer', level: 3, tier: 'feedback' },
    happy:       { rig: 'happy',       brief: 6, mood: 'glad', cut: true, react: true, body: 'notice', level: 2, tier: 'feedback' },
    daydream:    { rig: 'curious',     hold: true },
    hover:       { rig: 'flapping',    hold: true },
    sleep:       { rig: 'curious',     hold: true },

    // moods: what a line is spoken in when it follows a reaction
    glad:        { rig: 'happy',       hold: true },
    amazed:      { rig: 'surprised',   hold: true },

    watch:       { rig: 'blinking',    hold: true, level: 1, tier: 'act' },

    /* LEVEL 2 — a short, legible gesture, and then out of the way. */
    present:     { rig: 'celebrating', brief: 3, lean: true, level: 2, tier: 'present' },
    // looking at something with interest, head on one side
    observe:     { rig: 'curious',     brief: 10, lean: true, level: 2, tier: 'present' },
    // a question stands: the head stays tilted while it does
    question:    { rig: 'curious',     hold: true, level: 2, tier: 'present' },
    // "what will happen?" — before the child reshapes something
    curious:     { rig: 'curious',     brief: 6, lean: true, level: 2, tier: 'present' },
    // one card, then the other: `at` is the pair, and he leans to each in turn
    compare:     { rig: 'curious',     loops: 1, lean: true, level: 2, tier: 'present' },
    recall:      { rig: 'reading',     hold: true, seated: 'think', level: 2, tier: 'present' },
    note:        { rig: 'writing',     hold: true, seated: 'explain', level: 2, tier: 'present' },
    // held while the child measures the angles: the same glass, looking with them
    examine:     { rig: 'learning',    hold: true, seated: 'inspect', level: 2, tier: 'present' },
    // the idle nudge: one look toward whatever is waiting to be touched
    hint:        { rig: 'curious',     brief: 6, lean: true, level: 2, tier: 'hint' },
    oops:        { rig: 'confused',    brief: 4, cut: true, react: true, then: 'encourage', again: 'rethink', level: 2, tier: 'feedback' },
    rethink:     { rig: 'thinking',    brief: 6, cut: true, react: true, then: 'encourage', level: 2, tier: 'feedback' },
    happySmall:  { variants: ['nice', 'chuffed', 'wink'], recovered: 'phew', react: true, level: 2, tier: 'feedback' },
    nice:        { rig: 'happy',       brief: 10, mood: 'glad', cut: true, react: true, body: 'cheer', level: 2, tier: 'feedback' },
    chuffed:     { rig: 'proud',       brief: 10, mood: 'glad', cut: true, react: true, body: 'cheer', level: 2, tier: 'feedback' },
    wink:        { rig: 'playful',     brief: 7, mood: 'glad', cut: true, react: true, body: 'cheer', level: 2, tier: 'feedback' },
    // right after a miss: relief, eyes shut — "phew, there it is"
    phew:        { rig: 'relieved',    brief: 8, mood: 'glad', cut: true, react: true, body: 'cheer', level: 2, tier: 'feedback' },
    // the shape did something: a quick "oh!" — smaller than a celebration
    discover:    { rig: 'surprised',   brief: 6, mood: 'amazed', cut: true, react: true, level: 2, tier: 'feedback' },

    /* LEVEL 3 — the milestones. Heart eyes for a discovery he loves. */
    delight:     { rig: 'love',        loops: 1, mood: 'glad', cut: true, react: true, body: 'cheer', level: 3, tier: 'feedback' },

    // travel — a standalone loop under a WAAPI move
    enter:       { rig: 'driving',     hold: true },
    exit:        { rig: 'flapping',    hold: true },
    perch:       { rig: 'flapping',    hold: true },
    move:        { rig: 'flapping',    hold: true }
  };

  var PRELOAD = ['blinking',
                 'wave_start', 'waving', 'wave_stop',
                 'talk_start', 'talking', 'talk_stop', 'flapping'];

  var REACTIONS = ['happy_start', 'happy', 'happy_stop',
                   'confused_start', 'confused', 'confused_stop',
                   // and the face he watches the child work with
                   'blinking'];

  var SHEET_BUDGET = 10;
  var PINNED = { blinking: 1, talking: 1, talk_start: 1, talk_stop: 1, flapping: 1 };

  var IDLE_DAYDREAM_MS = 30000;
  var IDLE_SLEEP_MS = 75000;

  var el = null, cellEl = null, shadowEl = null, flightEl = null;
  var canvasEl = null, cctx = null, held = null, drawnOnce = false;
  var flightReady = false, flightHold = null;   // the inspection flight's art: decoded, and kept
  var CANVAS_PX = 512;
  var flightArt = null;
  var layout = null;                  // function(pos, size) -> { x, y, scale }
  var pos = 'left', size = 'medium';
  var scale = '1x';                   // which sheet resolution is being sampled
  var reduced = false;

  var live = [];                      // WAAPI animations on the wrapper
  var shiftAnim = null;               // the one animation allowed to persist
  var active = null;                  // the clip currently on screen
  var gen = 0;                        // bumped by every play(); stale sequences bail
  var stateName = 'idle';             // the storyboard state we are resting in
  var rigLoop = null;                 // the rig loop clip that still owes a `stop`
  var speaking = false;
  var mood = null, moodAt = 0;
  var MOOD_MS = 3000;
  var idleTimer = null, idleLevel = 0;
  var rafId = null, lastT = 0, painted = null;   // url of the sheet currently bound
  var sheets = {};                    // url -> { img, promise, ok, used, pinned }
  var sheetClock = 0;
  var everLoaded = {};

  function nowMs() {
    return (global.performance && global.performance.now) ? global.performance.now() : Date.now();
  }

  function url(rel) { return F.base + rel; }

  function sheet(rel, clipName) {
    var u = url(rel);
    if (sheets[u]) { sheets[u].used = ++sheetClock; return sheets[u]; }
    var rec = { ok: false, url: u, used: ++sheetClock, pinned: !!PINNED[clipName] };
    rec.promise = new Promise(function (resolve) {
      if (!global.Image) { resolve(false); return; }
      var img = new global.Image();
      var ready = function () {
        if (rec.ok) return;
        rec.ok = true; everLoaded[u] = true; resolve(true);
        if (held) paint(held.name, held.frame);
      };
      img.onload = function () {
        if (img.decode) img.decode().then(ready, ready); else ready();
      };
      img.onerror = function () {
        delete sheets[u];
        resolve(false);
      };
      img.src = u;
      rec.img = img;
      if (img.complete && img.naturalWidth) { if (img.decode) img.decode().then(ready, ready); else ready(); }
    });
    sheets[u] = rec;
    evict();
    return rec;
  }

  /** Drop the least recently painted unpinned sheets past the budget. */
  function evict() {
    var keys = Object.keys(sheets);
    if (keys.length <= SHEET_BUDGET) return;
    var waiting = held && pagesOf(held.name) ? pagesOf(held.name).map(function (pg) { return url(pg.image); }) : [];
    keys.filter(function (k) { return !sheets[k].pinned && sheets[k].url !== painted && sheets[k].ok && waiting.indexOf(k) < 0; })
        .sort(function (a, b) { return sheets[a].used - sheets[b].used; })
        .slice(0, keys.length - SHEET_BUDGET)
        .forEach(function (k) {
          var rec = sheets[k];
          if (rec.img) { rec.img.onload = rec.img.onerror = null; rec.img = null; }
          delete sheets[k];
        });
  }

  /** Every page of a clip at the current scale, with a 1x fallback. */
  function pagesOf(name) {
    var c = F.clips[name];
    if (!c) return null;
    return c.sheets[scale] || c.sheets['1x'];
  }

  function preload(names) {
    (names || []).forEach(function (n) {
      var ps = pagesOf(n);
      if (ps) ps.forEach(function (p) { sheet(p.image, n); });
    });
  }

  function awaitSheet(name, ms) {
    var ps = pagesOf(name);
    if (!ps || !ps.length) return Promise.resolve(false);
    var rec = sheet(ps[0].image, name);
    if (rec.ok || everLoaded[rec.url]) return Promise.resolve(true);
    return Promise.race([rec.promise, delay(ms == null ? 400 : ms)]);
  }

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function paint(name, frame) {
    var ps = pagesOf(name);
    if (!ps || !cellEl) return;
    var page = ps[0], k;
    for (k = 0; k < ps.length; k++) {
      if (frame >= ps[k].first && frame < ps[k].first + ps[k].frames) { page = ps[k]; break; }
    }
    var local = frame - page.first;
    var col = local % page.cols, row = Math.floor(local / page.cols);

    var u = url(page.image);
    if (cctx) {
      var rec = sheets[u] || sheet(page.image, name);
      rec.used = ++sheetClock;
      if (!rec.ok || !rec.img || !rec.img.naturalWidth) { held = { name: name, frame: frame }; return; }
      held = null;
      var img = rec.img, sw = img.naturalWidth / page.cols, sh = img.naturalHeight / page.rows;
      cctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
      cctx.drawImage(img, col * sw, row * sh, sw, sh, 0, 0, CANVAS_PX, CANVAS_PX);
      if (painted !== u) { painted = u; cellEl.setAttribute('data-sheet', page.image); }
      cellEl.setAttribute('data-frame', String(frame));
      if (!drawnOnce) { drawnOnce = true; canvasEl.style.visibility = 'visible'; }
      return;
    }
    if (painted !== u) {
      cellEl.style.backgroundImage = 'url("' + u + '")';
      cellEl.style.backgroundSize = (page.cols * CELL_PX) + 'px ' + (page.rows * CELL_PX) + 'px';
      painted = u;
    }
    if (sheets[u]) sheets[u].used = ++sheetClock;   // keep what is on screen hot
    cellEl.style.backgroundPosition = (-col * CELL_PX) + 'px ' + (-row * CELL_PX) + 'px';
  }

  function tick() {
    rafId = global.requestAnimationFrame ? global.requestAnimationFrame(tick) : setTimeout(tick, 50);
    var t = nowMs();
    var dt = lastT ? Math.min(250, t - lastT) : 0;
    lastT = t;
    if (flightArt && flightEl) {
      var frame = Math.floor((t - flightArt.start) / 110) % 4;
      if (frame !== flightArt.frame) {
        flightArt.frame = frame;
        if (flightHold) flightHold.style.left = (3 - frame * 250) + 'px';
        var r = el.getBoundingClientRect();
        var dx = flightArt.target.x - (r.left + r.width / 2);
        var dy = flightArt.target.y - (r.top + r.height / 2);
        var facing = dx >= 0 ? 1 : -1;
        var pitch = Math.max(-18, Math.min(18, dy * 0.08));
        flightEl.style.transform = 'scaleX(' + facing + ') rotate(' + (pitch * facing).toFixed(1) + 'deg)';
      }
    }
    if (held) paint(held.name, held.frame);
    if (!active) return;
    active.acc += dt;
    var step = 1000 / F.fps;
    var guard = 0;
    while (active && active.acc >= step && guard++ < 8) {
      active.acc -= step;
      advance();
    }
  }

  function startTicker() {
    if (rafId != null) return;
    lastT = 0;
    rafId = global.requestAnimationFrame ? global.requestAnimationFrame(tick) : setTimeout(tick, 50);
  }

  /** Frame order for one pass: forward, or forward-then-back for pingpong. */
  function order(c) {
    var out = [], i;
    for (i = 0; i < c.frames; i++) out.push(i);
    if (c.pingpong) for (i = c.frames - 2; i > 0; i--) out.push(i);
    return out;
  }

  var BLENDED = {
    celebrate_start: [1,  2,  3,  4],
    celebrate_stop: [2,  3,  4,  5,  6,  7],
    confused_start: [1,  2,  3,  4,  5],
    confused_stop: [1,  2,  3,  4],
    curious_start: [1,  2,  3,  4,  5,  6],
    curious_stop: [1,  2,  3,  4,  5,  6,  7],
    driving: [45,  46,  47],
    excited: [5,  6,  7,  8,  9,  10,  11,  12,  25,  26,  27,  28,  29,  30,  31,  41,  42,  43,  44,  45,  46,  63,  64,  65,  66,  67],
    focussed_start: [1,  2,  3,  4,  5],
    focussed_stop: [1,  2,  3,  4,  5],
    learning_start: [1,  2,  3,  4,  5,  6,  7,  8,  9],
    learning_stop: [0,  1,  2,  3,  4,  5,  6,  7,  8],
    playful_start: [1,  2,  3,  4,  5,  6],
    playful_stop: [1,  2,  3,  4,  5,  6,  7,  8],
    proud_start: [1,  2,  3,  4,  5],
    proud_stop: [1,  2,  3,  4,  5],
    reading_start: [1,  2,  3,  4,  5,  6],
    reading_stop: [1,  2,  3,  4,  5,  6],
    relieved_start: [1,  2,  3,  4,  5,  6],
    relieved_stop: [1,  2,  3,  4,  5,  6],
    thinking_start: [7,  8],
    thinking_stop: [1,  2],
    wave_start: [1,  2,  3,  4,  5],
    wave_stop: [1,  2,  3,  4,  5],
    write_start: [1,  2,  3,  4,  5],
    write_stop: [1,  2,  3,  4]
  };
  function solidOrder(name, list) {
    var b = BLENDED[name], c = F.clips[name], n = c && c.frames;
    if (!b || !n) return list;
    return list.map(function (f) {
      if (b.indexOf(f) < 0) return f;
      var lo = f, hi = f;
      while (b.indexOf(lo - 1) >= 0) lo--;
      while (b.indexOf(hi + 1) >= 0) hi++;
      var before = lo - 1, after = hi + 1;
      if (before < 0) return after < n ? after : f;
      if (after >= n) return before;
      return (f - lo) < (hi - lo + 1) / 2 ? before : after;
    });
  }

  function advance() {
    var a = active;
    a.i++;
    if (a.i >= a.order.length) {
      a.passes++;
      if (a.repeats !== Infinity && a.passes >= a.repeats) { settle(); return; }
      a.i = 0;
    }
    paint(a.name, a.order[a.i]);
  }

  function settle() {
    var a = active; active = null;
    if (a && a.resolve) a.resolve({ done: true });
  }

  function clip(name, repeats, frames) {
    var c = F.clips[name];
    if (!c) {
      if (global.console) console.warn('Swiftee: no clip "' + name + '"');
      return Promise.resolve({ missing: true });
    }
    if (active && active.resolve) active.resolve({ interrupted: true });
    active = null;
    preload([name]);   // every page of it, not only the first

    return awaitSheet(name).then(function () {
      return new Promise(function (resolve) {
        var a = {
          name: name, order: solidOrder(name, frames || order(c)), i: 0, passes: 0,
          repeats: repeats == null ? 1 : repeats, acc: 0, resolve: resolve
        };
        active = a;
        paint(name, a.order[0]);
        if (reduced) { if (a.repeats !== Infinity) settle(); return; }
        startTicker();
      });
    });
  }

  function stopActive() {
    if (active && active.resolve) active.resolve({ interrupted: true });
    active = null;
  }

  function triad(rig) {
    var s = F.states[rig];
    if (s) return { start: s.start, loop: s.loop, stop: s.stop };
    return { start: null, loop: rig, stop: null };     // a standalone clip
  }

  function fresh() { return ++gen; }
  function stale(g) { return g !== gen; }

  function closeCurrent(g, cut) {
    var owed = rigLoop; rigLoop = null;
    if (!owed) return Promise.resolve();
    if (cut) return Promise.resolve();
    var t = triad(owed);
    if (!t.stop) return Promise.resolve();             // sleeping/driving leave by their own clip
    return clip(t.stop, 1).then(function () { return stale(g) ? 'stale' : null; });
  }

  function briefOrder(loopName, n) {
    var c = F.clips[loopName];
    if (!c) return null;
    n = Math.max(1, Math.min(n, c.frames - 1));
    var out = [], i;
    for (i = 0; i <= n; i++) out.push(i);
    for (i = n - 1; i >= 0; i--) out.push(i);
    return out;
  }

  function runState(name, g) {
    var def = STATES[name] || STATES.idle;
    var t = triad(def.rig);
    var repeats = def.hold ? Infinity : (def.loops == null ? 1 : def.loops);

    return closeCurrent(g, def.cut).then(function () {
      if (stale(g)) return { cancelled: true };
      return t.start ? clip(t.start, 1) : null;
    }).then(function () {
      if (stale(g)) return { cancelled: true };
      rigLoop = def.rig;
      var loop = (def.brief && !def.hold) ? clip(t.loop, 1, briefOrder(t.loop, def.brief)) : clip(t.loop, repeats);
      if (def.hold) return { holding: true };          // do not await an endless loop
      return loop.then(function (r) {
        if (stale(g) || (r && r.interrupted)) return { cancelled: true };
        rigLoop = null;
        return t.stop ? clip(t.stop, 1) : null;
      });
    });
  }

  function restingState() {
    if (speaking) return mood || 'explain';            // narrating -> the mood, else the talking loop
    if (airborne) return 'hover';
    if (stance && STATES[stance]) return stance;
    if (pos === 'peek') return 'peek';
    if (idleLevel === 2) return 'sleep';
    if (idleLevel === 1) return 'daydream';
    return 'idle';
  }

  var arrived = false;

  function slideIn(o, g) {
    var from = (o && o.from === 'right') ? 1 : -1;
    place(pos, size);
    el.style.opacity = '1';
    stateName = 'enter';
    if (reduced || !el.animate) return rest();
    var a;
    if (o && o.from === 'below') {
      var rise = (o.rise || 200);
      el.style.transformOrigin = '50% 88%';
      a = anim([
        { translate: '0 ' + rise + 'px', scale: '0.9 1.1', offset: 0 },
        { translate: '0 -18px', scale: '0.96 1.06', offset: o.quick ? 0.5 : 0.46, easing: 'cubic-bezier(.2,.8,.35,1)' },
        { translate: '0 5px', scale: '1.06 0.93', offset: o.quick ? 0.7 : 0.66, easing: 'cubic-bezier(.4,0,.6,1)' },
        { translate: '0 -3px', scale: '0.98 1.02', offset: 0.84, easing: 'ease-in-out' },
        { translate: '0 0', scale: '1 1', offset: 1 }
      ], { duration: o.ms || (o.quick ? 520 : 640), easing: 'linear' });   // o.ms: the summary's third-of-a-second rise
      clip('curious', 1);
    } else {
      a = anim([
        { translate: (from * 380) + 'px 0', opacity: 0, offset: 0 },
        { translate: (from * 300) + 'px -54px', opacity: 1, offset: 0.22, easing: 'cubic-bezier(.3,.6,.5,1)' },
        { translate: (from * 190) + 'px 0', offset: 0.44, easing: 'cubic-bezier(.5,0,.7,.4)' },
        { translate: (from * 90) + 'px -42px', offset: 0.66, easing: 'cubic-bezier(.3,.6,.5,1)' },
        { translate: '0 0', offset: 0.9, easing: 'cubic-bezier(.5,0,.7,.4)' },
        { translate: '0 -6px', offset: 0.95 },
        { translate: '0 0', offset: 1 }
      ], { duration: 820, easing: 'linear' });
      clip('flapping', Infinity);
    }
    return a.finished.then(function () { return stale(g) ? null : rest(); },
                           function () { return stale(g) ? null : rest(); });
  }

  function flyTour(o, g) {
    try { return flyAround(o, g); } catch (e) { return slideIn({ from: 'left' }, g); }
  }
  function flyAround(o, g) {
    place(pos, size);
    stateName = o.state || 'enter';
    var stops = (o.tour || []).filter(function (p) { return p && isFinite(p.x) && isFinite(p.y); });
    if (reduced || !el.animate || !stops.length) { el.style.opacity = '1'; return rest(); }
    cancelAll();
    var b = api.bounds();
    var home = { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };
    var r0 = el.getBoundingClientRect();
    el.style.transformOrigin = '50% ' + (F.baselineY * 100).toFixed(1) + '%';
    var foot = { x: r0.left + r0.width / 2, y: r0.top + r0.height * F.baselineY };
    var v = { x: home.x - foot.x, y: home.y - foot.y };
    var baseScale = parseFloat((el.style.transform.match(/scale\(([^)]+)\)/) || [])[1]) || 1;
    var frame = function (p, extra) {
      var s = p.scale || 1, a = (p.tilt || 0) * Math.PI / 180;
      var rv = { x: (v.x * Math.cos(a) - v.y * Math.sin(a)) * s, y: (v.x * Math.sin(a) + v.y * Math.cos(a)) * s };
      var tx = (p.x - home.x) + (v.x - rv.x), ty = (p.y - home.y) + (v.y - rv.y);
      return Object.assign({ transform: 'translate(-50%,-' + (F.baselineY * 100).toFixed(1) + '%) translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) rotate(' + (p.tilt || 0) + 'deg) scale(' + (baseScale * s).toFixed(4) + ')' }, extra || {});
    };
    var start = (o.start && isFinite(o.start.x)) ? o.start : { x: -Math.max(160, b.width), y: Math.max(40, b.height * 0.5), scale: 0.6, tilt: 10 };
    var land = { x: home.x, y: home.y, scale: 1, tilt: 0 };
    // (down onto his mark from the side he is flying in from)
    var approach = { x: home.x + (start.x > home.x ? 10 : -10), y: home.y - 34, scale: 0.97, tilt: 0 };
    var P = [start].concat(stops).concat([approach, land]);
    var cr = function (p0, p1, p2, p3, u) {
      var u2 = u * u, u3 = u2 * u;
      var f = function (k) { return 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3); };
      return { x: f('x'), y: f('y') };
    };
    // the curve, densely, with its length so far at every point
    var path = [], knotAt = [0], lenSoFar = 0, STEPS = 40;
    for (var i = 0; i < P.length - 1; i++) {
      var p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      for (var k = (i ? 1 : 0); k <= STEPS; k++) {
        var u = k / STEPS, q = cr(p0, p1, p2, p3, u);
        if (path.length) { var pr = path[path.length - 1]; lenSoFar += Math.hypot(q.x - pr.x, q.y - pr.y); }
        path.push({ x: q.x, y: q.y, s: lenSoFar, seg: i, u: u });
      }
      knotAt.push(lenSoFar);
    }
    var pathLen = lenSoFar || 1;
    var smooth = function (x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    var speed = function (sAt) {
      var v = 1;
      for (var j = 1; j <= stops.length; j++) {
        var hold = stops[j - 1].hold || 0;
        if (!hold) continue;                                        // a point he only passes by
        var w = 34 + hold * 0.06, dip = Math.min(0.85, 0.5 + hold / 900);
        var d = (sAt - knotAt[j]) / w;
        v -= dip * Math.exp(-d * d);
      }
      v = Math.max(0.12, v);
      v *= o.fromRest ? Math.max(0.15, smooth(sAt / 110)) : 0.55 + 0.45 * smooth(sAt / 120);
      v *= Math.max(0.05, smooth((pathLen - sAt) / 150));             // and down to nothing at his mark
      return v;
    };
    // time as the distance divided by that speed, all the way along
    var tAt = [0];
    var paceAt = function (q) {
      var p0 = P[q.seg].pace || 1, p1 = P[q.seg + 1].pace || 1;
      return p0 + (p1 - p0) * smooth(q.u);
    };
    for (var m = 1; m < path.length; m++) {
      var ds = path[m].s - path[m - 1].s, vm = speed((path[m].s + path[m - 1].s) / 2) * paceAt(path[m]);
      tAt.push(tAt[m - 1] + ds / vm);
    }
    var cruise = 0.42 * (global.innerWidth || 1200) / 1000;          // px per ms
    var natural = tAt[tAt.length - 1] / cruise;
    var want = o.ms || Math.max(3600, Math.min(5200, natural));
    var scaleT = want / (tAt[tAt.length - 1] || 1);
    var dur = Math.round(tAt[tAt.length - 1] * scaleT);
    // what he is like at a place on the curve: its size and its look
    var knotVal = function (key, seg, u) {
      var a0 = P[seg][key] == null ? 1 : P[seg][key], a1 = P[seg + 1][key] == null ? 1 : P[seg + 1][key];
      return a0 + (a1 - a0) * smooth(u);
    };
    var FRAMES = Math.max(40, Math.round(dur / 40)), keys = [], idx = 0, prevX = null, bank = 0;
    for (var fN = 0; fN <= FRAMES; fN++) {
      var tt = (fN / FRAMES) * tAt[tAt.length - 1];
      while (idx < tAt.length - 2 && tAt[idx + 1] < tt) idx++;
      var span = (tAt[idx + 1] - tAt[idx]) || 1, w0 = Math.max(0, Math.min(1, (tt - tAt[idx]) / span));
      var A = path[idx], B = path[Math.min(path.length - 1, idx + 1)];
      var x = A.x + (B.x - A.x) * w0, y = A.y + (B.y - A.y) * w0;
      var seg = B.seg, uu = B.u;
      var sc = knotVal('scale', seg, uu), look = knotVal('tilt', seg, uu);
      var halfH = b.height * sc / 2, halfW = b.width * sc / 2;
      y = Math.max(halfH + 6, Math.min((global.innerHeight || 800) - halfH - 8, y));
      x = Math.min((global.innerWidth || 1200) - halfW - 8, x);
      // banking: into the way he is moving, softened frame to frame
      var vx = prevX == null ? 0 : (x - prevX) / ((dur / FRAMES) || 1);
      prevX = x;
      bank += (Math.max(-14, Math.min(14, vx * 20)) - bank) * 0.3;
      var landing = smooth((dur * fN / FRAMES - (dur - 420)) / 420);
      var bob = Math.sin((fN / FRAMES) * dur / 340 * 2 * Math.PI) * 6 * (1 - landing);
      var tilt = (bank * 0.8 + look * 0.6) * (1 - landing);
      keys.push(frame({ x: x, y: y + bob, scale: sc, tilt: +tilt.toFixed(2) }, { offset: +(fN / FRAMES).toFixed(4) }));
    }
    if (!o.fromRest) { keys[0].opacity = 0; keys[1].opacity = 1; }
    // a flight that cannot be computed is not played as a bird standing still
    if (!isFinite(dur) || keys.some(function (k) { return /NaN/.test(k.transform); })) throw new Error('flight');
    keys[keys.length - 1] = frame(land, { offset: 1 });
    el.style.opacity = '1';
    airborne = true;
    if (shadowEl) shadowEl.style.opacity = '0';
    clip('flapping', Infinity);
    startFlightArt(o.look || { x: stops[0].x, y: stops[0].y });
    setTimeout(function () {
      if (stale(g) || !flightArt || !cellEl || !flightEl) return;
      cellEl.style.transition = ''; flightEl.style.transition = '';
      cellEl.style.visibility = 'visible'; cellEl.style.opacity = '1';
      flightEl.style.opacity = '0';
    }, Math.max(0, dur - 160));
    // the shadow comes back under him as his feet arrive, not after
    setTimeout(function () {
      if (!shadowEl || stale(g)) return;
      shadowEl.style.opacity = '';
      try { shadowEl.animate([{ opacity: 0, transform: 'translate(-50%,-35%) scale(.5)' }, { opacity: 1, transform: 'translate(-50%,-35%) scale(1)' }], { duration: 380, easing: 'ease-out' }); } catch (e) {}
    }, Math.max(0, dur - 380));
    var total = dur;
    var a = anim(keys, { duration: total, easing: 'linear', composite: 'replace' });
    // (the shadow has already come back under his feet, above)
    var touchDown = function () {
      airborne = false; if (shadowEl) shadowEl.style.opacity = ''; stopFlightArt();
      if (typeof o.onLand === 'function') { try { o.onLand(); } catch (e) {} }
    };
    return a.finished.then(function () {
      touchDown();
      if (stale(g)) return null;
      return bounce('land').then(function () { return stale(g) ? null : rest(); });
    }, function () { touchDown(); return stale(g) ? null : rest(); });
  }

  function rest() {
    if (lockedBy()) { restOwed = true; return Promise.resolve({ locked: true }); }
    // Whatever he stepped aside for is over.
    if (shiftAnim) { try { shiftAnim.cancel(); } catch (e) {} shiftAnim = null; }
    if (STATES[stateName] && STATES[stateName].mood) moodAt = Date.now();
    var want = restingState();
    if (want === stateName && rigLoop === STATES[want].rig) return Promise.resolve({ resting: true });
    var g = fresh();
    stateName = want;
    return runState(stateName, g);
  }

  function armIdle() {
    clearTimeout(idleTimer);
    if (reduced) return;
    idleTimer = setTimeout(function () {
      idleLevel = 1;
      if (isResting()) rest();
      idleTimer = setTimeout(function () {
        idleLevel = 2;
        if (isResting()) rest();
      }, IDLE_SLEEP_MS - IDLE_DAYDREAM_MS);
    }, IDLE_DAYDREAM_MS);
  }

  function isResting() {
    return stateName === 'idle' || stateName === 'daydream' || stateName === 'sleep' || stateName === 'explain'
        || stateName === 'glad' || stateName === 'amazed'
        || (stance != null && stateName === stance);
  }

  function stir() {
    idleLevel = 0;
    armIdle();
    return Promise.resolve();
  }

  var clipY = null;
  var airborne = false;
  var clipOwed = false;
  function applyClip() {
    if (!el) return;
    if (clipY == null) { el.style.clipPath = ''; clipOwed = false; return; }
    if (moving()) { clipOwed = true; return; }
    clipOwed = false;
    var r = el.getBoundingClientRect();
    if (!r.height) return;
    var frac = Math.max(0, Math.min(1, (clipY - r.top) / r.height));
    el.style.clipPath = 'inset(0 0 ' + ((1 - frac) * 100).toFixed(2) + '% 0)';
  }

  function place(p, s) {
    if (!layout || !el) return;
    var L = layout(p, s);
    el.style.left = L.x + 'px';
    el.style.top = L.y + 'px';
    el.style.transform = 'translate(-50%,-' + (F.baselineY * 100).toFixed(1) + '%) scale(' + L.scale + ')';
    chooseScale(L.scale / (L.cam || 1));   // the sheet for his usual size, not the camera's (game.js applyCam)
    clipY = L.clip == null ? null : L.clip;
    applyClip();
    airborne = !!L.air;
    if (el.classList) el.classList.toggle('air', airborne);
    if (shadowEl) shadowEl.style.opacity = airborne ? '0' : '';
  }

  function chooseScale(k) {
    var dpr = global.devicePixelRatio || 1;
    var want = (CELL_PX * k * dpr) > (F.cell['1x'] * 1.6) ? '2x' : '1x';
    if (want === scale) return;
    scale = want;
    painted = null;
    Object.keys(sheets).forEach(function (k) { if (!sheets[k].ok || !cctx) delete sheets[k]; });
    if (active) paint(active.name, active.order[active.i]);
  }

  /** Shrink and soften the contact shadow while he is off the ground. */
  function liftShadow(ms) {
    if (!shadowEl || !shadowEl.animate || reduced) return;
    try {
      shadowEl.animate([
        { transform: 'translate(-50%,-35%) scale(1)', opacity: 1 },
        { transform: 'translate(-50%,-35%) scale(.62)', opacity: .45, offset: .5 },
        { transform: 'translate(-50%,-35%) scale(1)', opacity: 1 }
      ], { duration: ms, easing: 'ease-in-out' });
    } catch (e) {}
  }

  function pinClip(keyframes) {
    if (clipY == null || !keyframes || !keyframes.some(function (f) { return f && f.translate != null; })) return null;
    var r = el.getBoundingClientRect();
    if (!r.height) return null;
    return keyframes.map(function (f) {
      var y = (f && f.translate != null) ? (parseFloat(String(f.translate).trim().split(/\s+/)[1] || '0') || 0) : 0;
      var frac = Math.min(1, (clipY - r.top - y) / r.height);
      var k = { clipPath: 'inset(0 0 ' + ((1 - frac) * 100).toFixed(2) + '% 0)' };
      if (f && f.offset != null) k.offset = f.offset;
      if (f && f.easing) k.easing = f.easing;
      return k;
    });
  }

  function moving() {
    return live.some(function (a) {
      try {
        var t = a.effect && a.effect.getTiming ? a.effect.getTiming() : null;
        return a.playState === 'running' && !!t && t.iterations !== Infinity;
      } catch (e) { return false; }
    });
  }

  function anim(keyframes, opts) {
    if (!el || !el.animate || reduced) return { finished: Promise.resolve(), cancel: function () {} };
    var a, c = null;
    var clipFrames = pinClip(keyframes);
    try {
      a = el.animate(keyframes, Object.assign({ composite: 'add', fill: 'none' }, opts));
      if (clipFrames) c = el.animate(clipFrames, Object.assign({}, opts, { composite: 'replace', fill: 'none' }));
    } catch (e) { return { finished: Promise.resolve(), cancel: function () {} }; }
    live.push(a);
    if (c) live.push(c);
    a.finished.then(drop, drop);
    function drop() {
      var i = live.indexOf(a); if (i >= 0) live.splice(i, 1);
      if (c) { try { c.cancel(); } catch (e) {} var j = live.indexOf(c); if (j >= 0) live.splice(j, 1); }
      if (clipOwed && !moving()) applyClip();
    }
    return a;
  }

  function cancelAll() {
    live.slice().forEach(function (a) { try { a.cancel(); } catch (e) {} });
    live.length = 0;
    if (clipOwed) applyClip();
    shiftAnim = null;
    stopFlightArt();
  }

  function startFlightArt(target) {
    if (!flightEl || !cellEl || reduced || !flightReady) return;
    flightArt = { target: target, start: nowMs(), frame: -1 };
    cellEl.style.transition = '';
    cellEl.style.opacity = '0';
    flightEl.style.display = 'block';
    flightEl.style.opacity = '1';
  }

  function stopFlightArt() {
    flightArt = null;
    if (flightEl) { flightEl.style.display = 'none'; flightEl.style.transition = ''; flightEl.style.opacity = '1'; }
    if (cellEl) { cellEl.style.visibility = 'visible'; cellEl.style.transition = ''; cellEl.style.opacity = '1'; }
  }

  function centre(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  function lean(target, ms) {
    if (!el || !target || reduced) return null;
    var p = target.getBoundingClientRect ? centre(target.getBoundingClientRect()) : target;
    if (!p || p.x == null) return null;
    var me = centre(el.getBoundingClientRect());
    var dir = p.x >= me.x ? 1 : -1;
    var far = Math.min(1, Math.abs(p.x - me.x) / 500);
    return anim([
      { transform: 'translateX(0) rotate(0deg)' },
      { transform: 'translateX(' + (dir * 10 * far).toFixed(1) + 'px) rotate(' + (dir * 4 * far).toFixed(1) + 'deg)', offset: 0.4 },
      { transform: 'translateX(' + (dir * 8 * far).toFixed(1) + 'px) rotate(' + (dir * 3 * far).toFixed(1) + 'deg)', offset: 0.8 },
      { transform: 'translateX(0) rotate(0deg)' }
    ], { duration: ms || 1400, easing: 'ease-in-out' });
  }

  function leanEach(targets, g) {
    var list = (targets || []).filter(Boolean);
    if (!list.length) return;
    var first = lean(list[0], 1100);
    if (list.length < 2 || !first || !first.finished) return;
    first.finished.then(function () { if (!stale(g)) lean(list[1], 1100); }, function () {});
  }

  var BODY = {
    cheer: { ms: 420, easing: 'cubic-bezier(.3,1.4,.5,1)', frames: [
      { transform: 'translate(0,0) scale(1,1)' },
      { transform: 'translate(0,-3px) scale(.98,1.03)', offset: 0.22 },
      { transform: 'translate(0,-14px) scale(1,1)', offset: 0.52 },
      { transform: 'translate(0,0) scale(1.04,.97)', offset: 0.82 },
      { transform: 'translate(0,0) scale(1,1)' }
    ] },
    notice: { ms: 210, easing: 'cubic-bezier(.3,1.2,.5,1)', frames: [
      { transform: 'translate(0,0) scale(1,1)' },
      { transform: 'translate(0,-8px) scale(.98,1.03)', offset: 0.45 },
      { transform: 'translate(0,0) scale(1,1)' }
    ] },
    // the weight arriving — what a landing owes the ground
    land: { ms: 300, easing: 'cubic-bezier(.2,.9,.3,1)', frames: [
      { transform: 'scale(1,1)' },
      { transform: 'scale(1.16,.84)', offset: 0.3 },
      { transform: 'scale(.96,1.05)', offset: 0.65 },
      { transform: 'scale(1,1)' }
    ] }
  };
  function bounce(kind) {
    var b = BODY[kind];
    if (!b || !el) return Promise.resolve();
    return anim(b.frames, { duration: b.ms, easing: b.easing }).finished || Promise.resolve();
  }

  var MOVES = {

    enter: function (o) {
      var g = fresh(); stateName = 'enter'; rigLoop = null;
      var container = (el && el.parentNode) || null;

      // in by air, looking the shape over on the way (flyTour)
      if (o && o.from === 'air') { arrived = true; return flyTour(o, g); }
      if (arrived) return slideIn(o, g);
      arrived = true;

      if (!global.SleighIntro || !container || !global.SleighFrames) {
        el.style.opacity = '1';
        return rest();
      }

      el.style.opacity = '0';
      var box = api.bounds();
      var cr = container.getBoundingClientRect();
      var mark = box ? {
        markX: (box.left + box.right) / 2 - cr.left,
        markY: box.bottom - cr.top,
        birdHeight: box.height
      } : {};

      if (global.SFX) {
        SFX.play('sleighBells', { n: 7, spread: 0.055, gain: 0.05 });
        var t = 0, stepMs = 0.16;
        for (var i = 0; i < 12; i++) {
          SFX.play('hoofbeat', { delay: t, gain: 0.085 - i * 0.004 });
          t += stepMs; stepMs *= 1.05;
        }
        var B = SleighIntro.timeline();
        var cue = function (at, fn) { setTimeout(function () { if (!stale(g) && global.SFX) fn(); }, at); };
        cue(B.brake + 60, function () { SFX.play('slice', { gain: 0.05 }); });
        cue(B.land + 40, function () { SFX.play('zip', { gain: 0.06 }); });
        cue(B.exit + 60, function () {
          SFX.play('sleighBells', { n: 4, spread: 0.09, gain: 0.03 });
          for (var k = 0; k < 5; k++) SFX.play('hoofbeat', { delay: k * 0.2, gain: 0.05 - k * 0.008 });
        });
      }

      return SleighIntro.play(container, mark).then(function () {
        el.style.opacity = '1';
        if (stale(g)) return;
        return rest();
      }, function () {
        el.style.opacity = '1';
        if (stale(g)) return;
        return rest();
      });
    },

    exit: function (o) {
      var to = (o && o.to === 'right') ? 1 : -1;
      var g = fresh(); stateName = 'exit'; rigLoop = null;
      var a;
      if (o && o.to === 'below') {
        clip('happy', 1);
        el.style.transformOrigin = '50% 88%';
        a = anim([
          { translate: '0 0', scale: '1 1', offset: 0 },
          { translate: '0 3px', scale: '1.05 0.95', offset: 0.18, easing: 'ease-out' },
          { translate: '0 -10px', scale: '0.96 1.05', offset: 0.4, easing: 'cubic-bezier(.3,.6,.4,1)' },
          { translate: '0 ' + (o.rise || 200) + 'px', scale: '0.94 1.06', offset: 1, easing: 'cubic-bezier(.55,0,.85,.4)' }
        ], { duration: o.ms || 280 });   // o.ms: the swipe card's unhurried sink
      } else {
        // and two hops off, the same way, fading as he goes
        clip('flapping', Infinity);
        a = anim([
          { transform: 'translateX(0) translateY(0)', opacity: 1, offset: 0 },
          { transform: 'translateX(' + (to * 110) + 'px) translateY(-50px)', opacity: 1, offset: 0.3, easing: 'cubic-bezier(.3,.6,.5,1)' },
          { transform: 'translateX(' + (to * 220) + 'px) translateY(0)', opacity: 1, offset: 0.55, easing: 'cubic-bezier(.5,0,.7,.4)' },
          { transform: 'translateX(' + (to * 330) + 'px) translateY(-46px)', opacity: 0.6, offset: 0.8, easing: 'cubic-bezier(.3,.6,.5,1)' },
          { transform: 'translateX(' + (to * 440) + 'px) translateY(0)', opacity: 0, offset: 1 }
        ], { duration: 760, easing: 'linear' });
      }
      return a.finished.then(function () {
        el.style.opacity = '0';
        stopActive();
        void g;
      });
    },

    perch: function (o) {
      o = o || {};
      var b0 = el && api.bounds();
      if (!layout || !b0 || reduced || !el.animate) return MOVES.move(Object.assign({}, o, { to: 'log' }));
      var from = { x: (b0.left + b0.right) / 2, y: (b0.top + b0.bottom) / 2 };
      var g = fresh();
      pos = 'log'; size = o.size || size;
      place(pos, size);
      var b1 = api.bounds();
      var to = { x: (b1.left + b1.right) / 2, y: (b1.top + b1.bottom) / 2 };
      var bow = Math.max(40, +o.bow || 110);
      var dir = to.x < from.x ? -1 : 1;
      try {
        return flyAround({ start: { x: from.x, y: from.y, scale: 1, tilt: 0 },
                           tour: [{ x: from.x + (to.x - from.x) * 0.5, y: Math.min(from.y, to.y) - bow, hold: 0 }],
                           ms: o.ms || 1300, fromRest: true, state: 'perch', onLand: o.onLand,
                           // he faces the way he is going, the whole way
                           look: { x: to.x + dir * 480, y: to.y } }, g);
      } catch (e) { place(pos, size); return rest(); }
    },

    move: function (o) {
      if (!layout) return Promise.resolve();
      var fromP = layout(pos, size);
      var toPos = o.to || pos, toSize = o.size || size;
      var toP = layout(toPos, toSize);
      pos = toPos; size = toSize;
      el.style.opacity = toPos === 'off' ? '0' : '1';

      var g = fresh(); stateName = 'move'; rigLoop = null;
      var arc = Math.max(0, +o.arc || 0), ms = Math.max(200, +o.ms || 680);
      clip('flapping', Infinity);
      liftShadow(arc ? ms : 680);
      place(pos, size);
      var landingClip = clipY; clipY = null; applyClip();

      var S = toP.scale || 1;
      var dx = (toP.x - fromP.x) / S, dy = (toP.y - fromP.y) / S, ds = fromP.scale / toP.scale;
      var bow = arc / S;
      var keys;
      if (arc) {
        keys = [];
        for (var k = 0; k <= 20; k++) {
          var t = k / 20, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          var px = -dx * (1 - e), py = -dy * (1 - e) - bow * 4 * e * (1 - e), sc = ds + (1 - ds) * e;
          keys.push({ transform: 'translate(' + px.toFixed(2) + 'px,' + py.toFixed(2) + 'px) scale(' + sc.toFixed(4) + ')', offset: t });
        }
      } else {
        keys = [
          { transform: 'translate(' + (-dx) + 'px,' + (-dy) + 'px) scale(' + ds + ')' },
          { transform: 'translate(0,0) scale(1)' }
        ];
      }
      var a = anim(keys, { duration: arc ? ms : 680, easing: arc ? 'linear' : 'cubic-bezier(.22,1,.36,1)' });
      var land = function () { clipY = landingClip; applyClip(); };
      return a.finished.then(function () {
        land();
        if (stale(g)) return;
        if (typeof o.onLand === 'function') { try { o.onLand(); } catch (e) {} }
        if (arc) return bounce('land').then(function () { return stale(g) ? null : rest(); });
        return rest();
      }, land);
    }
  };

  function play(state, opts, ctx) {
    if (!el) return Promise.resolve();
    opts = opts || {};

    var lock = lockedBy();
    if (lock && !MOVES[state]) {
      deferred = { state: state, opts: opts };
      return Promise.resolve({ deferred: lock });
    }

    if (state !== 'enter' && global.SleighIntro) SleighIntro.cancel();

    if (state !== 'enter' && state !== 'exit' && el.style.opacity !== '1') {
      el.style.opacity = '1';
    }
    if (ctx && ctx.onCancel) ctx.onCancel(function () { cancelAll(); });

    if (MOVES[state]) { stir(); busy = null; return MOVES[state](opts); }

    if (!STATES[state]) {
      if (global.console) console.warn('Swiftee: no state "' + state + '"');
      return Promise.resolve();
    }
    // the one face for this feeling, on this screen, in this air
    state = resolve(state, opts);
    var def = STATES[state];
    if (def.mood) { mood = def.mood; moodAt = Date.now(); }
    else if (!def.hold || state === 'explain') mood = null;

    if (def.lean && opts.at && !Array.isArray(opts.at)) lean(opts.at);
    if (def.shift) {
      if (shiftAnim) { try { shiftAnim.cancel(); } catch (e) {} }
      shiftAnim = anim([{ transform: 'translateX(0)' }, { transform: 'translateX(' + def.shift + 'px)' }],
                       { duration: 520, easing: 'ease-out', fill: 'forwards' });
    }

    if (def.hold && state === stateName && !opts.restart && !busy && rigLoop === def.rig &&
        active && active.repeats === Infinity && active.name === triad(def.rig).loop) {
      return Promise.resolve({ holding: true, same: true });
    }

    var g = fresh();
    stateName = state;
    // A one-shot is something he is in the middle of; a held pose is not.
    busy = def.hold ? null : { tier: def.tier || 'present', g: g, state: state };
    if (def.lean && Array.isArray(opts.at)) leanEach(opts.at, g);
    if (def.body) bounce(def.body);
    var seq = stir().then(function () {
      if (stale(g)) return { cancelled: true };
      return runState(state, g);
    });

    if (!def.hold) {
      seq = seq.then(function (r) {
        if (stale(g) || (r && r.cancelled)) return r;
        busy = null;
        if (def.then && STATES[def.then]) return play(def.then, { key: opts.key });
        return rest().then(function () { return r; });
      });
    }
    return seq;
  }

  var TIER = { idle: 0, hint: 1, present: 2, feedback: 3, act: 4 };
  var busy = null;          // { tier, g, state } while a one-shot plays
  var stance = null;        // what he rests in while the child works
  var locks = {};           // name -> true: a dedicated sequence owns him
  var deferred = null;      // the latest request made while locked
  var restOwed = false;

  function lockedBy() { for (var k in locks) if (locks[k]) return k; return null; }

  function hashOf(key) {
    var s = String(key == null ? '' : key), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  function resolve(state, opts) {
    var def = STATES[state];
    if (!def) return state;
    if (def.recovered && opts && opts.after === 'miss' && STATES[def.recovered]) state = def.recovered;
    else if (def.again && opts && opts.misses > 1 && STATES[def.again]) state = def.again;
    else if (def.variants && def.variants.length) state = def.variants[hashOf(opts && opts.key) % def.variants.length];
    def = STATES[state];
    if (def && def.seated && (airborne || pos === 'log') && STATES[def.seated]) state = def.seated;
    return state;
  }

  function perform(intent, opts) {
    opts = opts || {};
    if (!el || !STATES[intent]) return Promise.resolve({ refused: 'unknown' });
    if (lockedBy() || /^(enter|exit|move)$/.test(stateName)) return Promise.resolve({ refused: 'locked' });
    var want = TIER[STATES[intent].tier || 'present'] || 0;
    if (busy && !stale(busy.g) && (TIER[busy.tier] || 0) > want) return Promise.resolve({ refused: 'busy' });
    if (STATES[intent].hold && stateName === intent) return Promise.resolve({ already: true });
    return play(intent, opts);
  }

  function setStance(name) {
    var next = (name && STATES[name]) ? name : null;
    if (next === stance) return;
    var was = stance;
    stance = next;
    if (lockedBy()) { restOwed = true; return; }
    if (!busy && (stateName === was || isResting())) rest();
  }

  function attend(on) {
    if (!on) { if (stance === 'watch') setStance(null); return null; }
    stance = 'watch';
    if (!el || lockedBy() || /^(enter|exit|move)$/.test(stateName)) return null;
    if (airborne || speaking || stateName === 'watch') return null;
    return play('watch');
  }

  function lock(name) { locks[name || 'sequence'] = true; }
  function unlock(name) {
    delete locks[name || 'sequence'];
    if (lockedBy()) return null;
    var d = deferred, owed = restOwed;
    deferred = null; restOwed = false;
    if (d) return play(d.state, d.opts);
    if (owed || isResting()) return rest();
    return null;
  }

  function settleScreen(o) {
    o = o || {};
    stance = null; deferred = null;
    if (!el || lockedBy() || /^(enter|exit|move)$/.test(stateName)) { busy = null; return Promise.resolve(); }
    var leftover = !!(busy && !stale(busy.g));
    busy = null;
    if (o.now) {
      cancelAll();
      rigLoop = null;                                   // the owed stop is written off
      fresh();
      stateName = '';                                   // so rest() moves whatever he is in
      return rest();
    }
    if (leftover || stateName === 'watch') return rest();
    return Promise.resolve();
  }

  function mount(container, opts) {
    opts = opts || {};
    if (!F) { if (global.console) console.error('Swiftee: swiftee-frames.js must load first'); return api; }

    reduced = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

    el = document.createElement('div');
    el.className = 'swiftee';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText =
      'position:absolute;left:0;top:0;width:' + CELL_PX + 'px;height:' + CELL_PX + 'px;' +
      'pointer-events:none;will-change:transform;transform-origin:50% ' + (F.baselineY * 100).toFixed(1) + '%;';

    shadowEl = document.createElement('div');
    shadowEl.style.cssText =
      'position:absolute;left:50%;top:' + (F.baselineY * 100).toFixed(1) + '%;' +
      'width:58%;height:9%;transform:translate(-50%,-40%);border-radius:50%;transition:opacity 320ms ease;' +
      'background:radial-gradient(closest-side, rgba(30,60,110,.26), rgba(30,60,110,.10) 55%, rgba(30,60,110,0));';

    cellEl = document.createElement('div');
    cellEl.style.cssText =
      'position:absolute;inset:0;background-repeat:no-repeat;image-rendering:auto;' +
      'filter: drop-shadow(0 3px 5px rgba(24,52,96,.20));';
    // (not under jsdom, which has no 2D context and says so on the console)
    var jsdom = /jsdom/i.test((global.navigator && global.navigator.userAgent) || '');
    if (!jsdom && global.HTMLCanvasElement) {
      canvasEl = document.createElement('canvas');
      canvasEl.width = CANVAS_PX; canvasEl.height = CANVAS_PX;
      canvasEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;visibility:hidden;pointer-events:none;';
      try { cctx = canvasEl.getContext('2d'); } catch (e) { cctx = null; }
      if (cctx) { cctx.imageSmoothingEnabled = true; cctx.imageSmoothingQuality = 'high'; cellEl.appendChild(canvasEl); }
      else canvasEl = null;
    }

    flightEl = document.createElement('div');
    flightEl.style.cssText =
      'position:absolute;inset:0;display:none;pointer-events:none;overflow:hidden;transform-origin:50% 50%;' +
      'filter:drop-shadow(0 7px 11px rgba(24,52,96,.24));';

    el.appendChild(shadowEl);
    el.appendChild(flightEl);
    el.appendChild(cellEl);
    container.appendChild(el);

    if (opts.layout) layout = opts.layout;
    preload(PRELOAD);
    if (global.Image) {
      var flightImage = new Image();
      var flightOk = function () { flightReady = true; };
      flightImage.onload = function () { if (flightImage.decode) flightImage.decode().then(flightOk, flightOk); else flightOk(); };
      flightImage.src = global.Preload && Preload.pick ? Preload.pick(url('swiftee-inspect-flight.webp')) : url('swiftee-inspect-flight.webp');
      flightHold = flightImage;
      flightImage.alt = ''; flightImage.draggable = false;
      flightImage.style.cssText = 'position:absolute;left:3px;top:-38px;width:1000px;height:333px;max-width:none;pointer-events:none;';
      flightEl.appendChild(flightImage);
    }
    if (global.SleighIntro) SleighIntro.preload().catch(function () {});

    // Park on the idle loop immediately so there is never an empty cell.
    rest();
    armIdle();

    return api;
  }

  var api = {
    mount: mount,
    play: play,
    lookAt: lean,

    perform: perform,
    stance: setStance,
    attend: attend,
    lock: lock,
    unlock: unlock,
    settle: settleScreen,
    /** Which concrete state an intention becomes, without playing it. */
    resolve: function (state, opts) { return resolve(state, opts || {}); },
    /** Does this state answer the child (and so wait for the answer to land)? */
    isReaction: function (state) { var d = STATES[state]; return !!(d && d.react); },
    get locked() { return lockedBy(); },
    get busy() { return busy && !stale(busy.g) ? busy.state : null; },
    get stanceName() { return stance; },

    speaking: function (v) {
      var was = speaking;
      speaking = !!v;
      if (speaking && mood && Date.now() - moodAt > MOOD_MS) mood = null;
      if (!speaking) mood = null;
      if (was !== speaking) { stir(); if (isResting()) rest(); }
      return speaking;
    },

    place: function (p, s) {
      pos = p || pos; size = s || size;
      if (!el) return;
      if (!lockedBy()) el.style.opacity = (pos === 'off' || !arrived) ? '0' : '1';
      place(pos, size);
    },

    bounds: function () {
      if (!el) return null;
      var r = el.getBoundingClientRect();
      var L = 84 / 512, R = 437 / 512, T = 58 / 512, B = F.baselineY;
      return {
        left: r.left + r.width * L, right: r.left + r.width * R,
        top: r.top + r.height * T, bottom: r.top + r.height * B,
        width: r.width * (R - L), height: r.height * (B - T)
      };
    },

    /** Show or hide without moving him. Safe before mount(). */
    visible: function (v) { if (el && !lockedBy()) el.style.opacity = v ? '1' : '0'; return !!v; },
    relayout: function () { place(pos, size); },

    /** A beat of body language: 'cheer', 'notice' or 'land'. See BODY. */
    bounce: bounce,

    warm: function (names) { preload(names || REACTIONS); },

    sheetUrls: function () {
      var out = {};
      Object.keys(F.clips).forEach(function (n) { (pagesOf(n) || []).forEach(function (p) { out[url(p.image)] = 1; }); });
      out[url('swiftee-inspect-flight.webp')] = 1;
      return Object.keys(out);
    },

    get el() { return el; },
    get pos() { return pos; },
    /** Has the sleigh been? Read by the suites and probes. */
    get arrived() { return arrived; },
    markArrived: function () { arrived = true; },
    get size() { return size; },
    get state() { return stateName; },
    get scale() { return scale; },
    states: Object.keys(STATES),
    rig: STATES
  };

  global.Swiftee = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);

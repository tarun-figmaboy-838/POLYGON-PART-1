/*!
 * story.js — the Momo and Popo story, before Swiftee and the lesson.
 *
 * Five painted scenes (story-art.js), played from story-data.js, then handed over to the
 * lesson exactly once. game.js owns the moments either side of it — Start, and play(0) —
 * and this owns everything in between:
 *
 *   Story.mount({ root, pace })         once, at boot: builds the layer, starts the art loading
 *   Story.enabled()                     false with ?story=0 (the suites), or with no art
 *   Story.start({ lift, done })         Start was pressed: lift() takes the title away once the
 *                                       first painting is in; done() is called once, at the end
 *   Story.next()                        on to the next scene (each goes on by itself once told; a test may press)
 *   Story.stop()                        called off from outside (the review tool): no done()
 *   Story.active / Story.state          for game.js and the suites
 *
 * ONE STATE, ONE CLOCK, ONE CLEAN-UP. storyScene is 1..5 and storyPhase is entering |
 * playing | dialogue | waiting | exiting. Every timer goes through later(), every animation
 * through animate() and every frame through one rAF loop, and cleanupStoryScene() cancels
 * all of them and stops the voice — so moving on can never leave a line of Scene N still
 * speaking in Scene N+1, a stale timer waking in the wrong scene, or a second copy of a
 * callback running. `gen` is bumped by the clean-up and checked after every wait, so a
 * wait that outlives its scene simply finds it is no longer wanted.
 *
 * NEXT, AND ONLY WHEN IT MEANS SOMETHING. A scene enters, settles, says its lines — each
 * one voiced when its clip exists and paced as it is read when it does not — and only then
 * does the lesson's own Next button appear (canAdvance). A press while it is hidden, a
 * second press, a press during a crossfade: all refused (isTransitioning). Next on the
 * last scene hands over to the lesson.
 *
 * THE WORDS AND THE VOICE START TOGETHER. A line's words are stepped against its clip's
 * own clock (VO.at), by its recorded word times when there are some, spread over the clip
 * when there are not, and at the lesson's read-aloud pace (dialogue-timing.js) when there is
 * no clip at all. The ids are in story-data.js; tools/vo-lines.js lists them for recording.
 *
 * NOTHING HERE TOUCHES THE LESSON. The story is a layer over the stage, under the HUD and
 * Next. It reads Timing, VO and SFX and changes none of them; the music simply runs on
 * under it (Music.start() is Start's), ducked by VO while a line speaks, into the lesson.
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var DATA = global.StoryData, ART = global.StoryArt;
  var W = (ART && ART.w) || 1672, H = (ART && ART.h) || 941;

  /* THE TIMING OF A SCENE, in milliseconds at the pace the lesson is played (pace() below
     scales every wait, so the suites run the story as fast as they run the lesson). */
  var T = {
    firstZoom: 900,    // scene 1 settles from 101% under the lifting title
    fadeIn: 560,       // crossfade: the new scene in, from 101% to 100%
    fadeOut: 520,      // and the old one easing out to 101% under it
    settle: 650,       // a scene is in and still for a moment before anyone speaks
    sayLead: 90,       // the bubble is seen arriving, then its words and voice begin together
    sayOut: 170,       // a bubble leaving
    between: 240,      // and the breath before the next one
    voHold: 480,       // after a voiced line, before the next speaker answers
    lastHold: 700,     // after a scene's last line, before the scene may go on (the brief's 500–800)
    autoNext: 500,     // and the breath after that before it does, by itself (no Next button)
    partLead: 240,     // a line's next part takes the box this long before its first word
    partMin: 420,      // and not until the part before it has been all there this long
    partOut: 130,      // the part leaving
    outro: 700,        // the story fading off the lesson
    artWait: 2500      // the longest a scene waits for its painting before going on anyway
  };

  /* WHAT A REGION OF THE PAINTING DOES WHEN ASKED: anticipation, action, settle, and back
     to exactly where it began — the painting underneath is the rest pose, so every one-shot
     motion must end where it started. Keyframes are [offset, transform]; each runs about
     its region's own `origin` (story-data.js). A few pixels, a few degrees: alive, not busy. */
  var MOTION = {
    hop:     { ms: 680,  f: [[0, 'none'], [0.2, 'scale(1.005, 0.991)'], [0.48, 'scale(0.995, 1.014)'], [0.74, 'scale(1.002, 0.996)'], [1, 'none']] },
    bob:     { ms: 620,  f: [[0, 'none'], [0.26, 'scale(1.003, 0.995)'], [0.56, 'scale(0.997, 1.008)'], [1, 'none']] },
    twostep: { ms: 1150, f: [[0, 'none'], [0.12, 'scale(1.005, 0.992)'], [0.28, 'translateX(1.5px) scale(0.995, 1.012)'], [0.44, 'translateX(2px) scale(1.005, 0.992)'],
                            [0.6, 'translateX(3px) scale(0.995, 1.012)'], [0.8, 'translateX(1.5px)'], [1, 'none']] },
    lift:    { ms: 1100, f: [[0, 'none'], [0.18, 'rotate(0.8deg)'], [0.46, 'rotate(-2.4deg)'], [0.68, 'rotate(-1.8deg)'], [1, 'none']] },
    wave:    { ms: 1000, f: [[0, 'none'], [0.22, 'rotate(-4deg)'], [0.48, 'rotate(2.5deg)'], [0.72, 'rotate(-2deg)'], [1, 'none']] },
    swing:   { ms: 1200, f: [[0, 'none'], [0.25, 'rotate(-1.5deg)'], [0.58, 'rotate(1.5deg)'], [0.82, 'rotate(-0.4deg)'], [1, 'none']] },
    recoil:  { ms: 950,  f: [[0, 'none'], [0.22, 'translateX(-3px) rotate(-0.45deg)'], [0.55, 'translateX(-2px) rotate(-0.4deg)'], [1, 'none']] },
    /* THE COMIC BEATS (the user's brief: "a subtle, child-friendly comical feel … from
       expressions, reaction timing, body language, small animation beats" — never a new line).
       Each is one small thing a body does: an anticipation, the action, a hold to be read, and
       the settle. They are cued from the words (story-data.js `at`, with `after` for the tiny
       pause that makes a reaction a reaction: notice → 250-400 ms → react → carry on). */
    perk:       { ms: 520,  f: [[0, 'none'], [0.3, 'translateY(-1.2px) scale(0.996, 1.012)'], [0.62, 'scale(1.003, 0.995)'], [1, 'none']] },                                // ears up: something was said
    doubletake: { ms: 700,  f: [[0, 'none'], [0.16, 'rotate(-0.9deg)'], [0.34, 'rotate(1deg) scale(1.004, 1.004)'], [0.62, 'rotate(1deg) scale(1.004, 1.004)'], [0.84, 'rotate(-0.2deg)'], [1, 'none']] },   // look, look again, hold
    nod:        { ms: 560,  f: [[0, 'none'], [0.32, 'rotate(1.1deg) translateY(0.8px)'], [0.64, 'rotate(-0.3deg)'], [1, 'none']] },
    proud:      { ms: 950,  f: [[0, 'none'], [0.22, 'translateY(-1.2px) scale(1.008, 1.012)'], [0.72, 'translateY(-1px) scale(1.006, 1.009)'], [1, 'none']] },              // chest out, held a moment
    gulp:       { ms: 760,  f: [[0, 'none'], [0.28, 'translateY(1px) scale(1.004, 0.988)'], [0.7, 'translateY(1px) scale(1.003, 0.99)'], [1, 'none']] },                     // sinks a little, and recovers
    lean:       { ms: 820,  f: [[0, 'none'], [0.34, 'translateX(2px) rotate(0.5deg)'], [0.72, 'translateX(2px) rotate(0.5deg)'], [1, 'none']] },                              // toward the thing looked at (+x)
    eager:      { ms: 720,  f: [[0, 'none'], [0.2, 'scale(1.004, 0.992)'], [0.4, 'scale(0.997, 1.01)'], [0.6, 'scale(1.004, 0.993)'], [0.8, 'scale(0.998, 1.006)'], [1, 'none']] }   // two quick bobs: an overconfident little nod
  };

  var o = {};                        // mount: { root, next(on), pace() }
  var cfg = {};                      // start: { lift, done }
  var host = null, ui = null, caption = null, sayEl = null, sayShape = null, sayText = null, sayWords = [];
  var snow = null, snowAnims = [];
  var st = { active: false, scene: 0, phase: 'idle', canAdvance: false, isTransitioning: false, isDialoguePlaying: false };
  var gen = 0, timers = [], anims = [], raf = 0;
  var shot = null, lifted = false, reduce = false;
  var art = [], log = [], ids = {};
  var sayLine = null;

  /* ------------------------------------------------------------------ *
   * The clock
   * ------------------------------------------------------------------ */

  function pace() {
    try { var p = o.pace ? o.pace() : 1; return p > 0 ? Math.min(1, p) : 1; } catch (e) { return 1; }
  }
  function now() { return (global.performance && performance.now) ? performance.now() : Date.now(); }
  /* every timer of the story, so the clean-up can take them all; `raw` is not scaled by
     the pace — for the end of an animation, which runs in real time whatever the pace */
  function later(ms, fn, raw) {
    var g = gen;
    var id = setTimeout(function () {
      var k = timers.indexOf(id); if (k >= 0) timers.splice(k, 1);
      if (g === gen) fn();
    }, Math.max(0, raw ? ms : ms * pace()));
    timers.push(id);
    return id;
  }
  function sleep(ms) { return new Promise(function (res) { later(ms, res); }); }
  function animate(el, frames, opts, list) {
    if (!el || !el.animate) return null;
    try { var a = el.animate(frames, opts); (list || anims).push(a); return a; } catch (e) { return null; }
  }
  function sfx(name, level) {
    if (!name || !global.SFX || !SFX.play) return;
    try { SFX.play(name, level == null ? { level: 0.6 } : { level: level }); } catch (e) {}
  }

  /** THE ONE CLEAN-UP. Everything the scene that is up has running: its timers, its
      animations, the frame loop, its voice — and `gen` moves on so nothing that was
      waiting for them acts on the scene that follows. The ambient life of a painting still
      fading out (its swinging shapes) belongs to that painting and goes with it. */
  function cleanupStoryScene() {
    gen++;
    timers.splice(0).forEach(clearTimeout);
    if (raf) { (global.cancelAnimationFrame || clearTimeout)(raf); raf = 0; }
    anims.splice(0).forEach(function (a) { try { a.cancel(); } catch (e) {} });
    if (global.VO && VO.id && ids[VO.id]) { try { VO.stop(); } catch (e) {} }
    st.isDialoguePlaying = false;
  }

  /* ------------------------------------------------------------------ *
   * The paintings
   * ------------------------------------------------------------------ */

  function load(src, low) {
    return new Promise(function (resolve) {
      var img = new Image(), done = false;
      var fin = function () { if (!done) { done = true; resolve(img); } };
      try { img.decoding = 'async'; if (low) img.fetchPriority = 'low'; } catch (e) {}
      img.onload = function () { if (img.decode) img.decode().then(fin, fin); else fin(); };
      img.onerror = fin;
      img.src = src;
      art.push(img);                          // held, so the fetch is not collected half way
    });
  }
  var ready = [];
  function preload() {
    if (!ART || ready.length) return;
    // scene 1 first and at full priority: it is the first thing seen after Start
    ART.scenes.forEach(function (s, i) {
      ready[i] = Promise.all([load(s.src, i > 0), load(s.around, i > 0)]);
    });
  }
  function artFor(n) {
    var p = ready[n - 1] || Promise.resolve();
    return Promise.race([p, new Promise(function (res) { later(T.artWait, res); })]);
  }

  /* ------------------------------------------------------------------ *
   * Building a scene
   * ------------------------------------------------------------------ */

  /** A painting from the loading bar's copy in memory (src/core/preload.js), else the file. */
  function mem(u) { return (global.Preload && Preload.url) ? Preload.url(u) : u; }

  function el(tag, cls, parent) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function px(v) { return (Math.round(v * 10) / 10) + 'px'; }
  var NS = 'http://www.w3.org/2000/svg';
  function bounds(poly) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    poly.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    return [x0, y0, x1, y1];
  }

  /* A REGION'S EDGE, SOFT. Its outline filled white and blurred into an image the browser
     draws once — the copy of the painting inside is then seen fully in the middle and not at
     all at the edge, so when it moves a few pixels there is no seam anywhere, only the
     painting flexing. The box is padded past the blur so it is never clipped. */
  function maskFor(poly, box, feather) {
    var s = Math.max(1, feather / 3);
    var pts = poly.map(function (p) { return (p[0] - box[0]) + ',' + (p[1] - box[1]); }).join(' ');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + box[2] + '" height="' + box[3] + '" viewBox="0 0 ' + box[2] + ' ' + box[3] + '">' +
      // the blur may spread over the whole box (userSpaceOnUse): a region's own bounds, the
      // default, clip it on a small outline like the trunk's tip and leave a hard edge
      '<filter id="f" filterUnits="userSpaceOnUse" x="0" y="0" width="' + box[2] + '" height="' + box[3] + '" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="' + s.toFixed(1) + '"/></filter>' +
      '<polygon points="' + pts + '" fill="#fff" filter="url(#f)"/></svg>';
    return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
  }

  function buildShot(n) {
    var sc = DATA.scenes[n - 1], a = ART.scenes[n - 1];
    var s = { n: n, el: el('div', 'story-shot'), regions: {}, sheens: {}, anims: [] };
    s.el.setAttribute('data-scene', String(n));
    /* THE BAND PAST THE PICTURE'S EDGE: the painting mirrored out beyond it and blurred
       (tools/build-story.js), laid under the picture exactly in line with it — so where the
       window is not 16:9 the scene carries on, soft, with no seam at the join */
    var ar = (ART && ART.around) || { x: 0, y: 0 };
    var around = el('div', 'story-around', el('div', 'story-under', s.el));
    around.style.left = px(-ar.x); around.style.top = px(-ar.y);
    around.style.width = px(W + 2 * ar.x); around.style.height = px(H + 2 * ar.y);
    around.style.backgroundImage = 'url("' + mem(a.around) + '")';
    var frame = el('div', 'story-frame', s.el);
    s.zoom = el('div', 'story-zoom', frame);
    s.cam = el('div', 'story-cam', s.zoom);
    var cam = sc.camera;
    if (cam && cam.origin) s.cam.style.transformOrigin = px(cam.origin[0]) + ' ' + px(cam.origin[1]);
    var img = el('img', 'story-art', s.cam);
    // the loading bar's copy in memory (mem), and the file itself if that will not load
    img.onerror = function () { img.onerror = null; if (img.src !== a.src) img.src = a.src; };
    img.src = mem(a.src); img.alt = ''; img.draggable = false;

    /* the moving parts: a parent before its children, each child inside its parent so it
       carries the parent's motion and adds its own */
    var defs = sc.regions || {}, made = {};
    var make = function (key) {
      if (made[key]) return made[key];
      var r = defs[key];
      var parent = r.parent ? make(r.parent) : null;
      var f = r.feather || 20, pad = Math.ceil(f * 1.3);
      var b = bounds(r.poly);
      var box = [Math.floor(b[0] - pad), Math.floor(b[1] - pad), 0, 0];
      box[2] = Math.ceil(b[2] + pad) - box[0]; box[3] = Math.ceil(b[3] + pad) - box[1];
      var e = el('div', 'story-rg', parent ? parent.el : s.cam);
      e.setAttribute('data-region', key);   // (named, so a test can see which region moved)
      var ox = parent ? box[0] - parent.box[0] : box[0], oy = parent ? box[1] - parent.box[1] : box[1];
      e.style.left = px(ox); e.style.top = px(oy); e.style.width = px(box[2]); e.style.height = px(box[3]);
      e.style.backgroundImage = 'url("' + mem(a.src) + '")';
      e.style.backgroundSize = W + 'px ' + H + 'px';
      e.style.backgroundPosition = px(-box[0]) + ' ' + px(-box[1]);
      var m = maskFor(r.poly, box, f);
      e.style.webkitMaskImage = m; e.style.maskImage = m;
      var org = r.origin || [(b[0] + b[2]) / 2, b[3]];
      e.style.transformOrigin = px(org[0] - box[0]) + ' ' + px(org[1] - box[1]);
      made[key] = { key: key, el: e, box: box, parent: parent, count: 0, def: r };
      return made[key];
    };
    Object.keys(defs).forEach(make);
    s.regions = made;

    /* the lights that cross an outline once: clipped to it, so the sign glows and not the sky */
    var sh = sc.sheens || {};
    Object.keys(sh).forEach(function (key) {
      var d = sh[key], b = bounds(d.poly);
      var e = el('div', 'story-sheen', s.cam);
      e.style.left = px(b[0]); e.style.top = px(b[1]); e.style.width = px(b[2] - b[0]); e.style.height = px(b[3] - b[1]);
      var clip = 'polygon(' + d.poly.map(function (p) { return px(p[0] - b[0]) + ' ' + px(p[1] - b[1]); }).join(', ') + ')';
      e.style.webkitClipPath = clip; e.style.clipPath = clip;
      var band = el('i', null, e);
      var bw = Math.max(70, (b[2] - b[0]) * 0.42);
      band.style.width = px(bw);
      s.sheens[key] = { el: e, band: band, def: d, w: b[2] - b[0], bw: bw };
    });

    // the ice's twinkles: the four-point star the lesson's own ice glints with (stage.js)
    (sc.glints || []).forEach(function (g) {
      var e = doc.createElementNS(NS, 'svg');
      e.setAttribute('class', 'story-glint'); e.setAttribute('viewBox', '-12 -12 24 24'); e.setAttribute('aria-hidden', 'true');
      var st = doc.createElementNS(NS, 'path'), r = 10, q = r * 0.22;
      st.setAttribute('d', 'M0 ' + -r + ' Q' + q + ' ' + -q + ' ' + r + ' 0 Q' + q + ' ' + q + ' 0 ' + r + ' Q' + -q + ' ' + q + ' ' + -r + ' 0 Q' + -q + ' ' + -q + ' 0 ' + -r + ' Z');
      st.setAttribute('fill', '#ffffff');
      e.appendChild(st);
      e.style.left = px(g[0]); e.style.top = px(g[1]);
      s.cam.appendChild(e);
      (s.glints || (s.glints = [])).push({ el: e, lag: g[2] || 0 });
    });
    return s;
  }

  function removeShot(s) {
    if (!s) return;
    s.anims.splice(0).forEach(function (a) { try { a.cancel(); } catch (e) {} });
    if (s.el && s.el.parentNode) s.el.parentNode.removeChild(s.el);
  }

  /* THE LIFE A PAINTING HAS FOR AS LONG AS IT IS UP: the camera's slow lean, the shapes
     swinging on their ropes, the ice twinkling. Held by the shot itself, so it carries on
     while the shot fades out and stops when it is gone. None of it with reduced motion. */
  function ambient(s) {
    if (reduce) return;
    var sc = DATA.scenes[s.n - 1];
    if (sc.camera && sc.camera.to) {
      animate(s.cam, [{ transform: 'none' }, { transform: 'scale(' + sc.camera.to + ')' }],
        { duration: sc.camera.ms || 4600, easing: 'cubic-bezier(.33,0,.25,1)', fill: 'forwards' }, s.anims);
    }
    Object.keys(s.regions).forEach(function (k) {
      var r = s.regions[k], sw = r.def.sway;
      if (!sw) return;
      show(r, 1);
      animate(r.el, [{ transform: 'rotate(' + (-sw.deg) + 'deg)' }, { transform: 'rotate(' + sw.deg + 'deg)' }],
        { duration: sw.ms, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out', delay: -(sw.lag || 0) }, s.anims);
    });
    (s.glints || []).forEach(function (g) {
      // as the lesson's: mostly nothing, then one quick bright twinkle
      animate(g.el, [
        { opacity: 0, transform: 'scale(0.4)' },
        { opacity: 0, transform: 'scale(0.4)', offset: 0.76 },
        { opacity: 0.95, transform: 'scale(1.25)', offset: 0.85 },
        { opacity: 0, transform: 'scale(0.4)' }
      ], { duration: 4600, iterations: Infinity, delay: -g.lag, easing: 'ease-in-out' }, s.anims);
    });
  }

  /** A region is drawn only while it (or a region inside it) is moving: at rest the
      painting underneath is the same picture, and needs no copy over it. */
  function show(r, d) {
    for (var p = r; p; p = p.parent) {
      p.count = Math.max(0, p.count + d);
      p.el.classList.toggle('on', p.count > 0);
    }
  }

  function move(key, kind) {
    var r = shot && shot.regions[key], m = MOTION[kind];
    if (!r || !m || reduce) return;
    show(r, 1);
    var frames = m.f.map(function (k) { return { offset: k[0], transform: k[1], easing: 'ease-in-out' }; });
    animate(r.el, frames, { duration: m.ms });
    later(m.ms + 40, function () { show(r, -1); }, true);
  }

  function sheen(key) {
    var s = shot && shot.sheens[key];
    if (!s || reduce) return;
    var d = s.def, rtl = d.dir === 'rtl';
    var from = rtl ? s.w + 10 : -s.bw - 10, to = rtl ? -s.bw - 10 : s.w + 10;
    var go = function () {
      animate(s.band, [
        { transform: 'translateX(' + from + 'px) skewX(-16deg)', opacity: 0 },
        { transform: 'translateX(' + (from + (to - from) * 0.3) + 'px) skewX(-16deg)', opacity: d.strength || 0.5, offset: 0.3 },
        { transform: 'translateX(' + (from + (to - from) * 0.7) + 'px) skewX(-16deg)', opacity: d.strength || 0.5, offset: 0.7 },
        { transform: 'translateX(' + to + 'px) skewX(-16deg)', opacity: 0 }
      ], { duration: d.ms || 1000, easing: 'ease-in-out' });
    };
    if (d.lag) later(d.lag, go, true); else go();
  }

  /* A TWINKLE, ONCE, on the ice (the "polygons" moment): the lesson's four-point star,
     up and gone in well under a second, and removed from the page when it is done. */
  function twinkle(x, y, delay) {
    if (!shot || reduce) return;
    var s = shot;
    later(delay || 0, function () {
      var e = doc.createElementNS(NS, 'svg'), r = 13, q = r * 0.22;
      e.setAttribute('class', 'story-glint'); e.setAttribute('viewBox', '-14 -14 28 28'); e.setAttribute('aria-hidden', 'true');
      var st = doc.createElementNS(NS, 'path');
      st.setAttribute('d', 'M0 ' + -r + ' Q' + q + ' ' + -q + ' ' + r + ' 0 Q' + q + ' ' + q + ' 0 ' + r + ' Q' + -q + ' ' + q + ' ' + -r + ' 0 Q' + -q + ' ' + -q + ' 0 ' + -r + ' Z');
      st.setAttribute('fill', '#ffffff');
      e.appendChild(st);
      e.style.left = px(x); e.style.top = px(y); e.style.width = e.style.height = '32px'; e.style.margin = '-16px 0 0 -16px';
      s.cam.appendChild(e);
      animate(e, [
        { opacity: 0, transform: 'scale(0.3) rotate(0deg)' },
        { opacity: 1, transform: 'scale(1.3) rotate(30deg)', offset: 0.4 },
        { opacity: 0, transform: 'scale(0.4) rotate(60deg)' }
      ], { duration: 700, easing: 'ease-out' });
      later(760, function () { if (e.parentNode) e.parentNode.removeChild(e); }, true);
    }, true);
  }

  function cue(c) {
    if (!c) return;
    var go = function () {
      if (c.move) move(c.move, c.as);
      if (c.sheen) [].concat(c.sheen).forEach(sheen);
      if (c.twinkle) c.twinkle.forEach(function (g) { twinkle(g[0], g[1], g[2]); });
      if (c.sfx) sfx(c.sfx, c.level);
      if (c.sfx2) later(140, function () { sfx(c.sfx2, 0.35); }, true);
    };
    if (c.after) later(c.after, go); else go();
  }

  /* ------------------------------------------------------------------ *
   * The one dialogue: a narrator's panel or a character's speech bubble
   * ------------------------------------------------------------------ */

  function words(text) { return String(text).trim().split(/\s+/).filter(Boolean); }

  /* A LINE IN SHORT PARTS, ONE AFTER ANOTHER (asked for: "show text separately and short
     and sequentially"). story-data.js splits a long line where its voice pauses — joined,
     the parts are the line word for word, or they are not used — and each part has the box
     to itself while it is said: the lesson's own way with a line of two sentences, which
     it shows as two bubbles in turn. */
  function partsOf(line) {
    var all = words(line.text);
    var split = (line.parts && line.parts.length) ? line.parts.map(words) : [all];
    if ([].concat.apply([], split).join(' ') !== all.join(' ')) split = [all];
    var out = [], at = 0;
    split.forEach(function (p) { out.push({ from: at, to: at + p.length }); at += p.length; });
    return { words: all, parts: out };
  }

  /* THE BUBBLE AND ITS TAIL ARE ONE OUTLINE, so there is no seam where the tail joins: a
     rounded box whose bottom edge runs out to the speaker's head and back. The base leans
     toward the speaker, so the tail points at him rather than straight down. */
  function bubblePath(w, h, tx, ty) {
    var r = Math.min(30, h / 2 - 1);
    var bw = Math.max(36, Math.min(64, w * 0.16));
    var bx = Math.max(r + bw / 2 + 4, Math.min(w - r - bw / 2 - 4, tx + (w / 2 - tx) * 0.2));
    var x1 = bx - bw / 2, x2 = bx + bw / 2, dy = Math.max(14, ty - h);
    ty = h + dy;
    var n = function (v) { return Math.round(v * 10) / 10; };
    return 'M' + n(r) + ',0 H' + n(w - r) + ' A' + n(r) + ',' + n(r) + ' 0 0 1 ' + n(w) + ',' + n(r) + ' V' + n(h - r) +
      ' A' + n(r) + ',' + n(r) + ' 0 0 1 ' + n(w - r) + ',' + n(h) + ' H' + n(x2) +
      ' Q' + n(x2 + (tx - x2) * 0.25) + ',' + n(h + dy * 0.62) + ' ' + n(tx) + ',' + n(ty) +
      ' Q' + n(x1 + (tx - x1) * 0.62) + ',' + n(h + dy * 0.28) + ' ' + n(x1) + ',' + n(h) +
      ' H' + n(r) + ' A' + n(r) + ',' + n(r) + ' 0 0 1 0,' + n(h - r) + ' V' + n(r) + ' A' + n(r) + ',' + n(r) + ' 0 0 1 ' + n(r) + ',0 Z';
  }

  /** Lay one part of a line out at its final size before a word is seen (the words hold
      their space from the start and only pop in), close the box round it, and hang it from
      the line's anchor — by the bottom for a bubble, so it grows up into the sky. The
      line's focus words (`key`) are marked, to arrive in their own colour. */
  function layoutSay(line, all, part) {
    sayEl.className = 'story-say';
    sayEl.setAttribute('data-who', line.who);
    sayText.textContent = '';
    var keys = line.key || [];
    sayWords = all.slice(part.from, part.to).map(function (w, i) {
      if (i) sayText.appendChild(doc.createTextNode(' '));
      var key = keys.indexOf(w) >= 0, sp = el('span', key ? 'w k' : 'w', sayText);
      // a focus word's letters take the colour; the comma or the "!" after it stays ink
      var m = key && /^(.*?[^,.!?;:\u2014\u2026])([,.!?;:\u2014\u2026]+)$/.exec(w);
      if (key) { el('span', 'kw', sp).textContent = m ? m[1] : w; if (m) sp.appendChild(doc.createTextNode(m[2])); }
      else sp.textContent = w;
      return sp;
    });
    place(line);
  }
  /* EVERY PIECE OF TEXT ON ONE LINE, the box closed round it (asked for: "single line, not
     2 lines", and "dynamic"). A part is laid out unwrapped at its own size; only if it would
     be wider than the room it has (`box.w`, or the painting less its margins) does its type
     come down — just enough to fit, and never under 20px of the painting. The parts are cut
     short enough (story-data.js) that this is the rare case, on a phone's small board. */
  function place(line) {
    var b = line.box || {};
    sayEl.style.fontSize = '';
    // (in the caption row the row lays it out: no place on the painting, no tail)
    if (caption && sayEl.parentNode === caption) {
      sayEl.style.left = ''; sayEl.style.top = '';
      sayEl.style.setProperty('--ox', '50%'); sayEl.style.setProperty('--oy', '0px');
      return;
    }
    sayEl.style.left = '0px'; sayEl.style.top = '0px';
    var room = Math.min(W - 40, b.w1 || (W - 80));
    var wide = sayEl.offsetWidth, padX = wide - sayText.offsetWidth;
    var f0 = parseFloat((global.getComputedStyle ? global.getComputedStyle(sayEl).fontSize : '') || '0');
    if (wide > room && f0 > 0 && wide > padX) {
      sayEl.style.fontSize = px(Math.max(20, Math.floor(f0 * (room - padX) / (wide - padX) * 10) / 10));
    }
    var w = sayEl.offsetWidth, h = sayEl.offsetHeight;
    var left = b.cx != null ? b.cx - w / 2 : (b.x || 0);
    left = Math.max(20, Math.min(W - 20 - w, left));
    var top = b.bottom != null ? b.bottom - h : (b.top || 0);
    sayEl.style.left = px(Math.round(left)); sayEl.style.top = px(Math.round(top));
    if (line.tip && w && h) {
      var tx = line.tip[0] - Math.round(left), ty = line.tip[1] - Math.round(top);
      var d = bubblePath(w, h, tx, ty);
      sayShape.setAttribute('width', String(w)); sayShape.setAttribute('height', String(h));
      sayShape.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      sayShape.querySelector('.shade').setAttribute('d', d);
      sayShape.querySelector('.fill').setAttribute('d', d);
      // it pops from where the tail leaves the box: the speaker's side
      sayEl.style.setProperty('--ox', px(Math.max(0, Math.min(w, tx))));
      sayEl.style.setProperty('--oy', px(h));
    } else {
      sayEl.style.setProperty('--ox', '50%');
      sayEl.style.setProperty('--oy', '0px');
    }
  }
  /** In. The first part of a line pops out (a bubble) or drops in (the narrator's panel);
      a line's later parts come up with a smaller pop — the same speaker, going on. */
  function showSay(again) {
    sayEl.classList.add('revealing');
    if (again) sayEl.classList.add('again');
    void sayEl.offsetWidth;
    sayEl.classList.add('show', 'enter');
  }
  function hideSay() {
    if (!sayEl || !sayEl.classList.contains('show')) return false;
    sayEl.classList.remove('enter', 'show');
    sayEl.classList.add('out');
    return true;
  }

  /* WHEN EACH WORD ARRIVES. The clip's own word times if it has them; spread across the
     clip's spoken length if it only has a length; the lesson's read-aloud pace if silent. */
  function cuesFor(line, voiced, n) {
    var vw = voiced && global.VO && VO.words ? VO.words(line.vo) : null;
    if (vw && vw.length === n) return vw.slice();
    var base = global.Timing && Timing.cues ? Timing.cues(line.text, 1) : words(line.text).map(function (w, i) { return i * 280; });
    if (voiced) {
      var span = (VO.spoken && VO.spoken(line.vo)) || ((VO.seconds && VO.seconds(line.vo)) || 0) * 1000;
      var last = base[n - 1] || 0;
      if (span > 0 && last > 0) {
        var k = Math.max(0.45, Math.min(2.2, (span - 380) / last));
        return base.map(function (t) { return Math.round(t * k); });
      }
      return base;
    }
    var p = pace();
    return base.map(function (t) { return Math.round(t * p); });
  }

  function wordIndex(text, word) { return words(text).indexOf(word); }

  /** The words of the line, each arriving on its cue, against the voice's own clock while
      it is on air and against the wall clock if there is none (or it drops out) — and the
      line's parts taking the box in turn: the next one comes up just before its first word
      is said, and never before the one showing has been all there for a moment. */
  function reveal(line, L, cues, audio) {
    return new Promise(function (resolve) {
      var g = gen, i = 0, n = L.words.length, p = 0, doneAt = null, swapUntil = 0;
      var heard = unboxed(line);   // (the narrator: heard, not shown — see speak)
      var P = pace(), lead = T.partLead * P, least = T.partMin * P, out = T.partOut * P;
      var hooks = (line.at || []).map(function (h) { return { i: wordIndex(line.text, h.word), c: h }; });
      var onVoice = !!audio, started = false, t0 = now(), ceiling = now() + (cues[n - 1] || 0) + 6000;
      if (audio && audio.addEventListener) audio.addEventListener('playing', function () { started = true; });
      var rq = global.requestAnimationFrame || function (f) { return setTimeout(function () { f(now()); }, 16); };
      var tick = function () {
        raf = 0;
        if (g !== gen) return;
        var t;
        if (onVoice && global.VO && VO.id === line.vo && now() < ceiling) {
          var at = VO.at();
          t = (started || (at != null && at > 0)) && at != null ? at : -1;
        } else {
          // the voice is gone (ended early, refused, failed) or never came: carry on by the
          // clock from the word it had reached, so no word is skipped and none waits forever
          if (onVoice) { onVoice = false; t0 = now() - (i < n ? cues[i] : 0); }
          t = now() - t0;
        }
        if (swapUntil) {
          // the part before has gone: the next one comes up in its place
          if (now() < swapUntil) { raf = rq(tick); return; }
          swapUntil = 0; p++; doneAt = null;
          layoutSay(line, L.words, L.parts[p]);
          if (!heard) showSay(true);
        }
        var part = L.parts[p];
        while (i < part.to && cues[i] <= t) {
          sayWords[i - part.from].classList.add('in');
          for (var h = 0; h < hooks.length; h++) if (hooks[h].i === i) cue(hooks[h].c);
          i++;
        }
        if (i >= n) { resolve(); return; }
        if (i >= part.to && p + 1 < L.parts.length) {
          if (doneAt == null) doneAt = t;
          if (t >= Math.max(cues[L.parts[p + 1].from] - lead, doneAt + least)) {
            if (!heard) { hideSay(); swapUntil = now() + out; } else swapUntil = now();
          }
        }
        raf = rq(tick);
      };
      raf = rq(tick);
    });
  }

  function playVoice(line) {
    if (!line.vo || !global.VO || !VO.play) return null;
    try { return VO.play(line.vo); } catch (e) { return null; }
  }

  /* THE NARRATOR IS A VOICE, NOT A BOX (the user: "in the story use VO only in the background
     for narration, do not add a box for it"). Its lines are spoken over the paintings and run
     exactly as before — the words keep their times, so the comic beats cued on them (a perk on
     "day", a hop on "picnic") still land — but the storybook panel is never shown. The words
     are still laid out, unseen, in the live region, so a screen reader still hears them. Momo
     and Popo keep their speech bubbles. */
  function unboxed(line) { return line && line.who === 'narrator'; }

  async function speak(line, idx, sc) {
    var g = gen;
    st.isDialoguePlaying = true; st.phase = 'dialogue';
    if (hideSay()) { await sleep(T.sayOut + T.between); if (g !== gen) return; }
    var L = partsOf(line);
    layoutSay(line, L.words, L.parts[0]);
    if (!unboxed(line)) showSay();
    sayLine = line;
    if (line.who !== 'narrator') sfx('pop', 0.28);
    log.push({ scene: st.scene, who: line.who, text: line.text });
    await sleep(T.sayLead); if (g !== gen) return;
    var audio = playVoice(line);
    (line.start || []).forEach(cue);
    await reveal(line, L, cuesFor(line, !!audio, L.words.length), audio); if (g !== gen) return;
    if (audio && global.VO && VO.finished) { await VO.finished(); if (g !== gen) return; }
    st.isDialoguePlaying = false;
    if (idx < sc.lines.length - 1) {
      var hold = audio ? T.voHold : (global.Timing && Timing.readingPause ? Timing.readingPause(line.text, 1) : 1800);
      await sleep(hold);
    }
  }

  /* ------------------------------------------------------------------ *
   * The scenes, in order
   * ------------------------------------------------------------------ */

  async function showScene(n) {
    cleanupStoryScene();
    var g = gen, sc = DATA.scenes[n - 1];
    st.scene = n; st.phase = 'entering'; st.isTransitioning = true; st.canAdvance = false;
    await artFor(n); if (g !== gen) return;
    var s = buildShot(n), old = shot;
    host.insertBefore(s.el, ui);
    shot = s;
    ambient(s);
    var ease = 'cubic-bezier(.22,.61,.36,1)';
    if (!old) {
      // the first painting is already there under the title: the title lifts off it, and
      // it settles from 101% as it does
      lift();
      if (!reduce) animate(s.zoom, [{ transform: 'scale(1.01)' }, { transform: 'none' }], { duration: T.firstZoom, easing: ease });
      await sleep(T.firstZoom);
    } else {
      sfx('menuWhoosh', 0.4);
      /* A TRUE CROSSFADE: the new scene fades in OVER the old, which stays whole under it
         until it is covered. Fading both at once let the sky-blue behind them show through
         mid-way, a quarter of it, as a pale pulse between every two scenes. */
      s.el.style.opacity = '1';
      animate(s.el, [{ opacity: 0 }, { opacity: 1 }], { duration: T.fadeIn, easing: ease });
      if (!reduce) {
        animate(s.zoom, [{ transform: 'scale(1.01)' }, { transform: 'none' }], { duration: T.fadeIn + 140, easing: ease });
        animate(old.zoom, [{ transform: 'none' }, { transform: 'scale(1.01)' }], { duration: T.fadeOut, easing: ease }, old.anims);
      }
      await sleep(T.fadeIn);
      removeShot(old);
      if (g !== gen) return;
    }
    st.isTransitioning = false; st.phase = 'playing';
    await sleep(T.settle); if (g !== gen) return;
    (sc.enter || []).forEach(cue);
    // a reaction that comes before the words is let finish first (scene 4's stop)
    if (sc.enterHold) { await sleep(sc.enterHold); if (g !== gen) return; }
    for (var i = 0; i < sc.lines.length; i++) {
      await speak(sc.lines[i], i, sc);
      if (g !== gen) return;
    }
    await sleep(T.lastHold); if (g !== gen) return;
    // the scene has been told: now, and only now, may the story go on — and it does, by
    // itself, a breath later (NO NEXT BUTTON: the user, "remove the next buttons"; a tap
    // could go on early, Story.next, and never can before the scene is told)
    st.phase = 'waiting'; st.canAdvance = true;
    later(T.autoNext, function () { if (g === gen && st.active && st.canAdvance) next(); });
  }

  function next() {
    if (!st.active || !st.canAdvance || st.isTransitioning) return false;
    st.canAdvance = false; st.isTransitioning = true; st.phase = 'exiting';
    hideSay();
    var n = st.scene;
    later(T.sayOut, function () {
      if (n < DATA.scenes.length) showScene(n + 1);
      else finish();
    });
    return true;
  }

  /* THE HAND-OVER. The last line has been said and read; a soft cue, the story fades off
     the lesson's own opening vista, and the lesson begins — once. */
  function finish() {
    cleanupStoryScene();
    st.phase = 'exiting'; st.isTransitioning = true;
    sfx('sparkle', 0.55);
    later(160, function () { sfx('chime', 0.45); }, true);
    host.style.opacity = '0';
    animate(host, [{ opacity: 1 }, { opacity: 0 }], { duration: T.outro, easing: 'ease-in-out' });
    later(T.outro, function () { end(true); });
  }

  function end(told) {
    cleanupStoryScene();
    removeShot(shot); shot = null;
    Array.prototype.slice.call(host.querySelectorAll('.story-shot')).forEach(function (e) { e.parentNode.removeChild(e); });
    if (sayEl) { sayEl.className = 'story-say'; sayText.textContent = ''; sayWords = []; }
    sayLine = null;
    snowfall(false);
    host.hidden = true; host.style.opacity = '';
    if (o.root) o.root.classList.remove('story-on');
    st.active = false; st.canAdvance = false; st.isTransitioning = false; st.isDialoguePlaying = false;
    st.phase = told ? 'done' : 'idle';
    var done = cfg.done; cfg = {};
    if (told && done) done();
  }

  /* THE SNOW, the lesson's own (stage.js seedSnow): six-armed crystals from fx/snowflake.js,
     a few dozen, each falling with its own sway and spin and already mid-fall on the first
     frame. One field for the whole story, so it does not restart at each scene. */
  function snowfall(on) {
    snowAnims.splice(0).forEach(function (a) { try { a.cancel(); } catch (e) {} });
    while (snow && snow.firstChild) snow.removeChild(snow.firstChild);
    if (!on || !snow || reduce || !global.Snowflake || !Snowflake.path) return;
    for (var i = 0; i < 26; i++) {
      var r = 5.4 + Math.random() * 8.6;
      var build = r < 8.4 ? 2 : (r < 12.5 ? 1 : 0);
      var x = Math.random() * W, dur = 9000 + Math.random() * 10000;
      var sway = 22 + Math.random() * 50, spin = (Math.random() < 0.5 ? -1 : 1) * (140 + Math.random() * 340);
      var f = doc.createElementNS(NS, 'path');
      f.setAttribute('d', Snowflake.path(r, build));
      f.setAttribute('fill', 'none'); f.setAttribute('stroke', '#ffffff');
      f.setAttribute('stroke-width', (r * 0.14 + 0.5).toFixed(2));
      f.setAttribute('stroke-linecap', 'round'); f.setAttribute('stroke-linejoin', 'round');
      f.setAttribute('opacity', (0.35 + Math.random() * 0.45).toFixed(2));
      snow.appendChild(f);
      var a = animate(f, [
        { transform: 'translate(' + x.toFixed(0) + 'px,-30px) rotate(0deg)' },
        { transform: 'translate(' + (x + sway).toFixed(0) + 'px,' + (H * 0.3).toFixed(0) + 'px) rotate(' + (spin * 0.3).toFixed(0) + 'deg)', offset: 0.3 },
        { transform: 'translate(' + (x - sway * 0.6).toFixed(0) + 'px,' + (H * 0.7).toFixed(0) + 'px) rotate(' + (spin * 0.7).toFixed(0) + 'deg)', offset: 0.7 },
        { transform: 'translate(' + (x + sway * 0.3).toFixed(0) + 'px,' + (H + 36) + 'px) rotate(' + spin.toFixed(0) + 'deg)' }
      ], { duration: dur, delay: -Math.random() * dur, iterations: Infinity, easing: 'linear' }, snowAnims);
      if (!a) f.setAttribute('transform', 'translate(' + x.toFixed(0) + ' ' + (Math.random() * H).toFixed(0) + ')');
    }
  }

  function lift() {
    if (lifted) return;
    lifted = true;
    if (cfg.lift) { try { cfg.lift(); } catch (e) {} }
  }

  /* ------------------------------------------------------------------ *
   * Public
   * ------------------------------------------------------------------ */

  function mount(opts) {
    o = opts || {};
    host = doc.getElementById('story');
    if (!host || !DATA || !ART) return false;
    DATA.scenes.forEach(function (s) { (s.lines || []).forEach(function (l) { if (l.vo) ids[l.vo] = true; }); });
    ui = el('div', 'story-frame story-ui', host);
    caption = el('div', 'sf-caption', host);
    snow = doc.createElementNS(NS, 'svg');
    snow.setAttribute('class', 'story-snow'); snow.setAttribute('viewBox', '0 0 ' + W + ' ' + H); snow.setAttribute('aria-hidden', 'true');
    ui.appendChild(snow);
    sayEl = el('div', 'story-say', ui);
    sayEl.setAttribute('role', 'status'); sayEl.setAttribute('aria-live', 'polite');
    sayShape = doc.createElementNS(NS, 'svg');
    sayShape.setAttribute('class', 'story-say-shape'); sayShape.setAttribute('aria-hidden', 'true');
    var shade = doc.createElementNS(NS, 'path'); shade.setAttribute('class', 'shade'); shade.setAttribute('transform', 'translate(0 6)');
    var fill = doc.createElementNS(NS, 'path'); fill.setAttribute('class', 'fill');
    sayShape.appendChild(shade); sayShape.appendChild(fill);
    sayEl.appendChild(sayShape);
    sayText = el('span', 'story-say-text', sayEl);
    // the story's voice is fetched behind the title screen, so the first line is ready
    if (global.VO && VO.ready && VO.preload) VO.ready().then(function () { VO.preload(Object.keys(ids)); }, function () {});
    // a line laid out in the fallback face is re-measured once the real one is in
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { if (sayLine && st.active) place(sayLine); }, function () {});
    preload();
    fitFrame();
    global.addEventListener('resize', fitFrame);
    global.addEventListener('orientationchange', fitFrame);
    return true;
  }

  /* THE PANEL FITTED TO THE PAGE (the user's StoryFrame.fit, for this story's 1672 x 941
     paintings). The panel is scaled as one piece to fill 95% of the story's box, centred, and
     its ink set so it is 3 to 7 screen pixels whatever the scale. On an upright phone, where
     50px lettering would show under 15px, the page is marked is-portrait: the panel moves to the
     upper part of the screen and the line is shown in the caption row under it. */
  function fitFrame() {
    if (!host) return;
    var vw = host.clientWidth || global.innerWidth || 0, vh = host.clientHeight || global.innerHeight || 0;
    if (!vw || !vh) return;
    var contain = Math.min(vw / W, vh / H);
    var portrait = vh > vw * 1.1 && contain * 50 < 15;
    var k = contain * (portrait ? 0.96 : 0.95);
    var pw = W * k, ph = H * k, top;
    if (portrait) {
      var centre = Math.max(80 + ph / 2, vh * 0.3);
      top = centre - ph / 2;
      host.style.setProperty('--sf-caption-top', (centre + ph / 2 + 20).toFixed(1) + 'px');
    } else {
      top = (vh - ph) / 2;
      host.style.removeProperty('--sf-caption-top');
    }
    host.style.setProperty('--story-k', k.toFixed(5));
    host.style.setProperty('--sf-x', ((vw - pw) / 2).toFixed(1) + 'px');
    host.style.setProperty('--sf-y', top.toFixed(1) + 'px');
    host.style.setProperty('--sf-ink-w', (Math.max(3, Math.min(7, vw / 260)) / k).toFixed(2) + 'px');
    var was = host.classList.contains('is-portrait');
    host.classList.toggle('is-portrait', portrait);
    // the line lives in the caption row on an upright phone, on the painting otherwise
    if (sayEl && caption && ui) {
      var want = portrait ? caption : ui;
      if (sayEl.parentNode !== want) want.appendChild(sayEl);
    }
    if (was !== portrait && sayLine && st.active) place(sayLine);
  }

  function enabled() {
    if (!host || !DATA || !ART || !DATA.scenes || !DATA.scenes.length) return false;
    try { if (/[?&]story=0\b/.test((global.location && global.location.search) || '')) return false; } catch (e) {}
    return true;
  }

  function start(opts) {
    if (st.active) return true;
    cfg = opts || {};
    if (!enabled()) { lift(); var d = cfg.done; cfg = {}; if (d) d(); return false; }
    lifted = false; log = []; shot = null;
    try { reduce = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { reduce = false; }
    st.active = true; st.scene = 0; st.phase = 'entering'; st.canAdvance = false; st.isTransitioning = true;
    host.hidden = false; host.style.opacity = '';
    fitFrame();   // (measured now it is shown: hidden, it has no size to fit to)
    if (o.root) o.root.classList.add('story-on');
    snowfall(true);
    if (global.VO && VO.ready && VO.preload) VO.ready().then(function () { VO.preload(Object.keys(ids)); }, function () {});
    showScene(1);
    return true;
  }

  function stop() {
    if (!st.active) return;
    lift();
    end(false);
  }

  global.Story = {
    mount: mount, enabled: enabled, start: start, next: next, stop: stop,
    get active() { return st.active; },
    get state() {
      return { active: st.active, scene: st.scene, phase: st.phase, canAdvance: st.canAdvance,
               isTransitioning: st.isTransitioning, isDialoguePlaying: st.isDialoguePlaying, lines: log.slice() };
    }
  };
})(typeof window !== 'undefined' ? window : this);

/*!
 * swiftee-visit.js — Swiftee, flying in over Frozen Rush (the user's game-lesson kit).
 *
 *   SwifteeVisit.run({ frame, where, lines, exit })  -> Promise, resolved when he has gone
 *
 * Twice in the experience the game holds still and Swiftee comes to Momo: at the broken path
 * before the lesson ("Momo needs your help." / "But to help Momo, you need to learn about
 * polygons.") and at the first ditch after it ("Now let's help Momo."). He is drawn by THIS page,
 * over the game's frame, with the lesson's own sprite sheets, the lesson's dialogue box and the
 * lesson's voice — nothing of his is added to the game, which only stops and says where Momo and
 * the hole are (`where`, from the game's tutorial: in its 1920 x 1080 stage, after its zoom).
 *
 *   flight   from the top right, on one curve, wings going              FLY_IN
 *   hover    IN THE AIR beside Momo, wings going, a moment to arrive     WATCH
 *            (the user: "Swiftee delivers the dialogue in the air, flying — not on the path")
 *   lines    in the box over his head, each word as it is spoken        + HOLD after each
 *   exit     off to the side the next thing is on                       FLY_OUT
 *
 * ONE DRAWING OF HIM AT A TIME, AND ALWAYS IN THE AIR. One canvas, one frame of the lesson's
 * flight strip (swiftee-inspect-flight.webp) at a time — never two frames cross-faded, the
 * lesson's "two Swiftees" bug — from the moment he flies in to the moment he flies off. He
 * hovers while he speaks, looking at Momo.
 *
 * Every step has a backstop on the wall clock: a voice that never starts is heard silently after
 * START_WAIT, a line ends by its length plus 0.6 s whatever the audio does, and the whole visit
 * ends within CAP — the game is waiting on it, and must never be left waiting for good.
 */
(function (global) {
  'use strict';

  var FLY_IN = 1400, FLY_OUT = 950, WATCH = 700, HOLD = 1000, BETWEEN = 260;
  var WORD = 320, START_WAIT = 1200, CAP = 20000;
  /* HIS ART: the lesson's own flight strip (the user: "use swiftee-inspect-flight.webp") — four
     wingbeat frames side by side, 543 x 724 each, drawn one frame at a time, a frame every STEP ms as
     the lesson flies it. Every frame registers the same: the top of his head at TOP, his feet at
     FEET, of the frame's height. The strip looks to the right; FACE mirrors it to look left. */
  var STRIP = 'assets/swiftee/swiftee-inspect-flight.webp', FRAMES = 4, FW = 543, FH = 724, STEP = 110;
  var TOP = 0.185, FEET = 0.776;
  /* HIS SIZE, in the game's stage px (times its zoom): the bird BIRD tall, head to feet; and WHERE
     HE HOVERS — in the open sky beside Momo, AHEAD of him (to his right, over the broken path),
     his feet LIFT below the top of Momo's head, so he is a little above Momo, looking at him;
     LEAN tilts him toward Momo. */
  var BIRD = 220, FRAME_H = BIRD / (FEET - TOP), FRAME_W = FRAME_H * FW / FH;
  var AHEAD = 320, LIFT = 40, LEAN = -4;
  var SW = 1920, SH = 1080;
  /* THE WORDS THAT ARE THE POINT, in the lesson's key-word ink. */
  var KEY = /^(momo|polygons)[.,!?]*$/i;

  function now() { return (global.performance && performance.now) ? performance.now() : Date.now(); }
  function reducedMotion() {
    try { return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  /* ---- the strip ---- */
  var strip = null;
  /** Fetch and decode his flight strip now, so it is in hand when he is needed (the lesson loads
      the same file, so it is usually in the cache already). */
  function load() {
    if (strip) return strip.ready;
    var img = new global.Image();
    var ready = new Promise(function (res) {
      img.onload = function () { var d = img.decode ? img.decode() : Promise.resolve(); d.then(function () { res(true); }, function () { res(true); }); };
      img.onerror = function () { res(false); };
    });
    img.src = global.Preload && Preload.pick ? Preload.pick(STRIP) : STRIP;   // its AVIF twin, where shown
    strip = { img: img, ready: ready };
    return ready;
  }
  function drawFrame(ctx, n, w, h) {
    if (!strip || !strip.img.complete || !strip.img.naturalWidth) return;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(strip.img, (n % FRAMES) * FW, 0, FW, FH, 0, 0, w, h);
  }

  /* ---- the box: the lesson's own (index.html .visit-bubble, the look of #bubble) ---- */
  function bubble(doc) {
    var el = doc.createElement('div');
    el.className = 'visit-bubble';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<svg class="visit-tail" viewBox="0 0 60 60" aria-hidden="true"><g>' +
      '<path class="visit-tail-fill" d="M14 0 H46 V12 C44 26 34 40 12 54 C16 40 18 26 14 12 Z"></path>' +
      '<path class="visit-tail-stroke" d="M46 12 C44 26 34 40 12 54 C16 40 18 26 14 12"></path></g></svg>' +
      '<div class="visit-line"></div>';
    return el;
  }
  /* IN THE LESSON'S LANGUAGE (src/core/i18n.js, ?lan=): the line, and its key words found by
     the same lists the lesson's key words are — Momo, and polygons */
  var I = global.I18N && global.I18N.on ? global.I18N : null;
  function isKey(w) { return I ? (I.isWord(w, 'nameMomo') || I.isWord(w, 'termPolygon')) : KEY.test(w); }
  function setWords(el, text) {
    var line = el.querySelector('.visit-line');
    line.textContent = '';
    var spans = [];
    if (I) text = I.tr(text);
    String(text).split(/\s+/).filter(Boolean).forEach(function (w, i) {
      if (i) line.appendChild(el.ownerDocument.createTextNode(' '));
      var s = el.ownerDocument.createElement('span');
      s.className = isKey(w) ? 'w k' : 'w';
      s.textContent = w;
      line.appendChild(s);
      spans.push(s);
    });
    return spans;
  }

  /**
   * One visit. `frame` is the game's <iframe>; `where` what the game reported; `lines` are
   * [{ t, vo }]; `exit` 'left' or 'right'. Resolves when he has flown off.
   */
  function run(o) {
    var doc = global.document, where = o.where || {}, lines = o.lines || [];
    var reduced = reducedMotion();
    var layer = doc.createElement('div');
    layer.className = 'visit';
    layer.setAttribute('aria-hidden', 'false');
    var canvas = doc.createElement('canvas');
    canvas.className = 'visit-bird';
    var box = bubble(doc);
    layer.appendChild(canvas);
    layer.appendChild(box);
    doc.body.appendChild(layer);
    var ctx = canvas.getContext('2d');

    var zoom = where.zoom || 1, st = where.stage || { x: 0, y: 0, w: 1, h: 1 };
    var lip = where.lip || { x: 1500, y: 840 };
    /* WHERE HE HOVERS — IN THE AIR BESIDE MOMO, WATCHING HIM (the user: "Swiftee on air, flying,
       watching Momo, and gives the dialogue"): in the open sky over the broken path, a little above
       Momo's head and to his right, leaning toward him. Never off the stage, never down on the ice. */
    var head = where.head || { x: 520, y: 480 };
    var perch = { x: Math.max(FRAME_W * zoom * 0.5, Math.min(head.x + AHEAD * zoom, SW - FRAME_W * zoom * 0.5)),
                  y: Math.min(head.y + LIFT * zoom, lip.y - BIRD * zoom * 0.6) };
    function geo() {
      var r = o.frame ? o.frame.getBoundingClientRect() : { left: 0, top: 0, width: global.innerWidth, height: global.innerHeight };
      var k = st.w * r.width / SW;                                   // page px per stage px
      return {
        k: k, fh: FRAME_H * zoom * k, fw: FRAME_W * zoom * k,
        page: function (sx, sy) { return { x: r.left + st.x * r.width + sx * k, y: r.top + st.y * r.height + sy * (st.h * r.height / SH) }; },
        W: global.innerWidth, H: global.innerHeight
      };
    }
    var g0 = geo(), dpr = Math.min(2, global.devicePixelRatio || 1);
    var cw = Math.max(48, Math.round(g0.fw * dpr)), ch = Math.max(64, Math.round(g0.fh * dpr));
    canvas.width = cw; canvas.height = ch;
    canvas.style.transformOrigin = '50% ' + (FEET * 100).toFixed(1) + '%';

    var t0 = now();
    // face: -1 looks left (the strip mirrored) — at Momo while he hovers; in flight, where he is going
    var pos = null, tilt = 0, face = -1, bob = true, raf = 0, gone = false;

    function place() {
      var g = geo(), fw = g.fw, fh = g.fh;
      var feet = pos || g.page(perch.x, perch.y);
      // a hover: a slow rise and fall with the wingbeat, and a little sway (not while he flies in or out)
      var hov = bob && !reduced && !pos;
      var left = feet.x - fw / 2, top = feet.y - fh * FEET + (hov ? Math.sin(now() / 230) * fh * 0.025 : 0);
      if (hov) { face = -1; tilt = LEAN + Math.sin(now() / 610) * 3; }      // looking at Momo, swaying
      var s = canvas.style;
      s.width = fw + 'px'; s.height = fh + 'px';
      s.transform = 'translate(' + left.toFixed(1) + 'px,' + top.toFixed(1) + 'px) rotate(' + tilt.toFixed(1) + 'deg) scaleX(' + face + ')';
      // the box over his head, inside the window, its tail on him
      if (box.classList.contains('show')) {
        var bw = box.offsetWidth, bh = box.offsetHeight, m = 12;
        var headY = top + fh * TOP;
        var bx = Math.max(m, Math.min(g.W - bw - m, feet.x - bw * 0.62));
        var by = Math.max(m, headY - bh - 22);
        box.style.transform = 'translate(' + bx.toFixed(1) + 'px,' + by.toFixed(1) + 'px)';
        box.style.setProperty('--tail-x', Math.max(14, Math.min(bw - 50, feet.x - bx - 18)).toFixed(1) + 'px');
      }
    }
    function tick() {
      if (gone) return;
      // the wingbeat: one frame every STEP ms, round and round, from the moment he appears
      drawFrame(ctx, reduced ? 1 : Math.floor((now() - t0) / STEP) % FRAMES, cw, ch);
      place();
      raf = global.requestAnimationFrame(tick);
    }
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function whoosh() { try { if (global.SFX) SFX.play('menuWhoosh'); } catch (e) {} }

    /* a flight from `a` to `b` (page px of his feet), on one curve bowed upward */
    function fly(a, b, ms, ease) {
      if (reduced) { pos = b; return Promise.resolve(); }
      return new Promise(function (done) {
        var t0 = now(), cx = (a.x + b.x) / 2, cy = Math.min(a.y, b.y) - 120;
        (function step() {
          if (gone) { done(); return; }
          var u = Math.min(1, (now() - t0) / ms), e = ease(u);
          pos = { x: (1 - e) * (1 - e) * a.x + 2 * (1 - e) * e * cx + e * e * b.x,
                  y: (1 - e) * (1 - e) * a.y + 2 * (1 - e) * e * cy + e * e * b.y };
          face = b.x < a.x ? -1 : 1;
          tilt = face * 9 * Math.sin(Math.PI * u);
          if (u >= 1) { tilt = 0; done(); return; }
          global.requestAnimationFrame(step);
        })();
      });
    }
    var out = function (u) { return 1 - Math.pow(1 - u, 3); };
    var inn = function (u) { return u * u * u; };

    /* one line: the box, the voice, each word on its own syllable, then the hold */
    function say(l) {
      var spans = setWords(box, l.t);
      var id = l.vo, V = global.VO;
      var onsets = (V && V.words && V.words(id)) || null;
      if (!onsets || onsets.length !== spans.length) onsets = spans.map(function (s, i) { return i * WORD; });
      var len = (V && V.seconds && V.seconds(id) * 1000) || (onsets[onsets.length - 1] + 700);
      box.classList.remove('out');
      box.classList.add('show');
      var a = null;
      try { a = V && V.play ? V.play(id) : null; } catch (e) { a = null; }
      var t0 = now(), heard = false, last = onsets[onsets.length - 1];
      return new Promise(function (done) {
        (function step() {
          if (gone) { done(); return; }
          var t = now() - t0;
          /* THE CLOCK THE WORDS FOLLOW: the voice's own while this line is on air; once it has been
             heard and is off, every word is in; never heard — no clip, muted, refused — the wall's,
             after START_WAIT if a voice was asked for and simply has not begun. */
          var on = (V && V.id === id && V.at) ? V.at() : null;
          if (on != null) heard = true;
          var clock = on != null ? on : heard ? Infinity : (a && t < START_WAIT) ? -1 : t - (a ? START_WAIT : 0);
          spans.forEach(function (s, i) { if (clock >= onsets[i]) s.classList.add('in'); });
          var over = (heard && on == null) || (!heard && clock >= last + 700) || t > len + 600 + START_WAIT;
          if (over) {
            spans.forEach(function (s) { s.classList.add('in'); });
            done();
            return;
          }
          global.requestAnimationFrame(step);
        })();
      }).then(function () { return wait(HOLD); });
    }

    var cap = null;
    var finished = new Promise(function (resolve) {
      var end = function () {
        if (gone) return;
        gone = true;
        clearTimeout(cap);
        if (raf) global.cancelAnimationFrame(raf);
        try { if (global.VO && VO.stop && lines.some(function (l) { return VO.id === l.vo; })) VO.stop(); } catch (e) {}
        if (layer.parentNode) layer.parentNode.removeChild(layer);
        resolve();
      };
      cap = setTimeout(end, CAP);                               // a visit can never hold the game for good
      load().then(function () {
        if (gone) return;
        var g = geo(), home = g.page(perch.x, perch.y);
        var from = { x: g.W + g.fw * 0.8, y: -g.fh * 0.15 };
        pos = from;
        tick();
        whoosh();
        return fly(from, home, FLY_IN, out).then(function () {
          // arrived: he holds there in the air, wings going, a moment before he speaks
          pos = null; bob = true;
          return wait(WATCH);
        }).then(function () {
          return lines.reduce(function (p, l, i) {
            return p.then(function () { return i ? wait(BETWEEN) : null; }).then(function () { return say(l); });
          }, Promise.resolve());
        }).then(function () {
          // the box goes, and so does he — to the side the next thing is on
          box.classList.add('out');
          if (o.onLeave) { try { o.onLeave(); } catch (e) {} }
          whoosh();
          var g2 = geo(), at = g2.page(perch.x, perch.y);
          var to = o.exit === 'left' ? { x: -g2.fw * 0.8, y: -g2.fh * 0.15 } : { x: g2.W + g2.fw * 0.8, y: -g2.fh * 0.15 };
          return fly(at, to, FLY_OUT, inn);
        });
      }).then(end, end);
    });
    return finished;
  }

  global.SwifteeVisit = { run: run, load: load,
    TIMINGS: { FLY_IN: FLY_IN, FLY_OUT: FLY_OUT, WATCH: WATCH, HOLD: HOLD, BETWEEN: BETWEEN, WORD: WORD, START_WAIT: START_WAIT, CAP: CAP } };
})(typeof window !== 'undefined' ? window : this);

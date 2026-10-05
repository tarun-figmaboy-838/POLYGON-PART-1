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
 *   flight   from the top right, on one curve, wings going (flapping)   FLY_IN
 *   hover    IN THE AIR beside Momo, wings going, a moment to arrive     WATCH
 *            (the user: "Swiftee delivers the dialogue in the air, flying — not on the path")
 *   lines    in the box over his head, each word as it is spoken        + HOLD after each
 *   exit     off to the side the next thing is on (flapping)            FLY_OUT
 *
 * ONE DRAWING OF HIM AT A TIME, AND ALWAYS IN THE AIR. One canvas, one cell of the wingbeat
 * sheet (flapping) per frame — never two cells cross-faded, the lesson's "two Swiftees" bug —
 * from the moment he flies in to the moment he flies off. He hovers while he speaks.
 *
 * Every step has a backstop on the wall clock: a voice that never starts is heard silently after
 * START_WAIT, a line ends by its length plus 0.6 s whatever the audio does, and the whole visit
 * ends within CAP — the game is waiting on it, and must never be left waiting for good.
 */
(function (global) {
  'use strict';

  var FLY_IN = 1400, FLY_OUT = 950, WATCH = 700, HOLD = 1000, BETWEEN = 260;
  var WORD = 320, START_WAIT = 1200, CAP = 20000;
  /* HIS SIZE AND HIS PERCH, in the game's stage px (times its zoom): the cell he is drawn in, and
     how far past the hole's far lip he lands — on the ground there, facing back at Momo. */
  /* HOVER: where he holds in the air — in the open sky beside Momo, AHEAD (to his right, over the
     broken path) by AHEAD and his feet LIFT below the top of Momo's head, so he is a little above
     Momo and looking at him; LEAN tilts him toward Momo (the sprite faces the viewer). */
  var SIZE = 300, AHEAD = 320, LIFT = 40, LEAN = -6, BASELINE = 0.877, HEAD_TOP = 0.16;
  var SW = 1920, SH = 1080;
  /* THE WORDS THAT ARE THE POINT, in the lesson's key-word ink. */
  var KEY = /^(momo|polygons)[.,!?]*$/i;

  function F() { return global.SwifteeFrames; }
  function now() { return (global.performance && performance.now) ? performance.now() : Date.now(); }
  function reducedMotion() {
    try { return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  /* ---- the sheets ---- */
  // (he is in the air for the whole visit: the wingbeat is the only clip he needs)
  var CLIPS = ['flapping'];
  var imgs = {};
  function res() { return (global.devicePixelRatio || 1) > 1.25 ? '2x' : '1x'; }
  function sheetOf(name) {
    var f = F(), c = f && f.clips && f.clips[name];
    var s = c && c.sheets && (c.sheets[res()] || c.sheets['1x']);
    return s && s[0] ? { clip: c, sheet: s[0], cell: f.cell[c.sheets[res()] ? res() : '1x'] } : null;
  }
  /** Fetch and decode his sheets now, so they are in hand when he is needed. */
  function load() {
    var f = F();
    if (!f) return Promise.resolve(false);
    return Promise.all(CLIPS.map(function (name) {
      var s = sheetOf(name);
      if (!s) return Promise.resolve(false);
      var url = f.base + s.sheet.image;
      if (imgs[url]) return imgs[url].ready;
      var img = new global.Image();
      var ready = new Promise(function (res2) {
        img.onload = function () { var d = img.decode ? img.decode() : Promise.resolve(); d.then(function () { res2(true); }, function () { res2(true); }); };
        img.onerror = function () { res2(false); };
      });
      img.src = url;
      imgs[url] = { img: img, ready: ready };
      return ready;
    }));
  }
  function drawCell(ctx, name, i, px) {
    var f = F(), s = sheetOf(name);
    if (!s) return;
    var rec = imgs[f.base + s.sheet.image];
    if (!rec || !rec.img.complete || !rec.img.naturalWidth) return;
    var n = s.sheet.first + (i % s.sheet.frames), cols = s.sheet.cols, cell = s.cell;
    ctx.clearRect(0, 0, px, px);
    ctx.drawImage(rec.img, (n % cols) * cell, Math.floor(n / cols) * cell, cell, cell, 0, 0, px, px);
  }
  function frames(name) { var s = sheetOf(name); return s ? s.sheet.frames : 1; }
  function fps(name) { var s = sheetOf(name); return (s && s.clip.fps) || 20; }

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
  function setWords(el, text) {
    var line = el.querySelector('.visit-line');
    line.textContent = '';
    var spans = [];
    String(text).split(/\s+/).filter(Boolean).forEach(function (w, i) {
      if (i) line.appendChild(el.ownerDocument.createTextNode(' '));
      var s = el.ownerDocument.createElement('span');
      s.className = KEY.test(w) ? 'w k' : 'w';
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
    var perch = { x: Math.max(SIZE * zoom * 0.5, Math.min(head.x + AHEAD * zoom, SW - SIZE * zoom * 0.5)),
                  y: Math.min(head.y + LIFT * zoom, lip.y - SIZE * zoom * 0.75) };
    function geo() {
      var r = o.frame ? o.frame.getBoundingClientRect() : { left: 0, top: 0, width: global.innerWidth, height: global.innerHeight };
      var k = st.w * r.width / SW;                                   // page px per stage px
      return {
        k: k, cell: SIZE * zoom * k,
        page: function (sx, sy) { return { x: r.left + st.x * r.width + sx * k, y: r.top + st.y * r.height + sy * (st.h * r.height / SH) }; },
        W: global.innerWidth, H: global.innerHeight
      };
    }
    var g0 = geo();
    var px = Math.max(64, Math.round(g0.cell * Math.min(2, global.devicePixelRatio || 1)));
    canvas.width = px; canvas.height = px;

    var anim = { name: 'flapping', t0: now() };
    var pos = null, tilt = 0, bob = true, raf = 0, gone = false;

    function place() {
      var g = geo(), c = g.cell;
      var feet = pos || g.page(perch.x, perch.y);
      // a hover: a slow rise and fall with the wingbeat, and a little sway (not while he flies in or out)
      var hov = bob && !reduced && !pos;
      var left = feet.x - c / 2, top = feet.y - c * BASELINE + (hov ? Math.sin(now() / 230) * c * 0.04 : 0);
      if (hov) tilt = LEAN + Math.sin(now() / 610) * 3;                // leaning toward Momo, swaying
      var s = canvas.style;
      s.width = c + 'px'; s.height = c + 'px';
      s.transform = 'translate(' + left.toFixed(1) + 'px,' + top.toFixed(1) + 'px) rotate(' + tilt.toFixed(1) + 'deg)';
      // the box over his head, inside the window, its tail on him
      if (box.classList.contains('show')) {
        var bw = box.offsetWidth, bh = box.offsetHeight, m = 12;
        var headY = top + c * HEAD_TOP;
        var bx = Math.max(m, Math.min(g.W - bw - m, feet.x - bw * 0.62));
        var by = Math.max(m, headY - bh - 22);
        box.style.transform = 'translate(' + bx.toFixed(1) + 'px,' + by.toFixed(1) + 'px)';
        box.style.setProperty('--tail-x', Math.max(14, Math.min(bw - 50, feet.x - bx - 18)).toFixed(1) + 'px');
      }
    }
    function tick() {
      if (gone) return;
      var a = anim, n = Math.floor((now() - a.t0) * fps(a.name) / 1000);
      drawCell(ctx, a.name, n, px);
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
          tilt = (b.x < a.x ? -1 : 1) * 9 * Math.sin(Math.PI * u);
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
        var g = geo(), c = g.cell, home = g.page(perch.x, perch.y);
        var from = { x: g.W + c * 0.6, y: -c * 0.25 };
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
          var g2 = geo(), c2 = g2.cell, at = g2.page(perch.x, perch.y);
          var to = o.exit === 'left' ? { x: -c2 * 0.7, y: -c2 * 0.2 } : { x: g2.W + c2 * 0.7, y: -c2 * 0.2 };
          return fly(at, to, FLY_OUT, inn);
        });
      }).then(end, end);
    });
    return finished;
  }

  global.SwifteeVisit = { run: run, load: load,
    TIMINGS: { FLY_IN: FLY_IN, FLY_OUT: FLY_OUT, WATCH: WATCH, HOLD: HOLD, BETWEEN: BETWEEN, WORD: WORD, START_WAIT: START_WAIT, CAP: CAP } };
})(typeof window !== 'undefined' ? window : this);

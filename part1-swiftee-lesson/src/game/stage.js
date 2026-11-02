// stage.js — everything the learner sees and touches, except Swiftee.
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var W = 1000, H = 562;

  /** The painted backdrop. 16:9, which is exactly the viewBox's aspect. */

  var svg, layers = {}, st = {};

  var seatY = 0, plankFree = false;
  var SEAT_LAYERS = ['panel', 'poly', 'ui', 'fx'];
  function applySeat(animate) {
    var p = (st.kind === 'polygon' && st.panel) ? st.panel : null;
    var target = 0;
    if (plankFree && p) {
      var band = p.controls ? CONTROL_GAP + CONTROL_H : 0;
      var groupH = p.h + band;
      var want = Math.max(40, (H - groupH) / 2);
      var lift = Math.max(p.y - want, (p.y + p.h) - 490);
      target = -Math.max(0, Math.min(64, lift));
    }
    if (target === seatY) return;
    var from = seatY; seatY = target;
    SEAT_LAYERS.forEach(function (n) {
      var g = layers[n]; if (!g) return;
      g.setAttribute('transform', target ? 'translate(0,' + target + ')' : '');
      if (animate && !reduced() && g.animate) {
        try {
          g.animate([{ transform: 'translate(0,' + from + 'px)' }, { transform: 'translate(0,' + target + 'px)' }],
                    { duration: 640, easing: 'cubic-bezier(.22,1,.36,1)' });
        } catch (e) {}
      }
    });
  }
  var onTap = function () {};       // game.js hooks perTap feedback here
  var onEvent = function () {};
  function evt(name, payload) { try { onEvent(name, payload || {}); } catch (e) {} }
  var cleanup = [];                 // listeners to remove when an interaction ends

  function inLang(text) { return (global.I18N && I18N.on) ? I18N.tr(text) : text; }

  function pic(u) { return global.Preload && Preload.pick ? Preload.pick(u) : u; }
  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in (attrs || {})) {
      if (k === 'text') e.textContent = inLang(attrs[k]);
      else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    }
    (parent || layers.ui).appendChild(e);
    return e;
  }
  function clear(layer) { var l = layers[layer]; while (l.firstChild) l.removeChild(l.firstChild); }
  function pt(e) {
    var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    var m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 };
    var q = p.matrixTransform(m.inverse());
    return { x: q.x, y: q.y - seatY };   // into the seated layers' own space
  }
  function on(el, ev, fn, opts) { el.addEventListener(ev, fn, opts); cleanup.push(function () { el.removeEventListener(ev, fn, opts); }); }
  var HINT_FIRST_MS = 700, HINT_IDLE_MS = 3000, HINT_SHOW_MS = 1800;
  var hintSeen = {};                         // interaction types already demonstrated
  var hintType = 'input';                    // the type the current interaction is (waitFor)
  var hintGate = function () { return true; };
  var hintRearm = null;                      // the live ladder's clock (hintRestart)
  var holdOn = false;
  function hintLadder(opts) {
    if (reduced() || !svg) return;
    var show = opts.demo || opts.pulse || null;
    var type = opts.type || hintType;
    var stop = null, t = null, live = true, pressing = false, lastMove = 0, blocked = false;
    var hide = function () { if (stop) { try { stop(); } catch (e) {} stop = null; } };
    var arm = function (ms) {
      clearTimeout(t);
      if (!live) return;
      t = setTimeout(function tick() {
        if (!live || pressing) return;
        // the lesson must be doing nothing but waiting for the child
        var open = true; try { open = hintGate() !== false; } catch (e) { open = true; }
        if (!open) { blocked = true; t = setTimeout(tick, 250); return; }
        if (blocked && hintSeen[type]) { blocked = false; arm(HINT_IDLE_MS); return; }
        blocked = false;
        var first = !hintSeen[type];
        hintSeen[type] = true;
        hide();
        try { stop = (show && show()) || null; } catch (e) { stop = null; }
        evt('hint:show', { rung: first ? 'first' : 'idle', type: type });
        arm(HINT_SHOW_MS + HINT_IDLE_MS);    // another 3 s of stillness after this one
      }, ms);
    };
    on(svg, 'pointerdown', function () { pressing = true; hintSeen[type] = true; hide(); clearTimeout(t); });
    var release = function () { pressing = false; arm(HINT_IDLE_MS); };
    on(svg, 'pointerup', release);
    on(svg, 'pointercancel', release);
    on(svg, 'pointermove', function () {
      if (pressing) return;
      var now = Date.now();
      if (now - lastMove < 200) return;       // a moving pointer is one signal, not sixty
      lastMove = now;
      arm(HINT_IDLE_MS);
    });
    cleanup.push(function () { live = false; hide(); clearTimeout(t); hintRearm = null; });
    hintRearm = function () { if (!pressing) arm(hintSeen[type] ? HINT_IDLE_MS : HINT_FIRST_MS); };
    arm(hintSeen[type] ? HINT_IDLE_MS : HINT_FIRST_MS);
  }

  function pulseHint(els, o) {
    o = o || {};
    if (reduced() || !svg) return function () {};
    var list = (els || []).filter(Boolean);
    if (!list.length) return function () {};
    var anims = [];
    var peak = o.strong ? '1.12' : '1.075', times = o.strong ? 2 : 1;
    list.slice(0, 10).forEach(function (e, i) {
      if (!e.animate) return;
      try {
        if (e.tagName === 'line' || e.tagName === 'path') {
          anims.push(e.animate([{ strokeOpacity: 0.45 }, { strokeOpacity: 1 }, { strokeOpacity: 0.45 }],
            { duration: o.pop ? 600 : 900, iterations: times, delay: i * (o.pop ? 80 : 110), easing: 'ease-in-out' }));
          return;
        }
        e.style.transformBox = 'fill-box'; e.style.transformOrigin = 'center';
        // o.pop: one quick springy "here!" — up, a touch past, and settle
        anims.push(o.pop
          ? e.animate([{ scale: '1' }, { scale: '1.22', offset: 0.35 }, { scale: '0.96', offset: 0.7 }, { scale: '1' }],
                      { duration: 480, delay: i * 80, easing: 'ease-out' })
          : e.animate([{ scale: '1' }, { scale: peak }, { scale: '1' }],
                      { duration: 900, iterations: times, delay: i * 110, easing: 'ease-in-out' }));
      } catch (x) {}
    });
    var stop = function () { anims.forEach(function (a) { try { a.cancel(); } catch (e) {} }); anims = []; };
    cleanup.push(stop);
    return stop;
  }

  var HAND_H = 62;   // stage units; the glove is 62 tall, its tip ~8 across
  if (global.HandArt && typeof Image !== 'undefined') {
    var warmHand = function () { try { (new Image()).src = pic(HandArt.src); } catch (e) {} };
    if (global.ImgFormat && ImgFormat.ready && !ImgFormat.settled) ImgFormat.ready.then(warmHand); else warmHand();
  }
  function handAt(parent, x, y) {
    var A = global.HandArt; if (!A || !A.src) return null;
    var h = HAND_H, w = h * A.w / A.h, tx = A.tip.x * w, ty = A.tip.y * h;
    var flip = x + (w - tx) > W - 6;
    var g = mk('g', { 'class': 'hint-hand', 'pointer-events': 'none', transform: 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')' }, parent);
    // the press, felt: a ring leaves the fingertip
    var ripple = mk('circle', { cx: 0, cy: 0, r: 18, fill: 'none', stroke: '#ffffff', 'stroke-width': 3, opacity: 0 }, g);
    var body = mk('g', flip ? { transform: 'scale(-1,1)' } : {}, g);
    var im = mk('image', { x: (-tx).toFixed(1), y: (-ty).toFixed(1), width: w.toFixed(1), height: h.toFixed(1), preserveAspectRatio: 'none' }, body);
    im.setAttribute('href', pic(A.src)); im.setAttributeNS('http://www.w3.org/1999/xlink', 'href', pic(A.src));
    im.style.filter = 'drop-shadow(0 3px 2.5px rgba(8, 44, 96, .35))';
    im.style.transformBox = 'fill-box'; im.style.transformOrigin = (A.tip.x * 100).toFixed(1) + '% ' + (A.tip.y * 100).toFixed(1) + '%';
    ripple.style.transformBox = 'fill-box'; ripple.style.transformOrigin = 'center';
    return { g: g, img: im, ripple: ripple, side: flip ? -1 : 1 };
  }
  function centreOf(el) {
    if (!el) return null;
    if (el._rect) return { x: el._rect.x + el._rect.w / 2, y: el._rect.y + el._rect.h / 2 };
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'circle') return { x: +el.getAttribute('cx'), y: +el.getAttribute('cy') };
    if (tag === 'line') return { x: (+el.getAttribute('x1') + +el.getAttribute('x2')) / 2, y: (+el.getAttribute('y1') + +el.getAttribute('y2')) / 2 };
    try { var b = el.getBBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; } catch (e) { return null; }
  }
  function tapHand(p, o) {
    o = o || {};
    if (reduced() || !svg || !p || !isFinite(p.x) || !isFinite(p.y)) return function () {};
    var Hd = handAt(layers.fx, p.x, p.y); if (!Hd) return function () {};
    var s1 = Hd.side, ms = o.duration || 2800, anims = [];
    var lift = (s1 * 7) + 'px 8px', away = (s1 * 30) + 'px 38px';
    try {
      anims.push(Hd.g.animate([
        { translate: away, opacity: 0, offset: 0 },
        { translate: lift, opacity: 1, offset: 0.16 },
        { translate: '0px 0px', opacity: 1, offset: 0.26 },     // press
        { translate: lift, opacity: 1, offset: 0.37 },
        { translate: '0px 0px', opacity: 1, offset: 0.5 },      // and again
        { translate: lift, opacity: 1, offset: 0.61 },
        { translate: lift, opacity: 1, offset: 0.8 },
        { translate: away, opacity: 0, offset: 1 }
      ], { duration: ms, easing: 'ease-in-out', fill: 'forwards' }));
      anims.push(Hd.img.animate([
        { scale: '1', offset: 0 }, { scale: '1', offset: 0.2 }, { scale: '.9', offset: 0.26 }, { scale: '1', offset: 0.34 },
        { scale: '1', offset: 0.44 }, { scale: '.9', offset: 0.5 }, { scale: '1', offset: 0.58 }, { scale: '1', offset: 1 }
      ], { duration: ms }));
      anims.push(Hd.ripple.animate([
        { opacity: 0, scale: '.3', offset: 0 }, { opacity: 0, scale: '.3', offset: 0.26 },
        { opacity: 0.9, scale: '.45', offset: 0.27 }, { opacity: 0, scale: '1.3', offset: 0.42 },
        { opacity: 0, scale: '.3', offset: 0.5 }, { opacity: 0.9, scale: '.45', offset: 0.51 },
        { opacity: 0, scale: '1.3', offset: 0.66 }, { opacity: 0, scale: '.3', offset: 1 }
      ], { duration: ms }));
    } catch (e) {}
    var live = true;
    var stop = function () { if (!live) return; live = false; anims.forEach(function (a) { try { a.cancel(); } catch (e) {} }); if (Hd.g.parentNode) Hd.g.remove(); };
    if (anims[0] && anims[0].finished) anims[0].finished.then(stop, function () {});
    cleanup.push(stop);
    return stop;
  }
  /** Two hints as one: the strong pulse on every target, and the hand on one. */
  function both(a, b) { return function () { try { a && a(); } catch (e) {} try { b && b(); } catch (e) {} }; }

  function endInteraction() {
    cleanup.splice(0).forEach(function (f) { f(); });
    if (svg) {
      svg.style.cursor = '';
      var dressed = svg.querySelectorAll('[style*="cursor"]');
      for (var i = 0; i < dressed.length; i++) dressed[i].style.cursor = '';
    }
  }
  function pathOf(v) { return v.map(function (p, i) { return (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ') + ' Z'; }
  function juice(name, el, o) { if (global.Juice && el && Juice[name]) Juice[name](el, o); }

  function gestureGhost(from, to, opts) {
    opts = opts || {};
    if (reduced() || !svg) return function () {};
    var g = mk('g', { 'class': 'gesture-ghost', 'pointer-events': 'none' }, layers.fx);
    var mover;
    var drawn = null;
    if (opts.line) {
      var glen0 = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      drawn = litLine(g, { x1: from.x, y1: from.y, x2: to.x, y2: to.y, 'stroke-width': 5, 'stroke-linecap': 'round' });
      drawn[0].setAttribute('opacity', 0.35); drawn[1].setAttribute('opacity', 0.62);
      drawn.forEach(function (ln) { ln.style.strokeDasharray = glen0 + ' ' + glen0; ln.style.strokeDashoffset = glen0 + 'px'; });
      drawn.len = glen0;
      mover = null;
    } else if (opts.clone) {
      mover = opts.clone.cloneNode(true);
      mover.removeAttribute('class'); mover.setAttribute('class', 'gesture-ghost-copy');
      // inert to every selector: no data attributes, no classes on what it copied
      mover.removeAttribute('data-shape'); mover.removeAttribute('data-id');
      var copied = mover.querySelectorAll('[class]'); for (var ci = 0; ci < copied.length; ci++) copied[ci].removeAttribute('class');
      mover.style.pointerEvents = 'none';
      mover.setAttribute('transform', 'translate(' + from.x + ',' + from.y + ')');
      g.appendChild(mover);
    } else {
      mover = mk('circle', { cx: from.x, cy: from.y, r: opts.r || 11, fill: HI.knob, stroke: HI.edge, 'stroke-width': 2.5 }, g);
    }
    var trail = null;
    if (opts.trail !== false && !opts.line) {
      var tp = litLine(g, { x1: from.x, y1: from.y, x2: to.x, y2: to.y, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-dasharray': '8 10', opacity: 0 });
      trail = mk('g', {}, g); trail.appendChild(tp[0]); trail.appendChild(tp[1]);
      g.insertBefore(trail, mover);
    }
    var dx = to.x - from.x, dy = to.y - from.y, live = true;
    var frames = [
      { translate: '0 0', opacity: 0, offset: 0 },
      { translate: '0 0', opacity: 0.85, offset: 0.14 },
      { translate: dx + 'px ' + dy + 'px', opacity: 0.85, offset: 0.66, easing: 'cubic-bezier(.35,.6,.3,1)' },
      { translate: dx + 'px ' + dy + 'px', opacity: 0.85, offset: 0.82 },
      { translate: dx + 'px ' + dy + 'px', opacity: 0, offset: 0.94 },
      { translate: dx + 'px ' + dy + 'px', opacity: 0, offset: 1 }
    ];

    var ms = opts.duration || 3200;
    var endG = mk('g', { 'class': 'gesture-ghost-end', 'pointer-events': 'none',
                         transform: 'translate(' + to.x + ',' + to.y + ')' }, layers.fx);
    endG.style.opacity = '0';

    var anims = [];
    var times = opts.times || 1, delay = opts.delay == null ? 120 : opts.delay;
    if (drawn && drawn[0].animate) {
      var L0 = drawn.len + 'px';
      drawn.forEach(function (ln) {
        try {
          anims.push(ln.animate([
            { strokeDashoffset: L0, opacity: 1, offset: 0 },
            { strokeDashoffset: L0, opacity: 1, offset: 0.16 },
            { strokeDashoffset: '0px', opacity: 1, offset: 0.66, easing: 'cubic-bezier(.35,.6,.3,1)' },
            { strokeDashoffset: '0px', opacity: 1, offset: 0.8 },
            { strokeDashoffset: '0px', opacity: 0, offset: 0.94 },
            { strokeDashoffset: '0px', opacity: 0, offset: 1 }
          ], { duration: ms, iterations: times, delay: delay, fill: 'both' }));
        } catch (e) {}
      });
    } else if (drawn) {
      // no motion: the line alone, dashed, so the hint is still there
      drawn.forEach(function (ln) { ln.style.strokeDasharray = '14 12'; ln.style.strokeDashoffset = '0px'; });
    }
    if (mover && mover.animate) anims.push(mover.animate(frames, { duration: ms, iterations: times, delay: delay }));
    if (opts.target && opts.target.animate) {
      try {
        opts.target.style.transformBox = 'fill-box'; opts.target.style.transformOrigin = 'center';
        var lit = 'brightness(1.18) drop-shadow(0 0 5px ' + HI.lit + ')';
        anims.push(opts.target.animate([
          { scale: '1', filter: 'none', offset: 0 },
          { scale: '1', filter: 'none', offset: 0.46 },
          { scale: '1.32', filter: lit, offset: 0.62, easing: 'cubic-bezier(.3,1.4,.5,1)' },
          { scale: '1.32', filter: lit, offset: 0.8 },
          { scale: '1', filter: 'none', offset: 0.94 },
          { scale: '1', filter: 'none', offset: 1 }
        ], { duration: ms, iterations: times, delay: delay }));
      } catch (e) {}
    }
    var hand = opts.hand === false ? null : handAt(g, from.x, from.y);
    if (hand && hand.g.animate) {
      var hs = hand.side, dxy = dx + 'px ' + dy + 'px';
      try {
        anims.push(hand.g.animate([
          { translate: (hs * 24) + 'px 30px', opacity: 0, offset: 0 },
          { translate: '0px 0px', opacity: 1, offset: 0.12 },
          { translate: '0px 0px', opacity: 1, offset: 0.16 },
          { translate: dxy, opacity: 1, offset: 0.66, easing: 'cubic-bezier(.35,.6,.3,1)' },
          { translate: dxy, opacity: 1, offset: 0.76 },
          { translate: (dx + hs * 20) + 'px ' + (dy + 26) + 'px', opacity: 0, offset: 0.92 },
          { translate: (dx + hs * 20) + 'px ' + (dy + 26) + 'px', opacity: 0, offset: 1 }
        ], { duration: ms, iterations: times, delay: delay, fill: 'both' }));
        anims.push(hand.img.animate([
          { scale: '1', offset: 0 }, { scale: '1', offset: 0.12 }, { scale: '.92', offset: 0.16 },
          { scale: '.92', offset: 0.7 }, { scale: '1', offset: 0.78 }, { scale: '1', offset: 1 }
        ], { duration: ms, iterations: times, delay: delay }));
      } catch (e) {}
    }
    if (trail && trail.animate) anims.push(trail.animate([
      { opacity: 0, offset: 0 }, { opacity: 0.55, offset: 0.2 }, { opacity: 0.55, offset: 0.76 }, { opacity: 0, offset: 0.92 }, { opacity: 0, offset: 1 }
    ], { duration: ms, iterations: times, delay: delay }));
    var ringIn = null;
    if (endG.animate) {
      try {
        endG.style.transformBox = 'fill-box'; endG.style.transformOrigin = 'center';
        ringIn = endG.animate([
          { opacity: 0, scale: '.7', offset: 0 },
          { opacity: 0.95, scale: '1', offset: 0.18 },
          { opacity: 0.95, scale: '1', offset: 0.62 },
          { opacity: 1, scale: '1.22', offset: 0.7 },       // the ghost arrives
          { opacity: 0.95, scale: '1', offset: 0.8 },
          { opacity: 0.95, scale: '1', offset: 1 }
        ], { duration: ms, delay: delay, fill: 'forwards', easing: 'ease-out' });
      } catch (e) { endG.style.opacity = '0.95'; }
    } else endG.style.opacity = '0.95';
    // THE GHOST GOES WHEN IT HAS SHOWN THE MOVE; THE MARK DOES NOT.
    var ghostGone = false;
    var fadeGhost = function () {
      if (ghostGone) return; ghostGone = true;
      if (g.animate) {
        try { var f = g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }); f.finished.then(function () { g.remove(); }, function () { g.remove(); }); return; } catch (e) {}
      }
      g.remove();
    };
    if (anims[0] && anims[0].finished) anims[0].finished.then(function () { if (live) { fadeGhost(); endG.style.opacity = '0.95'; } }, function () {});
    var stop = function () {
      if (!live) return; live = false;
      anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      fadeGhost();
      // from wherever the ring is now — mid-rise, or standing — to nothing
      var cur = 0;
      try { cur = parseFloat(global.getComputedStyle(endG).opacity) || 0; } catch (e) { cur = 0; }
      endG.style.opacity = String(cur);
      if (ringIn) { try { ringIn.cancel(); } catch (e) {} }
      if (cur > 0.02 && endG.animate && endG.parentNode) {
        try { var f2 = endG.animate([{ opacity: cur }, { opacity: 0 }], { duration: 180, fill: 'forwards' }); f2.finished.then(function () { endG.remove(); }, function () { endG.remove(); }); return; } catch (e) {}
      }
      endG.remove();
    };
    cleanup.push(stop);
    return stop;
  }
  function dotBurst(i) {
    var k = knobOf(i);
    if (!k || reduced() || !k.animate || !st.polyG || !k.parentNode) return;
    var cx = +k.getAttribute('cx'), cy = +k.getAttribute('cy');
    var host = k.parentNode, first = host.querySelector('.knob');
    var g = mk('g', { 'class': 'dot-burst', 'pointer-events': 'none' }, host);
    if (first) host.insertBefore(g, first);
    var cols = ['#ffb300', '#ff3d7f', '#00a8f0', '#2fbf4f', '#8a5cff', '#ff7a00'];
    for (var q = 0; q < 16; q++) {
      var ang = (q / 16) * Math.PI * 2 + Math.random() * 0.4, dist = 32 + Math.random() * 26;
      var bw = 8 + Math.random() * 3, bh = 4.5 + Math.random() * 1.5, col = cols[q % cols.length];
      var bit = q % 3
        ? mk('rect', { x: (cx - bw / 2).toFixed(1), y: (cy - bh / 2).toFixed(1), width: bw.toFixed(1), height: bh.toFixed(1), rx: 1.2, fill: col }, g)
        : mk('circle', { cx: cx, cy: cy, r: 3.6, fill: col }, g);
      var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
      bit.style.transformBox = 'fill-box'; bit.style.transformOrigin = 'center';
      try {
        bit.animate([
          { transform: 'translate(0px,0px) rotate(0deg) scale(.6)', opacity: 1 },
          { transform: 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) rotate(' + (180 + q * 40) + 'deg) scale(1)', opacity: 1, offset: 0.55 },
          { transform: 'translate(' + (dx * 1.15).toFixed(1) + 'px,' + (dy + 14).toFixed(1) + 'px) rotate(' + (300 + q * 40) + 'deg) scale(.9)', opacity: 0 }
        ], { duration: 720 + Math.random() * 160, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
      } catch (e) {}
    }
    later(1000, function () { if (g.parentNode) g.remove(); });
  }
  /** The visible knob at vertex i (the touch disc over it is st.vertEls[i]). */
  function knobOf(i) { return (st.knobEls && st.knobEls[i]) || null; }
  function sfx(name, o) {
    if (!global.SFX) return;
    SFX.play(name, (o && typeof o.gain === 'number') ? Object.assign({}, o, { level: o.gain }) : o);
  }
  var sceneGen = 0;
  var sceneTimers = [];
  var staleSuppressed = 0;

  function later(ms, fn) {
    var g = sceneGen;
    var id = setTimeout(function () {
      var i = sceneTimers.indexOf(id);
      if (i >= 0) sceneTimers.splice(i, 1);
      if (g !== sceneGen) { staleSuppressed++; return; }
      fn();
    }, ms);
    sceneTimers.push(id);
    return id;
  }

  /** Drop everything the outgoing scene was still waiting on. */
  function dropTimers() {
    sceneGen++;
    sceneTimers.splice(0).forEach(function (id) { clearTimeout(id); });
  }

  /** A wait that belongs to a scene: resolves false once that scene is over. */
  function hold(ms) {
    var g = sceneGen;
    return new Promise(function (r) {
      setTimeout(function () { r(g === sceneGen); }, ms);
    });
  }
  function reduced() { return !!(global.Juice && Juice.reducedMotion); }

  function mount(container) {
    svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('class', 'stage');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;user-select:none';
    container.appendChild(svg);
    svg.addEventListener('pointerdown', function (e) {
      if (!holdOn) return;
      var through = st.tapThrough;
      for (var t = e.target; through && t && t !== svg; t = t.parentNode) if (through.indexOf(t) >= 0) return;
      e.stopPropagation(); e.preventDefault();
    }, true);
    svg.addEventListener('pointerdown', function () { pressed = true; });
    var lift = function () { pressed = false; };
    (container.ownerDocument && container.ownerDocument.defaultView || global).addEventListener('pointerup', lift);
    (container.ownerDocument && container.ownerDocument.defaultView || global).addEventListener('pointercancel', lift);
    ['bg', 'panel', 'poly', 'ui', 'fx'].forEach(function (n) {
      layers[n] = mk('g', { 'class': 'layer-' + n }, svg);
    });
    layers.fx.setAttribute('pointer-events', 'none');
    drawVista();
    armPress();

    // A backgrounded tab should not be paying for snow it cannot show.
    if (document.addEventListener) {
      document.addEventListener('visibilitychange', function () { ambientPlay(!document.hidden); });
    }
    return api;
  }

  var HORIZON = 405;          // where the painted snowfield begins, in viewBox units

  var LOG = { src: 'assets/bg/stone-snowy.webp?v=16b51c48', x: 38, w: 320, iw: 720, ih: 250, foot: 249, crest: 0, at: 0.5, ground: 520 };
  LOG.h = LOG.w * LOG.ih / LOG.iw;
  LOG.y = LOG.ground - LOG.h * (LOG.foot / LOG.ih);
  var LOG_SINK = 22;
  function perchPoint() { return { x: LOG.x + LOG.w * LOG.at, y: LOG.y + LOG.h * (LOG.crest / LOG.ih) + LOG_SINK }; }
  var perchLog = null;
  var SNOW = 12, GUST = 16, GLINTS = 4;   // (the gust is the snow wipe's own flurry, paused until it is needed)
  var ambient = [];           // running WAAPI animations, so they can be stopped
  var snowAnims = [];         // just the snowfall, so a gust can speed it up
  var gustAnims = [], gustG = null, gusting = false;

  function drawVista() {
    clear('bg');
    var d = mk('defs', {}, layers.bg);
    d.innerHTML =
      '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fb3f6"/><stop offset=".55" stop-color="#a8dcfb"/><stop offset="1" stop-color="#eef8ff"/></linearGradient>' +
      '<linearGradient id="bleed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#40b7fd"/><stop offset="1" stop-color="#acd8fd"/></linearGradient>' +
      '<linearGradient id="snowlit" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="vignette" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#0a2a4a" stop-opacity="0"/><stop offset="1" stop-color="#0a2a4a" stop-opacity=".16"/></radialGradient>' +
      // the panel: a slab of ice, lit from above
      '<linearGradient id="panelFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".93"/><stop offset=".55" stop-color="#f2fbff" stop-opacity=".88"/><stop offset="1" stop-color="#d9eefb" stop-opacity=".9"/></linearGradient>' +
      '<linearGradient id="panelSheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".85"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>' +
      '<filter id="logSoft" x="-8%" y="-8%" width="116%" height="116%"><feGaussianBlur stdDeviation="0"/></filter>' +
      // the soft halo behind the compare card in focus (focus())
      '<filter id="cardGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>';

    perchLog = mk('g', { 'class': 'perch-log', 'pointer-events': 'none' }, layers.bg);
    perchLog.style.opacity = '0';
    var li = mk('image', { x: LOG.x, y: LOG.y.toFixed(1), width: LOG.w, height: LOG.h.toFixed(1),
                           preserveAspectRatio: 'xMidYMid meet' }, perchLog);
    li.setAttributeNS('http://www.w3.org/1999/xlink', 'href', pic(LOG.src));
    li.setAttribute('href', pic(LOG.src));
    ambientLife();
  }

  function keep(a) { if (a && a.cancel) ambient.push(a); return a; }

  function loopAnim(el, frames, opts) {
    if (reduced() || !el.animate) return null;
    try { return keep(el.animate(frames, Object.assign({ iterations: Infinity }, opts))); }
    catch (e) { return null; }
  }

  function ambientLife() {
    var g = mk('g', { 'class': 'weather', 'pointer-events': 'none' }, layers.bg);
    var i;

    // --- sun glow, breathing slowly -------------------------------------
    var sun = mk('circle', { cx: 500, cy: 120, r: 230, fill: 'url(#sun)' }, g);
    loopAnim(sun, [{ opacity: 0.45 }, { opacity: 0.8 }, { opacity: 0.45 }],
             { duration: 9000, easing: 'ease-in-out' });

    snowAnims = seedSnow(g, SNOW, 3.2, 8.4, 1);

    gustG = mk('g', { 'class': 'gust' }, g);
    gustG.style.opacity = '0';
    gustG.style.transition = 'opacity 240ms linear';
    gustAnims = seedSnow(gustG, GUST, 5.5, 13, 0.5);
    gustAnims.forEach(function (a) { try { a.pause(); } catch (e) {} });

    // --- glints on the ice ----------------------------------------------
    for (i = 0; i < GLINTS; i++) {
      var gx = 40 + Math.random() * (W - 80);
      var gy = HORIZON + 20 + Math.random() * (H - HORIZON - 30);
      var s = 3 + Math.random() * 4;
      var star = mk('path', {
        d: 'M0 ' + -s + ' Q' + (s * 0.22) + ' ' + (-s * 0.22) + ' ' + s + ' 0 Q' + (s * 0.22) + ' ' + (s * 0.22) + ' 0 ' + s +
           ' Q' + (-s * 0.22) + ' ' + (s * 0.22) + ' ' + -s + ' 0 Q' + (-s * 0.22) + ' ' + (-s * 0.22) + ' 0 ' + -s + ' Z',
        fill: '#ffffff', opacity: 0,
        transform: 'translate(' + gx.toFixed(0) + ',' + gy.toFixed(0) + ')'
      }, g);
      loopAnim(star, [
        { opacity: 0, transform: 'scale(.4)' },
        { opacity: 0, transform: 'scale(.4)', offset: 0.76 },
        { opacity: 0.95, transform: 'scale(1.25)', offset: 0.85 },
        { opacity: 0, transform: 'scale(.4)' }
      ], { duration: 4200 + Math.random() * 3800, delay: -Math.random() * 6000, easing: 'ease-in-out' });
      star.style.transformBox = 'fill-box'; star.style.transformOrigin = 'center';
    }

    // --- one slow band of light across the snow --------------------------
    var band = mk('rect', { x: -400, y: HORIZON, width: 300, height: H - HORIZON, fill: 'url(#snowlit)', opacity: 0.5 }, g);
    loopAnim(band, [
      { transform: 'translateX(0) skewX(-14deg)' },
      { transform: 'translateX(' + (W + 800) + 'px) skewX(-14deg)' }
    ], { duration: 17000, easing: 'ease-in-out' });
  }

  function seedSnow(parent, count, rMin, rMax, slow) {
    var out = [], i;
    for (i = 0; i < count; i++) {
      var r = rMin + Math.random() * (rMax - rMin);
      var build = r < 5 ? 2 : (r < 7.5 ? 1 : 0);
      var x = Math.random() * W;
      var dur = (7000 + Math.random() * 9000) * slow;
      var sway = 14 + Math.random() * 34;
      var spin = (Math.random() < 0.5 ? -1 : 1) * (140 + Math.random() * 340);

      var f = mk('path', {
        'class': 'flake',
        d: Snowflake.path(r, build),
        fill: 'none', stroke: '#ffffff',
        'stroke-width': (r * 0.14 + 0.34).toFixed(2),
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        opacity: (0.3 + Math.random() * 0.5).toFixed(2)
      }, parent);
      f.style.transformBox = 'fill-box';
      f.style.transformOrigin = 'center';

      var a = loopAnim(f, [
        { transform: 'translate(' + x.toFixed(0) + 'px,-28px) rotate(0deg)' },
        { transform: 'translate(' + (x + sway).toFixed(0) + 'px,' + (H * 0.3).toFixed(0) + 'px) rotate(' + (spin * 0.3).toFixed(0) + 'deg)', offset: 0.3 },
        { transform: 'translate(' + (x - sway * 0.6).toFixed(0) + 'px,' + (H * 0.7).toFixed(0) + 'px) rotate(' + (spin * 0.7).toFixed(0) + 'deg)', offset: 0.7 },
        { transform: 'translate(' + (x + sway * 0.3).toFixed(0) + 'px,' + (H + 34) + 'px) rotate(' + spin.toFixed(0) + 'deg)' }
      ], { duration: dur, delay: -Math.random() * dur, easing: 'linear' });
      if (a) out.push(a);
    }
    return out;
  }

  function flurry(on) {
    gusting = !!on;
    if (!gustG) return;
    gustG.style.opacity = on ? '1' : '0';
    gustAnims.forEach(function (a) { try { on ? a.play() : a.pause(); } catch (e) {} });
    snowAnims.forEach(function (a) { try { a.playbackRate = on ? 3.4 : 1; } catch (e) {} });
  }

  function ambientPlay(on) {
    ambient.forEach(function (a) {
      try { on ? a.play() : a.pause(); } catch (e) {}
    });
    if (on && !gusting) gustAnims.forEach(function (a) { try { a.pause(); } catch (e) {} });
  }

  var TOP = 120;
  var BOTTOM = H - 16;
  var CONTROL_H = 56;
  var CONTROL_GAP = 16;

  var UI = {
    radius: 18, rim: 2.5,
    paper: '#fff8ee', paperRim: '#d9bd92',        // warm, so the ice is the only blue
    title: 22
  };

  var SHAPE = { fill: '#5f97f0', edge: '#2f5fc4', edgeW: 3.5 };

  var HI = { fill: '#34b4a4', edge: '#0b4f9e', line: '#eafcff', lit: '#4be0ff', hot: '#7ff0d0',
             bad: '#b98cff', badLit: '#7a4cff', knob: '#eaf9ff', rim: '#4fb8ea',
             picked: '#34b4a4' };
  function litGlow(col) {
    return 'filter: drop-shadow(0 0 2px ' + col + ');';
  }
  function litLine(parent, attrs, o) {
    o = o || {};
    var bad = !!o.bad;
    var glowCol = bad ? 'rgba(255, 255, 255, 0.95)' : (o.warm ? '#ffb020' : HI.lit), coreCol = bad ? HI.badLit : (o.warm ? '#ffe27a' : HI.line);
    var core = mk('line', Object.assign({}, attrs, { stroke: coreCol, style: litGlow(glowCol) }), parent);
    return [core, core];
  }

  var PANELS = {
    right:  { x: 440, y: 100, w: 480, h: 440 },
    solo:   { x: 272, y: 108, w: 456, h: 430 },
    measure: { x: 100, y: 34, w: 800, h: 450, frame: 'measure' },
    center: { x: 230, y: 128, w: 540, h: 330 },
    left2:  { x: 330, y: 118, w: 290, h: 290, frame: 'compare' },
    right2: { x: 652, y: 118, w: 290, h: 290, frame: 'compare' }
  };

  function panelFor(name, spec) {
    var p = PANELS[name] || PANELS.right;
    var standsLeft = global.Swiftee && /^(left|log$)/.test(Swiftee.pos || '');
    if (p === PANELS.right && !standsLeft) {
      p = (spec && spec.room === 'measure' && global.CardFrame && CardFrame.measure) ? PANELS.measure : PANELS.solo;
    }
    var controls = spec && ((spec.choices && spec.choices.length) || spec.controls);
    if (!controls) return p;
    var floor = BOTTOM - CONTROL_H - CONTROL_GAP;
    var h = Math.min(p.h, Math.max(240, floor - TOP));
    var slack = (BOTTOM - TOP) - (h + CONTROL_GAP + CONTROL_H);
    // `controls`: the band under it is part of the scene (applySeat centres both)
    return { x: p.x, y: TOP + Math.max(0, slack / 2), w: p.w, h: h, frame: p.frame, controls: true };
  }

  /** Where a control bar sits: under the panel, and never off the foot. */
  function controlY() {
    var y = st.panel ? st.panel.y + st.panel.h + CONTROL_GAP + CONTROL_H / 2 : BOTTOM - CONTROL_H / 2;
    return Math.min(y, BOTTOM - CONTROL_H / 2);
  }

  function panel(p, opts) {
    opts = opts || {};
    var g = mk('g', { 'class': 'panel' }, layers.panel);
    st.panelEl = g;
    g._rect = { x: p.x, y: p.y, w: p.w, h: p.h };
    var F = global.CardFrame && (CardFrame[p.frame || 'panel'] || CardFrame.panel);

    if (F) {
      var img = mk('image', {
        x: p.x, y: p.y, width: p.w, height: p.h,
        preserveAspectRatio: 'none', 'pointer-events': 'none'
      }, g);
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', pic(F.src));
      img.setAttribute('href', pic(F.src));
    } else {
      // No frame table: a plain slab rather than no lesson.
      mk('rect', { x: p.x, y: p.y + 7, width: p.w, height: p.h, rx: 34,
                   fill: '#7cb6dc', opacity: 0.38, 'pointer-events': 'none' }, g);
      mk('rect', { x: p.x, y: p.y, width: p.w, height: p.h, rx: 34,
                   fill: 'url(#panelFace)', stroke: '#a3d4ef', 'stroke-width': 3 }, g);
    }

    if (opts.enter !== false) enter(g, opts.enter === 'rise' ? 'rise' : 'fade');
    return g;
  }

  var made = {};
  function rememberMade(cond, verts, moved) {
    if (!cond || !verts || verts.length < 3) return;
    made[cond + '-' + verts.length] = { verts: verts.map(function (p) { return { x: p.x, y: p.y }; }), moved: moved };
  }
  function madeShape(cond, n) {
    var m = made[cond + '-' + n];
    return m ? { verts: m.verts.map(function (p) { return { x: p.x, y: p.y }; }), moved: m.moved } : null;
  }

  var heldForWord = [];
  function wordKey(w) { return String(w == null ? '' : w).toLowerCase().replace(/[^a-z0-9]+/g, ''); }
  // `onShow` runs as the thing appears (a name tag's chime, the card it replaces)
  function holdForWord(el, words, onShow) {
    if (!el || !el.style || reduced()) return false;
    var list = (Array.isArray(words) ? words : [words]).map(wordKey).filter(Boolean);
    if (!list.length) return false;
    el.style.opacity = '0';
    el._held = true;                       // (dimTag leaves it hidden, and remembers — see there)
    el._heldEvents = el.style.pointerEvents || '';
    el.style.pointerEvents = 'none';
    heldForWord.push({ words: list, el: el, onShow: onShow || null });
    return true;
  }
  function onWord(words, run) {
    var list = (Array.isArray(words) ? words : [words]).map(wordKey).filter(Boolean);
    if (!list.length || typeof run !== 'function') return false;
    var h = { words: list, run: run };
    heldForWord.push(h);
    return h;
  }
  function showHeld(h, delay) {
    if (h.run) { try { h.run(); } catch (e) {} return; }
    var el = h.el;
    if (!el || !el.parentNode) return;
    var go = function () {
      if (!el.parentNode) return;
      el._held = false;
      el.style.opacity = '';
      el.style.pointerEvents = el._heldEvents || '';
      // arriving under a card that has stepped back, it arrives stepped back with it
      if (el._dimLater) { var d = el._dimLater; el._dimLater = null; dimTag(el, d.dim, d.soft); }
      enter(el, 'ui');
      if (h.onShow) { try { h.onShow(el); } catch (e) {} }
    };
    if (delay) later(delay, go); else go();
  }
  /** A word of the line has just appeared in the bubble. */
  function said(word) {
    if (!heldForWord.length) return 0;
    var w = wordKey(word);
    if (!w) return 0;
    var still = [], shown = 0;
    heldForWord.forEach(function (h) {
      if (h.words.indexOf(w) >= 0) { h.seen = (h.seen || 0) + 1; if (!h.nth || h.seen >= h.nth) { showHeld(h); shown++; } else still.push(h); }
      else still.push(h);
    });
    heldForWord = still;
    return shown;
  }
  /** The line is over, or the child is about to act: show whatever is left. */
  function releaseHeld() {
    var all = heldForWord; heldForWord = [];
    all.forEach(function (h, i) { showHeld(h, h.run ? 0 : i * 90); });
    return all.length;
  }
  function dropWord(h) { heldForWord = heldForWord.filter(function (x) { return x !== h; }); }

  var ENTER_MS = 380;
  function enter(el, kind) {
    if (reduced() || !el.animate) return;
    var k = kind === 'rise'
      ? [{ translate: '0 12px', opacity: 0 }, { translate: '0 0', opacity: 1 }]
      : kind === 'ui'
      ? [{ scale: '.94', translate: '0 8px', opacity: 0 }, { scale: '1.02', translate: '0 0', opacity: 1, offset: .7 }, { scale: '1', translate: '0 0', opacity: 1 }]
      : kind === 'intro'
      ? [{ scale: '.9', translate: '0 22px', opacity: 0 }, { scale: '1.012', translate: '0 -2px', opacity: 1, offset: .72 }, { scale: '1', translate: '0 0', opacity: 1 }]
      : kind === 'fade'
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ scale: '.94', translate: '0 8px', opacity: 0 }, { scale: '1', translate: '0 0', opacity: 1 }];
    el.style.transformBox = 'fill-box'; el.style.transformOrigin = 'center';
    el.animate(k, { duration: kind === 'intro' ? INTRO_MS : ENTER_MS, easing: 'cubic-bezier(.22,1,.36,1)' });
  }
  var INTRO_MS = 620;

  function panelFace(p) {
    var F = global.CardFrame && (CardFrame[p.frame || 'panel'] || CardFrame.panel);
    var q = F && F.pane;
    if (!q) return p;
    return { x: p.x + p.w * q.x, y: p.y + p.h * q.y, w: p.w * q.w, h: p.h * q.h };
  }

  function polygonIn(p, n, opts) {
    opts = opts || {};

    var face = panelFace(p);
    var mx = Math.max(face.w * 0.05, 22), mt = Math.max(face.h * 0.06, 22);
    var mb = opts.below ? Math.max(face.h * 0.13, 76) : Math.max(face.h * 0.06, 22);
    if (opts.room === 'measure') { mx = Math.max(face.w * 0.045, 32); mt = Math.max(face.h * 0.04, 30); mb = Math.max(mb, face.h * 0.07, 32); }
    if (opts.room === 'labels') { mx = Math.max(face.w * 0.07, 17); mt = Math.max(face.h * 0.07, 17); mb = mt; }
    var box = { x: face.x + mx, y: face.y + mt, w: face.w - mx * 2, h: face.h - mt - mb };
    if (opts.room === 'measure') { var stepR = Math.min(56, box.w * 0.08); box.x += stepR; box.w -= stepR; }

    var u = opts.shape && opts.shape.length >= 3 ? opts.shape.map(function (q) { return { x: q.x, y: q.y }; })
          : Poly.regular(n, 1, 0, 0);
    if (opts.dent != null) u = Poly.pullInward(u, opts.dent, 0.92);
    if (opts.stretch != null) u[opts.stretch] = { x: u[opts.stretch].x, y: u[opts.stretch].y - 0.55 };

    var lo = { x: Infinity, y: Infinity }, hi = { x: -Infinity, y: -Infinity };
    u.forEach(function (q) {
      if (q.x < lo.x) lo.x = q.x;
      if (q.x > hi.x) hi.x = q.x;
      if (q.y < lo.y) lo.y = q.y;
      if (q.y > hi.y) hi.y = q.y;
    });

    var fill = opts.fill == null ? 0.96 : opts.fill;
    var ext = { x: Math.max(hi.x - lo.x, 0.5), y: Math.max(hi.y - lo.y, 1.24) };
    var k = Math.min((box.w - VERT_PAINT * 2) / ext.x,
                     (box.h - VERT_PAINT * 2) / ext.y) * fill;

    var cx = box.x + box.w / 2 - (lo.x + hi.x) / 2 * k;
    var cy = box.y + box.h / 2 - (lo.y + hi.y) / 2 * k + (opts.dy || 0);

    var v = u.map(function (q) { return { x: cx + q.x * k, y: cy + q.y * k }; });
    return { verts: v, cx: cx, cy: cy, r: k };
  }

  function drawIn(dg, pair, a, b, delay, each) {
    var lines = pair.filter(function (x, i, all) { return x && all.indexOf(x) === i; });
    var dur = Math.max(500, Math.min(1000, (each || 1150) - 250));
    var tip = mk('circle', { cx: a.x, cy: a.y, r: 5.5, fill: '#ffffff', 'fill-opacity': 0.95, 'pointer-events': 'none' }, dg);
    if (tip.style) tip.style.filter = 'drop-shadow(0 0 5px rgba(170, 240, 255, .95))';
    tip.setAttribute('opacity', 0);
    lines.forEach(function (ln) { ln.setAttribute('x2', a.x); ln.setAttribute('y2', a.y); ln.setAttribute('opacity', 0); ln.__drawing = true; });
    var t0 = null;
    var frame = global.requestAnimationFrame || function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
    var ease = function (k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; };
    var step = function (now) {
      if (!dg.parentNode) return;                      // redrawn or torn down: stop
      if (t0 == null) t0 = now;
      var el = now - t0 - delay;
      if (el < 0) { frame(step); return; }
      var k = Math.min(1, el / dur), e = ease(k);
      var x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
      lines.forEach(function (ln) { ln.setAttribute('opacity', 1); ln.setAttribute('x2', x); ln.setAttribute('y2', y); });
      tip.setAttribute('cx', x); tip.setAttribute('cy', y);
      tip.setAttribute('opacity', k < 0.9 ? 1 : Math.max(0, (1 - k) * 10));
      if (k < 1) frame(step);
      else { lines.forEach(function (ln) { ln.setAttribute('x2', b.x); ln.setAttribute('y2', b.y); ln.__drawing = false; }); tip.remove(); }
    };
    frame(step);
  }

  /** (Re)draw the main polygon from st.verts. Called on every change. */
  function renderPoly() {
    var g = st.polyG;
    if (!g) return;
    while (g.firstChild) g.removeChild(g.firstChild);
    var v = st.verts, n = v.length;

    st.fill = mk('path', { d: pathOf(v), fill: 'url(#' + candy(SHAPE.fill) + ')', stroke: SHAPE.edge, 'stroke-width': SHAPE.edgeW, 'stroke-linejoin': 'round' }, g);

    st.diagG = mk('g', { 'pointer-events': 'none' }, g);
    (st.diagonals || []).forEach(function (d, k) {
      var a = v[d[0]], b = v[d[1]];
      var outside = !Poly.isDiagonalInside(v, d[0], d[1]);
      var hl = st.highlightOutside && outside;
      var dg = mk('g', {}, st.diagG);
      if (st.onlyOutside && !outside) dg.style.display = 'none';
      var pair = litLine(dg, {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        'stroke-width': hl ? 3.2 : (d.solid ? 2.6 : 2), 'stroke-linecap': 'round',
        'stroke-dasharray': d.solid ? null : '14 12'
      }, { bad: hl });
      var line = pair[1];
      if (d.animate && !reduced()) {
        d.animate = false;
        drawIn(dg, pair, a, b, d.delay || 0, d.each);
      }
    });

    if (st.ghost) {
      var ga = v[st.ghost.from], gb = v[st.ghost.to];
      var gg = mk('g', { 'class': 'ghost-demo', 'pointer-events': 'none' }, g);
      var glen = Math.hypot(gb.x - ga.x, gb.y - ga.y) || 1;
      var trailPair = litLine(gg, { x1: ga.x, y1: ga.y, x2: gb.x, y2: gb.y, 'stroke-width': 2.6, 'stroke-linecap': 'round' });
      var trail = trailPair[1]; trailPair[0].setAttribute('opacity', .3); trail.setAttribute('opacity', .55);
      if (reduced() || !trail.animate) {
        // no motion: the trail alone, dashed, so the hint is still there
        trail.setAttribute('stroke-dasharray', '14 12');
      } else {
        trail.style.strokeDasharray = glen + ' ' + glen;
        trail.animate([
          { strokeDashoffset: glen + 'px', opacity: 0.45, offset: 0 },
          { strokeDashoffset: '0px', opacity: 0.45, offset: 0.62, easing: 'cubic-bezier(.3,.7,.3,1)' },
          { strokeDashoffset: '0px', opacity: 0.45, offset: 0.78 },
          { strokeDashoffset: '0px', opacity: 0, offset: 1 }
        ], { duration: 3400, iterations: Infinity });
      }
    }

    if (st.segment) {
      var sa = v[st.segment[0]], sb = v[st.segment[1]];
      var segEl = mk('line', { x1: sa.x, y1: sa.y, x2: sb.x, y2: sb.y, stroke: SHAPE.edge, 'stroke-width': SHAPE.edgeW,
                               'stroke-linecap': 'round', 'pointer-events': 'none', 'class': 'segment' }, g);
      st.segGlow = segEl; st.segLine = segEl;
    }

    // edges as tap targets (invisible, wide)
    st.edgeEls = [];
    for (var i = 0; i < n; i++) {
      var e1 = v[i], e2 = v[(i + 1) % n];
      var edge = mk('line', { x1: e1.x, y1: e1.y, x2: e2.x, y2: e2.y, stroke: 'transparent', 'stroke-width': 46, 'stroke-linecap': 'round', 'class': 'edge', 'data-i': i }, g);
      st.edgeEls.push(edge);
    }

    st.sideDotEls = [];
    (st.sideTodo || []).forEach(function (si, order) {
      var p1 = v[si], p2 = v[(si + 1) % n];
      if (!p1 || !p2) return;
      var todo = mk('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: '#fff4c9', 'stroke-width': 7,
                              'stroke-linecap': 'round', 'class': 'side-todo', 'data-i': si, 'pointer-events': 'none' }, g);
      todo.style.animationDelay = (order * 0.22).toFixed(2) + 's';
      st.sideDotEls[si] = todo;
    });

    // measurements and arcs live in a sub-group so drags can refresh them
    st.measG = mk('g', { 'class': 'measurements' }, g);
    if (st.measure) drawMeasurements(st.measG);

    st.vertEls = []; st.knobEls = [];
    var touch = !!st.touchVerts;
    for (var j = 0; j < n; j++) {
      var col = st.vcolor && st.vcolor[j] ? st.vcolor[j] : null;
      var shown = !!(col || st.showVerts);
      var vs = st.vstate ? st.vstate[j] : null;
      var spent = vs === 'side-used-disabled' || vs === 'inactive' || vs === 'diagonal-used';
      var knob = mk('circle', {
        cx: v[j].x, cy: v[j].y,
        r: col ? 10 : (touch ? 9 : 6),
        fill: col || (touch ? '#ffffff' : SHAPE.edge),
        stroke: col ? '#ffffff' : (touch ? '#0b3f7a' : 'none'),
        'stroke-width': col ? 3 : (touch ? 3 : 2),
        'class': 'knob' + (!spent && ((st.breathe && !col && touch) || (st.breatheAt && st.breatheAt[j])) ? ' breathe' : '') + (spent && !col ? ' spent' : ''), 'data-i': j,
        opacity: shown ? (spent && !col ? 0.4 : 1) : 0,
        'pointer-events': 'none'
      }, g);
      if (vs) knob.setAttribute('data-state', vs);
      var c = mk('circle', {
        cx: v[j].x, cy: v[j].y, r: 18,
        fill: '#000', 'fill-opacity': 0, stroke: 'none',
        'class': 'vertex', 'data-i': j
      }, g);
      c.style.pointerEvents = touch && (vs ? vs === 'anchor' : true) ? 'all' : 'none';
      if (vs) c.setAttribute('data-state', vs);
      if (st.breathe && !col && touch) knob.style.animationDelay = (j * 0.22).toFixed(2) + 's';   // one after another, round the shape
      st.knobEls.push(knob);
      st.vertEls.push(c);
    }
  }

  function updatePoly() {
    var v = st.verts, n = v.length, i;
    if (st.fill) st.fill.setAttribute('d', pathOf(v));
    if (st.diagG) {
      var groups = st.diagG.childNodes;
      for (i = 0; i < groups.length && i < (st.diagonals || []).length; i++) {
        var d = st.diagonals[i], a = v[d[0]], b = v[d[1]], G = groups[i];
        var out = !Poly.isDiagonalInside(v, d[0], d[1]);
        var hl = st.highlightOutside && out;
        var kids = [].filter.call(G.childNodes, function (el) { return el.tagName === 'line'; }), w = hl ? 3.2 : (d.solid ? 2.6 : 2);
        for (var q = 0; q < kids.length; q++) {
          var L = kids[q], isGlow = kids.length > 1 && q === 0;
          L.setAttribute('x1', a.x); L.setAttribute('y1', a.y); L.setAttribute('x2', b.x); L.setAttribute('y2', b.y);
          // (the outside one as litLine draws it: deep violet with a white halo — see there)
          L.setAttribute('stroke', isGlow ? (hl ? HI.badLit : HI.lit) : (hl ? HI.badLit : HI.line));
          if (!isGlow) L.style.filter = 'drop-shadow(0 0 2px ' + (hl ? 'rgba(255, 255, 255, 0.95)' : HI.lit) + ')';
          L.setAttribute('stroke-width', isGlow ? w + 7 : w);
          L.style.strokeDasharray = d.solid ? '' : '14 12'; L.style.strokeDashoffset = 0;
        }
        G.style.display = (st.onlyOutside && !out) ? 'none' : '';
      }
    }
    if (st.segLine && st.segment) {
      var sa = v[st.segment[0]], sb = v[st.segment[1]];
      [st.segGlow, st.segLine].forEach(function (ln) { if (!ln) return; ln.setAttribute('x1', sa.x); ln.setAttribute('y1', sa.y); ln.setAttribute('x2', sb.x); ln.setAttribute('y2', sb.y); });
    }
    for (i = 0; i < n && st.edgeEls; i++) { var e1 = v[i], e2 = v[(i + 1) % n], E = st.edgeEls[i]; if (!E) continue; E.setAttribute('x1', e1.x); E.setAttribute('y1', e1.y); E.setAttribute('x2', e2.x); E.setAttribute('y2', e2.y); }
    for (i = 0; i < n && st.vertEls; i++) {
      var C = st.vertEls[i]; if (C) { C.setAttribute('cx', v[i].x); C.setAttribute('cy', v[i].y); }
      var K = st.knobEls && st.knobEls[i]; if (K) { K.setAttribute('cx', v[i].x); K.setAttribute('cy', v[i].y); }
    }
    if (st.measG) { while (st.measG.firstChild) st.measG.removeChild(st.measG.firstChild); if (st.measure) drawMeasurements(st.measG); }
  }

  function walkOrder() {
    var V = st.verts || [], n = V.length, shoe = 0, out = [];
    for (var i = 0; i < n; i++) { var P1 = V[i], P2 = V[(i + 1) % n]; shoe += P1.x * P2.y - P2.x * P1.y; }
    if (shoe >= 0) for (var k = 0; k < n; k++) out.push({ side: k, start: k, end: (k + 1) % n });
    else for (var q = n - 1; q >= 0; q--) out.push({ side: q, start: (q + 1) % n, end: q });
    return out;
  }
  function measureSide(index, done, opts) {
    opts = opts || {};
    var first = opts.first !== false, last = opts.last !== false;
    var frames = global.MeasuringFrames;
    if (reduced() || !frames || !global.requestAnimationFrame) { done(); return; }
    var a = st.verts[index], b = st.verts[(index + 1) % st.verts.length];
    var shoe = 0, VV = st.verts;
    for (var si = 0; si < VV.length; si++) { var P1 = VV[si], P2 = VV[(si + 1) % VV.length]; shoe += P1.x * P2.y - P2.x * P1.y; }
    if (shoe < 0) { var swap = a; a = b; b = swap; }
    var dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
    if (length < 1) { done(); return; }
    var angle = Math.atan2(dy, dx) * 180 / Math.PI;
    var center = Poly.centroid(st.verts), nx = -dy / length, ny = dx / length;
    if (nx * ((a.x + b.x) / 2 - center.x) + ny * ((a.y + b.y) / 2 - center.y) < 0) { nx = -nx; ny = -ny; }
    var cell = 56, baseline = cell * frames.baseline / frames.cell;
    var sc = cell / frames.cell, TAPE_Y = 158, TAPE_HEAD = 86;
    var TAPE_OUT = 3 + (frames.baseline - TAPE_Y) * sc;
    var TAPE_TRAIL = (128 - TAPE_HEAD) * sc - 4 * sc;
    var ON_LINE = 3;
    var g = mk('g', { 'class': 'swiftee-measuring', 'pointer-events': 'none', 'aria-hidden': 'true', 'data-side': index }, layers.fx);
    g.style.opacity = '0';   // nothing at the side until he has flown there
    var tapeG = mk('g', { transform: 'translate(' + (a.x + nx * TAPE_OUT) + ',' + (a.y + ny * TAPE_OUT) + ') rotate(' + angle + ')' }, g);
    var tape = mk('rect', { x: 0, y: -3.5, width: 0, height: 7, rx: 1.5, fill: '#ffe278', stroke: '#875b13', 'stroke-width': 1.2 }, tapeG);
    var ticks = mk('g', {}, tapeG), marks = [];
    for (var x = 0; x <= length; x += 6) {
      marks.push(mk('line', { x1: x, x2: x, y1: -3.5, y2: x % 30 === 0 ? 2.5 : -0.5,
        stroke: '#65491f', 'stroke-width': 1, visibility: 'hidden' }, ticks));
    }
    mk('path', { d: 'M0,-6 L0,6 L4,6', fill: 'none', stroke: '#586c7c', 'stroke-width': 3 }, tapeG);   // the hook, at the start
    var walker = mk('g', { 'class': 'measuring-walker' }, g);
    var crop = mk('svg', { x: -cell / 2, y: -baseline, width: cell, height: cell,
      viewBox: '0 0 ' + frames.cell + ' ' + frames.cell, overflow: 'hidden' }, walker);
    var sheet = mk('image', { href: pic(frames.image), width: frames.cols * frames.cell, height: frames.rows * frames.cell }, crop);
    var companion = global.Swiftee && Swiftee.el;
    var opacity = opts.homeOpacity != null ? opts.homeOpacity : (companion && companion.style.opacity);
    if (opts.angle) tapeG.style.display = 'none';           // to a corner: no tape is laid
    var raf = null, started = null, stopped = false;
    var duration = Math.max(1600, Math.min(2600, length * 10));   // a walk the child can watch

    var M = svg.getScreenCTM && svg.getScreenCTM();
    var page = function (x, y) { return M ? { x: M.a * x + M.e, y: M.d * (y + seatY) + M.f } : null; };
    var flies = !!(companion && companion.animate && global.Swiftee.bounds && parseFloat(opacity || '0') > 0.05 && M);

    var owns = !!(global.Swiftee && Swiftee.lock);
    if (owns) Swiftee.lock('measuring');
    var released = false;
    var release = function () {
      if (released) return; released = true;
      var at = cleanup.indexOf(release); if (at >= 0) cleanup.splice(at, 1);
      if (owns && Swiftee.unlock) Swiftee.unlock('measuring');
    };
    cleanup.push(release);   // a screen change mid-walk lets go of him too
    var finished = done;
    // (a walk that goes on to the next side keeps its hold on him; the last lets go)
    done = function () { if (last) release(); finished(); };
    var here = null, hb = flies && Swiftee.bounds();
    if (hb && hb.width) here = { x: (hb.left + hb.right) / 2, y: hb.bottom }; else flies = false;
    var startAt = page(a.x + nx * ON_LINE, a.y + ny * ON_LINE);
    var endAt = page(b.x + nx * ON_LINE, b.y + ny * ON_LINE);
    function fly(fromD, toD, fadeIn) {
      return new Promise(function (res) {
        var an;
        try {
          an = companion.animate([
            { translate: fromD.x.toFixed(0) + 'px ' + fromD.y.toFixed(0) + 'px', opacity: fadeIn ? 0 : 1 },
            { translate: toD.x.toFixed(0) + 'px ' + toD.y.toFixed(0) + 'px', opacity: fadeIn ? 1 : 0 }
          ], { duration: 640, easing: 'cubic-bezier(.3,.7,.3,1)', composite: 'add', fill: 'none' });
        } catch (e) { res(); return; }
        an.finished.then(res, res);
      });
    }

    function stop(restore) {
      if (stopped) return;
      stopped = true;
      if (raf !== null) global.cancelAnimationFrame(raf);
      g.remove();
      if (companion && restore !== false) companion.style.opacity = opacity;
      var at = cleanup.indexOf(stopper); if (at >= 0) cleanup.splice(at, 1);
    }
    var stopper = function () { stop(true); };
    cleanup.push(stopper);
    function finish() {
      if (stopped) return;
      if (!last) { stop(false); done(); return; }
      stop(true);
      if (flies && endAt) {
        fly({ x: endAt.x - here.x, y: endAt.y - here.y }, { x: 0, y: 0 }, true).then(done);
      } else done();
    }
    function tick(time) {
      if (stopped) return;
      if (started === null) started = time;
      var elapsed = time - started, progress = Math.min(1, elapsed / duration), distance = length * progress;
      var drawn = Math.max(0, distance - TAPE_TRAIL);   // the strip ends under the housing in his hand
      tape.setAttribute('width', drawn);
      marks.forEach(function (mark, i) { mark.setAttribute('visibility', i * 6 <= drawn ? 'visible' : 'hidden'); });
      var px = a.x + dx * progress, py = a.y + dy * progress;
      var wx = px + nx * ON_LINE, wy = py + ny * ON_LINE;
      var rot = Math.atan2(nx, -ny) * 180 / Math.PI;
      var rr = rot * Math.PI / 180, rx = Math.cos(rr), ry = Math.sin(rr);   // the sprite's "right", in stage space
      var faceLeft = (dx * rx + dy * ry) < 0;
      walker.setAttribute('transform', 'translate(' + wx + ',' + wy + ') rotate(' + rot.toFixed(2) + ')' + (faceLeft ? ' scale(-1,1)' : ''));
      var frame = frames.order[Math.floor(Math.min(elapsed, duration) * frames.fps / 1000) % frames.order.length];
      sheet.setAttribute('x', -(frame % frames.cols) * frames.cell);
      sheet.setAttribute('y', -Math.floor(frame / frames.cols) * frames.cell);
      walker.setAttribute('data-frame', frame);
      if (elapsed < duration + 180) raf = global.requestAnimationFrame(tick);
      else finish();
    }
    var begin = function () {
      if (stopped) return;
      g.style.opacity = '1';
      if (companion) companion.style.opacity = '0';
      raf = global.requestAnimationFrame(tick);
    };
    if (first && flies && startAt) fly({ x: 0, y: 0 }, { x: startAt.x - here.x, y: startAt.y - here.y }, false).then(begin);
    else begin();
  }

  function angleMeasurer() {
    var frames = global.AngleMeasuringFrames;
    if (reduced() || !frames || !global.requestAnimationFrame) return null;
    var companion = global.Swiftee && Swiftee.el, opacity = companion && companion.style.opacity;
    var g = mk('g', { 'class': 'swiftee-angle-measuring', 'pointer-events': 'none', 'aria-hidden': 'true' }, layers.fx);
    var instrument = mk('g', { 'class': 'angle-protractor' }, g);
    var scale = frames.scale, cell = frames.cell, anchor = frames.anchor;
    var bird = mk('g', { 'class': 'angle-performer' }, instrument);
    var sprite = mk('svg', { x: -anchor.x * scale, y: -anchor.y * scale,
      width: cell * scale, height: cell * scale, viewBox: '0 0 ' + cell + ' ' + cell,
      overflow: 'hidden' }, bird);
    var sheet = mk('image', { href: pic(frames.image), width: frames.cols * cell, height: frames.rows * cell }, sprite);
    var activeFrame = frames.carry;
    function norm(angle) { return ((angle % 360) + 540) % 360 - 180; }
    function bodyOffset(frame, rotation) {
      var local = frames.poses[frame].bodyOffset, a = (rotation - frames.poses[frame].angle) * Math.PI / 180;
      return { x: (Math.cos(a)*local.x-Math.sin(a)*local.y)*scale,
               y: (Math.sin(a)*local.x+Math.cos(a)*local.y)*scale };
    }
    function selectPose(frame, rotation) {
      var old = bodyOffset(activeFrame, pose.rotation), next = bodyOffset(frame, rotation);
      pose.x += old.x-next.x; pose.y += old.y-next.y;
      activeFrame = frame; pose.rotation = rotation;
    }
    // The real interior arc stays legible over the translucent tool face.
    var highlight = mk('g', { 'class': 'active-angle' }, g);
    var pose, raf, stopped = false, first = true;
    function home() {
      var bounds = companion && global.Swiftee.bounds && Swiftee.bounds();
      var matrix = g.getScreenCTM && g.getScreenCTM();
      if (bounds && matrix) {
        var point = svg.createSVGPoint();
        point.x = (bounds.left + bounds.right) / 2; point.y = bounds.bottom - bounds.height / 2;
        point = point.matrixTransform(matrix.inverse());
        return { x: point.x + 42, y: point.y + 8 };
      }
      return { x: st.verts[0].x - 35, y: st.verts[0].y + 55 };
    }
    pose = Object.assign({ rotation: frames.poses[activeFrame].angle }, home());
    if (global.Swiftee && Swiftee.lock) Swiftee.lock('angle-measuring');
    g.style.opacity = '0';
    function stop() {
      if (stopped) return;
      stopped = true; global.cancelAnimationFrame(raf); g.remove();
      if (companion) companion.style.opacity = opacity;
      if (global.Swiftee && Swiftee.unlock) Swiftee.unlock('angle-measuring');
    }
    cleanup.push(stop);
    function paint() {
      instrument.setAttribute('transform', 'translate(' + pose.x + ',' + pose.y + ') rotate(' + pose.rotation + ')');
      bird.setAttribute('transform', 'rotate(' + (-frames.poses[activeFrame].angle) + ')');
      sheet.setAttribute('x', -(activeFrame % frames.cols) * cell);
      sheet.setAttribute('y', -Math.floor(activeFrame / frames.cols) * cell);
      instrument.setAttribute('data-frame', activeFrame);
    }
    paint();
    function tween(state, phase, target, duration, done, progress, lift) {
      if (stopped) return;
      g.setAttribute('data-state', state);

      var start = null, from = Object.assign({}, pose);
      if (target.rotation != null) target.rotation = from.rotation + ((target.rotation - from.rotation + 540) % 360 + 360) % 360 - 180;
      function tick(time) {
        if (stopped) return;
        if (start === null) start = time;
        var t = Math.min(1, (time - start) / duration), ease = t * t * (3 - 2 * t);
        Object.keys(target).forEach(function (key) { pose[key] = from[key] + (target[key] - from[key]) * ease; });
        if (lift) pose.y -= Math.sin(Math.PI * t) * lift;
        paint();
        if (progress) progress(ease);
        if (t < 1) raf = global.requestAnimationFrame(tick); else done();
      }
      raf = global.requestAnimationFrame(tick);
    }
    return function (index, last, done) {
      var v = st.verts, p = v[index], prev = v[(index + v.length - 1) % v.length], next = v[(index + 1) % v.length];
      var a = Math.atan2(prev.y - p.y, prev.x - p.x), b = Math.atan2(next.y - p.y, next.x - p.x);
      var sweep = ((b - a) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      if (!Poly.contains(v, { x: p.x + Math.cos(a + sweep / 2) * 2, y: p.y + Math.sin(a + sweep / 2) * 2 })) sweep -= 2 * Math.PI;
      var base = sweep < 0 ? a : b, rotation = base * 180 / Math.PI;
      var chosen=0, error=Infinity;
      frames.poses.forEach(function (drawing,i) {
        var delta=Math.abs(norm(rotation-drawing.angle));
        if(delta<error){error=delta;chosen=i;}
      });
      var other = (base === a ? b : a) * 180 / Math.PI + 180, best = null;
      [rotation, other].forEach(function (rot) {
        frames.poses.forEach(function (drawing, i) {
          var delta = Math.abs(norm(rot - drawing.angle));
          if (delta > 30) return;
          var ang = (rot - drawing.angle) * Math.PI / 180, bo = drawing.bodyOffset;
          var body = { x: p.x + (Math.cos(ang) * bo.x - Math.sin(ang) * bo.y) * scale, y: p.y + (Math.sin(ang) * bo.x + Math.cos(ang) * bo.y) * scale };
          var outside = !Poly.contains(v, body);
          var score = (outside ? 0 : 1000) + delta;
          if (!best || score < best.score) best = { score: score, rot: rot, frame: i };
        });
      });
      if (best && best.score < 1000) { rotation = norm(best.rot); chosen = best.frame; }
      selectPose(chosen, rotation-5);
      var outward = a + sweep / 2 + Math.PI;
      var carry = { x: p.x + Math.cos(outward) * 16, y: p.y + Math.sin(outward) * 16 };
      var approach = first; first = false;
      g.setAttribute('data-angle', index); highlight.replaceChildren();
      var flight = Object.assign({ rotation: rotation - 5 }, carry);
      tween('MOVE_TO_VERTEX', 'carry', flight, approach ? 750 : 600, function () {
        tween('POSITION_PROTRACTOR', 'position', { x: p.x, y: p.y }, 400, function () {
          tween('ALIGN', 'align', { rotation: rotation }, 420, function () {
            drawArc(highlight, index, null, 1);
            var wedge = highlight.querySelector('path[fill-opacity]');
            if (wedge) wedge.setAttribute('fill-opacity', '0.16');
            highlight.style.opacity = '0';
            tween('MEASURE', 'align', {}, 300, function () {
              tween('HOLD', 'hold', {}, 900, function () {
                tween('LIFT', 'lift', carry, 350, function () {
                  highlight.replaceChildren();
                  if (!last) { done(); return; }
                  selectPose(frames.carry, frames.poses[frames.carry].angle);
                  tween('RETURN', 'carry', Object.assign({ rotation: frames.poses[frames.carry].angle }, home()), 800, function () {
                    tween('COMPLETE', 'carry', {}, 250, function () { stop(); done(); }, function (t) {
                      g.style.opacity = 1 - t;
                      if (companion) companion.style.opacity = String(t * Number(opacity || 1));
                    });
                  }, null, 10);
                });
              });
            }, function (t) { highlight.style.opacity = t; });
          });
        });
      }, function (t) {
        if (!approach) return;
        var visible = Math.min(1, t * 4); g.style.opacity = visible;
        if (companion) companion.style.opacity = String((1 - visible) * Number(opacity || 1));
      }, 10);
    };
  }

  function compareReadings(c, what, g, items) {
    var v = c.verts, n = v.length, cen = Poly.centroid(v), ink = '#0f3f8f';
    var ref = st.compare.left && st.compare.left.verts ? Poly.sideLengths(st.compare.left.verts) : Poly.sideLengths(v);
    var UNIT = (ref.reduce(function (a, b) { return a + b; }, 0) / ref.length) / 3 || 30;
    if (!c.space) c.space = labelSpace(v, (function () { var f = panelFace(c.panel); return { cx: f.x + f.w / 2, cy: f.y + f.h / 2, w: f.w, h: f.h }; })(), 13);
    if (what === 'sides') {
      var L = Poly.sideLengths(v), idx = v.map(function (_, i) { return i; });
      var sd = decimalsFor(L, marksBy(L, idx, 6).mark, UNIT, 2);
      for (var si = 0; si < n; si++) {
        var sa = v[si], sb = v[(si + 1) % n], slen = Math.hypot(sb.x - sa.x, sb.y - sa.y) || 1;
        var stx = (sb.x - sa.x) / slen, sty = (sb.y - sa.y) / slen, smx = (sa.x + sb.x) / 2, smy = (sa.y + sb.y) / 2;
        var snx = -sty, sny = stx;
        if (snx * (smx - cen.x) + sny * (smy - cen.y) < 0) { snx = -snx; sny = -sny; }
        var t = (L[si] / UNIT).toFixed(sd);
        if (/\.0+$/.test(t)) t = t.replace(/\.0+$/, '');
        var text = t + ' cm', tw = text.length * 8 + 4, th = 16;
        var base = 8 + Math.abs(snx) * tw / 2 + Math.abs(sny) * th / 2, cands = [];
        [0, 0.18, -0.18, 0.32, -0.32].forEach(function (along) {
          [base, base + 6].forEach(function (off) { cands.push({ x: smx + stx * slen * along + snx * off, y: smy + sty * slen * along + sny * off }); });
        });
        cands.push({ x: smx - snx * base, y: smy - sny * base });
        var at = c.space.fit(cands, tw, th) || cands[0];
        var lg = mk('g', { 'class': 'ev-length', 'data-side': si }, g);
        mk('text', { x: at.x, y: at.y + 5, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800,
                     fill: ink, stroke: '#ffffff', 'stroke-width': 3.2, 'paint-order': 'stroke', 'stroke-linejoin': 'round', text: text }, lg);
        items.push(lg);
      }
    } else if (what === 'angles') {
      var A2 = Poly.interiorAngles(v);
      for (var j = 0; j < n; j++) {
        var p = v[j], q = v[(j + n - 1) % n], r2 = v[(j + 1) % n];
        var a1 = Math.atan2(q.y - p.y, q.x - p.x), a2 = Math.atan2(r2.y - p.y, r2.x - p.x);
        var sweep = ((a2 - a1) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), large = sweep > Math.PI ? 1 : 0, mid = a1 + sweep / 2;
        var inside = Poly.contains(v, { x: p.x + Math.cos(mid) * 6, y: p.y + Math.sin(mid) * 6 }), rr = 14;
        var x1 = p.x + Math.cos(a1) * rr, y1 = p.y + Math.sin(a1) * rr, x2 = p.x + Math.cos(a2) * rr, y2 = p.y + Math.sin(a2) * rr;
        var arcD = 'A' + rr + ' ' + rr + ' 0 ' + (inside ? large : (1 - large)) + ' ' + (inside ? 1 : 0) + ' ' + x2 + ' ' + y2;
        var ag = mk('g', { 'class': 'ev-angle', 'data-angle': j }, g);
        mk('path', { d: 'M' + p.x + ' ' + p.y + ' L' + x1 + ' ' + y1 + ' ' + arcD + ' Z', fill: '#ffffff', 'fill-opacity': 0.5,
                     stroke: ink, 'stroke-opacity': 0.9, 'stroke-width': 2, 'stroke-linejoin': 'round' }, ag);
        var bxl = cen.x - p.x, byl = cen.y - p.y, dt = { x: p.x + bxl * 0.3, y: p.y + byl * 0.3 };
        var pull = Math.hypot(dt.x - p.x, dt.y - p.y);
        if (pull < rr + 15) { var kk = (rr + 15) / (pull || 1); dt = { x: p.x + (dt.x - p.x) * kk, y: p.y + (dt.y - p.y) * kk }; }
        var dtext = Math.round(A2[j]) + '°', dw = dtext.length * 8 + 6, dc = [dt];
        [0.24, 0.36, 0.42, 0.18, 0.5].forEach(function (f) { dc.push({ x: p.x + bxl * f, y: p.y + byl * f }); });
        var da = c.space.fit(dc, dw, 15) || dt;
        mk('text', { x: da.x, y: da.y + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800,
                     fill: '#ffffff', stroke: ink, 'stroke-width': 3, 'paint-order': 'stroke', 'stroke-linejoin': 'round', text: dtext }, ag);
        items.push(ag);
      }
    }
  }
  function compareEvidence(side, what) {
    var c = st.compare && st.compare[side];
    if (!c || !c.pg || !c.verts) return;
    var v = c.verts, n = v.length, idx = v.map(function (_, i) { return i; }), items = [];
    var g = c.evidence && c.evidence.parentNode ? c.evidence : (c.evidence = mk('g', { 'class': 'compare-evidence', 'pointer-events': 'none' }, c.pg));
    if (c.measured) compareReadings(c, what, g, items);
    else if (what === 'sides') {
      var L = Poly.sideLengths(v), sm = marksBy(L, idx, 15), same = sm.groups === 1;
      for (var i = 0; i < n; i++) {
        var a = v[i], b = v[(i + 1) % n], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        var sl = Math.hypot(b.x - a.x, b.y - a.y) || 1, tdx = (b.x - a.x) / sl, tdy = (b.y - a.y) / sl, tnx = -tdy, tny = tdx;
        var cnt = sm.mark[i] || 1, tg = mk('g', { 'class': 'ev-tick', 'data-side': i }, g);
        for (var k = 0; k < cnt; k++) {
          var o = (k - (cnt - 1) / 2) * 7, cx = mx + tdx * o, cy = my + tdy * o;
          litLine(tg, { x1: cx - tnx * 9, y1: cy - tny * 9, x2: cx + tnx * 9, y2: cy + tny * 9, 'stroke-width': 3, 'stroke-linecap': 'round' }, same ? { warm: true } : { bad: true });
        }
        items.push(tg);
      }
    } else if (what === 'angles') {
      var A = Poly.interiorAngles(v), am = marksBy(A, idx, 3), eq = am.groups === 1;
      for (var j = 0; j < n; j++) {
        var p = v[j], q = v[(j + n - 1) % n], s2 = v[(j + 1) % n];
        var a1 = Math.atan2(q.y - p.y, q.x - p.x), a2 = Math.atan2(s2.y - p.y, s2.x - p.x);
        var sweep = ((a2 - a1) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), mid = a1 + sweep / 2;
        var inside = Poly.contains(v, { x: p.x + Math.cos(mid) * 10, y: p.y + Math.sin(mid) * 10 }), large = sweep > Math.PI ? 1 : 0;
        var ag = mk('g', { 'class': 'ev-arc', 'data-angle': j }, g), rings = am.mark[j] || 1;
        for (var r0 = 0; r0 < rings; r0++) {
          var r = 20 + r0 * 6;
          var x1 = p.x + Math.cos(a1) * r, y1 = p.y + Math.sin(a1) * r, x2 = p.x + Math.cos(a2) * r, y2 = p.y + Math.sin(a2) * r;
          var d = inside ? 'M' + x1 + ' ' + y1 + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2
                         : 'M' + x1 + ' ' + y1 + ' A' + r + ' ' + r + ' 0 ' + (1 - large) + ' 0 ' + x2 + ' ' + y2;
          mk('path', { d: d, fill: 'none', stroke: eq ? '#ffe27a' : HI.badLit, 'stroke-width': 3, 'stroke-linecap': 'round',
                       style: litGlow(eq ? '#ffb020' : 'rgba(255, 255, 255, 0.95)') }, ag);
        }
        items.push(ag);
      }
    }
    items.forEach(function (it, i) {
      if (reduced()) return;
      it.style.opacity = 0;
      later(i * 110, function () {
        it.style.opacity = '';
        if (it.animate) { try { it.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' }); } catch (x) {} }
      });
    });
    sfx('tick', { gain: 0.5 });
  }

  function marksBy(vals, idxs, q) {
    var groups = {}, order = [];
    idxs.forEach(function (i) {
      var key = String(Math.round(vals[i] / q));
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(i);
    });
    order.sort(function (a, b) { return groups[b].length - groups[a].length || (+a) - (+b); });
    var mark = {};
    order.forEach(function (k, n) { groups[k].forEach(function (i) { mark[i] = Math.min(4, n + 1); }); });
    return { mark: mark, groups: order.length };
  }

  function decimalsFor(vals, marks, unit, cap) {
    for (var d = 0; d <= cap; d++) {
      var ok = true;
      for (var i = 0; i < vals.length && ok; i++) {
        for (var j = i + 1; j < vals.length; j++) {
          if (marks[i] === marks[j]) continue;           // the shape says these two match
          if ((vals[i] / unit).toFixed(d) === (vals[j] / unit).toFixed(d)) { ok = false; break; }
        }
      }
      if (ok) return d;
    }
    return cap;
  }

  function drawMeasurements(g) {
    var v = st.verts, n = v.length, L = Poly.sideLengths(v), A = Poly.interiorAngles(v);
    var c = Poly.centroid(v);
    var has = function (set, i) { return !!set && (set === 'all' || set.indexOf(i) >= 0); };
    var listOf = function (set) { var o = []; for (var k = 0; k < n; k++) if (has(set, k)) o.push(k); return o; };
    var sides = listOf(st.measure.sides), angles = listOf(st.measure.angles);
    var sMark = marksBy(L, sides, 15), aMark = marksBy(A, angles, 3);   // half a centimetre, three degrees
    var measuringAngles = !!st.measure.angles;
    var units = !!st.measure.units;
    var sideText  = units || (!measuringAngles && sMark.groups <= 1);
    var sideTicks = !units && sides.length === n;
    var angleText = units || aMark.groups <= 1;
    var cmU = st.cmUnit || 30;
    var sideDec = units ? decimalsFor(L, sMark.mark, cmU, 2) : 0;
    var cmText = function (len) { var t = (len / cmU).toFixed(sideDec); if (/\.0+$/.test(t)) t = t.replace(/\.0+$/, ''); return t + ' cm'; };

    for (var i = 0; i < n; i++) {
      if (has(st.measure.sides, i)) {
        var a = v[i], b = v[(i + 1) % n];
        var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        var dx = mx - c.x, dy = my - c.y, len = Math.hypot(dx, dy) || 1;
        var ux = dx / len, uy = dy / len;
        var sl0 = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx0 = (b.y - a.y) / sl0, ny0 = -(b.x - a.x) / sl0;
        if (Poly.contains(v, { x: mx + nx0 * 3, y: my + ny0 * 3 })) { nx0 = -nx0; ny0 = -ny0; }
        if (!Poly.contains(v, { x: mx + nx0 * 3, y: my + ny0 * 3 })) { ux = nx0; uy = ny0; }
        var t = mk('g', { 'class': 'meas', 'data-side': i }, g);
        if (sideText) {
          var dink = HI.edge || '#0b4f9e';
          var dtext = cmText(L[i]);
          var dtw = dtext.length * 9.5, dth = 17;
          var doff = 16 + Math.abs(ux) * (dtw / 2) + Math.abs(uy) * (dth / 2);
          var lx2 = mx + ux * doff, ly2 = my + uy * doff;
          if (st.panel) {
            var gf2 = panelFace(st.panel);
            lx2 = Math.max(gf2.x + dtw / 2 + 6, Math.min(gf2.x + gf2.w - dtw / 2 - 6, lx2));
            ly2 = Math.max(gf2.y + dth + 4, Math.min(gf2.y + gf2.h - 6, ly2));
          }
          mk('text', { x: lx2, y: ly2 + 6, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800,
                       fill: dink, stroke: '#ffffff', 'stroke-width': 3.5, 'paint-order': 'stroke',
                       'stroke-linejoin': 'round', 'class': 'meas-num', 'data-ux': ux.toFixed(4), 'data-uy': uy.toFixed(4),
                       text: dtext }, t);
        }
        if (sideTicks) {
          // the ticks sit across the side at its middle, spaced along it
          var sl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          var tdx = (b.x - a.x) / sl, tdy = (b.y - a.y) / sl;
          var tnx = -tdy, tny = tdx, TL = 9, TS = 7, cnt = sMark.mark[i] || 1;
          var tg = mk('g', { 'class': 'eq-tick', 'data-side': i }, t);
          for (var k = 0; k < cnt; k++) {
            var o = (k - (cnt - 1) / 2) * TS, cx2 = mx + tdx * o, cy2 = my + tdy * o;
            litLine(tg, { x1: cx2 - tnx * TL, y1: cy2 - tny * TL, x2: cx2 + tnx * TL, y2: cy2 + tny * TL, 'stroke-width': 3, 'stroke-linecap': 'round' }, { warm: true });
          }
        }
      }
      // a live readout names each corner by its number, so no rings on top
      if (has(st.measure.angles, i)) drawArc(g, i, angleText ? A[i] : null, units ? 1 : (aMark.groups > 1 ? (aMark.mark[i] || 1) : 1));
      else if (st.angleTodo) drawArc(g, i, null, 1, true);
    }
    untangle(g);
  }
  function untangle(g) {
    var els = [].slice.call(g.querySelectorAll('text.meas-num'));
    if (els.length < 2) return;
    var face = st.panel ? panelFace(st.panel) : null;
    var boxOf = function (el) {
      var w = el.textContent.length * 9.5 + 4, x = +el.getAttribute('x'), y = +el.getAttribute('y') - 6;
      return { l: x - w / 2, r: x + w / 2, t: y - 11, b: y + 11 };
    };
    var push = function (el, k) { move(el, (+el.getAttribute('data-ux') || 0) * k, (+el.getAttribute('data-uy') || 0) * k); };
    var move = function (el, dx, dy) {
      var x = +el.getAttribute('x') + dx, y = +el.getAttribute('y') + dy;
      if (face) {
        var hw = el.textContent.length * 4.75 + 6;
        x = Math.max(face.x + hw, Math.min(face.x + face.w - hw, x));
        y = Math.max(face.y + 22, Math.min(face.y + face.h - 6, y));
      }
      el.setAttribute('x', x.toFixed(1)); el.setAttribute('y', y.toFixed(1));
    };
    for (var pass = 0; pass < 14; pass++) {
      var moved = false;
      for (var i = 0; i < els.length; i++) for (var j = i + 1; j < els.length; j++) {
        var A = boxOf(els[i]), B = boxOf(els[j]);
        if (A.r <= B.l || B.r <= A.l || A.b <= B.t || B.b <= A.t) continue;
        var ai = /°/.test(els[i].textContent), aj = /°/.test(els[j].textContent);
        if (ai && !aj) push(els[i], 6);
        else if (aj && !ai) push(els[j], 6);
        else {
          var sx = (B.l + B.r - A.l - A.r) / 2, sy = (B.t + B.b - A.t - A.b) / 2, sn = Math.hypot(sx, sy);
          if (sn < 0.5) { sx = 0; sy = 1; sn = 1; }
          move(els[i], -sx / sn * 4, -sy / sn * 4); move(els[j], sx / sn * 4, sy / sn * 4);
        }
        moved = true;
      }
      if (!moved) break;
    }
  }
  /** Hold a point inside the card's glass, with room for a vertex knob. */
  function clampToCard(p) {
    if (!st.panel) return p;
    var f = panelFace(st.panel), m = 20;
    return { x: Math.max(f.x + m, Math.min(f.x + f.w - m, p.x)),
             y: Math.max(f.y + m, Math.min(f.y + f.h - m, p.y)) };
  }

  // `todo`: the angle not measured yet — its wedge in outline, no number
  function drawArc(g, i, deg, rings, todo) {
    var ag = mk('g', { 'data-angle': i }, g);   // the arc and its number, one thing to pop in
    var v = st.verts, n = v.length, p = v[i], q = v[(i + n - 1) % n], s = v[(i + 1) % n];
    var a1 = Math.atan2(q.y - p.y, q.x - p.x), a2 = Math.atan2(s.y - p.y, s.x - p.x), r = 21;
    var sweep = ((a2 - a1) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    var large = sweep > Math.PI ? 1 : 0;
    var x1 = p.x + Math.cos(a1) * r, y1 = p.y + Math.sin(a1) * r, x2 = p.x + Math.cos(a2) * r, y2 = p.y + Math.sin(a2) * r;
    var mid = a1 + sweep / 2;
    var inside = Poly.contains(v, { x: p.x + Math.cos(mid) * 10, y: p.y + Math.sin(mid) * 10 });
    var d = inside
      ? 'M' + x1 + ' ' + y1 + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2
      : 'M' + x1 + ' ' + y1 + ' A' + r + ' ' + r + ' 0 ' + (1 - large) + ' 0 ' + x2 + ' ' + y2;
    var wedge = 'M' + p.x + ' ' + p.y + ' L' + x1 + ' ' + y1 + ' ' + d.slice(d.indexOf('A')) + ' Z';
    if (deg != null && Math.abs(deg - 90) < 0.5) {
      // the right-angle square: two short lines meeting inside the corner
      var rs = r * 0.7, ux = Math.cos(a1) * rs, uy = Math.sin(a1) * rs, wx = Math.cos(a2) * rs, wy = Math.sin(a2) * rs;
      d = 'M' + (p.x + ux) + ' ' + (p.y + uy) + ' L' + (p.x + ux + wx) + ' ' + (p.y + uy + wy) + ' L' + (p.x + wx) + ' ' + (p.y + wy);
      wedge = 'M' + p.x + ' ' + p.y + ' L' + (p.x + ux) + ' ' + (p.y + uy) + ' L' + (p.x + ux + wx) + ' ' + (p.y + uy + wy) + ' L' + (p.x + wx) + ' ' + (p.y + wy) + ' Z';
    }
    if (todo) {
      ag.setAttribute('class', 'angle-todo');
      ag.removeAttribute('data-angle'); ag.setAttribute('data-todo', i);
      mk('path', { d: wedge, fill: '#ffd35a', 'fill-opacity': 0.16, stroke: '#ffd35a', 'stroke-width': 2.5,
                     'stroke-dasharray': '4 3.5', 'stroke-linejoin': 'round', 'pointer-events': 'none' }, ag);
      return ag;
    }
    // warm gold on the cool blue shape: the one mark on it that is an angle
    mk('path', { d: wedge, fill: '#ffd35a', 'fill-opacity': 0.82, stroke: 'none' }, ag);
    var w = mk('path', { d: d, fill: 'none', stroke: '#fff4c9', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, ag);
    for (var ri = 1; ri < (rings || 1) && deg == null; ri++) {
      var rr = r - ri * 7; if (rr < 8) break;
      var qx1 = p.x + Math.cos(a1) * rr, qy1 = p.y + Math.sin(a1) * rr, qx2 = p.x + Math.cos(a2) * rr, qy2 = p.y + Math.sin(a2) * rr;
      var dd = inside
        ? 'M' + qx1 + ' ' + qy1 + ' A' + rr + ' ' + rr + ' 0 ' + large + ' 1 ' + qx2 + ' ' + qy2
        : 'M' + qx1 + ' ' + qy1 + ' A' + rr + ' ' + rr + ' 0 ' + (1 - large) + ' 0 ' + qx2 + ' ' + qy2;
      mk('path', { d: dd, fill: 'none', stroke: HI.line, 'stroke-width': 3, 'stroke-linecap': 'round', style: litGlow(HI.lit) }, ag);
    }
    if (deg != null) {
      var cc = Poly.centroid(v), bx = cc.x - p.x, by = cc.y - p.y, bl = Math.hypot(bx, by) || 1;
      if (sweep > Math.PI === inside) { var ia = inside ? mid : mid + Math.PI; bx = Math.cos(ia); by = Math.sin(ia); bl = 1; }
      var tx = p.x + bx / bl * (r + 24), ty = p.y + by / bl * (r + 24);
      mk('text', { x: tx, y: ty + 6, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, fill: '#f2fdff',
                   stroke: '#123a7a', 'stroke-width': 3.5, 'paint-order': 'stroke', 'stroke-linejoin': 'round',
                   'class': 'meas-num', 'data-ux': (bx / bl).toFixed(4), 'data-uy': (by / bl).toFixed(4),
                   text: Math.round(deg) + '°' }, ag);
    }
    return w;
  }

  function shapeVerts(name, r, cx, cy) {
    switch (name) {
      case 'triangle':  return Poly.regular(3, r, cx, cy + r * 0.15);
      case 'square':    return Poly.regular(4, r, cx, cy);
      case 'pentagon':  return Poly.regular(5, r, cx, cy);
      case 'hexagon':   return Poly.regular(6, r, cx, cy);
      case 'octagon':   return Poly.regular(8, r, cx, cy);
      case 'rhombus':   return [{ x: cx, y: cy - r * 0.6 }, { x: cx + r, y: cy }, { x: cx, y: cy + r * 0.6 }, { x: cx - r, y: cy }];
      case 'chevron':   return [{ x: cx - r, y: cy + r * .7 }, { x: cx, y: cy - r * .8 }, { x: cx + r, y: cy + r * .7 }, { x: cx, y: cy + r * .1 }];
      case 'l-shape':   return [{ x: cx - r * .8, y: cy - r * .8 }, { x: cx - r * .1, y: cy - r * .8 }, { x: cx - r * .1, y: cy + r * .1 }, { x: cx + r * .8, y: cy + r * .1 }, { x: cx + r * .8, y: cy + r * .8 }, { x: cx - r * .8, y: cy + r * .8 }];
      case 'rectangle': return [{ x: cx - r, y: cy - r * 0.5 }, { x: cx + r, y: cy - r * 0.5 }, { x: cx + r, y: cy + r * 0.5 }, { x: cx - r, y: cy + r * 0.5 }];
      case 'star': { var o = []; for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .42 : r; o.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr }); } return o; }
      case 'stretched-hexagon': { var h = Poly.regular(6, r, cx, cy), s = Math.sqrt((16 / 9 - 0.25) / 0.75); return h.map(function (p) { return { x: cx + (p.x - cx) * s, y: p.y }; }); }
      default: return Poly.regular(5, r, cx, cy);
    }
  }
  var COLORS = { triangle: '#a97bff', square: '#2fd6c8', pentagon: '#ff7a91', hexagon: '#45bdff', octagon: '#4c8fe8',
                 rhombus: '#f06cff', chevron: '#35b06a', 'l-shape': '#ffc93c', star: '#ff9f5a', 'stretched-hexagon': '#6f8cff',
                 rectangle: '#ff9f5a' };

  function drawShape(name, r, cx, cy, parent) {
    var g = mk('g', { 'class': 'shape', 'data-shape': name }, parent);
    var col = COLORS[name] || '#5b95ee';
    if (name === 'circle') { mk('circle', { cx: cx, cy: cy, r: r * .85, fill: '#ffb27a', stroke: '#c9611a', 'stroke-width': 4 }, g); return g; }
    if (name === 'open-path') { mk('path', { d: 'M' + (cx - r) + ' ' + (cy + r * .7) + ' L' + (cx - r * .5) + ' ' + (cy - r * .6) + ' L' + (cx + r * .5) + ' ' + (cy - r * .6) + ' L' + (cx + r) + ' ' + (cy + r * .7), fill: 'none', stroke: '#a23bd6', 'stroke-width': 5, 'stroke-linecap': 'round' }, g); return g; }
    var v = shapeVerts(name, r, cx, cy);
    mk('path', { d: pathOf(v), fill: 'url(#' + candy(col) + ')', stroke: shade(col, -0.42), 'stroke-width': 3, 'stroke-linejoin': 'round' }, g);
    g._verts = v;
    return g;
  }

  function compareLine(c, d, full) {
    if (d.el) { if (full) finishLine(c, d); return d.el; }
    var a = c.verts[d.a], b = c.verts[d.b];
    var el = litLine(c.dg, { x1: a.x, y1: a.y, x2: full ? b.x : a.x, y2: full ? b.y : a.y,
                             'stroke-width': d.out ? 3.4 : 2.2, 'stroke-dasharray': '10 9', 'stroke-linecap': 'round' }, { bad: d.out })[0];
    el.setAttribute('class', d.out ? 'diag diag-out' : 'diag diag-in');
    d.el = el; d.state = full ? 'drawn' : 'growing';
    return el;
  }
  function finishLine(c, d) {
    var b = c.verts[d.b];
    if (d.el) { d.el.setAttribute('x2', b.x); d.el.setAttribute('y2', b.y); d.el.setAttribute('opacity', 1); }
    if (d.tip) { d.tip.remove(); d.tip = null; }
    d.state = 'drawn';
    var done = d.done; d.done = null; d.wait = null;
    if (done) done();
  }
  function growDiag(c, d, ms, delay) {
    if (d.state === 'drawn') return Promise.resolve();
    if (d.state === 'growing' && d.wait) return d.wait;
    var el = compareLine(c, d, false);
    var a = c.verts[d.a], b = c.verts[d.b];
    d.wait = new Promise(function (resolve) {
      d.done = resolve;
      if (reduced() || !global.requestAnimationFrame) { finishLine(c, d); return; }
      el.setAttribute('opacity', 0);
      var tip = mk('circle', { cx: a.x, cy: a.y, r: 5.5, fill: '#ffffff', 'fill-opacity': 0.95, 'pointer-events': 'none', opacity: 0 }, c.dg);
      if (tip.style) tip.style.filter = 'drop-shadow(0 0 5px ' + (d.out ? 'rgba(160, 120, 255, .95)' : 'rgba(170, 240, 255, .95)') + ')';
      d.tip = tip;
      var gen = sceneGen, t0 = null;
      var ease = function (k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; };
      var step = function (now) {
        if (d.state !== 'growing') return;                       // finished another way
        if (gen !== sceneGen || !el.parentNode) { var r = d.done; d.done = null; if (r) r(); return; }
        if (t0 == null) t0 = now;
        var t = now - t0 - (delay || 0);
        if (t < 0) { requestAnimationFrame(step); return; }
        var k = Math.min(1, t / ms), e = ease(k);
        var x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
        el.setAttribute('opacity', 1); el.setAttribute('x2', x.toFixed(1)); el.setAttribute('y2', y.toFixed(1));
        tip.setAttribute('cx', x.toFixed(1)); tip.setAttribute('cy', y.toFixed(1));
        tip.setAttribute('opacity', k < 0.9 ? 1 : Math.max(0, (1 - k) * 10));
        if (k < 1) requestAnimationFrame(step); else finishLine(c, d);
      };
      requestAnimationFrame(step);
    });
    return d.wait;
  }
  function outsidePieces(v, i, j) {
    var a = v[i], b = v[j], n = v.length, ts = [0, 1];
    for (var k = 0; k < n; k++) {
      var p = v[k], q = v[(k + 1) % n];
      var rx = b.x - a.x, ry = b.y - a.y, sx = q.x - p.x, sy = q.y - p.y;
      var den = rx * sy - ry * sx;
      if (Math.abs(den) < 1e-9) continue;
      var t = ((p.x - a.x) * sy - (p.y - a.y) * sx) / den;
      var u = ((p.x - a.x) * ry - (p.y - a.y) * rx) / den;
      if (u >= -1e-9 && u <= 1 + 1e-9 && t > 1e-6 && t < 1 - 1e-6) ts.push(t);
    }
    ts.sort(function (x, y) { return x - y; });
    var at = function (t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
    var out = [];
    for (var m = 0; m + 1 < ts.length; m++) {
      if (ts[m + 1] - ts[m] < 1e-6) continue;
      if (Poly.contains(v, at((ts[m] + ts[m + 1]) / 2))) continue;
      var last = out[out.length - 1];
      if (last && Math.abs(last[1] - ts[m]) < 1e-6) last[1] = ts[m + 1]; else out.push([ts[m], ts[m + 1]]);
    }
    return out.map(function (r) { return [at(r[0]), at(r[1])]; });
  }
  /** A line's own glow, turned up for a moment and back. */
  function liftLines(els, bad) {
    var col = bad ? HI.badLit : HI.lit, n = 0;
    (els || []).forEach(function (el, k) {
      if (!el || !el.animate) return;
      try {
        el.animate([{ filter: 'brightness(1) drop-shadow(0 0 2px ' + col + ')' },
                    { filter: 'brightness(1.6) drop-shadow(0 0 7px ' + col + ')', offset: 0.4 },
                    { filter: 'brightness(1) drop-shadow(0 0 2px ' + col + ')' }],
                   { duration: 620, delay: k * 90, easing: 'ease-in-out' });
        n++;
      } catch (e) {}
    });
    return n;
  }
  function drawnLines(c, out) {
    return (c ? c.diags : []).filter(function (d) { return d.el && d.state === 'drawn' && (out == null || d.out === out); })
                             .map(function (d) { return d.el; });
  }
  function discoverOutside(c, list, side) {
    evt('compare:outside', { card: side });
    sfx('slideWhistle');
    if (reduced() || !layers.fx) return;
    list.forEach(function (d, n) {
      var el = d.el;
      if (el && el.animate) {
        try {
          el.animate([{ filter: 'brightness(1) drop-shadow(0 0 2px ' + HI.badLit + ')' },
                      { filter: 'brightness(1.45) drop-shadow(0 0 9px ' + HI.badLit + ')', offset: 0.35 },
                      { filter: 'brightness(1) drop-shadow(0 0 2px ' + HI.badLit + ')' }],
                     { duration: 760, iterations: 2, delay: n * 140, easing: 'ease-in-out' });
        } catch (e) {}
      }
      outsidePieces(c.verts, d.a, d.b).forEach(function (seg) {
        var g = mk('g', { 'class': 'outside-exit', 'pointer-events': 'none' }, layers.fx);
        var gone = function () { if (g.parentNode) g.remove(); };
        later(1900, gone);
        var band = mk('line', { x1: seg[0].x, y1: seg[0].y, x2: seg[1].x, y2: seg[1].y, stroke: HI.bad,
                                'stroke-width': 18, 'stroke-linecap': 'round', opacity: 0 }, g);
        if (band.animate) {
          try { band.animate([{ opacity: 0 }, { opacity: 0.42, offset: 0.3 }, { opacity: 0 }], { duration: 1400, delay: n * 140, easing: 'ease-in-out' }); } catch (e) {}
        }
        seg.forEach(function (p, k) {
          var ring = mk('circle', { cx: p.x, cy: p.y, r: 10, fill: 'none', stroke: HI.badLit, 'stroke-width': 3, opacity: 0 }, g);
          if (!ring.animate) return;
          ring.style.transformBox = 'fill-box'; ring.style.transformOrigin = 'center';
          try {
            ring.animate([{ scale: '.4', opacity: 0.95 }, { scale: '2.1', opacity: 0 }],
                         { duration: 820, delay: 180 + n * 140 + k * 120, iterations: 2, easing: 'cubic-bezier(.2,.7,.3,1)' });
          } catch (e) {}
        });
      });
    });
  }
  function compareMark(side, text) {
    var c = st.compare && st.compare[side];
    if (!c) return null;
    st.compareMarks = st.compareMarks || {};
    if (st.compareMarks[side]) st.compareMarks[side].remove();
    var out = /out/i.test(text);
    var x = c.panel.x + c.panel.w / 2, y = c.panel.y + c.panel.h + 46, h = 30;
    var g = mk('g', { 'class': 'compare-mark', 'data-mark': out ? 'outside' : 'inside', 'pointer-events': 'none' }, layers.ui);
    var t = mk('text', { x: x, y: y + 5.5, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 900, 'letter-spacing': 1.5,
                         fill: out ? '#4b2aa8' : '#0b4f9e', text: String(text).toUpperCase() }, g);
    var w = 0; try { w = t.getComputedTextLength ? t.getComputedTextLength() : 0; } catch (e) { w = 0; }
    if (!w) w = String(text).length * 11.5;
    var bw = w + 32;
    var face = mk('rect', { x: x - bw / 2, y: y - h / 2, width: bw, height: h, rx: h / 2,
                            fill: out ? '#f3ecff' : '#e9fbff', stroke: out ? HI.badLit : HI.rim, 'stroke-width': 2.5 }, g);
    g.insertBefore(face, t);
    g._rect = { x: x - bw / 2, y: y - h / 2, w: bw, h: h };
    st.compareMarks[side] = g;
    st.compareMarkSpec = st.compareMarkSpec || {};
    st.compareMarkSpec[side] = text;
    if (st.compareFocus && st.compareFocus !== side) dimTag(g, true, st.compareStyle === 'lean');
    return g;
  }
  function dropMark(side, fade) {
    var m = st.compareMarks && st.compareMarks[side];
    if (st.compareMarkSpec) delete st.compareMarkSpec[side];
    if (!m) return;
    st.compareMarks[side] = null;
    if (!fade || reduced() || !m.animate) { m.remove(); return; }
    try { m.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished.then(function () { m.remove(); }, function () { m.remove(); }); }
    catch (e) { m.remove(); }
  }
  function reset() {
    dropTimers();
    alive(false);
    endInteraction();
    clear('panel'); clear('poly'); clear('ui'); clear('fx');
    st = { showVerts: false, touchVerts: false };
    heldForWord = [];          // the old scene's pieces are gone, and so is their wait
    applySeat(false);
  }

  var LEDGE_WALK = 455, LEDGE_K = (562 - LEDGE_WALK) / (388 - 232);
  var LEDGES = [
    { src: 'assets/bg/ledge-l.webp?v=acd909af', w: 1430, h: 538, face: 1403, at: 575 },
    { src: 'assets/bg/ledge-r.webp?v=5ceca85d', w: 850, h: 538, face: 24, at: 825 }
  ];

  var BUILD = {
    vista: function () { reset(); },

    ready: function () {
      reset();
      var g = mk('g', { 'class': 'ready-ground', 'pointer-events': 'none' }, layers.panel);
      // a light wash over the painting, so he and his words stand forward of it
      mk('rect', { x: -2000, y: -1200, width: 5000, height: 3000, fill: '#f4fbff', opacity: 0.24 }, g);
      LEDGES.forEach(function (L) {
        var im = mk('image', {
          x: (L.at - L.face * LEDGE_K).toFixed(1), y: (LEDGE_WALK - 232 * LEDGE_K).toFixed(1),
          width: (L.w * LEDGE_K).toFixed(1), height: (L.h * LEDGE_K).toFixed(1),
          preserveAspectRatio: 'none'
        }, g);
        im.setAttributeNS('http://www.w3.org/1999/xlink', 'href', pic(L.src));
        im.setAttribute('href', pic(L.src));
      });
    },

    polygon: function (spec) {
      var morph = spec.enter === 'morph' && st.verts;
      var prev = morph ? st.verts.slice() : null;
      reset();
      var p = spec._panel ? Object.assign({}, spec._panel) : panelFor(spec.panel || 'right', spec);
      st.panel = p; st.kind = 'polygon'; st.buildSpec = specOf(spec);
      panel(p, { enter: morph ? false : spec.enter });
      var P = polygonIn(p, spec.sides || 5, { below: spec.below, room: spec.room });
      st.verts = P.verts; st.cx = P.cx; st.cy = P.cy; st.r = P.r; st.n = spec.sides || 5;
      st.cmUnit = spec.room === 'measure' && st.verts.length > 2 ? Poly.sideLengths(st.verts)[0] / 6 : null;
      st.polyG = mk('g', { 'class': 'polygon' }, layers.poly);
      st.diagonals = [];
      renderPoly();
      if (morph && prev) morphFrom(prev);
      else if (!reduced()) enter(st.polyG, spec.enter === 'intro' ? 'intro' : 'pop');
      if (spec.label) op.label(spec.label);
      if (spec.badge) op.badge(spec.badge);
      if (spec.diagonals) op.diagonals(spec);
    },

    'choice-grid': function (spec) {
      var opts = spec.options || [];
      if (st.kind === 'grid' && st.cards && st.cards.length === opts.length && opts.length &&
          st.cards.every(function (c, i) { return c._opt && c._opt.id === opts[i].id; })) return;
      reset(); st.kind = 'grid';
      var standsLeft = global.Swiftee && /^(left|log)$/.test(Swiftee.pos);
      var HALF = standsLeft ? 124 : 98, GAP = standsLeft ? 22 : 28, band = BOTTOM - TOP;
      var OF = global.CardFrame && CardFrame.option;
      var cardH = 2 * HALF * (OF ? OF.h / OF.w : 1);
      var PITCH_X = standsLeft ? 2 * HALF + GAP : 400;
      var gx = standsLeft ? 664 : W / 2;
      var cells;
      if (standsLeft) {
        var y0 = (H - (2 * cardH + GAP)) / 2 + cardH / 2;
        var y1 = y0 + cardH + GAP;
        cells = [[gx - PITCH_X / 2, y0], [gx + PITCH_X / 2, y0], [gx - PITCH_X / 2, y1], [gx + PITCH_X / 2, y1]];
      } else {
        cells = [
          [gx - PITCH_X / 2, TOP + band * 0.25], [gx + PITCH_X / 2, TOP + band * 0.25],
          [gx - PITCH_X / 2, TOP + band * 0.75], [gx + PITCH_X / 2, TOP + band * 0.75]
        ];
      }
      st.cards = opts.map(function (o, i) {
        var x = cells[i][0], y = cells[i][1];
        var g = mk('g', { 'class': 'card', 'data-id': o.id }, layers.ui);
        var seat = mk('g', { transform: 'translate(' + x + ',' + y + ')' }, g);
        g._card = optionCard(seat, HALF, o.shape);
        g._opt = o;
        if (spec.enter === 'stagger' && !reduced()) {
          var shape = g.querySelector('.shape');
          if (shape && shape.animate) {
            shape.style.transformBox = 'fill-box'; shape.style.transformOrigin = 'center';
            try {
              shape.animate([{ transform: 'scale(0.2)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)', opacity: 1 }],
                            { duration: 420, delay: 140 + i * 110, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' });
            } catch (e) {}
          }
        }
        return g;
      });
    },

    compare: function (spec) {
      reset(); st.kind = 'compare'; st.buildSpec = specOf(spec);
      var sides = [['left', PANELS.left2, spec.left], ['right', PANELS.right2, spec.right]];
      st.compare = {};
      sides.forEach(function (s, i) {
        var pnl = s[1], cfg = s[2] || {};
        var g = panel(pnl, { enter: spec.enter === 'split' ? 'rise' : 'pop' });
        var mine = cfg.made ? madeShape(cfg.made, cfg.sides || 5) : null;
        var room = spec.measured ? 'labels' : undefined;
        var P = polygonIn(pnl, cfg.sides || 5, mine ? { shape: mine.verts, room: room } : { dent: cfg.dent, stretch: cfg.stretch, room: room });
        var pg = mk('g', {}, layers.poly);
        mk('path', { d: pathOf(P.verts), fill: 'url(#' + candy(SHAPE.fill) + ')', stroke: SHAPE.edge, 'stroke-width': SHAPE.edgeW, 'stroke-linejoin': 'round' }, pg);
        var dg = mk('g', { 'class': 'compare-diagonals' }, pg);
        var diags = Poly.allDiagonals(P.verts.length).map(function (d) {
          return { a: d[0], b: d[1], out: !Poly.isDiagonalInside(P.verts, d[0], d[1]), el: null, state: 'hidden' };
        });
        var tagEl = cfg.caption ? nameTag(layers.ui, pnl.x + pnl.w / 2, pnl.y + pnl.h + 38, cfg.caption, cfg.tone) : null;
        if (tagEl && cfg.captionCue) holdForWord(tagEl, cfg.captionCue);
        var tab = cfg.name ? nameTag(layers.ui, pnl.x + pnl.w / 2, pnl.y + 1, cfg.name, null, { h: 32, size: 17, pad: 30, rim: 2.5 }) : null;
        if (tab) tab.setAttribute('class', 'badge name-tab');
        var ring = mk('rect', { x: pnl.x - 12, y: pnl.y - 12, width: pnl.w + 24, height: pnl.h + 24, rx: 44, fill: '#ffe08a',
                                'class': 'focus-ring', opacity: 0, 'pointer-events': 'none' }, layers.panel);
        ring.style.filter = 'url(#cardGlow)';                      // (inline: the stylesheet's drop-shadow would win over the attribute)
        layers.panel.insertBefore(ring, layers.panel.firstChild);  // behind every card
        if (tab) layers.ui.appendChild(tab);                       // over the ring, where the two meet
        st.compare[s[0]] = { panel: pnl, g: g, pg: pg, dg: dg, diags: diags, verts: P.verts, tone: cfg.tone, tag: tagEl, nameTab: tab, ring: ring, measured: !!spec.measured };
      });
    },

    'swipe-sort': function (spec) {
      reset(); st.kind = 'swipe-sort';
      st.swipe = { zones: {}, items: (spec.items || []).slice(), i: 0, spec: spec, card: null };

      var ZW = 286, ZM = 12;
      [{ id: 'regular', x: ZM },
       { id: 'irregular', x: W - ZM - ZW }].forEach(function (z) {
        var def = (spec.zones || []).filter(function (d) { return d.id === z.id; })[0] || { id: z.id, label: z.id };
        var c = CONCEPT[z.id] || CONCEPT.regular;   // (the concept's own colours: the piles' cards set them)
        var tone = [c.wash, c.face, c.ink];
        var Z0 = global.CardFrame && CardFrame[z.id];
        var ZH = Z0 ? Math.round(ZW * Z0.h / Z0.w) : 268, ZY = Math.round(SWIPE_HOME.y - ZH / 2);
        var g = mk('g', { 'class': 'zone', 'data-zone': z.id }, layers.ui);

        var Z = Z0;
        var TITLE_H = 50, titleBottom = 0;
        mk('rect', { x: z.x + 6, y: ZY + 6, width: ZW - 12, height: ZH - 12, rx: 24,
                     fill: '#000', 'fill-opacity': 0, 'class': 'zone-hit' }, g);
        if (Z) {
          var im = mk('image', {
            x: z.x, y: ZY, width: ZW, height: ZH,
            preserveAspectRatio: 'xMidYMid meet', 'pointer-events': 'none'
          }, g);
          im.setAttributeNS('http://www.w3.org/1999/xlink', 'href', pic(Z.src));
          im.setAttribute('href', pic(Z.src));
          var pane = Z.pane || { x: 0.06, y: 0.09, w: 0.88, h: 0.82 };
          var px0 = z.x + ZW * pane.x, pw = ZW * pane.w, py0 = ZY + ZH * pane.y + 10;
          mk('rect', { x: px0 + 14, y: py0, width: pw - 28, height: TITLE_H, rx: 15, fill: c.face, opacity: 0.30 }, g);
          mk('text', { x: z.x + ZW / 2, y: py0 + TITLE_H / 2 + 10.5, 'text-anchor': 'middle', 'font-size': 30,
                       'font-weight': 800, fill: c.ink, text: def.label }, g);
          titleBottom = py0 + TITLE_H + 8;
        } else {
          // No artwork: the drawn zone, so the practice still works.
          mk('rect', { x: z.x, y: ZY + 7, width: ZW, height: ZH, rx: 26, fill: tone[1], opacity: 0.35 }, g);
          mk('rect', { x: z.x, y: ZY, width: ZW, height: ZH, rx: 26, fill: tone[0], stroke: tone[1], 'stroke-width': 3 }, g);
          mk('rect', { x: z.x + 16, y: ZY + 12, width: ZW - 32, height: 52, rx: 16, fill: c.deep }, g);
          mk('text', { x: z.x + ZW / 2, y: ZY + 47, 'text-anchor': 'middle', 'font-size': 30,
                       'font-weight': 700, fill: '#fff', text: def.label }, g);
        }

        g._rect = { x: z.x, y: ZY, w: ZW, h: ZH };
        var q = Z && Z.pane;
        g._shelf = q
          ? { x: z.x + ZW * q.x, y: titleBottom, w: ZW * q.w, h: ZY + ZH * (q.y + q.h) - titleBottom - 6 }
          : { x: z.x + 26, y: ZY + 86, w: ZW - 52, h: ZH - 112 };
        g._kept = [];
        g._keptG = mk('g', { 'class': 'zone-kept' }, g);
        g._tone = tone;
        st.swipe.zones[z.id] = g;
        if (spec.enter !== false) enter(g, 'rise');
      });

      dealCard();
    },

    sort: function (spec) {
      reset(); st.kind = 'sort'; st.sort = { bins: [], items: [], placed: 0, spec: spec };
      var bins = spec.bins || [];
      var bw = 360, gap = 30, bh = 226, by = 266;
      var x0 = (W - (bins.length * bw + (bins.length - 1) * gap)) / 2;
      bins.forEach(function (b, i) {
        var x = x0 + i * (bw + gap), y = by;
        var g = mk('g', { 'class': 'bin', 'data-bin': b.id }, layers.ui);
        var c = CONCEPT[b.tone] || CONCEPT.convex;
        var tone = [c.wash, c.face, c.ink];
        var BF = global.CardFrame && CardFrame[b.tone + 'Bin'];
        var pane = { x: x + 12, y: y + 10, w: bw - 24, h: bh - 20 };
        if (BF) {
          var im = mk('image', { x: x, y: y, width: bw, height: bh, preserveAspectRatio: 'none', 'pointer-events': 'none' }, g);
          im.setAttributeNS('http://www.w3.org/1999/xlink', 'href', pic(BF.src));
          im.setAttribute('href', pic(BF.src));
          if (BF.pane) pane = { x: x + bw * BF.pane.x, y: y + bh * BF.pane.y, w: bw * BF.pane.w, h: bh * BF.pane.h };
        } else {
          mk('rect', { x: x, y: y, width: bw, height: bh, rx: UI.radius, fill: tone[0], stroke: tone[1], 'stroke-width': UI.rim }, g);
        }
        mk('rect', { x: pane.x + 10, y: pane.y + 8, width: pane.w - 20, height: 40, rx: 12, fill: tone[1], opacity: .30 }, g);
        mk('text', { x: x + bw / 2, y: pane.y + 36, 'text-anchor': 'middle', 'font-size': UI.title, 'font-weight': 800, fill: c.ink, text: b.label }, g);
        g._bin = b; g._rect = { x: x, y: y, w: bw, h: bh }; g._count = 0;
        // the shelf: the glass below the title band
        g._pane = { x: pane.x, y: pane.y + 52, w: pane.w, h: pane.h - 56 };
        st.sort.bins.push(g);
        // "...as convex or concave?": each bin comes in on its own word
        if (spec.binsCue && holdForWord(g, b.cueWord || b.id)) return;
        if (spec.enter && !reduced()) enter(g, 'rise');
      });
      var items = spec.items || [];
      var visible = items;
      st.sort.total = items.length;
      var ITEM = 92, MARGIN = 24;
      var pitch = Math.min(ITEM + 12, (W - 2 * MARGIN - ITEM) / Math.max(1, visible.length - 1));
      var span = (visible.length - 1) * pitch;
      var ix0 = (W - span) / 2;
      visible.forEach(function (name, i) {
        st.sort.items.push(makeSortItem(
          name,
          ix0 + i * pitch,
          TOP + 58,           // clear of the plank
          i
        ));
      });
    },

    summary: function (spec) {
      reset(); st.kind = 'summary';
      st.summary = { concepts: (spec.concepts || []).slice(), cards: {}, collected: [], active: null, state: 'SUMMARY_START' };
      evt('summary:state', { state: 'SUMMARY_START' });
    }
  };

  var SUM = {
    card: { cx: 500, cy: 322, w: 300 },
    shape: { cx: 500, cy: 326, r: 86 },
    mini: { w: 132, x: [[80, 224], [776, 920]], y: [200, 378], zoom: 1.12, plate: { w: 118, h: 27, size: 15.5, rim: 2 } },
    enterMs: 420, collectMs: 580
  };

  var SUMMARY_VISUALS = {
    vertex:    { draw: true, hi: [0], pulse: true, near: 0 },
    side:      { hi: [0, 1], line: [0, 1, 'side'] },
    angle:     { hi: [0], sides: [[0, 4], [0, 1]], wedge: 0 },
    diagonal:  { hi: [0, 2], line: [0, 2, 'diag'] },
    convex:    { tone: 'convex', diags: true },
    concave:   { tone: 'concave', move: [0, 0, 0.08], line: [1, 4, 'out'] },
    regular:   { tone: 'regular', marks: { all: true, degrees: false } },
    irregular: { tone: 'irregular', move: [1, 1.273, -0.568], marks: {} }
  };

  /** The card's pentagon: as it starts, or as it ends once its corner has moved. */
  function summaryVerts(id, final) {
    var S = SUM.shape, V = SUMMARY_VISUALS[id] || {};
    var v = global.Poly ? Poly.regular(5, S.r, S.cx, S.cy) : [];
    if (final && V.move && v[V.move[0]]) v[V.move[0]] = { x: S.cx + V.move[1] * S.r, y: S.cy + V.move[2] * S.r };
    return v;
  }

  function setSummary(state, id) {
    var S = st.summary;
    if (!S || S.state === state) return;
    S.state = state;
    evt('summary:state', { state: state, card: id || S.active || null });
  }

  function sumHold(ms) { return reduced() ? Promise.resolve(true) : hold(ms); }

  /** A line that grows from one end to the other, stepped on its own end point. */
  function growLine(line, a, b, ms, delay) {
    var set = function (t) { line.setAttribute('x2', (a.x + (b.x - a.x) * t).toFixed(1)); line.setAttribute('y2', (a.y + (b.y - a.y) * t).toFixed(1)); };
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    if (reduced() || !global.requestAnimationFrame) { set(1); line.setAttribute('opacity', 1); return; }
    set(0);
    later(delay || 0, function () {
      line.setAttribute('opacity', 1);
      var g = sceneGen, t0 = null;
      var step = function (now) {
        if (g !== sceneGen) return;
        if (t0 == null) t0 = now;
        var t = Math.min(1, (now - t0) / ms);
        set(1 - Math.pow(1 - t, 3));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /** A mark arrives: small, a touch past full size, settled. */
  function sumPop(el, delay, big) {
    el.setAttribute('opacity', 1);
    if (reduced() || !el.animate) return;
    el.style.transformBox = 'fill-box'; el.style.transformOrigin = 'center';
    try {
      el.animate([{ opacity: 0, scale: '.3' }, { opacity: 1, scale: big ? '1.35' : '1.2', offset: 0.6 }, { opacity: 1, scale: '1' }],
                 { duration: 320, delay: delay || 0, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'backwards' });
    } catch (e) {}
  }

  /** A corner travels, and the outline (and its knob) go with it. */
  function moveCorner(c, i, to, ms, delay, then) {
    var from = { x: c._verts[i].x, y: c._verts[i].y };
    var put = function (t) {
      var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      c._verts[i] = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
      c._outline.setAttribute('d', pathOf(c._verts));
      if (c._mover) { c._mover.setAttribute('cx', c._verts[i].x.toFixed(1)); c._mover.setAttribute('cy', c._verts[i].y.toFixed(1)); }
    };
    if (reduced() || !global.requestAnimationFrame) { put(1); if (then) then(); return; }
    later(delay || 0, function () {
      var g = sceneGen, t0 = null;
      var step = function (now) {
        if (g !== sceneGen) return;
        if (t0 == null) t0 = now;
        var t = Math.min(1, (now - t0) / ms);
        put(t);
        if (t < 1) requestAnimationFrame(step); else if (then) then();
      };
      requestAnimationFrame(step);
    });
  }

  function summaryCard(c) {
    var id = c.id, V = SUMMARY_VISUALS[id] || {};
    var F = global.CardFrame && CardFrame.panel;
    var w = SUM.card.w, h = w * (F ? F.h / F.w : 0.96);
    var x = SUM.card.cx - w / 2, y = SUM.card.cy - h / 2;
    var g = mk('g', { 'class': 'summary-card', 'data-concept': id }, layers.ui);
    g._rect = { x: x, y: y, w: w, h: h }; g._id = id;
    var pop = mk('g', { 'class': 'summary-pop' }, g);
    g._pop = pop;
    if (F) {
      var img = mk('image', { x: x, y: y, width: w, height: h, preserveAspectRatio: 'none', 'pointer-events': 'none' }, pop);
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', pic(F.src)); img.setAttribute('href', pic(F.src));
    } else {
      mk('rect', { x: x, y: y, width: w, height: h, rx: 34, fill: '#f4fbff', stroke: '#a3d4ef', 'stroke-width': 3 }, pop);
    }
    var vis = mk('g', { 'class': 'summary-visual' }, pop);
    g._vis = vis;
    var tone = V.tone && CONCEPT[V.tone];
    var v = summaryVerts(id, false);
    g._verts = v;
    g._outline = mk('path', { d: pathOf(v), fill: 'url(#' + candy(tone ? tone.face : SHAPE.fill) + ')',
                              stroke: tone ? tone.deep : SHAPE.edge, 'stroke-width': SHAPE.edgeW, 'stroke-linejoin': 'round', opacity: 0 }, vis);
    g._linesG = mk('g', {}, vis);
    if (V.near != null) {
      var n0 = V.near, nv = v.length;
      g._near = [v[(n0 + nv - 1) % nv], v[(n0 + 1) % nv]].map(function (q) {
        return mk('line', { x1: v[n0].x, y1: v[n0].y, x2: q.x, y2: q.y, stroke: 'none', opacity: 0 }, g._linesG);
      });
    }
    g._knobs = (V.hi || []).map(function (i) {
      return mk('circle', { cx: v[i].x, cy: v[i].y, r: 11, fill: HI.fill, stroke: shade(HI.fill, -0.45), 'stroke-width': 3, opacity: 0 }, vis);
    });
    if (V.move) g._mover = mk('circle', { cx: v[V.move[0]].x, cy: v[V.move[0]].y, r: 10, fill: HI.fill, stroke: shade(HI.fill, -0.45), 'stroke-width': 3, opacity: 0 }, vis);
    g._tag = nameTag(pop, SUM.card.cx, y + h + 4, c.label || id, V.tone || null);
    g._tag.setAttribute('opacity', 0);
    return g;
  }

  function summaryReveal(g) {
    var id = g._id, V = SUMMARY_VISUALS[id] || {}, v = g._verts, t = 0;
    var line = function (a, b, kind, dur, delay) {
      var el = kind === 'side'
        ? litLine(g._linesG, { x1: a.x, y1: a.y, x2: a.x, y2: a.y, 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0 }, { warm: true })[0]
        : litLine(g._linesG, { x1: a.x, y1: a.y, x2: a.x, y2: a.y, 'stroke-width': kind === 'out' ? 3 : 2.2, 'stroke-dasharray': '10 8',
                               'stroke-linecap': 'round', opacity: 0 }, { bad: kind === 'out' })[0];
      growLine(el, a, b, dur, delay);
      return el;
    };
    var out = g._outline;
    out.setAttribute('opacity', 1);
    if (V.draw && !reduced() && out.animate) {
      out.setAttribute('pathLength', 1);
      out.style.strokeDasharray = '1 1';
      try {
        out.animate([{ strokeDashoffset: 1, fillOpacity: 0 }, { strokeDashoffset: 0, fillOpacity: 0, offset: 0.55 }, { strokeDashoffset: 0, fillOpacity: 1 }],
                    { duration: 560, easing: 'ease-in-out', fill: 'backwards' });
      } catch (e) {}
      later(600, function () { out.style.strokeDasharray = ''; out.removeAttribute('pathLength'); });
      t = 480;
    } else if (!reduced() && out.animate) {
      try { out.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'backwards' }); } catch (e) {}
      t = 140;
    }
    // the corners it is about
    g._knobs.forEach(function (k, j) { sumPop(k, t + j * 120, true); });
    if (g._knobs.length) { later(reduced() ? 0 : t, function () { sfx('pop', { gain: 0.55 }); }); t += 120 * g._knobs.length + 120; }
    if (V.pulse && g._knobs[0] && !reduced()) {
      // a soft ring leaves the corner, twice: "this one"
      var k0 = g._knobs[0];
      var ring = mk('circle', { cx: k0.getAttribute('cx'), cy: k0.getAttribute('cy'), r: 12, fill: 'none', stroke: HI.fill, 'stroke-width': 3, opacity: 0 }, g._vis);
      if (ring.animate) {
        ring.style.transformBox = 'fill-box'; ring.style.transformOrigin = 'center';
        try { ring.animate([{ opacity: 0.9, scale: '1' }, { opacity: 0, scale: '2.6' }], { duration: 640, delay: t - 60, iterations: 2, easing: 'ease-out' }); } catch (e) {}
      }
    }
    if (V.line && !V.move) {
      var L = V.line;
      g._line = line(v[L[0]], v[L[1]], L[2], 380, t); g._lineKind = L[2];
      later(reduced() ? 0 : t, function () { sfx('zip', { gain: 0.6 }); });
      t += 400;
    }
    if (V.sides) {
      g._sideLines = V.sides.map(function (s) { return line(v[s[0]], v[s[1]], 'side', 300, t); });
      later(reduced() ? 0 : t, function () { sfx('zip', { gain: 0.5 }); });
      t += 320;
    }
    if (V.wedge != null) {
      var p = v[V.wedge], q = v[(V.wedge + v.length - 1) % v.length], r2 = v[(V.wedge + 1) % v.length], rr = 26;
      var a1 = Math.atan2(q.y - p.y, q.x - p.x), a2 = Math.atan2(r2.y - p.y, r2.x - p.x);
      var sw = ((a2 - a1) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), large = sw > Math.PI ? 1 : 0;
      var inside = Poly.contains(v, { x: p.x + Math.cos(a1 + sw / 2) * 8, y: p.y + Math.sin(a1 + sw / 2) * 8 });
      var flag = inside ? large : 1 - large, dir = inside ? 1 : 0;
      var arc = 'M' + (p.x + Math.cos(a1) * rr) + ' ' + (p.y + Math.sin(a1) * rr) +
                ' A' + rr + ' ' + rr + ' 0 ' + flag + ' ' + dir + ' ' + (p.x + Math.cos(a2) * rr) + ' ' + (p.y + Math.sin(a2) * rr);
      g._wedge = mk('g', { opacity: 0 }, g._linesG);
      mk('path', { d: 'M' + p.x + ' ' + p.y + ' L' + arc.slice(1) + ' Z', fill: '#ffd24a', 'fill-opacity': 0.9, stroke: 'none' }, g._wedge);
      mk('path', { d: arc, fill: 'none', stroke: '#fff4c9', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, g._wedge);
      sumPop(g._wedge, t, true);
      later(reduced() ? 0 : t, function () { sfx('tick', { gain: 0.7 }); });
      t += 320;
    }
    if (V.diags) {
      g._diags = Poly.allDiagonals(v.length).map(function (d, k) { return line(v[d[0]], v[d[1]], 'diag', 280, t + k * 110); });
      later(reduced() ? 0 : t, function () { sfx('zip', { gain: 0.6 }); });
      t += 110 * 4 + 280;
    }
    if (V.move) {
      // the corner moves: in, into a dent; or out, and the sides stop matching
      var M = V.move, to = summaryVerts(id, true)[M[0]];
      sumPop(g._mover, Math.max(0, t - 60), true);
      later(reduced() ? 0 : t + 120, function () { sfx(id === 'concave' ? 'boing' : 'slideWhistle', { gain: 0.6 }); });
      moveCorner(g, M[0], to, 460, t + 120, function () {
        var mv = g._mover;
        if (!mv) return;
        if (reduced() || !mv.animate) { mv.setAttribute('opacity', 0); return; }
        try {
          var fade = mv.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: 220, fill: 'forwards' });
          fade.finished.then(function () { mv.setAttribute('opacity', 0); fade.cancel(); }, function () {});
        } catch (e) { mv.setAttribute('opacity', 0); }
      });
      t += 120 + 480;
      if (V.line) {
        // the line that proves it, drawn once the dent is there
        var L2 = V.line, fv = summaryVerts(id, true);
        g._line = line(fv[L2[0]], fv[L2[1]], L2[2], 320, t); g._lineKind = L2[2];
        if (L2[2] === 'out') g._line._out = true;
        later(reduced() ? 0 : t, function () { sfx('zip', { gain: 0.6 }); });
        t += 340;
      }
    }
    if (V.marks) {
      var drawMarks = function () {
        g._vis._verts = g._verts.map(function (q) { return { x: q.x, y: q.y }; });
        var m = shapeMarks(g._vis, V.marks);
        if (!m || !m.g) return;
        var kids = [].slice.call(m.g.childNodes);
        g._ticks = kids.filter(function (k) { return k.tagName === 'line'; });
        g._wedges = kids.filter(function (k) { return k.tagName === 'path'; });
        g._ticks.forEach(function (k, j) { sumPop(k, j * 80); });
        g._wedges.forEach(function (k, j) { sumPop(k, g._ticks.length * 80 + 80 + j * 60); });
        sfx('sparkle', { gain: 0.5 });
      };
      if (reduced()) drawMarks(); else later(t, drawMarks);
      t += 80 * 5 + 380;
    }
    return t;
  }

  function summaryShow(id) {
    var S = st.summary;
    if (!S) return Promise.resolve(false);
    // never two at once: a card still in the middle is put away first
    if (S.active && S.active !== id) summaryCollect(S.active, true);
    var c = S.concepts.filter(function (k) { return k.id === id; })[0] || { id: id, label: id };
    var g = S.cards[id] || (S.cards[id] = summaryCard(c));
    S.active = id;
    setSummary('CARD_ENTER', id);
    sfx('menuWhoosh', { gain: 0.45 });
    var pp = g._pop;
    if (!reduced() && pp.animate) {
      pp.style.transformBox = 'fill-box'; pp.style.transformOrigin = 'center';
      try {
        pp.animate([{ opacity: 0, scale: '.82', translate: '0 14px' }, { opacity: 1, scale: '1.03', translate: '0 0', offset: 0.62 }, { opacity: 1, scale: '1', translate: '0 0' }],
                  { duration: SUM.enterMs, easing: 'cubic-bezier(.22,1,.36,1)' });
      } catch (e) {}
    }
    return sumHold(SUM.enterMs).then(function (live) {
      if (!live || S !== st.summary) return false;
      setSummary('CONCEPT_REVEAL', id);
      var ms = summaryReveal(g);
      return sumHold(ms + 60).then(function (live2) {
        if (!live2 || S !== st.summary) return false;
        sumPop(g._tag, 0);
        return sumHold(260);
      });
    });
  }

  function summarySlot(id) {
    var S = st.summary, order = S ? S.concepts.map(function (k) { return k.id; }) : [];
    var i = Math.max(0, order.indexOf(id)), half = Math.ceil(order.length / 2) || 4;
    var col = i < half ? 0 : 1, k = col ? i - half : i, gx = k % 2, row = Math.floor(k / 2);
    // (col is the side: the finale gathers each side in toward the middle)
    return { x: SUM.mini.x[col][gx], y: SUM.mini.y[row], col: col, row: row };
  }

  function summaryCollect(id, now) {
    var S = st.summary, c = S && S.cards[id];
    if (!c || c._collected) return Promise.resolve(true);
    c._collected = true;
    if (S.active === id) S.active = null;
    setSummary('CARD_COLLECT', id);
    var r = c._rect, cx0 = r.x + r.w / 2, cy0 = r.y + r.h / 2;
    var slot = summarySlot(id), k = SUM.mini.w / r.w;
    var zoomIn = function (e) {
      var z = 1 + (SUM.mini.zoom - 1) * e, sx = SUM.shape.cx, sy = SUM.shape.cy;
      if (c._vis) c._vis.setAttribute('transform', 'translate(' + sx + ',' + sy + ') scale(' + z.toFixed(4) + ') translate(' + (-sx) + ',' + (-sy) + ')');
    };
    var land = function () {
      c.setAttribute('transform', 'translate(' + slot.x + ',' + slot.y + ') scale(' + k.toFixed(4) + ') translate(' + (-cx0) + ',' + (-cy0) + ')');
      c._rect = { x: slot.x - r.w * k / 2, y: slot.y - r.h * k / 2, w: r.w * k, h: r.h * k };
      c._slot = slot;
      zoomIn(1);
      var PL = SUM.mini.plate;
      var mini = nameTag(layers.ui, slot.x, slot.y + r.h * k / 2 + 1, (S.concepts.filter(function (q) { return q.id === id; })[0] || {}).label || id,
                         (SUMMARY_VISUALS[id] || {}).tone || null, { h: PL.h, size: PL.size, w: PL.w, rim: PL.rim });
      mini.setAttribute('class', 'badge summary-tag');
      c._mini = mini;
      if (!now) sumPop(mini, 0);
      if (S.collected.indexOf(id) < 0) S.collected.push(id);
      setSummary('NEXT_CONCEPT', id);
    };
    var tagEl = c._tag;
    if (!now && !reduced() && tagEl.animate) { try { tagEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150 }); } catch (e) {} }
    tagEl.setAttribute('opacity', 0);
    if (now || reduced()) tagEl.remove(); else later(170, function () { tagEl.remove(); });
    if (now || reduced() || !global.requestAnimationFrame) { land(); return Promise.resolve(true); }
    sfx('menuWhoosh', { gain: 0.35 });
    var g0 = sceneGen;
    return new Promise(function (resolve) {
      var t0 = null;
      var step = function (ts) {
        if (g0 !== sceneGen) { resolve(false); return; }
        if (t0 == null) t0 = ts;
        var t = Math.min(1, (ts - t0) / SUM.collectMs);
        var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        var s = 1 + (k - 1) * e;
        zoomIn(e);
        var x = cx0 + (slot.x - cx0) * e, y = cy0 + (slot.y - cy0) * e - 40 * Math.sin(Math.PI * e);
        c.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') scale(' + s.toFixed(4) + ') translate(' + (-cx0) + ',' + (-cy0) + ')');
        if (t < 1) { requestAnimationFrame(step); return; }
        land(); sfx('pop', { gain: 0.45 });
        resolve(true);
      };
      requestAnimationFrame(step);
    });
  }

  function summaryFinal() {
    var S = st.summary;
    if (!S) return Promise.resolve(false);
    if (S.active) summaryCollect(S.active, true);
    setSummary('FINAL_SUMMARY');
    sfx('sparkle', { gain: 0.6 });
    S.collected.forEach(function (id, i) {
      var c = S.cards[id], dx = c._slot && c._slot.col ? -16 : 16;
      later(reduced() ? 0 : i * 70, function () {
        [c, c._mini].forEach(function (el) {
          if (!el) return;
          if (reduced() || !el.animate) { el.style.translate = dx + 'px 0'; return; }
          try {
            var hop = el.animate([{ translate: '0 0' }, { translate: (dx / 2) + 'px -12px', offset: 0.45 }, { translate: dx + 'px 0' }],
                                 { duration: 440, easing: 'cubic-bezier(.3,1.2,.5,1)', fill: 'forwards' });
            hop.finished.then(function () { el.style.translate = dx + 'px 0'; hop.cancel(); }, function () {});
          } catch (e) { el.style.translate = dx + 'px 0'; }
        });
        c._rect = { x: c._rect.x + dx, y: c._rect.y, w: c._rect.w, h: c._rect.h };
        if (c._mini && c._mini._rect) c._mini._rect = { x: c._mini._rect.x + dx, y: c._mini._rect.y, w: c._mini._rect.w, h: c._mini._rect.h };
      });
    });
    return sumHold(S.collected.length * 70 + 460);
  }

  var SWIPE_HALF = 176;
  var SWIPE_HOME = { x: W / 2, y: 300 };   // level with the middle of the zones

  var SWIPE_CM = { pentagon: 3, rhombus: 3, triangle: 5, 'stretched-hexagon': 3, square: 4,
                   rectangle: 3, hexagon: 3, 'l-shape': 7 };
  // the type and the corner marks, at SWIPE_HALF
  var SWF = { side: 15.5, angle: 14, arc: 15, right: 11 };

  function cmText(x) {
    var t = Math.round(x * 10) / 10;
    return (Math.abs(t - Math.round(t)) < 0.05 ? String(Math.round(t)) : t.toFixed(1)) + ' cm';
  }
  function textW(s, size) { return String(s).length * size * 0.54 + 4; }

  function swipeArea(half) {
    var F = global.CardFrame && CardFrame.option;
    var halfH = half * (F ? F.h / F.w : 1);
    var p = (F && F.pane) || { x: 0.08, y: 0.09, w: 0.84, h: 0.8 };
    var k = half / SWIPE_HALF;
    var gl = -half + half * 2 * p.x, gw = half * 2 * p.w;
    var gt = -halfH + halfH * 2 * p.y, gh = halfH * 2 * p.h;
    return { halfH: halfH,
             l: gl + 4 * k, r: gl + gw - 4 * k, t: gt + 8 * k, b: gt + gh - 4 * k };
  }

  function sideLabelBoxes(v, texts, size) {
    var n = v.length, out = [];
    for (var i = 0; i < n; i++) {
      var a = v[i], b = v[(i + 1) % n];
      var len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      var tx = (b.x - a.x) / len, ty = (b.y - a.y) / len;
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var nx = -ty, ny = tx;
      if (Poly.contains(v, { x: mx + nx * 3, y: my + ny * 3 })) { nx = -nx; ny = -ny; }
      var w = textW(texts[i], size), h = size + 1;
      var off = 6 + Math.abs(nx) * w / 2 + Math.abs(ny) * h / 2;
      out.push({ i: i, x: mx + nx * off, y: my + ny * off, w: w, h: h, mx: mx, my: my,
                 tx: tx, ty: ty, nx: nx, ny: ny, len: len, off: off });
    }
    return out;
  }
  function boxOf(v, labels) {
    var b = { l: Infinity, r: -Infinity, t: Infinity, b: -Infinity };
    v.forEach(function (p) { b.l = Math.min(b.l, p.x); b.r = Math.max(b.r, p.x); b.t = Math.min(b.t, p.y); b.b = Math.max(b.b, p.y); });
    (labels || []).forEach(function (q) {
      b.l = Math.min(b.l, q.x - q.w / 2); b.r = Math.max(b.r, q.x + q.w / 2);
      b.t = Math.min(b.t, q.y - q.h / 2); b.b = Math.max(b.b, q.y + q.h / 2);
    });
    return b;
  }

  function swipeFit(name, texts) {
    var A = swipeArea(SWIPE_HALF);
    var test = function (r) {
      var v = shapeVerts(name, r, 0, 0), bb = boxOf(v, sideLabelBoxes(v, texts, SWF.side));
      return { ok: bb.r - bb.l <= A.r - A.l && bb.b - bb.t <= A.b - A.t, bb: bb };
    };
    var lo = 20, hi = 260;
    for (var it = 0; it < 18; it++) { var mid = (lo + hi) / 2; if (test(mid).ok) lo = mid; else hi = mid; }
    var bb = test(lo).bb;
    return { r: lo, cx: (A.l + A.r) / 2 - (bb.l + bb.r) / 2, cy: (A.t + A.b) / 2 - (bb.t + bb.b) / 2, area: A };
  }

  /** The side lengths a card prints: in proportion to its shortest side (SWIPE_CM). */
  function swipeLengths(name) {
    var L = Poly.sideLengths(shapeVerts(name, 100, 0, 0));
    var unit = Math.min.apply(null, L) / (SWIPE_CM[name] || 3);
    return L.map(function (l) { return cmText(l / unit); });
  }

  function swipeFace(g, half, name, bare) {
    var texts = swipeLengths(name), F = swipeFit(name, texts), k = half / SWIPE_HALF;
    drawShape(name, F.r * k, F.cx * k, F.cy * k, g);
    return { verts: shapeVerts(name, F.r * k, F.cx * k, F.cy * k), fit: F, texts: texts };
  }

  function swipeMarks(card, face, ink) {
    var v = card._verts, n = v.length, A = Poly.interiorAngles(v), ar = face.fit.area;
    var g = mk('g', { 'class': 'units', 'pointer-events': 'none' }, card);
    var space = labelSpace(v, { cx: (ar.l + ar.r) / 2, cy: (ar.t + ar.b) / 2, w: ar.r - ar.l + 12, h: ar.b - ar.t + 12 }, SWF.arc);
    var txt = function (x, y, s, size, cls) {
      mk('text', { x: x.toFixed(1), y: (y + size * 0.36).toFixed(1), 'text-anchor': 'middle', 'font-size': size,
                   'font-weight': 800, fill: ink, stroke: '#ffffff', 'stroke-width': 3, 'paint-order': 'stroke',
                   'stroke-linejoin': 'round', 'class': cls, text: s }, g);
    };
    sideLabelBoxes(v, face.texts, SWF.side).forEach(function (q) {
      var cands = [];
      [0, 0.16, -0.16, 0.3, -0.3].forEach(function (along) {
        [q.off, q.off + 5, q.off + 10].forEach(function (off) {
          cands.push({ x: q.mx + q.tx * q.len * along + q.nx * off, y: q.my + q.ty * q.len * along + q.ny * off });
        });
      });
      var at = space.fit(cands, q.w, q.h) || cands[0];
      txt(at.x, at.y, face.texts[q.i], SWF.side, 'u-side');
    });
    for (var j = 0; j < n; j++) {
      var p = v[j], q0 = v[(j + n - 1) % n], q1 = v[(j + 1) % n];
      var l0 = Math.hypot(q0.x - p.x, q0.y - p.y) || 1, l1 = Math.hypot(q1.x - p.x, q1.y - p.y) || 1;
      var u0 = { x: (q0.x - p.x) / l0, y: (q0.y - p.y) / l0 }, u1 = { x: (q1.x - p.x) / l1, y: (q1.y - p.y) / l1 };
      var bx = u0.x + u1.x, by = u0.y + u1.y, bl = Math.hypot(bx, by);
      if (bl < 1e-6) { bx = -u0.y; by = u0.x; bl = 1; }
      bx /= bl; by /= bl;
      if (!Poly.contains(v, { x: p.x + bx * 4, y: p.y + by * 4 })) { bx = -bx; by = -by; }
      var deg = A[j], right = Math.abs(deg - 90) < 0.6, s = SWF.right, R = SWF.arc;
      var markOn = function (d, closed) {
        mk('path', { d: d, fill: closed ? '#ffffff' : 'none', 'fill-opacity': 0.42, stroke: ink, 'stroke-opacity': 0.95, 'stroke-width': 5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'class': 'u-angle' }, g);
        mk('path', { d: d, fill: 'none', stroke: '#ffffff', 'stroke-width': 2.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'class': 'u-angle' }, g);
      };
      if (right) {
        markOn('M' + (p.x + u0.x * s) + ' ' + (p.y + u0.y * s) +
               ' L' + (p.x + (u0.x + u1.x) * s) + ' ' + (p.y + (u0.y + u1.y) * s) +
               ' L' + (p.x + u1.x * s) + ' ' + (p.y + u1.y * s), false);
      } else {
        var a0 = Math.atan2(u0.y, u0.x), a1 = Math.atan2(u1.y, u1.x);
        var sweep = ((a1 - a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);   // a0 to a1, clockwise on screen
        var mid = a0 + sweep / 2;
        var cw = Poly.contains(v, { x: p.x + Math.cos(mid) * 4, y: p.y + Math.sin(mid) * 4 });
        var span = cw ? sweep : 2 * Math.PI - sweep;                            // the inside of the corner
        var d = 'M' + p.x + ' ' + p.y + ' L' + (p.x + u0.x * R) + ' ' + (p.y + u0.y * R) +
                ' A' + R + ' ' + R + ' 0 ' + (span > Math.PI ? 1 : 0) + ' ' + (cw ? 1 : 0) + ' ' +
                (p.x + u1.x * R) + ' ' + (p.y + u1.y * R) + ' Z';
        markOn(d, true);
      }
      var dt = Math.round(deg) + '°', dw = textW(dt, SWF.angle), dh = SWF.angle + 1;
      var base = (right ? s * 1.42 : R) + 4 + Math.max(dw, dh) / 2, dc = [];
      [0, 5, 10, 16, 24, 34].forEach(function (e) { dc.push({ x: p.x + bx * (base + e), y: p.y + by * (base + e) }); });
      var da = space.fit(dc, dw, dh) || dc[0];
      txt(da.x, da.y, dt, SWF.angle, 'u-angle');
    }
    if (g.animate && !reduced()) g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'backwards' });
    return g;
  }

  /** The card's readings fade over `ms` as it flies. */
  function fadeFace(card, ms) {
    ['.units'].forEach(function (sel) {
      var el = card && card.querySelector(sel);
      if (!el) return;
      if (reduced() || !el.animate) { el.setAttribute('opacity', 0); return; }
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: 'ease-out', fill: 'forwards' });
    });
  }

  function shelfSeats(zone, n) {
    var sh = zone._shelf;
    var cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(n))));
    var rows = Math.ceil(n / cols);
    var cw = sh.w / cols, ch = sh.h / rows;
    var half = Math.min(cw, ch) * 0.34 * 1.35;
    var seats = [];
    for (var i = 0; i < n; i++) {
      seats.push({ x: sh.x + cw * ((i % cols) + 0.5), y: sh.y + ch * (Math.floor(i / cols) + 0.5), half: half });
    }
    return seats;
  }

  function keepInZone(zone, name) {
    if (!zone) return;
    zone._kept.push(name);
    var was = zone._seats || [];
    while (zone._keptG.firstChild) zone._keptG.removeChild(zone._keptG.firstChild);

    var n = zone._kept.length;
    var seats = shelfSeats(zone, n);
    zone._seats = seats;

    zone._kept.forEach(function (nm, i) {
      var seat = seats[i];
      var cell = mk('g', { 'class': 'kept' }, zone._keptG);
      var at = mk('g', { transform: 'translate(' + seat.x.toFixed(1) + ',' + seat.y.toFixed(1) + ')' }, cell);
      swipeFace(optionCard(at, seat.half, null), seat.half, nm, true);
      if (reduced() || !cell.animate) return;
      cell.style.transformBox = 'fill-box'; cell.style.transformOrigin = 'center';
      if (i === n - 1) {
        cell.animate([{ opacity: 0.85 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
      } else if (was[i] && (was[i].x !== seat.x || was[i].y !== seat.y || was[i].half !== seat.half)) {
        var k = was[i].half / seat.half;
        cell.animate([
          { translate: (was[i].x - seat.x) + 'px ' + (was[i].y - seat.y) + 'px', scale: String(k) },
          { translate: '0 0', scale: '1' }
        ], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' });
      }
    });

  }

  function dealStack() {
    var sw = st.swipe; if (!sw) return;
    if (sw.stackG && sw.stackG.parentNode) sw.stackG.parentNode.removeChild(sw.stackG);
    sw.stackG = null;
    var left = sw.items.length - sw.i - 1;
    if (left <= 0) return;
    var g = mk('g', { 'class': 'swipe-stack', 'pointer-events': 'none' }, layers.ui);
    sw.stackG = g;
    // drawn far to near, so the nearest blank is on top of the one behind it
    for (var k = Math.min(2, left); k >= 1; k--) {
      var pileK = SWIPE_HALF / 96;
      var dxk = (k === 1 ? -1 : 1) * (4 + k * 3) * pileK, scale = 1 - k * 0.06, rot = (k === 1 ? -1 : 1) * (1.5 + k);
      var c = mk('g', { opacity: String(0.92 - k * 0.16) }, g);
      optionCard(c, SWIPE_HALF, null);   // a blank card: the pile, not the answers
      c.setAttribute('transform', 'translate(' + (SWIPE_HOME.x + dxk) + ',' + (SWIPE_HOME.y + 10 * k * pileK) + ') rotate(' + rot + ') scale(' + scale.toFixed(3) + ')');
    }
  }

  function dealCard() {
    var sw = st.swipe;
    if (!sw || sw.i >= sw.items.length) return null;
    dealStack();
    Object.keys(sw.zones).forEach(function (k) { if (sw.zones[k].classList) sw.zones[k].classList.add('hint'); });
    var name = sw.items[sw.i];
    var g = mk('g', { 'class': 'swipe-card', 'data-shape': name }, layers.ui);
    var card = optionCard(g, SWIPE_HALF, null);
    var face = swipeFace(card, SWIPE_HALF, name);
    g.setAttribute('transform', 'translate(' + SWIPE_HOME.x + ',' + SWIPE_HOME.y + ')');
    g._name = name; g._cardEl = card;
    g._verts = face.verts;
    swipeMarks(g, face, shade(COLORS[name] || '#5b95ee', -0.42));
    g.style.cursor = 'grab';
    g.style.touchAction = 'pan-y';
    sw.card = g;
    if (!reduced() && g.animate) {
      g.animate([{ translate: '0 26px', opacity: 0 }, { translate: '0 0', opacity: 1 }],
                { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
    return g;
  }

  function verdictOf(v) {
    var ix = []; for (var q = 0; q < v.length; q++) ix.push(q);
    if (Poly.isRegular(v)) return 'regular';
    var sides = marksBy(Poly.sideLengths(v), ix, 6).groups > 1;
    var angles = marksBy(Poly.interiorAngles(v), ix, 1).groups > 1;
    return sides && angles ? 'both' : sides ? 'sides' : 'angles';
  }

  function labelSpace(v, pane, wedgeR) {
    var M = 6, PAD = 3.5, boxes = [];
    var area = pane && pane.w ? { l: pane.cx - pane.w / 2 + M, r: pane.cx + pane.w / 2 - M,
                                  t: pane.cy - pane.h / 2 + M, b: pane.cy + pane.h / 2 - M } : null;
    var distPtSeg = function (px, py, ax, ay, bx, by) {
      var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
      var t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
      return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
    };
    var inBox = function (px, py, b) { return px >= b.l && px <= b.r && py >= b.t && py <= b.b; };
    var segCross = function (ax, ay, bx, by, cx, cy, dx, dy) {
      var d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
      var d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
      return (d1 * d2 < 0) && (d3 * d4 < 0);
    };
    // how close a side comes to a box: 0 if it crosses it
    var segBox = function (ax, ay, bx, by, b) {
      if (inBox(ax, ay, b) || inBox(bx, by, b)) return 0;
      var cs = [[b.l, b.t], [b.r, b.t], [b.r, b.b], [b.l, b.b]];
      for (var e = 0; e < 4; e++) {
        var p = cs[e], q = cs[(e + 1) % 4];
        if (segCross(ax, ay, bx, by, p[0], p[1], q[0], q[1])) return 0;
      }
      var d = Infinity;
      cs.forEach(function (c) { d = Math.min(d, distPtSeg(c[0], c[1], ax, ay, bx, by)); });
      // and the side's own ends against the box's edges
      [[ax, ay], [bx, by]].forEach(function (p) {
        var cx = Math.max(b.l, Math.min(b.r, p[0])), cy = Math.max(b.t, Math.min(b.b, p[1]));
        d = Math.min(d, Math.hypot(p[0] - cx, p[1] - cy));
      });
      return d;
    };
    var ok = function (b) {
      if (area && (b.l < area.l || b.r > area.r || b.t < area.t || b.b > area.b)) return false;
      for (var i = 0; i < v.length; i++) {
        var a = v[i], c = v[(i + 1) % v.length];
        if (segBox(a.x, a.y, c.x, c.y, b) < PAD) return false;
        var nx = Math.max(b.l, Math.min(b.r, a.x)), ny = Math.max(b.t, Math.min(b.b, a.y));
        if (Math.hypot(a.x - nx, a.y - ny) < (wedgeR || 0) + 2) return false;   // a corner's wedge
      }
      for (var k = 0; k < boxes.length; k++) {
        var o2 = boxes[k];
        if (b.l < o2.r + 3 && b.r > o2.l - 3 && b.t < o2.b + 3 && b.b > o2.t - 3) return false;
      }
      return true;
    };
    return {
      fit: function (cands, w, h) {
        for (var i = 0; i < cands.length; i++) {
          var c = cands[i], b = { l: c.x - w / 2, r: c.x + w / 2, t: c.y - h / 2, b: c.y + h / 2 };
          if (ok(b)) { boxes.push(b); return c; }
        }
        // nowhere is clear: the first place, still kept inside the glass
        var c0 = cands[0];
        if (!c0) return null;
        var x = c0.x, y = c0.y;
        if (area) { x = Math.max(area.l + w / 2, Math.min(area.r - w / 2, x)); y = Math.max(area.t + h / 2, Math.min(area.b - h / 2, y)); }
        boxes.push({ l: x - w / 2, r: x + w / 2, t: y - h / 2, b: y + h / 2 });
        return { x: x, y: y };
      },
      get count() { return boxes.length; }
    };
  }

  function shapeMarks(card, o) {
    o = o || {};
    if (!card || !card._verts) return null;
    var v = card._verts, n = v.length;
    var L = Poly.sideLengths(v), A2 = Poly.interiorAngles(v);
    var idxs = []; for (var i = 0; i < n; i++) idxs.push(i);
    var sideM = marksBy(L, idxs, 6);
    var verdict = Poly.isRegular(v) ? 'regular' : (sideM.groups > 1 ? 'sides' : 'angles');
    var g = mk('g', { 'class': o.cls || 'why', 'pointer-events': 'none' }, card);
    var drawnNumbers = false;

    if (o.numbers) {
      var cen = Poly.centroid(v);
      var UNIT = 30;
      var sd = decimalsFor(L, sideM.mark, UNIT, 2);

      var ink = o.ink || '#0f3f8f';
      var placed = labelSpace(v, o.pane || card._pane, 13);
      for (var si = 0; si < n; si++) {
        var sa = v[si], sb = v[(si + 1) % n];
        var slen = Math.hypot(sb.x - sa.x, sb.y - sa.y) || 1;
        var stx = (sb.x - sa.x) / slen, sty = (sb.y - sa.y) / slen;   // along the side
        var smx = (sa.x + sb.x) / 2, smy = (sa.y + sb.y) / 2;
        var snx = -sty, sny = stx;                                     // square to it...
        if (snx * (smx - cen.x) + sny * (smy - cen.y) < 0) { snx = -snx; sny = -sny; }   // ...and outward
        var text = (L[si] / UNIT).toFixed(sd) + ' cm';
        var tw = text.length * 7.4 + 4, th = 15;
        var base = 7 + Math.abs(snx) * tw / 2 + Math.abs(sny) * th / 2;
        var cands = [];
        [0, 0.18, -0.18, 0.32, -0.32].forEach(function (along) {
          [base, base + 6].forEach(function (off) {
            cands.push({ x: smx + stx * slen * along + snx * off, y: smy + sty * slen * along + sny * off });
          });
        });
        cands.push({ x: smx - snx * base, y: smy - sny * base });      // inside, as a last resort
        var at = placed.fit(cands, tw, th) || cands[0];
        mk('text', { x: at.x, y: at.y + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800,
                     fill: ink, stroke: '#ffffff', 'stroke-width': 3, 'paint-order': 'stroke',
                     'stroke-linejoin': 'round', text: text }, g);
      }
      card._labelSpace = placed;
      drawnNumbers = true;
    }

    if (!drawnNumbers) for (var i2 = 0; i2 < n; i2++) {
      var a = v[i2], b = v[(i2 + 1) % n];
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, sl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      var tdx = (b.x - a.x) / sl, tdy = (b.y - a.y) / sl, tnx = -tdy, tny = tdx;
      var cnt = sideM.mark[i2] || 1;
      for (var k = 0; k < cnt; k++) {
        var along = (k - (cnt - 1) / 2) * 6, cx = mx + tdx * along, cy = my + tdy * along;
        litLine(g, { x1: cx - tnx * 7, y1: cy - tny * 7, x2: cx + tnx * 7, y2: cy + tny * 7,
                     'stroke-width': 3, 'stroke-linecap': 'round' }, { warm: true });
      }
    }

    if (o.all || o.numbers || verdict !== 'sides') {
      for (var j = 0; j < n; j++) {
        var p = v[j], q = v[(j + n - 1) % n], r2 = v[(j + 1) % n];
        var a1 = Math.atan2(q.y - p.y, q.x - p.x), a2 = Math.atan2(r2.y - p.y, r2.x - p.x);
        var sweep = ((a2 - a1) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        var large = sweep > Math.PI ? 1 : 0;
        var mid = a1 + sweep / 2;
        var inside = Poly.contains(v, { x: p.x + Math.cos(mid) * 6, y: p.y + Math.sin(mid) * 6 });
        var rr = 13;
        var x1 = p.x + Math.cos(a1) * rr, y1 = p.y + Math.sin(a1) * rr;
        var x2 = p.x + Math.cos(a2) * rr, y2 = p.y + Math.sin(a2) * rr;
        var sweepFlag = inside ? large : (1 - large), dir = inside ? 1 : 0;
        var arcD = 'A' + rr + ' ' + rr + ' 0 ' + sweepFlag + ' ' + dir + ' ' + x2 + ' ' + y2;
        var aink = o.ink || '#0f3f8f';
        mk('path', { d: 'M' + p.x + ' ' + p.y + ' L' + x1 + ' ' + y1 + ' ' + arcD + ' Z',
                     fill: aink, 'fill-opacity': 0.22, stroke: aink, 'stroke-opacity': 0.85,
                     'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
        if (o.degrees !== false) {
          var dtx = p.x + (cen.x - p.x) * 0.30;
          var dty = p.y + (cen.y - p.y) * 0.30;
          // but never so far in that two corners' numbers meet in the middle
          var pull = Math.hypot(dtx - p.x, dty - p.y);
          if (pull < rr + 14) {
            var kk = (rr + 14) / (pull || 1);
            dtx = p.x + (dtx - p.x) * kk; dty = p.y + (dty - p.y) * kk;
          }
          if (card._labelSpace) {
            var bxl = cen.x - p.x, byl = cen.y - p.y;
            var dw = String(Math.round(A2[j])).length * 7 + 12, dh = 14, dc = [{ x: dtx, y: dty }];
            [0.24, 0.36, 0.42, 0.18, 0.5].forEach(function (f) { dc.push({ x: p.x + bxl * f, y: p.y + byl * f }); });
            var da = card._labelSpace.fit(dc, dw, dh, true);
            if (da) { dtx = da.x; dty = da.y; }
          }
          mk('text', { x: dtx, y: dty + 4, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800,
                       fill: o.ink || '#0f3f8f', stroke: '#ffffff', 'stroke-width': 2.8,
                       'paint-order': 'stroke', 'stroke-linejoin': 'round',
                       text: Math.round(A2[j]) + '°' }, g);
        }
      }
    }

    if (g.animate) g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'backwards' });
    return { g: g, verdict: verdict };
  }

  function whyShape(card) {
    if (!card || !card._verts || reduced()) return null;
    var already = !!(card.querySelector && card.querySelector('.units'));
    // the marks are already there: read the verdict, do not draw a second set
    var verdict = already ? verdictOf(card._verts) : null;
    var r = already ? null : shapeMarks(card);
    if (!already && !r) return null;
    if (r) verdict = r.verdict;
    if (card.animate) {
      card.style.transformBox = 'fill-box'; card.style.transformOrigin = 'center';
      try {
        card.animate([{ scale: '1' }, { scale: '1.14', offset: 0.3 }, { scale: '1.14', offset: 0.6 }, { scale: '1' }],
                     { duration: 900, easing: 'cubic-bezier(.3,1.2,.4,1)' });
      } catch (x) {}
    }
    if (!already && r) {
      var g = r.g;
      later(1700, function () {
        if (!g.parentNode) return;
        var fade = g.animate ? g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }) : null;
        var go = function () { if (g.parentNode) g.parentNode.removeChild(g); };
        if (fade && fade.finished) fade.finished.then(go, go); else go();
      });
    }
    return verdict;
  }

  /** Lean a zone toward the child while they are dragging at it. */
  function leanZone(id, on) {
    var sw = st.swipe; if (!sw) return;
    Object.keys(sw.zones).forEach(function (k) {
      var g = sw.zones[k], want = (k === id && on);
      if (g._lean === want) return;
      g._lean = want;
      g.style.transformBox = 'fill-box'; g.style.transformOrigin = 'center';
      if (!reduced() && g.animate) {
        g.animate([{ scale: want ? '1' : '1.045' }, { scale: want ? '1.045' : '1' }],
                  { duration: 160, easing: 'ease-out', fill: 'forwards' });
      }
      g.classList.toggle('zone-live', want);
    });
  }

  function packBin(bin) {
    var items = bin._items || [];
    if (!items.length) return;
    var r = bin._pane || bin._rect;
    var PAD_X = bin._pane ? 6 : 12, PAD_TOP = bin._pane ? 6 : 56, PAD_BOT = bin._pane ? 6 : 12;
    var ITEM_W = 92, gapX = 16, n = items.length;
    var roomW = r.w - PAD_X * 2;
    var k = Math.min(1, (roomW - gapX * (n - 1)) / (n * ITEM_W));
    k = Math.max(0.5, k);
    var cw = ITEM_W * k, total = n * cw + gapX * (n - 1);
    var x0 = r.x + (r.w - total) / 2 + cw / 2;
    var cy = r.y + PAD_TOP + (r.h - PAD_TOP - PAD_BOT) / 2;
    items.forEach(function (it, i) {
      var cx = x0 + i * (cw + gapX);
      it._pos = { x: cx, y: cy };
      it.setAttribute('transform', 'translate(' + cx + ',' + cy + ') scale(' + k.toFixed(3) + ')');
    });
  }

  function optionCard(parent, half, name, opts) {
    var F = global.CardFrame && CardFrame.option;
    var g = mk('g', { 'class': 'shape-card' }, parent);

    var aspect = F ? F.h / F.w : 1;
    var halfH = half * aspect;

    if (F) {
      var img = mk('image', {
        x: -half, y: -halfH, width: half * 2, height: halfH * 2,
        preserveAspectRatio: 'none'
      }, g);
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', pic(F.src));
      img.setAttribute('href', pic(F.src));
    } else {
      // No frame table: a plain slab rather than nothing at all.
      mk('rect', { x: -half, y: -halfH, width: half * 2, height: halfH * 2, rx: half * 0.3,
                   fill: '#f4fbff', stroke: '#2f96f5', 'stroke-width': Math.max(2, half * 0.06) }, g);
    }

    var p = (F && F.pane) || { x: 0.08, y: 0.09, w: 0.84, h: 0.8 };
    var paneW = half * 2 * p.w;
    var paneH = halfH * 2 * p.h;
    var cx = -half + half * 2 * (p.x + p.w / 2);
    var cy = -halfH + halfH * 2 * (p.y + p.h / 2);
    var r = Math.min(paneW, paneH) / 2 * ((opts && opts.fill) || 0.86);

    if (name) drawShape(name, r, cx, cy, g);

    var halo = null;
    g._mark = function (state) {
      if (g.classList) {
        g.classList.remove('mark-good', 'mark-bad');
        if (state === 'correct') g.classList.add('mark-good');
        if (state === 'wrong') g.classList.add('mark-bad');
      }
      if (halo) { var gone = halo; halo = null; if (reduced() || !gone.animate) gone.remove(); else { try { gone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }).finished.then(function () { gone.remove(); }, function () { gone.remove(); }); } catch (e) { gone.remove(); } } }
      if (!state) return;
      var col = state === 'wrong' ? '#ff5a5a' : '#3ad46e', deep = state === 'wrong' ? '#c62828' : '#1f8f46';
      halo = mk('g', { 'class': 'verdict-glow', 'pointer-events': 'none' });
      g.insertBefore(halo, g.firstChild);
      var pad = Math.max(8, half * 0.08), rx = half * 0.26;
      mk('rect', { x: -half - pad, y: -halfH - pad, width: 2 * (half + pad), height: 2 * (halfH + pad), rx: rx, ry: rx,
                   fill: col, 'fill-opacity': 0.9, filter: 'url(#cardGlow)' }, halo);
      mk('rect', { x: -half - 2, y: -halfH - 2, width: 2 * (half + 2), height: 2 * (halfH + 2), rx: rx * 0.8, ry: rx * 0.8,
                   fill: 'none', stroke: deep, 'stroke-width': 5, 'stroke-opacity': 0.9 }, halo);
      if (!reduced() && halo.animate) { try { halo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out', fill: 'backwards' }); } catch (e) {} }
      if (state === 'correct' && !reduced() && g.animate) {
        g.style.transformBox = 'fill-box'; g.style.transformOrigin = 'center';
        try { g.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)', offset: 0.45 }, { transform: 'scale(1)' }], { duration: 340, easing: 'cubic-bezier(.3,1.4,.5,1)' }); } catch (e) {}
      }
    };

    g._pane = { cx: cx, cy: cy, r: r, w: paneW, h: paneH };
    return g;
  }

  function makeSortItem(name, x, y, i) {
    var g = mk('g', { 'class': 'sort-item', 'data-shape': name }, layers.ui);
    var card = optionCard(g, 46, name);   // the option is the small thing; the bin it goes in is the big one
    g.setAttribute('transform', 'translate(' + x + ',' + y + ')');
    g._home = { x: x, y: y }; g._name = name;
    g._verts = shapeVerts(name, card._pane.r, card._pane.cx, card._pane.cy);
    if (!reduced() && g.animate) {
      try { g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: i * 90, easing: 'ease-out', fill: 'backwards' }); } catch (e) {}
      var shape = g.querySelector('.shape');
      if (shape && shape.animate) {
        shape.style.transformBox = 'fill-box'; shape.style.transformOrigin = 'center';
        try {
          shape.animate([{ transform: 'scale(0.2)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)', opacity: 1 }],
                        { duration: 420, delay: 120 + i * 90, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' });
        } catch (e) {}
      }
    }
    return g;
  }

  var EVAL = {
    yes: ['#58c47c', '#2e8a4e'],
    no:  ['#f0789e', '#b93c66']
  };

  var CONCEPT = {
    convex:    { face: '#2bb8d6', deep: '#0f6f86', wash: '#e4f8fc', ink: '#0b5566' },
    concave:   { face: '#f2a222', deep: '#95590a', wash: '#fff3dd', ink: '#6d4100' },
    regular:   { face: '#f08a2c', deep: '#a04e0a', wash: '#fff0e0', ink: '#7a3300' },
    irregular: { face: '#9270e6', deep: '#54399e', wash: '#f1ebfe', ink: '#3d2775' }
  };

  function conceptOf(text) {
    var k = String(text == null ? '' : text).trim().toLowerCase();
    return CONCEPT[k] ? k : null;
  }

  /* [face, lip, ink] — ink optional, white when absent. */
  var PILL_TONES = {
    blue:      ['#4f9df5', '#2b6fc4'],
    // the new kit's tones, drawn the same colours if the art is missing
    uiPrimary: ['#ffc53d', '#c07a00', '#5a3400'],
    uiSuccess: EVAL.yes,
    uiDanger:  EVAL.no
  };

  function nameTag(parent, x, y, text, tone, o) {
    var c = CONCEPT[tone] || null;
    var g = mk('g', { 'class': 'badge' }, parent);
    var H0 = (o && o.h) || 50, fs = (o && o.size) || 26;
    var probe = mk('text', { x: x, y: y + (o && o.size ? fs * 0.35 : 9), 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 900,
                             fill: c ? c.ink : '#0b3f7a', text: text }, g);
    var w = 0; try { w = probe.getComputedTextLength ? probe.getComputedTextLength() : 0; } catch (e) { w = 0; }
    if (!w) w = text.length * (o && o.size ? fs * 0.54 : 14);
    var bw = (o && o.w) || (w + ((o && o.pad) || 52)), bx = x - bw / 2, by = y - H0 / 2;
    var r = H0 * 0.44;
    // one face, one rim, no shadow and no gloss
    var face = mk('rect', { x: bx, y: by, width: bw, height: H0, rx: r,
                            fill: c ? c.wash : '#f3fcff', stroke: c ? c.deep : HI.edge, 'stroke-width': (o && o.rim) || 3 }, g);
    g.insertBefore(face, probe);
    g._text = probe;
    g._face = face; g._pad = (o && o.pad) || 52;
    g._rect = { x: bx, y: by, w: bw, h: H0 };
    return g;
  }

  function renameTag(g, text, tone) {
    if (!g || !g._text || !g._face || !g._rect) return;
    var c = CONCEPT[tone] || null, t = g._text;
    text = inLang(text);
    t.textContent = text;
    var fs = parseFloat(t.getAttribute('font-size')) || 17;
    var w = 0; try { w = t.getComputedTextLength ? t.getComputedTextLength() : 0; } catch (e) { w = 0; }
    if (!w) w = text.length * fs * 0.54;
    var cx = g._rect.x + g._rect.w / 2, bw = w + g._pad;
    g._face.setAttribute('x', (cx - bw / 2).toFixed(1));
    g._face.setAttribute('width', bw.toFixed(1));
    g._rect.x = cx - bw / 2; g._rect.w = bw;
    if (c) { g._face.setAttribute('fill', c.wash); g._face.setAttribute('stroke', c.deep); t.setAttribute('fill', c.ink); }
  }

  function tag(parent, o) {
    var c = CONCEPT[o.tone] || null;
    var h = o.h == null ? 44 : o.h;
    var g = mk('g', o.attrs || {}, parent);
    var face = mk('rect', {
      x: o.x, y: o.y - h / 2, width: o.w, height: h, rx: h * 0.42,
      fill: c ? c.wash : UI.paper, stroke: c ? c.deep : UI.paperRim, 'stroke-width': UI.rim
    }, g);
    var t = mk('text', {
      x: o.x + o.w / 2, y: o.y + h * 0.15, 'text-anchor': 'middle',
      'font-size': o.size || Math.round(h * 0.48), 'font-weight': 700,
      fill: c ? c.ink : '#1c2a4a', text: o.label
    }, g);
    g._text = t;
    g._rect = { x: o.x, y: o.y - h / 2, w: o.w, h: h };
    g._retint = function (tone) {
      var cc = CONCEPT[tone];
      face.setAttribute('fill', cc ? cc.wash : UI.paper);
      face.setAttribute('stroke', cc ? cc.deep : UI.paperRim);
      t.setAttribute('fill', cc ? cc.ink : '#1c2a4a');
    };
    return g;
  }

  function shade(hex, t) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var to = t > 0 ? 255 : 0, k = Math.abs(t);
    var mix = function (c) { return Math.round(c + (to - c) * k); };
    return '#' + ((1 << 24) + (mix(r) << 16) + (mix(g) << 8) + mix(b)).toString(16).slice(1);
  }

  function pill(parent, o) {
    var tone = PILL_TONES[o.tone] || PILL_TONES.blue;
    var w = o.w, h = o.h == null ? 62 : o.h;
    var x = o.x, y = o.y;                        // y is the CENTRE of the face
    var r = o.r == null ? h / 2 : o.r;
    var lip = o.lip == null ? Math.max(4, h * 0.15) : o.lip;
    var top = y - h / 2;

    var g = mk('g', o.attrs || {}, parent);
    var art = null, drawn = null;

    var B = global.ButtonFrame && ButtonFrame[o.tone];

    var size = o.size || Math.round(h * 0.52);

    if (B) {
      art = sliced(g, B, x, top, w, h);
    } else {
      drawn = drawnPill(g, tone, x, top, w, h, r, lip);
    }

    var DARK_ON = { uiPrimary: 1 };
    var ink = o.ink || (DARK_ON[o.tone] ? '#3a2410' : '#ffffff');
    var t = mk('text', {
      x: x + w / 2, y: y + h * 0.18,
      'text-anchor': 'middle', 'font-size': size, 'font-weight': 800,
      fill: ink, text: o.label,
      'pointer-events': 'none'
    }, g);

    g._text = t;
    g._rect = { x: x, y: top, w: w, h: h };
    g._retint = function (name) {
      var p = PILL_TONES[name] || PILL_TONES.blue;
      var nb = global.ButtonFrame && ButtonFrame[name];
      if (art && nb) art.href(nb);
      else if (drawn) drawn.paint(p);
      t.setAttribute('fill', o.ink || (DARK_ON[name] ? '#3a2410' : '#ffffff'));
    };

    if (o.press) g.style.cursor = 'pointer';
    return g;
  }

  /** The three pieces, and a way to point them all at another button. */
  function sliced(g, B, x, top, w, h) {
    var k = h / B.h;                 // the sheet's pixels, at this size
    var cap = Math.min(B.cap * k, w / 2);
    var pieces = [];
    var put = function (dx, dw, sx, sw) {
      var box = mk('svg', {
        x: dx, y: top, width: dw, height: h,
        viewBox: sx + ' 0 ' + sw + ' ' + B.h,
        preserveAspectRatio: 'none', overflow: 'hidden'
      }, g);
      var im = mk('image', { x: 0, y: 0, width: B.w, height: B.h,
                             preserveAspectRatio: 'none' }, box);
      im.setAttributeNS('http://www.w3.org/1999/xlink', 'href', pic(B.src));
      im.setAttribute('href', pic(B.src));
      pieces.push(im);
    };
    var tuck = Math.min(2, Math.max(0, w / 2 - cap));
    put(x + cap - tuck, w - cap * 2 + tuck * 2, B.cap, B.w - B.cap * 2);   // the stretch, under the caps
    put(x, cap, 0, B.cap);                                                // left cap
    put(x + w - cap, cap, B.w - B.cap, B.cap);                            // right cap
    return {
      href: function (nb) {
        pieces.forEach(function (im) {
          im.setAttributeNS('http://www.w3.org/1999/xlink', 'href', pic(nb.src));
          im.setAttribute('href', pic(nb.src));
        });
      }
    };
  }

  /** The fallback: the same button, drawn, for a tone the sheet has not got. */
  function drawnPill(g, tone, x, top, w, h, r, lip) {
    var lipEl = mk('rect', { x: x, y: top + lip, width: w, height: h, rx: r, fill: tone[1] }, g);
    var face = mk('rect', { x: x, y: top, width: w, height: h, rx: r, fill: tone[0] }, g);
    var lit = mk('rect', { x: x, y: top, width: w, height: h, rx: r, fill: 'none', 'pointer-events': 'none' }, g);
    var rim = mk('rect', { x: x + 1, y: top + 1, width: w - 2, height: h - 2, rx: Math.max(0, r - 1),
                           fill: 'none', stroke: tone[1], 'stroke-width': 2, opacity: 0.55,
                           'pointer-events': 'none' }, g);
    mk('ellipse', { cx: x + w - h * 0.34, cy: top + h * 0.27, rx: h * 0.17, ry: h * 0.12,
                    fill: '#ffffff', opacity: 0.92, 'pointer-events': 'none' }, g);
    mk('ellipse', { cx: x + h * 0.36, cy: top + h * 0.72, rx: h * 0.1, ry: h * 0.07,
                    fill: '#ffffff', opacity: 0.55, 'pointer-events': 'none' }, g);
    var paint = function (p) {
      face.setAttribute('fill', shade(p[0], 0.04));
      lipEl.setAttribute('fill', p[1]);
      rim.setAttribute('stroke', p[1]);
      lit.setAttribute('fill', 'url(#' + gloss(p[0]) + ')');
    };
    paint(tone);
    return { paint: paint };
  }

  function candy(hex) {
    var id = 'candy' + hex.slice(1);
    if (!svg) return id;
    if (svg.querySelector('#' + id)) return id;
    var defs = svg.querySelector('defs');
    if (!defs) return id;
    var ns = 'http://www.w3.org/2000/svg';
    var lg = document.createElementNS(ns, 'linearGradient');
    lg.setAttribute('id', id);
    lg.setAttribute('x1', '0'); lg.setAttribute('y1', '0');
    lg.setAttribute('x2', '0'); lg.setAttribute('y2', '1');
    [[0, shade(hex, 0.34)], [0.42, hex], [1, shade(hex, -0.2)]].forEach(function (st) {
      var stop = document.createElementNS(ns, 'stop');
      stop.setAttribute('offset', st[0]);
      stop.setAttribute('stop-color', st[1]);
      lg.appendChild(stop);
    });
    defs.appendChild(lg);
    return id;
  }

  function gloss(hex) {
    var id = 'gloss' + hex.slice(1);
    if (!svg) return id;
    if (svg.querySelector('#' + id)) return id;
    var defs = svg.querySelector('defs');
    if (!defs) return id;
    var ns = 'http://www.w3.org/2000/svg';
    var lg = document.createElementNS(ns, 'linearGradient');
    lg.setAttribute('id', id);
    lg.setAttribute('x1', '0'); lg.setAttribute('y1', '0');
    lg.setAttribute('x2', '0'); lg.setAttribute('y2', '1');
    [[0, shade(hex, 0.42)], [0.5, shade(hex, 0.02)], [0.52, hex], [1, shade(hex, -0.26)]]
      .forEach(function (st) {
        var stop = document.createElementNS(ns, 'stop');
        stop.setAttribute('offset', st[0]);
        stop.setAttribute('stop-color', st[1]);
        lg.appendChild(stop);
      });
    defs.appendChild(lg);
    return id;
  }

  function choiceCeiling() {
    if (!st.choiceEls || !st.choiceEls.length) return null;
    var top = Infinity;
    st.choiceEls.forEach(function (b) { if (b._rect && b._rect.y < top) top = b._rect.y; });
    return top === Infinity ? null : top - 18;
  }

  function liftAboveChoices() {
    var ceil = choiceCeiling();
    if (ceil == null) return;
    if (st.panelEl && st.panel) {
      var over = (st.panel.y + st.panel.h) - ceil;
      if (over > 0) {
        var nh = Math.max(200, st.panel.h - over);
        st.panel.h = nh;
        st.panelEl._rect.h = nh;
        var im = st.panelEl.querySelector('image, rect');
        if (im) im.setAttribute('height', nh);
        var pf2 = panelFace(st.panel), v2 = st.verts;
        if (v2 && v2.length) {
          var lo2 = Infinity, hi2 = -Infinity;
          v2.forEach(function (q) { if (q.y < lo2) lo2 = q.y; if (q.y > hi2) hi2 = q.y; });
          var m2 = Math.max(pf2.h * 0.06, 22);
          if (hi2 + VERT_PAINT > pf2.y + pf2.h - m2) {
            var room2 = pf2.h - 2 * m2 - 2 * VERT_PAINT, k2 = Math.min(1, room2 / Math.max(1, hi2 - lo2));
            var cx2 = st.cx != null ? st.cx : v2.reduce(function (s, q) { return s + q.x; }, 0) / v2.length;
            var midY = (lo2 + hi2) / 2, toY = pf2.y + pf2.h / 2;
            st.verts = v2.map(function (q) { return { x: cx2 + (q.x - cx2) * k2, y: toY + (q.y - midY) * k2 }; });
            st.cx = cx2; st.cy = toY; if (st.r) st.r *= k2;
            renderPoly();
          }
        }
      }
    }

    var movers = [];
    if (st.labelEl) movers.push(st.labelEl);
    Object.keys(st.badges || {}).forEach(function (k) { movers.push(st.badges[k]); });
    movers.forEach(function (g) {
      if (!g || !g.getBBox) return;
      if (g.getAnimations) { try { g.getAnimations().forEach(function (a) { a.finish(); }); } catch (e) {} }
      var b;
      try { b = g.getBBox(); } catch (e) { return; }
      if (!b || !b.height) return;
      var over = b.y + b.height - ceil;
      if (over > 0) g.setAttribute('transform', 'translate(0,' + (-Math.ceil(over)) + ')');
    });
  }

  var VERT_PAINT = 12;   // a knob is r11 now

  function distToRect(p, r) {
    var dx = Math.max(r.x0 - p.x, 0, p.x - r.x1), dy = Math.max(r.y0 - p.y, 0, p.y - r.y1);
    return Math.sqrt(dx * dx + dy * dy);
  }
  function segHitsRect(a, b, r) {
    // Liang–Barsky: does any part of a→b lie inside r?
    var t0 = 0, t1 = 1, dx = b.x - a.x, dy = b.y - a.y;
    var p = [-dx, dx, -dy, dy], q = [a.x - r.x0, r.x1 - a.x, a.y - r.y0, r.y1 - a.y];
    for (var i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; continue; }
      var t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return true;
  }
  function tagClear(r) {
    var v = st.verts; if (!v || !v.length) return true;
    var pf = st.panel ? panelFace(st.panel) : { x: 0, y: 0, w: W, h: H };
    if (r.x0 < pf.x + 14 || r.x1 > pf.x + pf.w - 14 || r.y0 < pf.y + 14 || r.y1 > pf.y + pf.h - 8) return false;
    if (st.panel) {
      // the frame's crystals reach in over the glass at its four corners
      var P = st.panel, cw = P.w * 0.17, ch = P.h * 0.15;
      var corners = [{ x0: P.x, y0: P.y }, { x0: P.x + P.w - cw, y0: P.y }, { x0: P.x, y0: P.y + P.h - ch }, { x0: P.x + P.w - cw, y0: P.y + P.h - ch }];
      for (var c = 0; c < 4; c++) {
        var K = corners[c];
        if (r.x0 < K.x0 + cw && r.x1 > K.x0 && r.y0 < K.y0 + ch && r.y1 > K.y0) return false;
      }
    }
    var n = v.length, pad = 8, R = { x0: r.x0 - pad, y0: r.y0 - pad, x1: r.x1 + pad, y1: r.y1 + pad };
    for (var k = 0; k < n; k++) if (distToRect(v[k], r) < 26) return false;
    for (var e = 0; e < n; e++) if (segHitsRect(v[e], v[(e + 1) % n], R)) return false;
    var ds = st.diagonals || [];
    for (var d = 0; d < ds.length; d++) if (v[ds[d][0]] && v[ds[d][1]] && segHitsRect(v[ds[d][0]], v[ds[d][1]], R)) return false;
    return !Poly.contains(v, { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });
  }
  function tagInside(r) {
    var v = st.verts; if (!v || !v.length) return false;
    var pad = 8, R = { x0: r.x0 - pad, y0: r.y0 - pad, x1: r.x1 + pad, y1: r.y1 + pad }, n = v.length;
    var corners = [[R.x0, R.y0], [R.x1, R.y0], [R.x1, R.y1], [R.x0, R.y1]];
    for (var c = 0; c < 4; c++) if (!Poly.contains(v, { x: corners[c][0], y: corners[c][1] })) return false;
    for (var k = 0; k < n; k++) if (distToRect(v[k], r) < 22) return false;
    for (var e = 0; e < n; e++) if (segHitsRect(v[e], v[(e + 1) % n], R)) return false;
    var ds = st.diagonals || [];
    for (var d = 0; d < ds.length; d++) if (v[ds[d][0]] && v[ds[d][1]] && segHitsRect(v[ds[d][0]], v[ds[d][1]], R)) return false;
    return true;
  }
  function besideSide(a, b, tw, hy, lift, faceFirst) {
    hy = hy || 20; lift = lift == null ? 7 : lift;
    var m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    var sl = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / sl, uy = (b.y - a.y) / sl;
    var nx = -uy, ny = ux;
    if ((m.x - st.cx) * nx + (m.y - st.cy) * ny < 0) { nx = -nx; ny = -ny; }
    var hx = tw / 2, reach = Math.abs(nx) * hx + Math.abs(ny) * hy;
    var find = function (sgn, ok) {
      for (var pass = 0; pass < 2; pass++) {
        for (var gap = 26; gap <= 150; gap += 8) {
          for (var k = pass ? 1 : 0; k < (pass ? 11 : 1); k++) {
            var slide = Math.ceil(k / 2) * 16 * (k % 2 ? -1 : 1);
            var cx = m.x + sgn * nx * (reach + gap) + ux * slide, cy = m.y + sgn * ny * (reach + gap) + uy * slide;
            if (ok({ x0: cx - hx, y0: cy - hy, x1: cx + hx, y1: cy + hy })) return { x: cx, y: cy + lift };
          }
        }
      }
      return null;
    };
    if (faceFirst) return find(-1, tagInside) || find(1, tagInside) || find(1, tagClear) || find(-1, tagClear);
    return find(1, tagClear) || find(-1, tagInside);
  }

  function belowShape(gap, floorPad) {
    var lowest = st.verts && st.verts.length
      ? st.verts.reduce(function (m, p) { return p.y > m ? p.y : m; }, -Infinity) + VERT_PAINT
      : null;
    var f = st.panel ? panelFace(st.panel) : null;
    var floorY = f ? f.y + f.h - (floorPad == null ? 8 : floorPad * 0.4) : H - 30;
    var ceil = choiceCeiling();
    if (ceil != null) floorY = Math.min(floorY, ceil);
    if (lowest == null) return floorY;
    return Math.min(floorY, lowest + (gap == null ? 52 : gap));
  }

  function makeRoomBelow(floorY, need) {
    var v = st.verts; if (!v || !v.length || !st.panel) return;
    var lo = Infinity, hi = -Infinity, xl = Infinity, xr = -Infinity;
    v.forEach(function (p) { if (p.y < lo) lo = p.y; if (p.y > hi) hi = p.y; if (p.x < xl) xl = p.x; if (p.x > xr) xr = p.x; });
    var want = floorY - need;                    // the lowest corner may sit here at most
    if (hi + VERT_PAINT <= want) return;
    var pf = panelFace(st.panel);
    var top = pf.y + pf.h * 0.02 + VERT_PAINT;
    var deficit = hi + VERT_PAINT - want;
    var k = 1, newTop;
    if (deficit <= lo - top) newTop = lo - deficit;          // slide up, whole
    else { newTop = top; k = Math.max(0.5, (want - VERT_PAINT - top) / (hi - lo)); }   // shrink about the top
    var cx = (xl + xr) / 2;
    st.verts = v.map(function (p) { return { x: cx + (p.x - cx) * k, y: newTop + (p.y - lo) * k }; });
    st.cx = cx; st.cy = newTop + (hi - lo) * k / 2; if (st.r) st.r *= k;
    renderPoly();
    var g = st.polyG;
    if (g && g.animate && !reduced()) {
      g.style.transformBox = 'fill-box'; g.style.transformOrigin = '50% 0%';
      g.animate([
        { transform: 'translate(0px, ' + (lo - newTop).toFixed(1) + 'px) scale(' + (1 / k).toFixed(4) + ')' },
        { transform: 'none' }
      ], { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
  }

  function bandBelow() {
    if (!st.panel || !st.panelEl) return;
    var ceil = BOTTOM - CONTROL_H - CONTROL_GAP;
    if (st.panel.y + st.panel.h > ceil + 0.5) {
      var nh = Math.max(200, ceil - st.panel.y);
      st.panel.h = nh;
      if (st.panelEl._rect) st.panelEl._rect.h = nh;
      var im = st.panelEl.querySelector('image, rect');
      if (im) im.setAttribute('height', nh);
    }
    var pf = panelFace(st.panel);
    makeRoomBelow(pf.y + pf.h, VERT_PAINT + 10);
  }

  function morphFrom(prev) {
    if (reduced() || !st.fill || !st.fill.animate) return;
    // Resample both outlines to a common count so the path can tween.
    var from = resample(prev, 60), to = resample(st.verts, 60);
    var f = st.fill;
    f.animate([{ d: 'path("' + pathOf(from) + '")' }, { d: 'path("' + pathOf(to) + '")' }], { duration: 640, easing: 'cubic-bezier(.22,1,.36,1)' });
  }
  function resample(v, count) {
    var n = v.length, out = [], per = count / n;
    for (var i = 0; i < n; i++) {
      var a = v[i], b = v[(i + 1) % n];
      for (var k = 0; k < per; k++) { var t = k / per; out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); }
    }
    return out;
  }

  function resolveVertex(ref) {
    if (typeof ref === 'number') return ref;
    if (ref === 'picked') return st.picked == null ? 0 : st.picked;
    if (ref === 'adjacent') return (st.picked == null ? 0 : st.picked) + 1 >= st.n ? 0 : (st.picked == null ? 0 : st.picked) + 1;
    if (ref === 'remaining-diagonal') {
      var used = (st.diagonals || []).map(function (d) { return d.join('-'); });
      var cands = Poly.diagonalsFrom(st.picked == null ? 0 : st.picked, st.n).filter(function (j) {
        var k = [Math.min(st.picked, j), Math.max(st.picked, j)].join('-'); return used.indexOf(k) < 0;
      });
      return cands[0] == null ? 0 : cands[0];
    }
    return 0;
  }

  var op = {
    highlight: function (h) {
      if (h.vertex != null) {
        st.vcolor = st.vcolor || {};
        var i = resolveVertex(h.vertex);
        // the picked corner keeps its own colour whatever the beat calls it
        st.vcolor[i] = h.vertex === 'picked' ? HI.picked : h.color === 'red' ? HI.bad : h.color === 'orange' ? HI.hot : HI.fill;
        renderPoly();
        if (knobOf(i)) juice('pop', knobOf(i), { scale: 0.5 });
      }
      if (h.diagonal === 'outside') {
        if (global.Poly && Poly.classify && !Poly.classify(st.verts).concave) {
          var c0 = Poly.centroid(st.verts), p0 = st.verts[0];
          st.verts[0] = { x: c0.x + (p0.x - c0.x) * 0.1, y: c0.y + (p0.y - c0.y) * 0.1 };
          st.vcolor = st.vcolor || {}; st.vcolor[0] = HI.fill;
        }
        st.highlightOutside = true; st.onlyOutside = true; renderPoly(); juice('flash', st.diagG);
      }
    },
    label: function (l) {
      st.labelSpec = specOf(l);
      if (st.labelEl) st.labelEl.remove();
      if (l.at === 'top' && st.panel) {
        var tg = nameTag(layers.ui, st.panel.x + st.panel.w / 2, st.panel.y + 1, l.text, null, { h: 32, size: 17, pad: 30, rim: 2.5 });
        tg.setAttribute('class', 'label name-tab');
        st.labelEl = tg;
        if (l.cue && holdForWord(tg, l.cue)) return;
        if (l.enter && !reduced()) enter(tg, 'ui');
        return;
      }
      var lastDiag = st.diagonals && st.diagonals.length ? st.diagonals[st.diagonals.length - 1] : null;
      var seg = l.at === 'diagonal' ? (lastDiag ? [lastDiag[0], lastDiag[1]] : null) : st.segment;
      var x, y, m = null;
      if (l.at === 'below-polygon' || !seg) {
        var lceil = choiceCeiling();
        var under = null;
        if (l.inside && st.panel && lceil == null && st.verts && st.verts.length) {
          var utw = String(l.text).length * 15 + 36;
          var ulow = st.verts.reduce(function (mm, p) { return p.y > mm ? p.y : mm; }, -Infinity);
          for (var ug = 22; ug <= 70 && !under; ug += 6) {
            for (var uk = 0; uk < 9 && !under; uk++) {
              var ucx = st.cx + Math.ceil(uk / 2) * 22 * (uk % 2 ? -1 : 1), ucy = ulow + ug + 20;
              if (tagClear({ x0: ucx - utw / 2, y0: ucy - 20, x1: ucx + utw / 2, y1: ucy + 20 })) under = { x: ucx, y: ucy + 7 };
            }
          }
        }
        if (under) { x = under.x; y = under.y; }
        else if (st.panel && lceil == null) {
          // under the card, centred, in the control band (see bandBelow)
          bandBelow();
          x = st.panel.x + st.panel.w / 2;
          y = controlY() + 9;   // the text baseline, so the plate is centred in the band
        } else {
          var pf = panelFace(st.panel);
          var floorY = pf.y + pf.h - 8;
          if (lceil != null) floorY = Math.min(floorY, lceil);
          x = st.cx;
          var lowest = st.verts && st.verts.length
            ? st.verts.reduce(function (m, p) { return p.y > m ? p.y : m; }, -Infinity) + VERT_PAINT
            : null;
          y = lowest == null ? Math.min(floorY, st.panel.y + st.panel.h - 30)
                             : Math.min(floorY, lowest + 52);
        }
      } else {
        var a = st.verts[seg[0]], b = st.verts[seg[1]];
        m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        var beside = besideSide(a, b, String(l.text).length * 13 + 28, 17, 6, l.at === 'diagonal');
        if (beside) { x = beside.x; y = beside.y; }
        else {
        var nx = m.x - st.cx, ny = m.y - st.cy;
        var len = Math.sqrt(nx * nx + ny * ny) || 1;
        var OUT = 74;
        x = m.x + nx / len * OUT;
        y = m.y + ny / len * OUT;
        var pfc = st.panel ? panelFace(st.panel) : { x: 0, y: 0, w: W, h: H };
        x = Math.max(pfc.x + 70, Math.min(pfc.x + pfc.w - 70, x));
        if (y <= pfc.y + pfc.h) y = Math.max(pfc.y + 40, Math.min(pfc.y + pfc.h - 32, y));
        else y = Math.min(y, BOTTOM - 14);

        if (st.verts && st.verts.length) {
          var tw = (String(l.text).length * 15) + 36;
          var bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
          st.verts.forEach(function (p) {
            if (p.x < bx0) bx0 = p.x; if (p.x > bx1) bx1 = p.x;
            if (p.y < by0) by0 = p.y; if (p.y > by1) by1 = p.y;
          });
          var ox = (m.x - st.cx), oy = (m.y - st.cy);
          var ol = Math.sqrt(ox * ox + oy * oy) || 1;
          ox /= ol; oy /= ol;
          var hits = function (px, py) {
            return px - tw / 2 < bx1 + 6 && px + tw / 2 > bx0 - 6 &&
                   py - 27 < by1 + 6 && py + 13 > by0 - 6;
          };

          var glassX0 = pfc.x + tw / 2 + 14, glassX1 = pfc.x + pfc.w - tw / 2 - 14;
          var glassY0 = pfc.y + 44, glassY1 = pfc.y + pfc.h - 18;
          var onGlass = function (px, py) {
            return px >= glassX0 - 0.5 && px <= glassX1 + 0.5 && py >= glassY0 - 0.5 && py <= glassY1 + 0.5;
          };
          var px0 = -oy, py0 = ox;                     // along the rim, not away from it
          var best = null;
          if (glassX1 >= glassX0 && glassY1 >= glassY0) {
            for (var step = 0; step <= 12 && !best; step++) {
              for (var side = 0; side < 7 && !best; side++) {
                var sgn = side % 2 ? -1 : 1, slide = Math.ceil(side / 2) * 26 * sgn;
                var tx = x + ox * step * 14 + px0 * slide;
                var ty = y + oy * step * 14 + py0 * slide;
                if (onGlass(tx, ty) && !hits(tx, ty)) best = { x: tx, y: ty };
              }
            }
          }
          if (best) { x = best.x; y = best.y; }
          else {
            // nowhere clear: stay on the glass rather than climb onto the frame
            for (var g2 = 0; g2 < 14 && hits(x, y); g2++) { x += ox * 14; y += oy * 14; }
            if (glassX1 >= glassX0) x = Math.max(glassX0, Math.min(glassX1, x));
            else x = pfc.x + pfc.w / 2;
            if (glassY1 >= glassY0) y = Math.max(glassY0, Math.min(glassY1, y));
            else y = pfc.y + pfc.h / 2;
          }
          // and never off the stage, whatever the card did
          x = Math.max(tw / 2 + 12, Math.min(W - tw / 2 - 12, x));
          y = Math.max(46, Math.min(BOTTOM - 14, y));
        }
        }
      }
      var g = mk('g', { 'class': 'label' }, layers.ui);
      var LF = 22, LH = 36, LPAD = 16;
      var tone = l.at === 'diagonal' ? (HI.lit || '#ffc83d') : HI.rim, toneDeep = shade(tone, -0.35);
      var lt = mk('text', { x: x, y: y, 'text-anchor': 'middle', 'font-size': LF, 'font-weight': 800,
                            fill: '#0f3f8f', text: l.text }, g);
      var lw = 0; try { lw = lt.getComputedTextLength ? lt.getComputedTextLength() : 0; } catch (e) { lw = 0; }
      if (!lw) lw = l.text.length * 13;
      var px0 = x - lw / 2 - LPAD, py0 = y - 6 - LH / 2, pw = lw + LPAD * 2;
      var shadow = mk('rect', { x: px0, y: py0 + 3, width: pw, height: LH, rx: LH / 2, fill: '#0f3f8f', 'fill-opacity': 0.16 }, g);
      var plate = mk('rect', { x: px0, y: py0, width: pw, height: LH, rx: LH / 2, fill: '#ffffff', stroke: tone, 'stroke-width': 3.5 }, g);
      var sheen = mk('rect', { x: px0 + 6, y: py0 + 4, width: pw - 12, height: LH * 0.38, rx: LH * 0.19, fill: tone, 'fill-opacity': 0.16, 'pointer-events': 'none' }, g);
      g.insertBefore(sheen, lt); g.insertBefore(plate, sheen); g.insertBefore(shadow, plate);
      if (l.arrow && m) {
        var pcx = x, pcy = y - 6, phx = pw / 2, phy = LH / 2;
        var dx = m.x - pcx, dy = m.y - pcy, d = Math.sqrt(dx * dx + dy * dy) || 1, ax = dx / d, ay = dy / d;
        var te = Math.min(dx ? phx / Math.abs(dx) : Infinity, dy ? phy / Math.abs(dy) : Infinity);
        var sx = pcx + dx * te + ax * 3, sy = pcy + dy * te + ay * 3;
        var tipX = m.x - ax * 6, tipY = m.y - ay * 6, HL = 16, HW = 9;
        var bx = tipX - ax * HL, by = tipY - ay * HL;
        if (te < 1) {
          var run = (bx - sx) * ax + (by - sy) * ay;
          if (run > 2) {
            var cx2 = (sx + bx) / 2 - ay * Math.min(14, run * 0.2), cy2 = (sy + by) / 2 + ax * Math.min(14, run * 0.2);
            var dpath = 'M' + sx.toFixed(1) + ' ' + sy.toFixed(1) + ' Q' + cx2.toFixed(1) + ' ' + cy2.toFixed(1) + ' ' + bx.toFixed(1) + ' ' + by.toFixed(1);
            mk('path', { d: dpath, fill: 'none', stroke: '#ffffff', 'stroke-width': 7.5, 'stroke-linecap': 'round', 'stroke-opacity': 0.9 }, g);
            mk('path', { d: dpath, fill: 'none', stroke: tone, 'stroke-width': 4.2, 'stroke-linecap': 'round' }, g);
          }
          var head = 'M' + tipX.toFixed(1) + ' ' + tipY.toFixed(1) +
                     ' L' + (bx - ay * HW).toFixed(1) + ' ' + (by + ax * HW).toFixed(1) +
                     ' L' + (bx + ay * HW).toFixed(1) + ' ' + (by - ax * HW).toFixed(1) + ' Z';
          mk('path', { d: head, fill: '#ffffff', stroke: '#ffffff', 'stroke-width': 6, 'stroke-linejoin': 'round', 'stroke-opacity': 0.9 }, g);
          mk('path', { d: head, fill: tone, stroke: toneDeep, 'stroke-width': 1.5, 'stroke-linejoin': 'round', 'class': 'tag-arrow' }, g);
        }
      }
      st.labelEl = g;
      if (l.cue && holdForWord(g, l.cue)) return;               // the tag arrives on its word
      if (l.enter && !reduced()) enter(g, 'ui');
    },
    badge: function (b) {
      var key = b.under || 'main';
      st.badgeSpecs = st.badgeSpecs || {}; st.badgeSpecs[key] = specOf(b);
      st.badges = st.badges || {};
      if (st.badges[key]) st.badges[key].remove();
      var x, y;
      if (b.under && st.compare && st.compare[b.under.split('.')[1]]) {
        var pnl = st.compare[b.under.split('.')[1]].panel;
        x = pnl.x + pnl.w / 2; y = pnl.y + pnl.h + 46;
      } else {
        if (st.panel && !(st.choiceEls && st.choiceEls.length)) {
          // under the card, in the control band, like a label (bandBelow)
          bandBelow();
          x = st.panel.x + st.panel.w / 2;
          y = controlY();
        } else {
          x = st.cx;
          y = belowShape(30, 34);
          if (st.choiceEls && st.choiceEls.length) y = Math.min(y, H - 64 - 60);
        }
      }
      var g = tag(layers.ui, {
        x: x - 84, y: y, w: 168, h: 44,
        label: b.text, tone: b.tone || conceptOf(b.text),
        attrs: { 'class': 'badge' }
      });
      st.badges[key] = g; if (b.live) st.liveBadge = g;
      // a tag put under a card that has stepped back steps back too
      if (b.under && st.compareFocus && b.under !== 'compare.' + st.compareFocus) dimTag(g, true, st.compareStyle === 'lean');
      var side = b.under && b.under.indexOf('compare.') === 0 ? b.under.split('.')[1] : null;
      var shown = function () {
        if (side) dropMark(side, true);
        // and the card's tab takes the name with it ("Convex pentagon": b.tab)
        if (side && b.tab && st.compare[side]) renameTag(st.compare[side].nameTab, b.tab, b.tone || conceptOf(b.text));
        if (!b.enter) return;
        if (b.sfx) sfx(b.sfx, { gain: 0.55 });
        if (b.sparkle && global.Juice && Juice.sparkle && !reduced()) { try { Juice.sparkle(g); } catch (e) {} }
        if (b.react) evt('compare:react', { state: b.react, card: side });
      };
      if (b.cue && holdForWord(g, b.cue, shown)) return;         // it arrives with its word
      if (b.enter && !reduced()) enter(g, 'ui');
      shown();
    },
    grow: function (o) {
      if (!o || !st.compare) return null;
      var waits = [];
      (o.card === 'both' ? ['left', 'right'] : [o.card]).forEach(function (side) {
        var c = st.compare[side];
        if (!c) return;
        if (o.instant) {
          c.diags.forEach(function (d) {
            if (d.word) { dropWord(d.word); d.word = null; }
            compareLine(c, d, true);
          });
          return;
        }
        var todo = c.diags.filter(function (d) { return d.state === 'hidden'; });
        var byWord = o.outsideOn ? todo.filter(function (d) { return d.out; }) : [];
        var each = o.each || 430, ms = o.ms || 540;
        todo.filter(function (d) { return byWord.indexOf(d) < 0; })
            .forEach(function (d, k) { waits.push(growDiag(c, d, ms, k * each)); });
        if (!byWord.length) return;
        var h = onWord(o.outsideOn, function () {
          byWord.forEach(function (d) { d.word = null; });
          Promise.all(byWord.map(function (d, k) { return growDiag(c, d, ms + 160, k * 260); })).then(function () {
            if (st.compare && st.compare[side] === c) discoverOutside(c, byWord, side);
          });
        });
        byWord.forEach(function (d) { d.state = 'waiting'; d.word = h; });
      });
      return waits.length ? Promise.all(waits) : null;
    },
    onWord: function (list) {
      (Array.isArray(list) ? list : [list]).forEach(function (w) {
        if (!w || !w.word) return;
        var hw = onWord(w.word, function () {
          if (w.sfx) sfx(w.sfx, { gain: w.gain || 0.5 });
          // the focus moves on its word too: the line turns from one card to the other
          if (w.focus && st.compare) focus(w.focus === 'even' ? 'compare' : 'compare.' + w.focus, w.focus === 'even' ? 'even' : (w.style || 'lean'));
          if (w.evidence && st.compare) compareEvidence(w.evidence.card, w.evidence.what);
          if (w.lit) apply({ lit: w.lit, litEach: w.each });
          if (w.knob != null && st.verts && st.verts[w.knob] && st.polyG) {
            st.vcolor = st.vcolor || {}; st.vcolor[w.knob] = HI.picked;
            // (and breathing from that word on — screen 10's "this vertex")
            if (w.breathe) { st.breatheAt = st.breatheAt || {}; st.breatheAt[w.knob] = true; }
            renderPoly();
            var kn = knobOf(w.knob); if (kn) sumPop(kn, 0, true);
          }
          if (reduced() || !st.compare) return;
          // and a card's marks lit again as the rule names them ("equal", "unequal")
          if (w.glow && st.compare[w.glow] && st.compare[w.glow].evidence) {
            warmPulse([st.compare[w.glow].evidence], { together: true, peak: '1.04', ms: 560 });
          }
          if (w.pulse) {
            var ks = w.pulse === 'both' ? ['left', 'right'] : [w.pulse];
            warmPulse(ks.map(function (k) { return st.compare[k] && st.compare[k].pg; }), { together: true, peak: '1.04', ms: 560 });
          }
        });
        if (hw && w.nth) hw.nth = w.nth;
      });
    },
    /* The small learning marks, INSIDE and OUTSIDE, popped in one after the other. */
    marks: function (m) {
      if (!m || !st.compare) return;
      ['left', 'right'].forEach(function (side, i) {
        if (!m[side]) return;
        var g = compareMark(side, m[side]);
        if (!g || m.enter === false || reduced()) return;
        if (m.cue && holdForWord(g, String(m[side]).toLowerCase(), function () { enter(g, 'ui'); sfx('pop', { gain: 0.35 }); })) return;
        g.style.opacity = 0;
        later(i * 240, function () { g.style.opacity = ''; enter(g, 'ui'); sfx('pop', { gain: 0.35 }); });
      });
    },
    ghost: function (gh) { st.ghost = gh ? { from: resolveVertex(gh.from), to: resolveVertex(gh.to) } : null; renderPoly(); },
    diagonals: function (d) {
      if (d.diagonals === 'all') {
        var seq = d.animate === 'sequential' && !reduced();
        var all = Poly.allDiagonals(st.n);
        st.diagonals = all.map(function (pair, k) { return Object.assign(pair, { animate: seq, delay: k * (d.each || 200), each: d.each }); });
        st.segment = null; st.vcolor = null; renderPoly();
        if (seq && all.length) {
          var each = d.each || 200, dur = Math.max(500, Math.min(1000, (d.each || 1150) - 250));
          return new Promise(function (res) { setTimeout(res, (all.length - 1) * each + dur + 200); });
        }
      }
    },
    choices: function (list, spec) {
      if (st.choiceG) { st.choiceG.remove(); st.choiceG = null; }
      if (!list) {
        st.choiceEls = [];
        if (st.panel && st.panel.controls) { st.panel.controls = false; applySeat(true); }
        return;
      }
      var cue = spec && spec.cue;
      var cueFor = function (label) {
        if (!cue) return null;
        if (cue === true) return String(label).split(/\s+/);
        return cue[label] || null;
      };
      var g = mk('g', { 'class': 'choices' }, layers.ui); st.choiceG = g; st.choiceEls = [];
      var longest = list.reduce(function (n, t) { return Math.max(n, String(t).length); }, 0);
      var bw = Math.max(150, Math.min(250, longest * 13 + 62)), gap = 24, bh = 50;
      var row = list.length * bw + (list.length - 1) * gap;
      var x0 = (st.panel ? st.panel.x + st.panel.w / 2 : W / 2) - row / 2;
      var rowCentre = x0 + row / 2;
      var y = controlY();
      x0 = Math.max(14, Math.min(x0, W - row - 14));
      list.forEach(function (label, i) {
        var x = x0 + i * (bw + gap);
        var b = pill(g, {
          x: x, y: y, w: bw, h: bh, label: label,
          tone: 'uiPrimary',
          press: true, attrs: { 'class': 'choice', 'data-label': label }
        });
        st.choiceEls.push(b);
        if (spec && spec.hold) {
          b.style.opacity = '0'; b._held = true; b._heldEvents = b.style.pointerEvents || ''; b.style.pointerEvents = 'none';
          heldForWord.push({ words: [], el: b, onShow: null });
          return;
        }
        var words = cueFor(label);
        if (words && holdForWord(b, words)) return;       // arrives with its word
        if (spec && spec.enter === false) return;          // (its entrance is the caller's: `merge`)
        if (!reduced()) { b.style.opacity = 0; later(90 * i, function () { b.style.opacity = 1; enter(b, 'ui'); }); }
      });
      var total = st.choiceEls.reduce(function (n, b) { return n + b._rect.w; }, 0) + gap * (list.length - 1);
      var cursor = rowCentre - total / 2;
      st.choiceEls.forEach(function (b) {
        var dx = cursor - b._rect.x;
        if (Math.abs(dx) > 0.5) {
          b.setAttribute('transform', 'translate(' + dx.toFixed(1) + ',0)');
          b._rect = { x: b._rect.x + dx, y: b._rect.y, w: b._rect.w, h: b._rect.h };
        }
        cursor += b._rect.w + gap;
      });
      liftAboveChoices();
    },
    measurements: function (m) {
      if (m === 'live') { st.measure = { sides: 'all', angles: 'all', units: true }; renderPoly(); }
    },
    summary: function (o) {
      if (!o || st.kind !== 'summary') return null;
      if (o.card) return summaryShow(o.card);
      if (o.collect) return summaryCollect(o.collect);
      if (o.final) return summaryFinal();
      return null;
    }
  };

  function specOf(o) {
    if (!o || typeof o !== 'object') return o;
    var c = JSON.parse(JSON.stringify(o));
    delete c.enter; delete c._panel;
    return c;
  }

  function snapshot() {
    if (!st.kind || !st.buildSpec || !/^(polygon|compare)$/.test(st.kind)) return st.kind ? { kind: st.kind } : null;
    var copy = function (o) { return o == null ? (o === undefined ? null : o) : JSON.parse(JSON.stringify(o)); };
    return {
      kind: st.kind, spec: copy(st.buildSpec), panel: copy(st.panel),
      verts: copy(st.verts), n: st.n, cx: st.cx, cy: st.cy, r: st.r,
      picked: st.picked == null ? null : st.picked,
      segment: copy(st.segment), vcolor: copy(st.vcolor),
      diagonals: (st.diagonals || []).map(function (d) { return { a: d[0], b: d[1], solid: !!d.solid }; }),
      measure: copy(st.measure), highlightOutside: !!st.highlightOutside, onlyOutside: !!st.onlyOutside,
      ghost: copy(st.ghost), label: copy(st.labelSpec), badges: copy(st.badgeSpecs),
      compareFocus: st.compareFocus || null, compareStyle: st.compareStyle || null,
      // which of each card's diagonals are drawn, and the small marks under them
      compareDrawn: st.compare ? Object.keys(st.compare).reduce(function (o, k) {
        o[k] = st.compare[k].diags.map(function (d, i) { return d.state === 'drawn' || d.state === 'growing' ? i : -1; }).filter(function (i) { return i >= 0; });
        return o;
      }, {}) : null,
      compareMarks: copy(st.compareMarkSpec),
      liveText: st.liveBadge && st.liveBadge._text ? st.liveBadge._text.textContent : null
    };
  }

  /** Put a written-down scene back. False if it is not one that can be. */
  function restore(snap) {
    if (!snap || !snap.spec || !BUILD[snap.kind]) return false;
    var spec = Object.assign({}, snap.spec, { enter: false, _panel: snap.panel });
    if (snap.kind === 'polygon') { spec.label = null; spec.badge = null; spec.diagonals = null; }
    BUILD[snap.kind](spec);
    if (snap.kind !== 'compare') {
      st.verts = snap.verts; st.n = snap.n; st.cx = snap.cx; st.cy = snap.cy; st.r = snap.r;
      st.picked = snap.picked == null ? null : snap.picked;
      st.segment = snap.segment; st.vcolor = snap.vcolor;
      st.diagonals = (snap.diagonals || []).map(function (d) { return Object.assign([d.a, d.b], d.solid ? { solid: true } : {}); });
      st.measure = snap.measure; st.highlightOutside = snap.highlightOutside; st.onlyOutside = snap.onlyOutside;
      st.ghost = snap.ghost;
      renderPoly();
      // put back as they were seen: shown, not waiting again for a word
      if (snap.label) op.label(Object.assign({}, snap.label, { cue: null, enter: false }));
    } else {
      Object.keys(snap.compareDrawn || {}).forEach(function (k) {
        var c = st.compare && st.compare[k];
        if (c) snap.compareDrawn[k].forEach(function (i) { if (c.diags[i]) compareLine(c, c.diags[i], true); });
      });
      if (snap.compareMarks) op.marks(Object.assign({}, snap.compareMarks, { enter: false }));
      if (snap.compareFocus) focus('compare.' + snap.compareFocus, snap.compareStyle || 'dim-others');
    }
    Object.keys(snap.badges || {}).forEach(function (k) { op.badge(Object.assign({}, snap.badges[k], { cue: null, enter: false })); });
    if (snap.liveText && st.liveBadge && st.liveBadge._text) st.liveBadge._text.textContent = snap.liveText;
    applySeat(false);
    return true;
  }

  function apply(spec) {
    if (!spec) return;
    if (spec.kind) BUILD[spec.kind] && BUILD[spec.kind](spec);
    if (spec.highlight) op.highlight(spec.highlight);
    var drawing = spec.diagonals && !spec.kind ? op.diagonals(spec) : null;
    if ('ghost' in spec && !spec.kind) op.ghost(spec.ghost);
    if (spec.label && !spec.kind) op.label(spec.label);
    // a carried name tag is taken down by a beat that says label: null
    if (spec.label === null && st.labelEl) { st.labelEl.remove(); st.labelEl = null; st.labelSpec = null; }
    // the side that was named, and its tag, fade before the next try
    if (spec.side === null) clearSide();
    if (spec.side === 'done') freezeSide();
    if (spec.connectState) setConnect(spec.connectState);
    if (spec.dots != null && st.polyG) {
      var were = !!st.showVerts;
      st.showVerts = !!spec.dots; st.touchVerts = !!spec.dots; renderPoly();
      if (spec.dots && !were && !reduced()) (st.knobEls || []).forEach(function (k) {
        try { k.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' }); } catch (e) {}
      });
    }
    if (spec.badge && !spec.kind) op.badge(spec.badge);
    if ('choices' in spec) op.choices(spec.choices, spec);
    if (spec.measurements) op.measurements(spec.measurements);
    if (spec.returnItem && st.sort && st.sort.dragging) returnItem(st.sort.dragging);
    if (spec.autoConcave && st.verts && st.polyG) {
      var ai = spec.autoConcave.vertex || 0, av = st.verts[ai], ac = Poly.centroid(st.verts);
      var at = st.verts.length === 4 ? 1.3 : 0.88;
      var target = { x: av.x + (ac.x - av.x) * at, y: av.y + (ac.y - av.y) * at }, from = { x: av.x, y: av.y };
      var paced = spec.autoConcave.settle != null;
      st.highlightOutside = !paced; st.showVerts = true; st.touchVerts = false; st.breatheAt = null;
      st.vcolor = {}; st.vcolor[ai] = HI.picked; renderPoly();
      return new Promise(function (res) {
        var t0 = null, ms = reduced() ? 0 : (spec.autoConcave.ms || 1000);
        var step = function (tn) {
          if (t0 == null) t0 = tn;
          var k = ms ? Math.min(1, (tn - t0) / ms) : 1, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          st.verts[ai] = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e };
          updatePoly();
          if (st.liveBadge) {
            var cc = isDented(st.verts, ai);
            st.liveBadge._text.textContent = inLang(cc ? 'Concave' : 'Convex');
            if (st.liveBadge._retint) st.liveBadge._retint(cc ? 'concave' : 'convex');
          }
          if (k < 1 && global.requestAnimationFrame) global.requestAnimationFrame(step);
          else if (!paced) { rememberMade('concave', st.verts, ai); renderPoly(); if (st.diagG) juice('flash', st.diagG); sfx('zip', { gain: 0.5 }); later(200, res); }
          else {
            rememberMade('concave', st.verts, ai); renderPoly();
            later(reduced() ? 0 : spec.autoConcave.settle, function () {
              st.highlightOutside = true; renderPoly();
              if (st.diagG) juice('flash', st.diagG); sfx('zip', { gain: 0.5 });
              later(reduced() ? 0 : (spec.autoConcave.hold || 1000), res);
            });
          }
        };
        if (global.requestAnimationFrame && ms) global.requestAnimationFrame(step); else step(0);
      });
    }
    if (spec.reveal && st.choiceEls) {
      var doReveal = function () {
        (st.choiceEls || []).forEach(function (b) {
          if (b.getAttribute('data-label') !== spec.reveal) return;
          if (b._retint) b._retint('uiSuccess');
          if (global.Juice && Juice.sparkle && !reduced()) { try { Juice.sparkle(b); } catch (x) {} }
        });
      };
      // (on its word, `cue`, when he says it)
      if (!(spec.cue && onWord(spec.cue, doReveal))) doReveal();
    }
    if (spec.merge && st.choiceG) {
      var doMerge = function () {
      if (!st.choiceG) return;
      var oldG = st.choiceG, oldEls = (st.choiceEls || []).slice();
      st.choiceG = null;                                   // (so op.choices builds beside it, not over it)
      op.choices([spec.merge], { enter: false });
      var one = st.choiceEls[0];
      if (one) {
        if (one._retint) one._retint('uiSuccess');
        var mid = one._rect ? one._rect.x + one._rect.w / 2 : W / 2;
        if (!reduced()) {
          one.style.opacity = 0;
          oldEls.forEach(function (b) {
            if (!b || !b._rect || !b.animate) return;
            var dx = mid - (b._rect.x + b._rect.w / 2), keep = b.getAttribute('data-label') === spec.merge;
            try { b.animate([{ translate: '0 0', opacity: 1 }, { translate: dx.toFixed(1) + 'px 0', opacity: keep ? 1 : 0, offset: 0.7 }, { translate: dx.toFixed(1) + 'px 0', opacity: 0 }],
                            { duration: 460, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }); } catch (x) {}
          });
          later(320, function () { if (one.parentNode) { one.style.opacity = 1; enter(one, 'ui'); } });
        }
      }
      later(reduced() ? 0 : 480, function () { if (oldG.parentNode) oldG.remove(); });
      };
      if (!(spec.cue && onWord(spec.cue, doMerge))) doMerge();
    }
    if (spec.lit === 'diagonals' && st.diagG) {
      var each = spec.litEach != null ? spec.litEach : 260;
      [].slice.call(st.diagG.childNodes).filter(function (g) { return g.style && g.style.display !== 'none'; }).forEach(function (g, k) {
        later(reduced() ? 0 : k * each, function () {
          [].slice.call(g.querySelectorAll('line')).forEach(function (ln) {
            ln.setAttribute('stroke', '#ffd54a');
            ln.style.filter = 'drop-shadow(0 0 2.5px rgba(255, 176, 32, 0.95))';
          });
          g.setAttribute('data-lit', '1');
          if (g.animate && !reduced()) { try { g.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' }); } catch (e) {} }
        });
      });
    }

    if ('quietWords' in spec) st.quietWords = !!spec.quietWords;
    if (spec.onWord) op.onWord(spec.onWord);
    var growing = spec.grow ? op.grow(spec.grow) : null;
    if (spec.marks) op.marks(spec.marks);
    if (spec.kind) applySeat(false);
    if (spec.summary) return op.summary(spec.summary);
    return growing || drawing;
  }

  function targets(ref) {
    if (!ref) return [];
    if (ref === 'polygon' || ref === 'polygon.vertices') return ref === 'polygon' ? [st.polyG] : (st.knobEls || st.vertEls || []);
    if (ref === 'polygon.sides') return st.edgeEls || [];
    if (ref === 'polygon.diagonals') return st.diagG ? [st.diagG] : [];
    if (ref.indexOf('polygon.vertex.') === 0) { var i = +ref.split('.')[2]; return knobOf(i) ? [knobOf(i)] : []; }
    if (ref === 'segment.endpoint') return st.segment && knobOf(st.segment[1]) ? [knobOf(st.segment[1])] : [];
    if (ref === 'diagonal.endpoints') {
      var dd = st.segment || ((st.diagonals || []).length ? st.diagonals[st.diagonals.length - 1] : null);
      return dd && knobOf(dd[0]) ? [knobOf(dd[0]), knobOf(dd[1])] : [];
    }
    if (ref === 'picked') return st.picked != null && knobOf(st.picked) ? [knobOf(st.picked)] : [];
    if (ref === 'grid') return st.cards || [];
    if (ref.indexOf('compare.') === 0) { var c = st.compare && st.compare[ref.split('.')[1]]; return c ? [c.g, c.pg] : []; }
    if (ref === 'sort.tray' || ref === 'sort.item') return st.sort ? st.sort.items : [];
    if (ref === 'summary') return st.summary ? Object.keys(st.summary.cards).map(function (k) { return st.summary.cards[k]; }) : [];
    if (ref === 'summary.card') return st.summary && st.summary.active ? [st.summary.cards[st.summary.active]] : [];
    return [];
  }

  /** A name tag goes with its card: faded and drained when the card is. */
  // `soft`: the lighter step back of the compare sequence ('lean')
  function dimTag(el, dim, soft) {
    if (!el || !el.style) return;
    if (el._held) { el._dimLater = { dim: dim, soft: soft }; return; }
    el.style.transition = 'opacity 320ms ease, filter 320ms ease';
    el.style.opacity = dim ? (soft ? .6 : .42) : '';
    el.style.filter = dim ? (soft ? 'saturate(.55) brightness(1.03)' : 'saturate(.25) brightness(1.04)') : '';
  }

  function focus(ref, style) {
    var els = targets(ref);
    if (style === 'even' && st.compare) {
      st.compareFocus = null; st.compareStyle = null;
      Object.keys(st.compare).forEach(function (k) {
        var c = st.compare[k];
        [c.g, c.pg].forEach(function (el) { el.style.transition = 'opacity 320ms ease, filter 320ms ease'; el.style.opacity = 1; el.style.filter = ''; });
        [(st.badges || {})['compare.' + k], c.tag, (st.compareMarks || {})[k], c.nameTab].forEach(function (el) { dimTag(el, false); });
        if (c.ring) c.ring.style.opacity = '0';
      });
      return;
    }
    if ((style === 'dim-others' || style === 'lean') && st.compare) {
      var soft = style === 'lean';
      st.compareFocus = ref.split('.')[1]; st.compareStyle = style;
      Object.keys(st.compare).forEach(function (k) {
        var c = st.compare[k]; var dim = 'compare.' + k !== ref;
        [c.g, c.pg].forEach(function (el) {
          el.style.opacity = dim ? (soft ? .6 : .42) : 1;
          el.style.filter = dim ? (soft ? 'saturate(.55) brightness(1.03)' : 'saturate(.25) brightness(1.04)') : '';
          el.style.transition = 'opacity 320ms ease, filter 320ms ease';
        });
        dimTag((st.badges || {})['compare.' + k], dim, soft);
        dimTag(c.tag, dim, soft);
        dimTag((st.compareMarks || {})[k], dim, soft);
        dimTag(c.nameTab, dim, soft);
        // and the one in focus wears the ring (the other card's comes off)
        if (c.ring) c.ring.style.opacity = dim ? '0' : '1';
      });
      return;
    }
    els.forEach(function (e, i) {
      if (!e) return;
      if (e.classList && e.classList.contains('vertex')) { e.setAttribute('opacity', 1); e.setAttribute('r', 15); }
      if (reduced() || !e.animate) return;
      e.style.transformBox = 'fill-box'; e.style.transformOrigin = 'center';
      e.animate([{ scale: '1' }, { scale: '1.14' }, { scale: '1' }], { duration: 700, delay: i * 700, iterations: 1, easing: 'ease-in-out' });
    });
  }

  var WARM = 'rgba(255, 150, 40, 0.85)';
  function warmPulse(els, o) {
    o = o || {};
    var n = 0;
    (els || []).filter(Boolean).slice(0, 12).forEach(function (e, i) {
      if (!e.animate) return;
      e.style.transformBox = 'fill-box'; e.style.transformOrigin = 'center';
      var knob = e.classList && e.classList.contains('knob');
      var peak = o.peak || (knob ? '1.5' : '1.045');
      try {
        e.animate([
          { scale: '1', filter: 'brightness(1) drop-shadow(0 0 0 rgba(255,150,40,0))' },
          { scale: peak, filter: 'brightness(1.12) drop-shadow(0 0 7px ' + WARM + ')', offset: 0.4 },
          { scale: '1', filter: 'brightness(1) drop-shadow(0 0 0 rgba(255,150,40,0))' }
        ], { duration: o.ms || 480, delay: (o.together ? 0 : i * (o.gap || 60)) + (o.delay || 0), easing: 'cubic-bezier(.3,1.25,.45,1)' });
        n++;
      } catch (x) {}
    });
    return n;
  }
  /** The polygon's own outline, as a path to borrow the shape of. */
  function outlineOf() { return st.fill && st.fill.getAttribute && st.fill.getAttribute('d'); }
  function regionGlow(d, outside) {
    if (!d || !layers.fx) return 0;
    var g = mk('g', { 'class': 'concept-glow', 'pointer-events': 'none' }, layers.fx);
    var el;
    if (outside) {
      var id = 'outside-clip-' + (++glowSeq);
      var defs = mk('defs', {}, g);
      var cp = mk('clipPath', { id: id }, defs);
      mk('path', { d: 'M-50 -50 H' + (W + 50) + ' V' + (H + 50) + ' H-50 Z ' + d, 'clip-rule': 'evenodd' }, cp);
      el = mk('path', { d: d, fill: 'none', stroke: '#fff4d6', 'stroke-width': 26, 'stroke-linejoin': 'round', 'clip-path': 'url(#' + id + ')' }, g);
    } else {
      el = mk('path', { d: d, fill: '#fff4d6', stroke: 'none' }, g);
    }
    el.setAttribute('opacity', 0);
    if (!el.animate) { g.remove(); return 0; }
    try {
      el.animate([{ opacity: 0 }, { opacity: outside ? 0.55 : 0.38, offset: 0.4 }, { opacity: 0 }], { duration: 620, easing: 'ease-in-out' })
        .finished.then(function () { g.remove(); }, function () { g.remove(); });
    } catch (e) { g.remove(); return 0; }
    return 1;
  }
  var glowSeq = 0;
  /** Which corners the sentence means: the one(s) the lesson has marked, else all. */
  function relevantKnobs() {
    var ks = st.knobEls || [];
    var marked = st.vcolor ? Object.keys(st.vcolor).map(Number).filter(function (i) { return ks[i]; }) : [];
    if (st.picked != null && ks[st.picked] && marked.indexOf(st.picked) < 0) marked.push(st.picked);
    var shown = marked.length ? marked.map(function (i) { return ks[i]; }) : ks;
    return shown.filter(function (k) { return k && k.getAttribute('opacity') !== '0'; });
  }
  function reflexCorners(v) {
    var A = Poly.interiorAngles(v), out = [];
    for (var i = 0; i < A.length; i++) if (A[i] > 180.5) out.push(i);
    return out;
  }
  function summaryWord(term, line) {
    void line;
    var S = st.summary; if (!S) return 0;
    var c = S.active ? S.cards[S.active] : null;
    if (!c) return term === 'polygon' ? warmPulse(S.collected.map(function (k) { return S.cards[k]._pop; }), { together: true, peak: '1.05' }) : 0;
    switch (term) {
      case 'polygon': return warmPulse([c._outline], { peak: '1.04' });
      case 'vertex': return c._knobs.length ? warmPulse(c._knobs, { peak: '1.5' }) : (c._mover ? warmPulse([c._mover], { peak: '1.5' }) : 0);
      case 'side': {
        var sl = c._sideLines || (c._line && c._lineKind === 'side' ? [c._line] : null) || c._near;
        if (sl && sl.length) return trace(sl);
        return c._ticks && c._ticks.length ? warmPulse(c._ticks, { peak: '1.5' }) : trace([c._outline]);
      }
      case 'angle':
        if (c._wedge) return warmPulse([c._wedge], { peak: '1.25' });
        return c._wedges && c._wedges.length ? warmPulse(c._wedges, { peak: '1.25' }) : 0;
      case 'diagonal': {
        var ds = (c._diags || []).concat(c._line && c._lineKind !== 'side' ? [c._line] : []);
        return ds.length ? trace(ds) : 0;
      }
      case 'inside': return regionGlow(pathOf(c._verts));
      case 'outside': return regionGlow(pathOf(c._verts), true);
      case 'equal': { var eq = (c._ticks || []).concat(c._wedges || []); return eq.length ? warmPulse(eq, { peak: '1.3' }) : 0; }
      case 'convex': case 'concave': case 'regular': case 'irregular':
        return c._id === term ? warmPulse([c._tag], { peak: '1.08' }) : 0;
      default: return 0;
    }
  }
  function traceSides(v) {
    if (!v || !v.length || reduced()) return 0;
    var g = mk('g', { 'class': 'word-sides', 'pointer-events': 'none' }, layers.fx), n = v.length;
    v.forEach(function (a, i) {
      var b = v[(i + 1) % n], len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      var ln = mk('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: WARM, 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0.95 }, g);
      ln.style.strokeDasharray = len + ' ' + len; ln.style.strokeDashoffset = len + 'px';
      try { ln.animate([{ strokeDashoffset: len + 'px' }, { strokeDashoffset: '0px' }], { duration: 260, delay: i * 150, easing: 'ease-out', fill: 'forwards' }); } catch (e) {}
    });
    later(n * 150 + 700, function () { fadeOut(g); });
    return n;
  }
  function traceAngles(v) {
    if (!v || !v.length || reduced()) return 0;
    var g = mk('g', { 'class': 'word-angles', 'pointer-events': 'none' }, layers.fx), n = v.length, R = 24, c = Poly.centroid(v);
    v.forEach(function (p, i) {
      var a = v[(i + n - 1) % n], b = v[(i + 1) % n];
      var a1 = Math.atan2(a.y - p.y, a.x - p.x), a2 = Math.atan2(b.y - p.y, b.x - p.x);
      var bis = Math.atan2(c.y - p.y, c.x - p.x), TAU = 2 * Math.PI;
      var d1 = ((a2 - a1) % TAU + TAU) % TAU, db = ((bis - a1) % TAU + TAU) % TAU;
      var sweep = db < d1 ? 1 : 0, span = sweep ? d1 : TAU - d1, large = span > Math.PI ? 1 : 0;
      var x1 = p.x + Math.cos(a1) * R, y1 = p.y + Math.sin(a1) * R, x2 = p.x + Math.cos(a2) * R, y2 = p.y + Math.sin(a2) * R;
      var d = 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' A' + R + ' ' + R + ' 0 ' + large + ' ' + sweep + ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1);
      var wedge = mk('path', { d: 'M' + p.x + ' ' + p.y + ' L' + x1.toFixed(1) + ' ' + y1.toFixed(1) + d.slice(d.indexOf('A') - 1) + ' Z', fill: WARM, 'fill-opacity': 0.35, stroke: 'none', opacity: 0 }, g);
      var arc = mk('path', { d: d, fill: 'none', stroke: WARM, 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0 }, g);
      [wedge, arc].forEach(function (el) {
        try { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: i * 150, easing: 'ease-out', fill: 'forwards' }); } catch (e) {}
      });
    });
    later(n * 150 + 700, function () { fadeOut(g); });
    return n;
  }
  function emphasize(term, ctx) {
    if (!svg || reduced() || dragging()) return 0;
    if (st.quietWords) return 0;
    var kind = st.kind, line = String((ctx && ctx.line) || '').toLowerCase();
    if (kind === 'summary') return summaryWord(term, line);
    switch (term) {
      case 'polygon':
        if (kind === 'grid') return 0;
        // "this one" is the card in focus; "both" and no focus, the pair
        if (kind === 'compare') return warmPulse(Object.keys(st.compare || {}).filter(function (k) { return !st.compareFocus || /both/.test(line) || k === st.compareFocus; })
                                                   .map(function (k) { return st.compare[k].pg; }), { together: true });
        if (kind === 'sort') return 0;   // (every tray card swelling at once: the animation review)
        if (kind === 'swipe-sort') return warmPulse(st.swipe && st.swipe.card ? [st.swipe.card] : [], { peak: '1.03' });
        return warmPulse([st.polyG]);
      case 'vertex': {
        var mine = relevantKnobs(), all = (st.knobEls || []).filter(function (k) { return k && k.getAttribute('opacity') !== '0'; });
        if (st.vstate && /\b(another|different|other)\s+vert/.test(line)) {
          return warmPulse(st.vstate.map(function (vs, q) { return /-available$/.test(vs) ? knobOf(q) : null; }), { gap: 240 });
        }
        if (/\b(another|different|other)\s+vert/.test(line) && mine.length < all.length) {
          return warmPulse(all.filter(function (k) { return mine.indexOf(k) < 0; }));
        }
        return warmPulse(mine);
      }
      case 'side':
        if (kind === 'compare') { var fs = st.compareFocus ? st.compare[st.compareFocus] : null; return fs ? traceSides(fs.verts) : 0; }
        if (st.segLine) return trace([st.segLine]);
        if (st.sideDotEls && st.sideDotEls.filter(Boolean).length) return warmPulse(st.sideDotEls, { peak: '1.6' });
        return st.fill ? trace([st.fill]) : 0;
      case 'line segment':
        return st.segLine ? trace([st.segLine]) : 0;
      case 'diagonal': {
        if (kind === 'compare') {
          // "this one" is the card in focus; otherwise both cards' diagonals
          var cards = Object.keys(st.compare || {}).filter(function (k) { return !st.compareFocus || /\bboth\b/.test(line) || k === st.compareFocus; });
          var dl = [];
          cards.forEach(function (k) { var pg = st.compare[k].pg; if (pg) dl = dl.concat([].slice.call(pg.querySelectorAll('line'))); });
          return dl.length ? trace(dl) : 0;
        }
        var shown = st.diagG ? [].slice.call(st.diagG.childNodes).filter(function (g) { return g.style.display !== 'none'; }) : [];
        return shown.length ? trace(shown) : 0;
      }
      case 'angle': {
        if (kind === 'compare') { var fa = st.compareFocus ? st.compare[st.compareFocus] : null; return fa ? traceAngles(fa.verts) : 0; }
        var wedges = st.measG ? [].slice.call(st.measG.querySelectorAll('[data-angle]')) : [];
        return wedges.length ? warmPulse(wedges, { peak: '1.15' }) : warmPulse(relevantKnobs());
      }
      case 'inside':
        // the inside of the card in focus glows, and its inside diagonals with it
        if (kind === 'compare') {
          var f1 = st.compareFocus ? st.compare[st.compareFocus] : null;
          if (!f1) return 0;
          liftLines(drawnLines(f1, false));
          return regionGlow(pathOf(f1.verts));
        }
        return regionGlow(outlineOf());
      case 'outside':
        if (kind === 'compare') { var f2 = st.compareFocus ? st.compare[st.compareFocus] : null; return f2 ? liftLines(drawnLines(f2, true), true) : 0; }
        return regionGlow(outlineOf(), true);
      case 'equal': {
        var ticks = st.measG ? [].slice.call(st.measG.querySelectorAll('.eq-tick')) : [];
        return ticks.length ? warmPulse(ticks, { peak: '1.3' }) : 0;
      }
      case 'convex':
      case 'concave': {
        var want = term === 'concave';
        var isIt = function (v) { var c = Poly.classify(v); return want ? c.concave : c.convex; };
        if (kind === 'sort') {                                  // the bin that is named, never the answers
          return warmPulse((st.sort ? st.sort.bins : []).filter(function (b) { return b._bin && b._bin.id === term; }), { peak: '1.03' });
        }
        if (kind === 'compare') {
          var hit = Object.keys(st.compare || {}).map(function (k) { return st.compare[k]; }).filter(function (c) { return isIt(c.verts); });
          return warmPulse(hit.map(function (c) { return c.pg; }).concat(hit.map(function (c) { return (st.badges || {})['compare.' + (st.compare.left === c ? 'left' : 'right')]; })));
        }
        if (kind === 'polygon' && st.verts && st.verts.length >= 3 && isIt(st.verts)) {
          if (want) {
            // the corner that caves in first, then the whole shape
            var bent = reflexCorners(st.verts).map(knobOf).filter(Boolean);
            var n0 = warmPulse(bent, { peak: '1.6' });
            later(n0 ? 260 : 0, function () { warmPulse([st.polyG]); });
            return 1;
          }
          return warmPulse([st.polyG]);
        }
        return 0;                                              // not made yet: nothing to name
      }
      case 'regular':
      case 'irregular': {
        var reg = term === 'regular';
        if (kind === 'compare') {
          var cs = Object.keys(st.compare || {}).map(function (k) { return st.compare[k]; }).filter(function (c) { return !!Poly.isRegular(c.verts) === reg; });
          return warmPulse(cs.map(function (c) { return c.pg; }).concat(cs.map(function (c) { return c.tag; })));
        }
        // the evidence: the equal marks, or the readings that differ
        var ev = st.measG ? [].slice.call(st.measG.querySelectorAll(reg ? '.eq-tick,[data-angle]' : '.meas,[data-angle]')) : [];
        return ev.length ? warmPulse(ev, { peak: '1.12' }) : 0;
      }
      default:
        return 0;                                               // an action word: lettering only
    }
  }
  /** A finger is on the glass moving something: the board is the child's. */
  var pressed = false;
  function dragging() { return pressed; }

  function trace(els, color) {
    var lines = [];
    els.forEach(function (e) {
      if (!e) return;
      if (e.tagName === 'line' || e.tagName === 'path') { lines.push(e); return; }
      var kids = e.querySelectorAll ? e.querySelectorAll('line,path') : [];
      for (var i = 0; i < kids.length; i++) lines.push(kids[i]);
    });
    if (!lines.length) return 0;
    var drawn = 0;
    lines.slice(0, 24).forEach(function (src, i) {
      if (src.__drawing) return;
      var copy;
      try { copy = src.cloneNode(false); } catch (e) { return; }
      copy.removeAttribute('style');
      copy.setAttribute('class', 'dc-trace');
      // frost over the blue, whatever the word's ink (see halo())
      void color;
      copy.setAttribute('stroke', '#f2fdff');
      copy.setAttribute('stroke-width', 9);
      copy.setAttribute('stroke-linecap', 'round');
      copy.setAttribute('fill', 'none');
      copy.removeAttribute('stroke-dasharray');
      copy.setAttribute('opacity', 0);
      copy.setAttribute('pointer-events', 'none');
      layers.fx.appendChild(copy);
      drawn++;
      if (!copy.animate) { copy.remove(); return; }
      var a = copy.animate(
        [{ opacity: 0 }, { opacity: 0.9, offset: 0.25 }, { opacity: 0.9, offset: 0.6 }, { opacity: 0 }],
        { duration: 1500, delay: i * 55, easing: 'ease-out', fill: 'forwards' }
      );
      a.finished.then(function () { copy.remove(); }, function () { copy.remove(); });
    });
    return drawn;
  }

  function element(ref) {
    if (ref === 'answer' || ref === 'option' || ref === 'item') return st.lastEl || st.polyG || svg;
    if (ref === 'vertex') return st.lastEl || svg;
    if (ref === 'side' || ref === 'angle' || ref === 'diagonal') return st.lastEl || st.polyG || svg;
    if (ref === 'stage') return svg;
    var t = targets(ref); return t[0] || st.polyG || svg;
  }

  function nearestVertex(p, exclude, within) {
    var best = -1, bd = Infinity;
    st.verts.forEach(function (v, i) { if (i === exclude) return; var d = Math.hypot(v.x - p.x, v.y - p.y); if (d < bd) { bd = d; best = i; } });
    return bd < (within || 76) ? best : -1;
  }

  function missedCorner(targets, said, busy) {
    showTargets(targets || [], true);
    later(1400, function () { if (!(busy && busy())) showTargets([], false); });
    onTap('wrong', said || { t: 'Drop it on a corner!', vo: 'fb15' });
  }

  function dragVertices(idxs, moveFn, upFn, ctx) {
    var active = -1, pid = null, last = null, grab = { x: 0, y: 0 };
    idxs.forEach(function (i) {
      var h = st.vertEls[i]; if (h) { h.style.cursor = 'grab'; h.style.pointerEvents = 'all'; }
      var k = knobOf(i); if (k) k.setAttribute('opacity', 1);
    });
    var win = svg.ownerDocument.defaultView || global;
    function down(e) {
      var t = e.target; if (!t || !t.classList || !t.classList.contains('vertex')) return;
      var i = +t.getAttribute('data-i'); if (idxs.indexOf(i) < 0) return;
      if (global.Input && Input.guarded) return;
      if (active >= 0 || (e.button != null && e.button > 0)) return;
      active = i; pid = e.pointerId; last = pt(e);
      var cv = st.verts && st.verts[i];
      grab = cv ? { x: cv.x - last.x, y: cv.y - last.y } : { x: 0, y: 0 };
      try { svg.setPointerCapture && svg.setPointerCapture(e.pointerId); } catch (x) {}
      e.preventDefault();
    }
    function mine(e) { return active >= 0 && (pid == null || e.pointerId === pid); }
    function move(e) {
      if (!mine(e)) return;
      if (e.pointerType === 'mouse' && e.buttons === 0) { up(e); return; }     // its release was missed
      last = pt(e); moveFn({ x: last.x + grab.x, y: last.y + grab.y }, active);
    }
    function up(e) {
      if (!mine(e)) return;
      var i = active; active = -1; pid = null;
      var cancelled = !!e && (e.type === 'pointercancel' || e.type === 'lostpointercapture');
      upFn(e && e.type === 'pointerup' ? pt(e) : last, i, { cancelled: cancelled });
    }
    on(st.polyG, 'pointerdown', down); on(win, 'pointermove', move); on(win, 'pointerup', up); on(win, 'pointercancel', up);
    on(svg, 'lostpointercapture', function (e) { if (mine(e)) later(0, function () { if (mine(e)) up(e); }); });
    if (ctx && ctx.onCancel) ctx.onCancel(endInteraction);
  }

  function dentDepth(v, i) {
    var n = v.length, a = v[(i + n - 1) % n], b = v[(i + 1) % n], p = v[i];
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    var c = Poly.centroid(v);
    var side = (dx * (c.y - a.y) - dy * (c.x - a.x)) >= 0 ? 1 : -1;
    var d = (dx * (p.y - a.y) - dy * (p.x - a.x)) / len;
    var R = 0;
    for (var k = 0; k < n; k++) R += Math.hypot(v[k].x - c.x, v[k].y - c.y);
    R = (R / n) || 1;
    return d * side / R;
  }
  var DENT_MIN = 0.18, DENT_REFLEX = 198, STRAIGHT_BAND = 12;
  function dentAngleOk(v, i) { var A = Poly.interiorAngles(v); return A[i] >= DENT_REFLEX; }
  function isDented(v, i) { return Poly.classify(v).concave && dentDepth(v, i) >= DENT_MIN && dentAngleOk(v, i); }
  var DENT_SNAP = 0.22, CONVEX_KEEP = 0.2;
  var DENT_REACH = 1.6;
  function inwardOnly(i, p, start) {
    if (!start) return p;
    var c = Poly.centroid(st.verts.map(function (q, k) { return k === i ? start : q; }));
    var dx = c.x - start.x, dy = c.y - start.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    var t = Math.max(0, Math.min(len * DENT_REACH, (p.x - start.x) * ux + (p.y - start.y) * uy));
    return { x: start.x + ux * t, y: start.y + uy * t };
  }
  function offTheLine(i, p) {
    var v = st.verts.slice(); v[i] = p;
    var n = v.length, a = v[(i + n - 1) % n], b = v[(i + 1) % n];
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    var c = Poly.centroid(v);
    var nx = -dy / len, ny = dx / len;                                   // a normal to the line
    if (nx * (c.x - a.x) + ny * (c.y - a.y) < 0) { nx = -nx; ny = -ny; }  // ...pointing into the shape
    var R = 0; for (var k = 0; k < n; k++) R += Math.hypot(v[k].x - c.x, v[k].y - c.y); R = (R / n) || 1;
    var d = ((p.x - a.x) * nx + (p.y - a.y) * ny) / R;                   // depth past the line, in radii (+ = inward)
    var want = null;
    if (d > 0 && d < DENT_SNAP) want = DENT_SNAP;                        // crossed the line: straight to a real dent
    else if (d <= 0 && d > -CONVEX_KEEP) want = -CONVEX_KEEP;            // near the line from outside: still a corner
    if (want == null) return p;
    return { x: p.x + nx * (want - d) * R, y: p.y + ny * (want - d) * R };
  }
  function springBack(i, to) {
    if (!st.verts || !st.verts[i]) return;
    var from = { x: st.verts[i].x, y: st.verts[i].y }, t0 = null;
    if (reduced() || !global.requestAnimationFrame) { st.verts[i] = { x: to.x, y: to.y }; updatePoly(); return; }
    var step = function (tn) {
      if (t0 == null) t0 = tn;
      var k = Math.min(1, (tn - t0) / 340), e = 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);   // a small overshoot
      st.verts[i] = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
      updatePoly();
      if (k < 1) global.requestAnimationFrame(step);
    };
    global.requestAnimationFrame(step);
  }

  var INTERACT = {

    'tap-anywhere': function (spec, ctx) {
      return new Promise(function (resolve) {
        if (!global.Input) { on(svg, 'pointerdown', function () { resolve({ result: 'tap' }); }); return; }
        Input.mode('dialogue');
        var fn = function () { Input.off('advance', fn); endInteraction(); resolve({ result: 'tap' }); };
        Input.on('advance', fn);
        cleanup.push(function () { Input.off('advance', fn); });
        if (ctx && ctx.onCancel) ctx.onCancel(function () { Input.off('advance', fn); });
      });
    },

    'vertex-pick': function (spec, ctx) {
      return new Promise(function (resolve) {
        if (global.Input) Input.mode('polygon');
        var v0 = st.verts || [], sug = 0;
        v0.forEach(function (p, j) { if (p.x + p.y > v0[sug].x + v0[sug].y) sug = j; });
        var were = !!st.showVerts;
        st.showVerts = true; st.touchVerts = true; st.breathe = false; st.breatheAt = null; renderPoly();
        if (!were && !reduced()) (st.knobEls || []).forEach(function (k) {
          try { k.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' }); } catch (e) {}
        });
        st.vstate = null;
        setConnect('IDLE_VERTEX');
        var pickHand = function (strong) {
          return both(pulseHint([knobOf(sug)].filter(Boolean), strong ? { strong: true } : null), tapHand(v0[sug]));
        };
        hintLadder({
          pulse: function () { return pickHand(false); },
          demo: function () { return pickHand(true); }
        });
        st.vertEls.forEach(function (c, i) {
          c.style.cursor = 'pointer';
          on(c, 'pointerdown', function (e) {
            e.preventDefault();
            evt('vertex:selected', { vertex: i });
            st.picked = i; st.lastEl = knobOf(i) || c; st.vcolor = {}; st.vcolor[i] = HI.picked; st.showVerts = false; st.breathe = false; st.breatheAt = null; renderPoly();
            // the tap answered on the dot itself: a brief glow as it turns gold
            juice('good', knobOf(i));
            setConnect('ANCHOR_SELECTED', { from: i });
            endInteraction(); resolve({ result: 'correct', vertex: i });
          });
        });
        if (ctx && ctx.onCancel) ctx.onCancel(endInteraction);
      });
    },

    'draw-diagonal': function (spec, ctx) { return drawDiagonals(spec, 1, ctx); },
    'draw-diagonals': function (spec, ctx) { return drawDiagonals(spec, spec.count || 1, ctx); },

    'drag-vertex': function (spec, ctx) {
      return new Promise(function (resolve) {
        if (global.Input) Input.mode('polygon');
        var sug = spec.suggest == null ? 0 : spec.suggest;
        if (spec.vertex === 'any') { st.showVerts = true; st.touchVerts = true; st.breatheAt = {}; st.breatheAt[sug] = true; cleanup.push(function () { st.breatheAt = null; }); }
        renderPoly();
        var idxs = spec.vertex === 'any' ? st.verts.map(function (_, i) { return i; }) : [spec.vertex];
        var start = null, done = false, held = -1, grabAt = null;
        var keep = spec.until === 'concave' && !spec.attempts;
        var ahead = {}, lead = { x: 0, y: 0 };
        var liveDiags = spec.live === 'diagonals' || spec.live === 'both', liveBadge = spec.live === 'badge' || spec.live === 'both';
        if (liveDiags) st.highlightOutside = true;
        var ghostOf = function () {
          if (done) return null;
          var gi = idxs[0], gv = st.verts[gi], gc = Poly.centroid(st.verts);
          var glen = Math.hypot(gc.x - gv.x, gc.y - gv.y) || 1;
          var gt = st.verts.length === 4 ? 1.3 : 0.9;
          var to = spec.until === 'concave'
            ? { x: gv.x + (gc.x - gv.x) * gt, y: gv.y + (gc.y - gv.y) * gt }
            : { x: gv.x - (gc.x - gv.x) / glen * 78 * 0.55, y: gv.y - (gc.y - gv.y) / glen * 78 * 0.55 };
          return gestureGhost(gv, to, { r: 11 });
        };
        hintLadder({
          pulse: function () { return done ? null : pulseHint([knobOf(spec.vertex === 'any' ? sug : idxs[0])].filter(Boolean)); },
          demo: ghostOf
        });
        // WHAT THE DRAG IS ASKED TO MAKE, judged from the shape as it stands
        var judge = function (i) {
          var np = st.verts[i];
          return spec.until === 'concave' ? isDented(st.verts, i)
               : spec.until === 'irregular' ? (!Poly.isRegular(st.verts) && !!start && Math.hypot(np.x - start.x, np.y - start.y) >= (spec.minMove || 0))
               : false;
        };
        if (spec.vertex !== 'any') {
          idxs.forEach(function (i) { st.vcolor = st.vcolor || {}; if (!st.vcolor[i]) st.vcolor[i] = HI.picked; });
          st.breatheAt = {}; idxs.forEach(function (i) { st.breatheAt[i] = true; });
          cleanup.push(function () { st.breatheAt = null; });
          renderPoly();
        }
        var breathe = function (i, on) {
          if (spec.vertex === 'any' && i !== sug) return;
          st.breatheAt = on ? {} : null; if (on) st.breatheAt[i] = true;
          var k = knobOf(i); if (k && k.classList) k.classList.toggle('breathe', !!on);
        };
        dragVertices(idxs, function (p, i) {
            if (done) return;
            if (held !== i) {
              held = i; grabAt = { x: st.verts[i].x, y: st.verts[i].y };
              if (!start) start = grabAt;
              breathe(i, false);
              st.vcolor = st.vcolor || {}; st.vcolor[i] = HI.picked;
              var hk = knobOf(i);
              if (hk) { hk.setAttribute('fill', HI.fill); hk.setAttribute('stroke', shade(HI.fill, -0.45)); hk.setAttribute('stroke-width', 3); hk.setAttribute('r', 10); }
              lead = keep && ahead[i] ? { x: ahead[i].x - st.verts[i].x, y: ahead[i].y - st.verts[i].y } : { x: 0, y: 0 };
            }
            if (lead.x || lead.y) p = { x: p.x + lead.x, y: p.y + lead.y };
            var np = Poly.clampSimple(st.verts, i, spec.until === 'concave' ? inwardOnly(i, clampToCard(p), start) : clampToCard(p));
            if (spec.until === 'irregular') {
              var was = st.verts[i]; st.verts[i] = np;
              var An = Poly.interiorAngles(st.verts), nn = st.verts.length;
              var flat = [i, (i + nn - 1) % nn, (i + 1) % nn].some(function (q) { return Math.abs(An[q] - 180) < STRAIGHT_BAND; });
              st.verts[i] = was;
              if (flat) np = was;
            }
            if (spec.until === 'concave') { if (keep) ahead[i] = { x: np.x, y: np.y }; np = offTheLine(i, np); }
            st.verts[i] = np;
            updatePoly();
            if (liveBadge && st.liveBadge) {
              var cc = isDented(st.verts, i);
              st.liveBadge._text.textContent = inLang(cc ? 'Concave' : 'Convex');
              if (st.liveBadge._retint) st.liveBadge._retint(cc ? 'concave' : 'convex');
            }
          }, function (p, i, how) {
            if (done) return;
            var from = grabAt || st.verts[i]; held = -1; grabAt = null;
            evt('vertex:dragged', { vertex: i });
            if (!judge(i)) breathe(i, true);
            if (keep && how && how.cancelled) { breathe(i, true); st.lastEl = knobOf(i) || st.polyG; return; }
            if (judge(i)) {
              done = true; st.lastEl = st.polyG; endInteraction();
              // the vertex they moved keeps its knob: the dent IS a vertex
              st.vcolor = {}; st.vcolor[i] = HI.picked;
              if (liveDiags) st.onlyOutside = true;
              if (spec.until) rememberMade(spec.until, st.verts, i);
              renderPoly(); resolve({ result: 'correct', vertex: i });
              return;
            }
            var moved = Math.hypot(st.verts[i].x - from.x, st.verts[i].y - from.y);
            if (moved < 6) return;
            st.lastEl = knobOf(i) || st.polyG;
            if (keep) { onTap('wrong', { t: 'Pull it in more!', vo: 'fb11' }, { soft: true }); return; }
            if (spec.until === 'concave' && from) springBack(i, from);
            else juice('wobble', knobOf(i) || st.polyG);
            if (spec.attempts) { done = true; endInteraction(); resolve({ result: 'wrong', vertex: i }); return; }
            onTap('wrong', spec.until === 'concave' ? { t: 'Pull it in more!', vo: 'fb11' }
                         : spec.until === 'irregular' ? { t: 'Try again! Stretch the corner a little further.', vo: 'fb40' } : null,
                  { soft: true });
          }, ctx);
      });
    },

    choice: function (spec, ctx) {
      return new Promise(function (resolve) {
        if (global.Input) Input.mode('polygon');
        (st.choiceEls || []).forEach(function (b) {
          b.style.cursor = 'pointer';
          on(b, 'pointerdown', function (e) {
            e.preventDefault(); st.lastEl = b;
            if (spec['continue']) {
              if (b.getAttribute('data-label') !== spec.correct) return;
              sfx('select', { gain: 0.5 });
              endInteraction(); resolve({ result: 'tap', label: b.getAttribute('data-label') });
              return;
            }
            var ok = b.getAttribute('data-label') === spec.correct;
            evt('answer:selected', { label: b.getAttribute('data-label'), correct: ok });
            if (ok && global.Juice && Juice.sparkle && !reduced()) { try { Juice.sparkle(b); } catch (x) {} }
            if (ok && b._retint) b._retint('uiSuccess');
            if (!ok && b._retint) {
              b._retint('uiDanger');
              later(650, function () { if (b._retint) b._retint('uiPrimary'); });
            }
            endInteraction(); resolve({ result: ok ? 'correct' : 'wrong', label: b.getAttribute('data-label') });
          });
        });
        if (ctx && ctx.onCancel) ctx.onCancel(endInteraction);
      });
    },

    swipe: function (spec, ctx) {
      return new Promise(function (resolve) {
        if (global.Input) Input.mode('polygon');
        var sw = st.swipe;
        if (!sw || !sw.card) { resolve({ result: 'correct' }); return; }

        var W_CARD = SWIPE_HALF * 2;
        var THRESHOLD = W_CARD * 0.2;
        var resolving = false, dragging = false, demo = null;
        var startX = 0, startY = 0, dx = 0, pid = null;
        function held() { return holdOn; }

        function place(card, x, rot, scale) {
          card.setAttribute('transform',
            'translate(' + (SWIPE_HOME.x + x) + ',' + SWIPE_HOME.y + ') rotate(' + rot.toFixed(2) + ')' +
            (scale ? ' scale(' + scale + ')' : ''));
        }

        function flyCard(card, a, b, ms, lift, then) {
          var set = function (p) {
            card.setAttribute('transform', 'translate(' + p.x.toFixed(2) + ',' + p.y.toFixed(2) + ') rotate(' + p.rot.toFixed(2) + ')' + (Math.abs(p.s - 1) > 1e-3 ? ' scale(' + p.s.toFixed(4) + ')' : ''));
          };
          if (reduced() || !global.requestAnimationFrame) { set(b); if (then) then(); return; }
          var t0 = null;
          var step = function (now) {
            if (!card.parentNode) { if (then) then(); return; }
            if (t0 == null) t0 = now;
            var k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
            set({ x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e - (lift || 0) * 4 * e * (1 - e),
                  rot: a.rot + (b.rot - a.rot) * e, s: a.s + (b.s - a.s) * e });
            if (k < 1) global.requestAnimationFrame(step);
            else if (then) then();
          };
          global.requestAnimationFrame(step);
        }

        function sideOf(x) { return x < -THRESHOLD ? 'regular' : x > THRESHOLD ? 'irregular' : null; }
        function tiltOf(x) { return Math.max(-1, Math.min(1, x / (THRESHOLD * 2.2))) * 6; }

        /* the pile lights as a card LANDS in it (never before it has left) */
        function zoneLit(zone) {
          if (zone && zone.classList) {
            zone.classList.remove('landed'); void zone.getBBox && zone.getBBox();
            zone.classList.add('landed');
            later(700, function () { zone.classList.remove('landed'); });
          }
          if (zone && !reduced() && zone.animate) {
            zone.animate([{ scale: '1' }, { scale: '1.07' }, { scale: '1' }],
                         { duration: 320, easing: 'cubic-bezier(.3,1.3,.5,1)' });
          }
        }

        /* ---- the one submission path ---- */
        function classify(answer) {
          if (resolving || !answer || !sw.card) return;
          stopDemo();
          var card = sw.card;
          var right = Poly.isRegular(card._verts) ? 'regular' : 'irregular';
          var ok = answer === right;
          evt('answer:selected', { item: card._name, zone: answer, correct: ok });
          resolving = true;
          st.lastEl = card;

          if (ok) {
            var zone = sw.zones[answer];
            sfx('correct');
            Object.keys(sw.zones).forEach(function (k) { if (sw.zones[k].classList) sw.zones[k].classList.remove('hint'); });
            juice('pop', card);
            leanZone(null, false);
            if (card._cardEl && card._cardEl._mark) card._cardEl._mark('correct');
            var landIn = function () { zoneLit(zone); };
            later(reduced() ? 0 : 200, function () { collect(card, zone, dx, tiltOf(dx), landIn); });
          } else {
            sfx('wrong');
            juice('refuse', card);
            card._misses = (card._misses || 0) + 1;
            if (card._cardEl && card._cardEl._mark) {
              card._cardEl._mark('wrong');
              later(1100, function () { if (card._cardEl) card._cardEl._mark(null); });
            }
            var why = card._misses >= 2 ? verdictOf(card._verts) : whyShape(card);
            var z = sw.zones[answer];
            if (z && !reduced() && z.animate) {
              z.animate([{ translate: '0 0' }, { translate: '-6px 0' }, { translate: '6px 0' }, { translate: '0 0' }],
                        { duration: 260, easing: 'ease-in-out' });
            }
            var pulledBack = dx, tiltBack = tiltOf(dx);
            if (card._misses < 2) {
              onTap('wrong',
                why === 'regular' ? { t: 'Try again! Every side and every angle is equal.', vo: 'fb35' } :
                why === 'sides'   ? { t: 'Try again! The sides are not all equal.', vo: 'fb36' } :
                why === 'angles'  ? { t: 'Try again! The angles are not all equal.', vo: 'fb37' } :
                why === 'both'    ? { t: 'Try again! The sides and the angles are not all equal.', vo: 'fb38' } : null,
                { tries: 1, marked: true });
              var reset2 = function () {
                dx = 0; place(card, 0, 0);
                leanZone(null, false);
                resolving = false;
                evt('swipe:home', { i: sw.i, back: true });
              };
              flyCard(card, { x: SWIPE_HOME.x + pulledBack, y: SWIPE_HOME.y, rot: tiltBack, s: 1 }, { x: SWIPE_HOME.x, y: SWIPE_HOME.y, rot: 0, s: 1 }, 260, 0, reset2);
              return;
            }
            var rightZone = sw.zones[right];
            var putAway = function () {
              if (!st.swipe || sw.card !== card) return;
              leanZone(right, true);
              later(260, function () {
                if (!st.swipe || sw.card !== card) return;
                collect(card, rightZone, 0, 0, function () {
                  leanZone(null, false);
                  zoneLit(rightZone);
                });
              });
            };
            var explained = false, explain = function () { if (explained) return; explained = true; putAway(); };
            var settle = function () {
              dx = 0; place(card, 0, 0);
              leanZone(null, false);
              // (still resolving: the card is locked)
              evt('swipe:home', { i: sw.i, back: true, locked: true });
              onTap('wrong', null, { tries: 2, marked: true, teach: { el: card, kind: why || 'both', fit: 'swipe' },
                                     after: function () { later(reduced() ? 0 : 320, explain); } });
              later(14000, explain);
            };
            flyCard(card, { x: SWIPE_HOME.x + pulledBack, y: SWIPE_HOME.y, rot: tiltBack, s: 1 }, { x: SWIPE_HOME.x, y: SWIPE_HOME.y, rot: 0, s: 1 }, 260, 0, settle);
          }
        }

        function collect(card, zone, pulled, tilt, landed) {
          var seat = zone ? shelfSeats(zone, zone._kept.length + 1)[zone._kept.length] : null;
          var tx = seat ? seat.x : SWIPE_HOME.x, ty = seat ? seat.y : SWIPE_HOME.y;
          var k = seat ? seat.half / SWIPE_HALF : 0.4;
          var after = function () {
            card.style.pointerEvents = 'none';
            if (card.parentNode) card.parentNode.removeChild(card);
            keepInZone(zone, card._name);
            if (landed) landed();
            sw.card = null;
            sw.i++;
            if (sw.i >= sw.items.length) { hold(260).then(function () { done(); }); return; }
            // a beat to understand what happened, then the next question
            hold(300).then(function () {
              if (!st.swipe) return;
              dealCard();
              arm();
              resolving = false;
              later(420, function () { if (st.swipe && sw.card && !dragging) evt('swipe:home', { i: sw.i, dealt: true }); });
            });
          };
          fadeFace(card, 380);
          flyCard(card, { x: SWIPE_HOME.x + pulled, y: SWIPE_HOME.y, rot: tilt, s: 1 }, { x: tx, y: ty, rot: 0, s: k }, 560, 46, after);
        }

        /* ---- the demonstration: the hint ladder's top rung ---- */
        function runDemo() {
          if (reduced() || !sw.card || !sw.card.animate) return null;
          stopDemo();
          var ghost = sw.card.cloneNode(true);
          ghost.setAttribute('class', 'swipe-ghost');
          ghost.style.pointerEvents = 'none';
          ghost.style.opacity = '0.45';
          sw.card.parentNode.insertBefore(ghost, sw.card);
          sw.ghost = ghost;
          demo = ghost.animate([
            { translate: '0 0', rotate: '0deg', opacity: 0.45, offset: 0 },
            { translate: '-150px -62px', rotate: '-12deg', opacity: 0, offset: 0.36 },
            { translate: '0 0', rotate: '0deg', opacity: 0, offset: 0.40 },
            { translate: '0 0', rotate: '0deg', opacity: 0.45, offset: 0.52 },
            { translate: '150px -62px', rotate: '12deg', opacity: 0, offset: 0.88 },
            { translate: '0 0', rotate: '0deg', opacity: 0, offset: 1 }
          ], { duration: 3400, iterations: 1, easing: 'ease-in-out' });
          // the hand holds the card's middle and swipes it, left and then right
          var hd = handAt(layers.fx, SWIPE_HOME.x, SWIPE_HOME.y);
          if (hd && hd.g.animate) {
            sw.demoHand = hd.g;
            try {
              sw.demoHandAnim = hd.g.animate([
                { translate: '24px 30px', opacity: 0, offset: 0 },
                { translate: '0px 0px', opacity: 1, offset: 0.06 },
                { translate: '-150px -62px', opacity: 1, offset: 0.33 },
                { translate: '-150px -62px', opacity: 0, offset: 0.37 },
                { translate: '0px 0px', opacity: 0, offset: 0.42 },
                { translate: '0px 0px', opacity: 1, offset: 0.5 },
                { translate: '150px -62px', opacity: 1, offset: 0.85 },
                { translate: '150px -62px', opacity: 0, offset: 0.9 },
                { translate: '150px -62px', opacity: 0, offset: 1 }
              ], { duration: 3400, easing: 'ease-in-out', fill: 'forwards' });
              hd.img.animate([{ scale: '1' }, { scale: '.92', offset: 0.06 }, { scale: '.92', offset: 0.9 }, { scale: '1' }], { duration: 3400 });
            } catch (e) {}
          }
          if (demo && demo.finished) demo.finished.then(stopDemo, function () {});
          return stopDemo;
        }
        function stopDemo() {
          if (demo) { try { demo.cancel(); } catch (e) {} demo = null; }
          if (sw.ghost) { try { sw.ghost.remove(); } catch (e) {} sw.ghost = null; }
          if (sw.demoHandAnim) { try { sw.demoHandAnim.cancel(); } catch (e) {} sw.demoHandAnim = null; }
          if (sw.demoHand) { try { sw.demoHand.remove(); } catch (e) {} sw.demoHand = null; }
        }

        /* ---- pointer, the only input path that needs geometry ---- */
        function onDown(e) {
          if (resolving || !sw.card || held()) return;
          stopDemo();
          dragging = true; pid = e.pointerId;
          startX = e.clientX; startY = e.clientY; dx = 0;
          sw.card.style.cursor = 'grabbing';
          try { if (e.target.setPointerCapture) e.target.setPointerCapture(pid); } catch (err) {}
          e.preventDefault();
        }
        function onMove(e) {
          if (!dragging || resolving || !sw.card) return;
          var m = svg.getScreenCTM();
          var scale = m ? m.a : 1;
          dx = (e.clientX - startX) / (scale || 1);
          var t = Math.max(-1, Math.min(1, dx / (THRESHOLD * 2.2)));
          place(sw.card, dx, t * 6);
          leanZone(sideOf(dx), !!sideOf(dx));
          e.preventDefault();
        }
        function onUp(e) {
          if (!dragging) return;
          dragging = false;
          if (sw.card) sw.card.style.cursor = 'grab';
          try { if (e.target.releasePointerCapture && pid != null) e.target.releasePointerCapture(pid); } catch (err) {}
          var side = sideOf(dx);
          if (side) { classify(side); return; }
          // not far enough to mean anything: spring home
          leanZone(null, false);
          var pulledHome = dx, tiltHome = tiltOf(dx);
          dx = 0;
          // back to the middle, smoothly — no spring past it
          if (sw.card) flyCard(sw.card, { x: SWIPE_HOME.x + pulledHome, y: SWIPE_HOME.y, rot: tiltHome, s: 1 }, { x: SWIPE_HOME.x, y: SWIPE_HOME.y, rot: 0, s: 1 }, 220, 0,
                               function () { if (!dragging && !resolving) evt('swipe:home', { i: sw.i }); });
        }
        function onCancel() {
          if (!dragging) return;
          dragging = false;
          leanZone(null, false);
          dx = 0; if (sw.card) { place(sw.card, 0, 0); sw.card.style.cursor = 'grab'; }
          evt('swipe:home', { i: sw.i });
        }

        function onKey(e) {
          if (held()) return;
          if (e.key === 'ArrowLeft') { classify('regular'); e.preventDefault(); }
          else if (e.key === 'ArrowRight') { classify('irregular'); e.preventDefault(); }
        }

        /* ---- arm whatever is currently on the table ---- */
        function arm() {
          if (!sw.card) return;
          on(sw.card, 'pointerdown', onDown);
          on(sw.card, 'pointermove', onMove);
          on(sw.card, 'pointerup', onUp);
          on(sw.card, 'pointercancel', onCancel);
          on(sw.card, 'lostpointercapture', onCancel);
        }
        hintLadder({
          pulse: function () {
            var zs = Object.keys(sw.zones || {}).map(function (k) { return sw.zones[k]; }).filter(Boolean);
            return zs.length ? pulseHint(zs) : null;
          },
          demo: runDemo
        });

        Object.keys(sw.zones).forEach(function (id) {
          var g = sw.zones[id];
          g.style.cursor = 'pointer';
          on(g, 'pointerdown', function (e) { e.preventDefault(); if (held()) return; stopDemo(); classify(id); });
        });
        on(svg.ownerDocument, 'keydown', onKey);

        arm();

        function done() {
          endInteraction();
          resolve({ result: 'correct' });
        }
      });
    },

    'multi-select': function (spec, ctx) {
      return new Promise(function (resolve) {
        if (global.Input) Input.mode('polygon');
        var need = st.cards.filter(function (c) { return c._opt.correct; }).length, got = 0;
        st.tapThrough = st.cards.slice();
        cleanup.push(function () { st.tapThrough = null; });
        st.cards.forEach(function (c) {
          c.style.cursor = 'pointer';
          on(c, 'pointerdown', function (e) {
            e.preventDefault(); if (c._done || c._off) return;
            var at = Date.now(); if (c._pressedAt && at - c._pressedAt < 450) return; c._pressedAt = at;
            if (c._missAt && at - c._missAt < 2500) return;
            st.lastEl = c;
            evt('answer:selected', { option: c._opt.id, correct: !!c._opt.correct });
            if (c._opt.correct) {
              c._done = true; got++; c.style.cursor = '';
              if (c._card) c._card._mark('correct');
              onTap('correct', null, { last: got >= need, marked: true });
              if (got >= need) { endInteraction(); resolve({ result: 'correct' }); }
            } else {
              c._misses = (c._misses || 0) + 1; c._missAt = at;
              var out = c._misses >= (spec.outAfter || 2);
              if (c._card) c._card._mark('wrong');
              if (out) { c._off = true; c.style.cursor = ''; c.style.pointerEvents = 'none'; }
              // the red stays up long enough to be seen
              later(1500, function () {
                if (c._card) c._card._mark(null);
                // (the entrance left an inline opacity on it; the class decides now)
                if (out && c.classList) { c.style.opacity = ''; c.classList.add('card-off'); }
              });
              onTap('wrong', null, { card: c._opt.id, tries: c._misses, out: out, reason: c._opt.reason, marked: true });
            }
          });
        });
        if (ctx && ctx.onCancel) ctx.onCancel(endInteraction);
      });
    },

    'tap-each': function (spec, ctx) {
      return new Promise(function (resolve) {
        if (global.Input) Input.mode('polygon');
        var isSides = spec.targets === 'sides', seen = {}, count = 0, need = spec.count || st.n;
        var queue = [], measuring = false, cancelled = false;
        cleanup.push(function () {
          cancelled = true; queue.length = 0;
          // the to-do dots go with the interaction, whichever way it ends
          if (st.sideTodo || st.angleTodo) { st.sideTodo = null; st.angleTodo = false; if (st.polyG) renderPoly(); }
        });
        st.measure = st.measure || {}; st.measure[isSides ? 'sides' : 'angles'] = [];
        st.showVerts = false; st.touchVerts = !isSides && !spec.auto; st.angleTodo = !isSides && !spec.auto;
        // every side starts on the to-do list, marked by a dot at its middle
        st.sideTodo = isSides ? st.verts.map(function (_, k) { return k; }) : null;
        renderPoly();
        var cls = isSides ? 'edge' : 'vertex';
        var auto = !!spec.auto, angleRig = null;
        var hint = function () {
          if (auto) return;
          (isSides ? st.edgeEls : st.vertEls).forEach(function (el, i) {
            el.style.cursor = seen[i] ? '' : 'pointer';   // a measured side is done with
            if (el.classList) el.classList.toggle('hint', !seen[i]);
            // the pulse is drawn on the knob, the tap is taken by the disc
            if (!isSides && knobOf(i) && knobOf(i).classList) knobOf(i).classList.toggle('hint', !seen[i]);
          });
        };
        hint();
        // what is still to measure: the sides' dots and the corners breathe
        var todo = function () {
          return isSides ? (st.sideDotEls || []).filter(function (d, q) { return d && !seen[q]; })
                         : (st.measG ? [].slice.call(st.measG.querySelectorAll('.angle-todo')) : []);
        };
        if (!auto) hintLadder({
          pulse: function () { var t = todo(); return both(pulseHint(t), tapHand(centreOf(t[0]))); },
          demo: function () { var t = todo(); return both(pulseHint(t, { strong: true }), tapHand(centreOf(t[0]))); }
        });
        var order = auto ? walkOrder() : null, walkOf = {};
        if (order) order.forEach(function (w) { walkOf[w.side] = w; });
        var homeOpacity = auto && global.Swiftee && Swiftee.el ? Swiftee.el.style.opacity : null;
        if (auto) {
          if (global.Input) Input.mode('locked');
          later(Math.round((spec.lead == null ? 650 : spec.lead)), function () {
            order.forEach(function (w) { if (queue.length < need && !seen[w.side]) { seen[w.side] = true; queue.push(w.side); } });
            next();
          });
        }
        // Delegated: renderPoly() runs after every reveal.
        if (!auto) on(st.polyG, 'pointerdown', function (e) {
          var t = e.target; if (!t || !t.classList || !t.classList.contains(cls)) return;
          var i = +t.getAttribute('data-i'); if (seen[i]) return;
          e.preventDefault(); seen[i] = true;
          evt('measurement:start', { what: isSides ? 'side' : 'angle', index: i });
          // its dot goes at once: the tap has been taken
          if (isSides && st.sideTodo) {
            st.sideTodo = st.sideTodo.filter(function (k) { return k !== i; });
            renderPoly(); hint();
          }
          queue.push(i); next();
        });
        function next() {
          if (cancelled || measuring || !queue.length) return;
          var i = queue.shift(); measuring = true;
          // (walking, the angle he reveals is the one at the corner this side ENDS at)
          var w = auto ? walkOf[i] : null, at = (auto && !isSides && w) ? w.end : i;
          if (auto) {
            // what a tap did, done as each side is begun
            evt('measurement:start', { what: isSides ? 'side' : 'angle', index: at });
            if (isSides && st.sideTodo) { st.sideTodo = st.sideTodo.filter(function (k) { return k !== i; }); renderPoly(); }
          }
          function reveal() {
            if (cancelled) return;
            count++;
            st.measure[isSides ? 'sides' : 'angles'].push(at); renderPoly();
            var fresh = st.measG && st.measG.querySelector(isSides ? '.meas[data-side="' + i + '"]' : '[data-angle="' + at + '"]');
            if (fresh) enter(fresh, 'pop');
            st.lastEl = isSides ? st.edgeEls[i] : (knobOf(at) || st.vertEls[at]);
            hint();
            evt('measurement:complete', { what: isSides ? 'side' : 'angle', index: at });
            onTap('correct'); measuring = false;
            if (count >= need) {
              st.sideTodo = null; st.angleTodo = false; renderPoly();
              if (isSides && st.measG && !reduced()) {
                var ticks = st.measG.querySelectorAll('.eq-tick');
                for (var tk = 0; tk < ticks.length; tk++) {
                  var te = ticks[tk];
                  if (!te.animate) continue;
                  te.style.transformBox = 'fill-box'; te.style.transformOrigin = 'center';
                  try { te.animate([{ opacity: 0, scale: '.3' }, { opacity: 1, scale: '1.25', offset: 0.6 }, { opacity: 1, scale: '1' }],
                                   { duration: 420, delay: 160 + tk * 150, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' }); } catch (x) {}
                }
                if (ticks.length) sfx('sparkle', { gain: 0.5 });
              }
              if (auto) later(1400, function () { if (!cancelled) { endInteraction(); resolve({ result: 'correct' }); } });
              else { endInteraction(); resolve({ result: 'correct' }); }
            }
            else next();
          }
          if (auto && !isSides) {
            if (!angleRig) angleRig = angleMeasurer();
            if (angleRig) angleRig(at, queue.length === 0 || count + 1 >= need, reveal);
            else reveal();
          }
          else if (auto && w) measureSide(i, reveal, { first: w === order[0], last: queue.length === 0 || count + 1 >= need, angle: !isSides, homeOpacity: homeOpacity });
          else if (isSides) measureSide(i, reveal);
          else reveal();
        }
        if (ctx && ctx.onCancel) ctx.onCancel(endInteraction);
      });
    },

    sort: function (spec, ctx) {
      return new Promise(function (resolve) {
        if (global.Input) Input.mode('polygon');
        var S = st.sort;
        var win = svg.ownerDocument.defaultView || global;
        var ITEM_HALF = 46;
        function armItem(item) {
          var active = false, off = { x: 0, y: 0 }, pid = null;
          item.style.cursor = 'grab';
          item.style.touchAction = 'none';
          var stop = function () {
            active = false;
            if (S.dragging === item) S.dragging = null;
            try { if (pid != null && item.releasePointerCapture) item.releasePointerCapture(pid); } catch (x) {}
            pid = null;
            item.style.cursor = item._placed ? '' : 'grab';
          };
          on(item, 'pointerdown', function (e) {
            if (item._placed || active || S.dragging || S.done) return;
            if (e.button != null && e.button > 0) return;              // a left press, a touch or a pen
            e.preventDefault();
            var p = pt(e), m = item._pos || item._home;
            off = { x: m.x - p.x, y: m.y - p.y };
            if (item._glide) { item._glide(); item._glide = null; }       // taken back while gliding home
            layers.ui.appendChild(item);                                   // on top of the others — FIRST
            pid = e.pointerId; active = true; S.dragging = item;
            try { if (item.setPointerCapture) item.setPointerCapture(pid); } catch (x) {}
            item.style.cursor = 'grabbing';
          });
          var move = function (e) {
            if (!active || (pid != null && e.pointerId !== pid)) return;
            if (e.pointerType === 'mouse' && e.buttons === 0) { stop(); returnItem(item); return; }
            var p = pt(e);
            item._pos = { x: Math.max(ITEM_HALF, Math.min(W - ITEM_HALF, p.x + off.x)),
                          y: Math.max(ITEM_HALF, Math.min(H - ITEM_HALF - seatY, p.y + off.y)) };
            item.setAttribute('transform', 'translate(' + item._pos.x + ',' + item._pos.y + ')');
          };
          on(win, 'pointermove', move);
          on(win, 'pointercancel', function (e) {
            if (!active || (pid != null && e.pointerId !== pid)) return;
            stop(); returnItem(item);
          });
          on(item, 'lostpointercapture', function (e) {
            // (the release itself also loses the capture — that one is handled below, first)
            if (!active || (pid != null && e.pointerId !== pid)) return;
            later(0, function () { if (active) { stop(); returnItem(item); } });
          });
          on(win, 'pointerup', function (e) {
            if (!active || (pid != null && e.pointerId !== pid)) return;
            stop();
            var p = item._pos || item._home;
            var bin = S.bins.filter(function (b) { var r = b._rect; return p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h; })[0];
            st.lastEl = item;
            if (bin) evt('answer:selected', { item: item._name, bin: bin._bin.id });
            if (!bin) { returnItem(item); return; }
            var c = Poly.classify(item._verts);
            var truth = bin._bin.id === 'convex' ? c.convex : bin._bin.id === 'concave' ? c.concave : bin._bin.id === 'regular' ? c.regular : c.irregular;
            if (truth) {
              item._placed = true; S.placed++; bin._count++; item.style.cursor = '';
              bin._items = bin._items || [];
              bin._items.push(item);
              packBin(bin);
              onTap('correct', null);
              if (S.placed >= S.total) { S.done = true; endInteraction(); resolve({ result: 'correct' }); }
            } else {
              item._misses = (item._misses || 0) + 1;
              var teachIt = spec.teach && item._misses >= spec.teach;
              onTap('wrong', null, teachIt ? { teach: { el: item, concave: !!c.concave } } : null);
              returnItem(item, true);
            }
          });
        }
        S.items.forEach(armItem);
        S.autoTeach = !!spec.autoPlace;
        S.autoPlace = function (item) {
          if (!item || item._placed || S.done) return null;
          var c = Poly.classify(item._verts);
          var bin = S.bins.filter(function (b) {
            var id = b._bin.id;
            return id === 'convex' ? c.convex : id === 'concave' ? c.concave : id === 'regular' ? c.regular : c.irregular;
          })[0];
          if (!bin) return null;
          if (item._glide) { item._glide(); item._glide = null; }
          item._placed = true; item._auto = true; S.placed++; bin._count++; item.style.cursor = '';
          bin._items = bin._items || [];
          bin._items.push(item);
          packBin(bin);
          evt('sort:auto', { item: item._name, bin: bin._bin.id });
          return bin;
        };
        S.finishIfDone = function () {
          if (S.done || S.placed < S.total) return false;
          S.done = true; endInteraction(); resolve({ result: 'correct', auto: true });
          return true;
        };
        var firstLeft = function () { return S.items.filter(function (it) { return !it._placed; })[0]; };
        hintLadder({
          pulse: function () { var f = firstLeft(); return f ? pulseHint([f]) : null; },
          demo: function () {
            var first = firstLeft();
            if (!first || !S.bins || !S.bins.length) return null;
            var b0 = S.bins[0]._rect, b1 = S.bins[S.bins.length - 1]._rect;
            var gapX = (b0.x + b0.w + b1.x) / 2, home = first._pos || first._home;
            return gestureGhost(home, { x: gapX, y: b0.y + 40 }, { clone: first, trail: false, duration: 2600 });
          }
        });
        if (ctx && ctx.onCancel) ctx.onCancel(endInteraction);
      });
    }
  };

  var SNAP = 60;

  /** Is the pair (a, b) already a diagonal on the shape? Pairs are unordered. */
  function diagonalUsed(a, b) {
    var k = Math.min(a, b) + '-' + Math.max(a, b);
    return (st.diagonals || []).some(function (d) { return Math.min(d[0], d[1]) + '-' + Math.max(d[0], d[1]) === k; });
  }

  /** The line under the finger, hidden until the drag begins. */
  function previewLine(from) {
    var a = st.verts[from];
    return mk('line', { x1: a.x, y1: a.y, x2: a.x, y2: a.y, stroke: HI.line, 'stroke-width': 5,
                        'stroke-linecap': 'round', opacity: 0, 'pointer-events': 'none',
                        style: litGlow(HI.lit) }, layers.fx);
  }

  var KNOB_ATTRS = ['opacity', 'r', 'fill', 'stroke', 'stroke-width'];
  function showTargets(idxs, on) {
    (st.knobEls || []).forEach(function (k, i) {
      if (!k) return;
      if (on && idxs.indexOf(i) >= 0) {
        if (!k._was) { k._was = {}; KNOB_ATTRS.forEach(function (a) { k._was[a] = k.getAttribute(a); }); }
        k.setAttribute('opacity', 1); k.setAttribute('r', 9);
        k.setAttribute('fill', HI.knob); k.setAttribute('stroke', HI.rim); k.setAttribute('stroke-width', 3);
        k.classList.add('target');
      } else if (k._was) {
        KNOB_ATTRS.forEach(function (a) { if (k._was[a] == null) k.removeAttribute(a); else k.setAttribute(a, k._was[a]); });
        k._was = null;
        k.classList.remove('target', 'hot');
      }
    });
  }

  function followFinger(line, from, p, valid, was, finger) {
    var best = -1, bd = SNAP, f = finger || p;
    valid.forEach(function (j) { var q = st.verts[j], d = Math.hypot(q.x - f.x, q.y - f.y); if (d < bd) { bd = d; best = j; } });
    var end = best >= 0 ? st.verts[best] : p;
    line.setAttribute('opacity', 1);
    line.setAttribute('x2', end.x); line.setAttribute('y2', end.y);
    if (best !== was) {
      if (was >= 0 && knobOf(was)) { knobOf(was).classList.remove('hot'); knobOf(was).setAttribute('r', 9); }
      if (best >= 0 && knobOf(best)) {
        knobOf(best).classList.add('hot'); knobOf(best).setAttribute('r', 12);
        sfx('tick', { gain: 0.5 });                     // the icy tick of a line finding its corner
      }
    }
    return best;
  }

  function retract(line, from, then) {
    var a = st.verts[from];
    var finished = false;
    var done = function () { if (finished) return; finished = true; line.remove(); if (then) then(); };
    if (reduced() || line.getAttribute('opacity') === '0') { done(); return; }
    var x2 = +line.getAttribute('x2'), y2 = +line.getAttribute('y2');
    var frame = global.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    var t0 = Date.now();
    (function step() {
      var k = Math.min(1, (Date.now() - t0) / 200), e = k * k;
      line.setAttribute('x2', x2 + (a.x - x2) * e); line.setAttribute('y2', y2 + (a.y - y2) * e);
      line.setAttribute('opacity', 1 - k);
      if (k < 1 && line.parentNode) frame(step);
      else done();
    }());
  }

  function shimmer(k, found) {
    if (reduced() || !st.diagG) return;
    var g = st.diagG.childNodes[k], ln = g && g.querySelector('line');
    if (!ln || !ln.animate) return;
    var timing = found ? { duration: 760, iterations: 2, easing: 'ease-in-out' } : { duration: 560, easing: 'ease-out' };
    try {
      ln.animate([
        { strokeWidth: 4, opacity: 1 },
        { strokeWidth: found ? 9 : 7.5, opacity: 1, offset: 0.35 },
        { strokeWidth: 4, opacity: 1 }
      ], timing);
      g.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(' + (found ? 1.6 : 1.45) + ')', offset: 0.35 }, { filter: 'brightness(1)' }], timing);
    } catch (e) {}
  }

  var CONNECT_READY = { SIDE_HINT: 1, NEXT_SIDE_READY: 1, DIAGONAL_READY: 1 };
  function setConnect(state, detail) {
    if (st.connect === state) return;
    st.connect = state;
    (st.connectLog = st.connectLog || []).push(state);
    if (st.connectLog.length > 40) st.connectLog.shift();
    evt('connect:state', Object.assign({ state: state }, detail || {}));
  }
  function sideEnds() {
    var ends = (st.sidesDone || []).map(function (sd) { return sd[1]; });
    if (st.segment) ends.push(st.segment[1]);
    return ends;
  }
  function sidesLeft(from) {
    var ends = sideEnds(), left = 0;
    for (var q = 0; q < st.n; q++) if (q !== from && Poly.isAdjacent(from, q, st.n) && ends.indexOf(q) < 0) left++;
    return left;
  }
  function setVertexStates(from, locked, free) {
    var ends = sideEnds(), diag = true, out = [];
    for (var q = 0; q < st.n; q++) {
      if (q === from) out.push('anchor');
      else if (ends.indexOf(q) >= 0) out.push('side-used-disabled');
      else if (locked) out.push('inactive');
      else if (Poly.isAdjacent(from, q, st.n)) out.push('adjacent-available');
      else if (free && diagonalUsed(from, q)) out.push('diagonal-used');
      else out.push(diag && !diagonalUsed(from, q) ? 'diagonal-available' : 'inactive');
    }
    st.vstate = out;
    evt('connect:vertices', { states: out.slice() });
    return out;
  }
  function freezeSide() {
    var tag = st.labelEl, from = st.picked;
    if (st.segment) { st.sidesDone = (st.sidesDone || []).concat([st.segment.slice()]); st.segment = null; }
    st.segLine = st.segGlow = null;
    if (tag) { st.labelEl = null; st.labelSpec = null; fadeOut(tag); }
    var toDiagonal = st.vstate && from != null && sidesLeft(from) === 0;
    if (st.vstate && from != null) setVertexStates(from);
    if (st.vstate) setConnect('ENDPOINT_DISABLED', { from: from });
    if (st.polyG) renderPoly();
    // (no rise for the far corners here any more: they have been open since the start)
    if (toDiagonal) setConnect('DIAGONAL_INSTRUCTION', { from: from });
  }
  function fadeOut(el) {
    if (!el) return;
    if (reduced() || !el.animate) { el.remove(); return; }
    try {
      var a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: 'ease-in', fill: 'forwards' });
      a.onfinish = function () { el.remove(); };
    } catch (e) { el.remove(); }
  }
  function clearSide() {
    var ln = st.segLine, tag = st.labelEl;
    st.segment = null; st.segLine = st.segGlow = null;
    if (tag) { st.labelEl = null; st.labelSpec = null; }
    [ln, tag].forEach(function (el) {
      if (!el) return;
      if (reduced() || !el.animate) { el.remove(); return; }
      try {
        var a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: 'ease-in', fill: 'forwards' });
        a.onfinish = function () { el.remove(); };
      } catch (e) { el.remove(); }
    });
  }

  function drawDiagonals(spec, count, ctx) {
    return new Promise(function (resolveRaw) {
      var resolve = function (r) {
        if (global.Input) Input.mode('locked');
        (st.vertEls || []).forEach(function (c) { if (c && c.style) { c.style.pointerEvents = 'none'; c.style.cursor = ''; } });
        resolveRaw(r);
      };
      if (global.Input) Input.mode('polygon');
      var from = spec.from === 'picked' ? (st.picked == null ? 0 : st.picked) : spec.from;
      var sides = !!spec.sides;
      var sidesOk = !sides && !!spec.sidesOk;
      st.picked = from; st.vcolor = {}; st.vcolor[from] = HI.picked; st.showVerts = true; st.touchVerts = true;
      if (sides) setVertexStates(from); else if (sidesOk) setVertexStates(from, false, true); else st.vstate = null;
      st.breatheAt = {}; st.breatheAt[from] = true; renderPoly();
      var still = function (on) { var fk = knobOf(from); if (fk && fk.classList) fk.classList.toggle('breathe', !!on); };
      cleanup.push(function () { st.breatheAt = null; still(false); });
      var dressFrom = function () { var c = st.vertEls && st.vertEls[from]; if (c) c.style.cursor = 'grab'; };
      dressFrom();
      var readyState = function () { return sidesLeft(from) === 0 ? 'DIAGONAL_READY' : ((st.sidesDone || []).length ? 'NEXT_SIDE_READY' : 'SIDE_HINT'); };
      if (sides) setConnect(readyState(), { from: from });
      var made = 0, active = false, hot = -1;
      var line = previewLine(from);
      var valid = function () { return Poly.diagonalsFrom(from, st.n).filter(function (j) { return !diagonalUsed(from, j); }); };
      var targets = function () {
        if (!sides && !sidesOk) return valid();
        return (st.vstate || []).map(function (vs, q) { return /-available$/.test(vs) ? q : -1; }).filter(function (q) { return q >= 0; });
      };
      hintLadder({
        pulse: function () { return pulseHint([knobOf(from)].filter(Boolean)); },
        demo: function () {
          var t;
          if (sides && sidesLeft(from) > 0) { var nb = targets().filter(function (q) { return Poly.isAdjacent(from, q, st.n); }); t = nb.indexOf((from + 1) % st.n) >= 0 ? (from + 1) % st.n : nb[0]; }
          else t = sides ? targets()[0] : valid()[0];
          return t == null ? null : gestureGhost(st.verts[from], st.verts[t], { line: true, target: knobOf(t) });
        }
      });
      var face = st.panel ? panelFace(st.panel) : null;
      var inCard = function (p) {
        if (!face) return p;
        return { x: Math.max(face.x + 10, Math.min(face.x + face.w - 10, p.x)),
                 y: Math.max(face.y + 10, Math.min(face.y + face.h - 10, p.y)) };
      };
      var pid = null;
      var win = (svg.ownerDocument && svg.ownerDocument.defaultView) || global;
      // Delegated: the source vertex element is rebuilt after each diagonal.
      on(st.polyG, 'pointerdown', function (e) {
        var t = e.target; if (!t || !t.classList || !t.classList.contains('vertex') || +t.getAttribute('data-i') !== from) return;
        if (global.Input && Input.guarded) return;
        if (sides && !CONNECT_READY[st.connect]) return;
        if (active) return;
        active = true; pid = e.pointerId; e.preventDefault();
        still(false);
        try { svg.setPointerCapture && svg.setPointerCapture(e.pointerId); } catch (x) {}
        // connecting, nothing lights up front; the corner the line finds does
        if (sides) { showTargets([], false); setConnect(sidesLeft(from) ? 'SIDE_DRAG' : 'DIAGONAL_DRAG', { from: from }); }
        else showTargets(targets(), true);
        svg.style.cursor = 'grabbing';
        evt('diagonal:start', { from: from });
      });
      var mine = function (e) { return active && (pid == null || e.pointerId == null || e.pointerId === pid); };
      on(win, 'pointermove', function (e) {
        if (!mine(e)) return;
        if (e.pointerType === 'mouse' && e.buttons === 0) { cancel(); return; }
        var was = hot;
        var at = pt(e);
        hot = followFinger(line, from, inCard(at), targets(), hot, at);
        if (sides && hot !== was) {
          // only the corner it has snapped to shows, for as long as it is there
          showTargets(hot >= 0 ? [hot] : [], true);
          if (hot >= 0 && knobOf(hot)) { knobOf(hot).classList.add('hot'); knobOf(hot).setAttribute('r', 12); }
        }
      });
      var release = function (e) {
        if (!active) return; active = false; pid = null;
        svg.style.cursor = '';
        var j = hot >= 0 ? hot : nearestVertex(pt(e), from, 44);
        if (j >= 0 && diagonalUsed(from, j)) {
          var made0 = (st.diagonals || []).findIndex(function (d) { return (d[0] === from && d[1] === j) || (d[1] === from && d[0] === j); });
          if (made0 >= 0) shimmer(made0);
          hot = -1; showTargets([], false); still(true);
          if (sides) setConnect(readyState(), { from: from });
          retract(line, from, function () { line = previewLine(from); });
          return;
        }
        if (sides && j >= 0 && targets().indexOf(j) < 0) j = -1;
        if (sidesOk && j >= 0 && targets().indexOf(j) < 0) {
          hot = -1; showTargets([], false); still(true);
          retract(line, from, function () { line = previewLine(from); });
          return;
        }
        hot = -1;
        showTargets([], false);
        if (j < 0) {
          still(true);
          retract(line, from, function () { line = previewLine(from); });
          if (sides) {
            setConnect(readyState(), { from: from });
            return;
          }
          missedCorner(valid(), null, function () { return active; });
          return;
        }
        var ok = !Poly.isAdjacent(from, j, st.n) && !diagonalUsed(from, j);
        st.lastEl = knobOf(j) || st.vertEls[j];
        if (sidesOk && !ok && Poly.isAdjacent(from, j, st.n)) {
          line.remove();
          st.sidesDone = (st.sidesDone || []).concat([[from, j]]);
          setVertexStates(from, false, true); renderPoly(); dressFrom(); still(true);
          line = previewLine(from);
          evt('side:made', { from: from, to: j });
          var a0 = st.verts[from], b0 = st.verts[j];
          if (a0 && b0 && st.polyG && !reduced()) {
            var flash = mk('line', { x1: a0.x, y1: a0.y, x2: b0.x, y2: b0.y, stroke: '#ff5a5a', 'stroke-width': 5,
                                     'stroke-linecap': 'round', 'pointer-events': 'none' }, st.polyG);
            flash.style.filter = 'drop-shadow(0 0 5px rgba(255, 60, 60, 0.9))';
            if (flash.animate) { try { flash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }], { duration: 900, easing: 'ease-out', fill: 'forwards' }); } catch (x) {} }
            later(950, function () { if (flash.parentNode) flash.remove(); });
          }
          st.lastEl = knobOf(j) || st.vertEls[j];
          onTap('wrong');
          return;
        }
        if (sides && !ok && Poly.isAdjacent(from, j, st.n)) {
          var second = (st.sidesDone || []).length > 0;
          line.remove();
          st.segment = [from, j]; st.ghost = null;
          setVertexStates(from);
          renderPoly();
          st.lastEl = st.segLine || knobOf(j);
          setConnect(second ? 'SECOND_SIDE_COMPLETE' : 'SIDE_COMPLETE', { from: from, to: j });
          evt('side:made', { from: from, to: j });
          endInteraction(); resolve({ result: 'side', vertex: j });
          return;
        }
        if (ok) {
          if (sides) {
            st.segment = null;
            if (st.labelEl) { st.labelEl.remove(); st.labelEl = null; st.labelSpec = null; }
          }
          line.remove(); line = previewLine(from);
          if (sides) st.vcolor[j] = HI.picked;
          st.diagonals = st.diagonals || []; st.diagonals.push(Object.assign([Math.min(from, j), Math.max(from, j)], { solid: true })); st.ghost = null;
          if (sides) setVertexStates(from, true);
          else if (sidesOk) setVertexStates(from, made + 1 >= count, true);   // (its far end is used now)
          renderPoly(); made++;
          if (made < count) dressFrom();
          st.lastEl = knobOf(j) || st.vertEls[j];
          shimmer(st.diagonals.length - 1, sides);
          dotBurst(j);
          if (sides) setConnect('DIAGONAL_CREATED', { from: from, to: j });
          evt('diagonal:complete', { from: from, to: j });
          if (count > 1) onTap('correct', null, { last: made >= count });
          if (made >= count) { line.remove(); endInteraction(); resolve({ result: 'correct' }); if (sides) setConnect('INTERACTION_LOCKED', { from: from }); }
        } else if (count > 1) {
          retract(line, from, function () { line = previewLine(from); });
          onTap('wrong');
        } else {
          endInteraction();
          retract(line, from, function () { resolve({ result: 'wrong' }); });
        }
      };
      var cancel = function () {
        if (!active) return; active = false; pid = null; hot = -1; showTargets([], false);
        svg.style.cursor = ''; still(true);
        if (sides) setConnect(readyState(), { from: from });
        retract(line, from, function () { line = previewLine(from); });
      };
      on(win, 'pointerup', function (e) { if (mine(e)) release(e); });
      on(win, 'pointercancel', function (e) { if (mine(e)) cancel(); });
      if (ctx && ctx.onCancel) ctx.onCancel(function () { if (line) line.remove(); endInteraction(); });
    });
  }

  var TEACH = { scale: 3, flyMs: 620, backMs: 520, out: '#7a4cff', warm: '#ffc83d' };
  function teachShape(item, opts) {
    opts = opts || {};
    if (!svg || !item || !item._verts || !svg.parentNode) return null;
    var doc = svg.ownerDocument, host = svg.parentNode;
    var sheet = doc.createElement('div'); sheet.className = 'teach-sheet';
    var tsvg = doc.createElementNS(NS, 'svg');
    tsvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    tsvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    sheet.appendChild(tsvg); host.appendChild(sheet);
    var toStage = function (el) {
      var a = svg.getScreenCTM && svg.getScreenCTM(), b = el.getScreenCTM && el.getScreenCTM();
      if (!a || !b) return null;
      var m = a.inverse().multiply(b);
      return { x: m.e, y: m.f, s: Math.sqrt(m.a * m.a + m.b * m.b) || 1 };
    };
    var mid = { x: W / 2 + 40, y: H * 0.52, s: TEACH.scale };   // a touch right: he stands at its left
    var from = toStage(item) || { x: mid.x, y: mid.y, s: 1 };
    var deck = opts.fit === 'swipe' ? layers.ui.querySelector('.swipe-stack') : null;
    if (opts.fit === 'swipe') mid = { x: from.x, y: from.y - 6, s: from.s * 1.1 };
    var deckShown = function (on) {
      if (!deck) return;
      deck.style.transition = 'opacity .3s ease';
      deck.style.opacity = on ? '' : '0';
    };
    var copy = item.cloneNode(true);
    st.teachCopy = copy;
    copy.removeAttribute('style'); copy.setAttribute('class', 'teach-card');
    // (not still red from the miss it is here to explain)
    [].slice.call(copy.querySelectorAll('.mark-bad, .mark-good')).forEach(function (e) { e.classList.remove('mark-bad', 'mark-good'); });
    tsvg.appendChild(copy);
    var fx = mk('g', { 'class': 'teach-fx', 'pointer-events': 'none' }, copy);
    item.style.visibility = 'hidden';
    var now = { x: from.x, y: from.y, s: from.s };
    var set = function (p) { now = p; copy.setAttribute('transform', 'translate(' + p.x.toFixed(2) + ',' + p.y.toFixed(2) + ') scale(' + p.s.toFixed(4) + ')'); };
    set(from);
    var fly = function (a, b, ms, pop) {
      return new Promise(function (res) {
        if (reduced() || !global.requestAnimationFrame) { set(b); res(); return; }
        var t0 = null;
        var step = function (tn) {
          if (!copy.parentNode) { res(); return; }
          if (t0 == null) t0 = tn;
          var k = Math.min(1, (tn - t0) / ms);
          var e = 1 - Math.pow(1 - k, 3);
          // a little past the size and back: it arrives, it does not slide in
          var sk = pop ? 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2) : e;
          set({ x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e - (pop ? 26 * Math.sin(Math.PI * k) : 0), s: a.s + (b.s - a.s) * sk });
          if (k < 1) global.requestAnimationFrame(step); else res();
        };
        global.requestAnimationFrame(step);
      });
    };
    var v = item._verts, n = v.length, A = Poly.interiorAngles(v);
    // the corner that goes inward: the most reflex one, the highest of equals
    var dent = -1;
    A.forEach(function (a, i) { if (a > 180.5 && (dent < 0 || a > A[dent] + 0.5 || (Math.abs(a - A[dent]) <= 0.5 && v[i].y < v[dent].y))) dent = i; });
    var sw = 1.9;
    var ring = function (p, delay, col) {
      var r = mk('circle', { cx: p.x, cy: p.y, r: 3.6, fill: col || TEACH.warm, stroke: '#ffffff', 'stroke-width': 1.3, 'class': 'teach-ring' }, fx);
      r.style.animationDelay = (delay || 0) + 'ms';
      return r;
    };
    var sparkle = function (p) {
      [[-9, -7], [8, -9], [10, 6]].forEach(function (d, i) {
        var sx = p.x + d[0], sy = p.y + d[1], z = 2.3;
        var s = mk('path', { d: 'M' + sx + ' ' + (sy - z) + ' L' + (sx + z * 0.3) + ' ' + (sy - z * 0.3) + ' L' + (sx + z) + ' ' + sy + ' L' + (sx + z * 0.3) + ' ' + (sy + z * 0.3) +
                                ' L' + sx + ' ' + (sy + z) + ' L' + (sx - z * 0.3) + ' ' + (sy + z * 0.3) + ' L' + (sx - z) + ' ' + sy + ' L' + (sx - z * 0.3) + ' ' + (sy - z * 0.3) + ' Z',
                             fill: '#fff6c8', 'class': 'teach-spark' }, fx);
        s.style.animationDelay = (i * 140) + 'ms';
      });
    };
    var grow = function (a, b, delay, bad, diag) {
      var l = litLine(fx, { x1: a.x, y1: a.y, x2: a.x, y2: a.y, 'stroke-width': bad ? 2.3 : 1.9, 'stroke-linecap': 'butt',
                            'stroke-dasharray': diag ? '4.2 3.4' : 'none' }, { bad: bad })[0];
      later(delay || 0, function () {
        if (reduced() || !global.requestAnimationFrame) { l.setAttribute('x2', b.x); l.setAttribute('y2', b.y); return; }
        var t0 = null;
        var step = function (tn) {
          if (!l.parentNode) return;
          if (t0 == null) t0 = tn;
          var k = Math.min(1, (tn - t0) / 460), e = 1 - Math.pow(1 - k, 3);
          l.setAttribute('x2', a.x + (b.x - a.x) * e); l.setAttribute('y2', a.y + (b.y - a.y) * e);
          if (k < 1) global.requestAnimationFrame(step);
        };
        global.requestAnimationFrame(step);
      });
      return l;
    };
    var breathe = function () {
      if (reduced() || !copy.animate) return;
      copy.style.transformBox = 'fill-box'; copy.style.transformOrigin = 'center';
      try { copy.animate([{ scale: '1' }, { scale: '1.05' }, { scale: '1' }], { duration: 900, easing: 'ease-in-out' }); } catch (e) {}
    };
    var api = {
      concave: dent >= 0,
      open: function () {
        global.requestAnimationFrame ? global.requestAnimationFrame(function () { sheet.classList.add('on'); }) : sheet.classList.add('on');
        deckShown(false);
        sfx('menuWhoosh', { gain: 0.5 });
        return fly(from, mid, TEACH.flyMs, true);
      },
      show: function (what) {
        if (!copy.parentNode) return;
        var glowOn = function (sel) {
          [].slice.call(fx.querySelectorAll(sel)).forEach(function (l) {
            if (reduced() || !l.animate) return;
            try { l.animate([{ filter: 'drop-shadow(0 0 1px rgba(255,255,255,0))' }, { filter: 'drop-shadow(0 0 3.5px rgba(255,255,255,.95)) brightness(1.25)', offset: 0.45 }, { filter: 'drop-shadow(0 0 1.5px rgba(255,255,255,.6))' }],
                            { duration: 900, easing: 'ease-in-out' }); } catch (e) {}
          });
        };
        if (what !== 'outsideGlow' && what !== 'insideGlow') [].slice.call(fx.childNodes).forEach(function (el) { fadeOut(el); });
        if (what === 'notch' && dent >= 0) {
          // "This CORNER goes inward": that corner, and only it
          ring(v[dent], 0, TEACH.warm); sfx('tick', { gain: 0.6 });
        } else if (what === 'outside' && dent >= 0) {
          var a2 = v[(dent + n - 1) % n], b2 = v[(dent + 1) % n];
          grow(a2, b2, 0, true, true).setAttribute('class', 'teach-diag teach-out');
          sfx('zip', { gain: 0.5 });
        } else if (what === 'outsideGlow') {
          // "…OUTSIDE": the diagonal already drawn catches the light, outside the shape
          glowOn('.teach-out');
        } else if (what === 'corners') {
          // "No CORNER goes inward": every corner, one after another
          v.forEach(function (p, i) { later(i * 110, function () { if (copy.parentNode) ring(p, 0, TEACH.warm); }); });
          sfx('tick', { gain: 0.6 });
        } else if (what === 'inside') {
          var pairs = [];
          for (var j = 2; j <= n - 2; j++) pairs.push([0, j]);
          if (n === 4) pairs.push([1, 3]);
          pairs.forEach(function (q, i) { grow(v[q[0]], v[q[1]], i * 260, false, true).setAttribute('class', 'teach-diag teach-in'); });
          sfx('zip', { gain: 0.5 });
        } else if (what === 'insideGlow') {
          // "…INSIDE": those diagonals catch the light, inside the shape
          glowOn('.teach-in');
        } else if (what === 'sides') {
          var L = Poly.sideLengths(v), sm = marksBy(L, v.map(function (_, i) { return i; }), 15);
          v.forEach(function (p, i) { grow(p, v[(i + 1) % n], i * 140, sm.mark[i] !== 1, false); });
          pulseHint([].slice.call(copy.querySelectorAll('.u-side')), { strong: true });
          sfx('tick', { gain: 0.6 });
        } else if (what === 'angles') {
          var am = marksBy(A, v.map(function (_, i) { return i; }), 3), c0 = Poly.centroid(v), R = 7.2, TAU = 2 * Math.PI;
          v.forEach(function (p, i) {
            later(i * 110, function () {
              if (!copy.parentNode) return;
              var qa = v[(i + n - 1) % n], qb = v[(i + 1) % n];
              var a1 = Math.atan2(qa.y - p.y, qa.x - p.x), a3 = Math.atan2(qb.y - p.y, qb.x - p.x), bis = Math.atan2(c0.y - p.y, c0.x - p.x);
              var d1 = ((a3 - a1) % TAU + TAU) % TAU, db = ((bis - a1) % TAU + TAU) % TAU;
              var sweep = db < d1 ? 1 : 0, span = sweep ? d1 : TAU - d1, large = span > Math.PI ? 1 : 0;
              var arc = mk('path', { d: 'M' + (p.x + Math.cos(a1) * R).toFixed(2) + ' ' + (p.y + Math.sin(a1) * R).toFixed(2) + ' A' + R + ' ' + R + ' 0 ' + large + ' ' + sweep + ' ' +
                                        (p.x + Math.cos(a3) * R).toFixed(2) + ' ' + (p.y + Math.sin(a3) * R).toFixed(2),
                                     fill: 'none', stroke: am.mark[i] === 1 ? TEACH.warm : TEACH.out, 'stroke-width': 1.5, 'stroke-linecap': 'round', 'class': 'teach-arc' }, fx);
              if (!reduced() && arc.animate) { try { arc.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' }); } catch (e) {} }
            });
          });
          pulseHint([].slice.call(copy.querySelectorAll('.u-angle')), { strong: true });
          sfx('tick', { gain: 0.6 });
        }
      },
      close: function () {
        var S2 = st.sort, bin = (S2 && S2.autoTeach && S2.autoPlace) ? S2.autoPlace(item) : null;
        var home = toStage(item) || from;
        fx.style.transition = 'opacity .25s ease'; fx.style.opacity = '0';
        sheet.classList.remove('on');
        deckShown(true);
        return fly(now, home, bin ? TEACH.backMs + 180 : TEACH.backMs, false).then(function () {
          if (st.teachCopy === copy) st.teachCopy = null;
          item.style.visibility = '';
          if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
          juice('pop', item);
          if (bin) {
            sfx('pop', { gain: 0.6 });
            if (!reduced() && bin.animate) {
              bin.style.transformBox = 'fill-box'; bin.style.transformOrigin = 'center';
              try { bin.animate([{ scale: '1' }, { scale: '1.04' }, { scale: '1' }], { duration: 300, easing: 'cubic-bezier(.3,1.3,.5,1)' }); } catch (e) {}
            }
            if (S2 && S2.finishIfDone) S2.finishIfDone();
          }
        });
      }
    };
    // a screen change or the end of the question takes it all away
    cleanup.push(function () { if (st.teachCopy === copy) st.teachCopy = null; item.style.visibility = ''; deckShown(true); if (sheet.parentNode) sheet.parentNode.removeChild(sheet); });
    return api;
  }

  function returnItem(item, refused) {
    if (!item || item._placed) return;
    var from = item._pos, to = item._home;
    item._pos = null;
    var put = function (x, y) { item.setAttribute('transform', 'translate(' + x + ',' + y + ')'); };
    var land = function () { item._glide = null; put(to.x, to.y); if (refused) juice('refuse', item); };
    if (!from || reduced() || !global.requestAnimationFrame || Math.hypot(from.x - to.x, from.y - to.y) < 2) { land(); return; }
    var g0 = sceneGen, t0 = null, live = true;
    item._glide = function () { live = false; };
    var step = function (now) {
      if (!live || g0 !== sceneGen || item._placed) return;
      if (t0 == null) t0 = now;
      var k = Math.min(1, (now - t0) / 260), e = 1 - Math.pow(1 - k, 3);
      item._pos = null;
      put(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e);
      if (k < 1) requestAnimationFrame(step); else land();
    };
    requestAnimationFrame(step);
  }

  function alive(on) {
    if (svg) {
      var was = svg.querySelectorAll('.touchable');
      for (var k = 0; k < was.length; k++) was[k].classList.remove('touchable');
    }
    if (!on || !svg) return;
    if (reduced()) return;

    var els = svg.querySelectorAll('[style*="cursor: pointer"],[style*="cursor:pointer"]');
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (e.classList) e.classList.add('touchable');
    }

  }

  function pivot(e) {
    if (e.style && !e.style.transformOrigin) {
      e.style.transformBox = 'fill-box';
      e.style.transformOrigin = 'center';
    }
    return e;
  }

  function armPress() {
    if (!svg) return;
    on(svg, 'pointerdown', function (ev) {
      var t = ev.target;
      while (t && t !== svg && !(t.style && /pointer/.test(t.style.cursor))) t = t.parentNode;
      if (!t || t === svg) return;
      sfx('select');
      if (reduced() || !t.animate) return;
      pivot(t);
      try {
        t.animate([{ scale: '1' }, { scale: '.9' }, { scale: '1.04' }, { scale: '1' }],
                  { duration: 260, easing: 'cubic-bezier(.3,1.35,.5,1)' });
      } catch (e) {}
    });
  }

  /** What an interaction wants touched, for the pop that hands it over. */
  function armTargets(spec) {
    var t = spec.type, ks = (st.knobEls || []).filter(Boolean);
    if (t === 'vertex-pick') return ks;
    if (t === 'draw-diagonal' || t === 'draw-diagonals') return st.picked != null && knobOf(st.picked) ? [knobOf(st.picked)] : [];
    if (t === 'drag-vertex') return spec.vertex === 'any' || spec.vertex == null ? ks : (knobOf(spec.vertex) ? [knobOf(spec.vertex)] : []);
    if (t === 'tap-each') return spec.targets === 'sides' ? (st.sideDotEls || []).filter(Boolean) : ks;
    if (t === 'choice') return (st.choiceEls || []).slice();
    if (t === 'multi-select') return (st.cards || []).slice();
    if (t === 'sort') return st.sort && st.sort.items ? st.sort.items.filter(function (it) { return !it._placed; }).slice(0, 1) : [];
    if (t === 'swipe') return st.swipe && st.swipe.zones ? Object.keys(st.swipe.zones).map(function (k) { return st.swipe.zones[k]; }) : [];
    return [];
  }

  function waitFor(spec, ctx) {
    var fn = INTERACT[spec.type];
    hintType = spec.type + (spec.targets ? ':' + spec.targets : '');
    if (!fn) { if (global.console) console.warn('Stage: no interaction "' + spec.type + '"'); return Promise.resolve({ result: 'correct' }); }

    var invite = spec.type !== 'tap-anywhere';
    if (invite) later(60, function () { alive(true); });

    var p;
    try { p = fn(spec, ctx); }
    catch (e) { alive(false); throw e; }
    if (invite && !spec.retry && spec.type !== 'multi-select') later(90, function () { var t = armTargets(spec); if (t.length) pulseHint(t, { pop: true }); });
    return Promise.resolve(p).then(
      function (r) { alive(false); return r; },
      function (e) { alive(false); throw e; }
    );
  }

  function isEmpty() { return !st.kind; }

  function contentBox() {
    if (!svg || !st.kind) return null;
    var m = svg.getScreenCTM && svg.getScreenCTM();
    if (!m) return null;
    var box = null;
    ['panel', 'poly', 'ui'].forEach(function (name) {
      var layer = layers[name];
      if (!layer || !layer.getBBox || !layer.childNodes.length) return;
      var b;
      try { b = layer.getBBox(); } catch (e) { return; }
      if (!b || (!b.width && !b.height)) return;
      box = box
        ? { x: Math.min(box.x, b.x), y: Math.min(box.y, b.y),
            r: Math.max(box.r, b.x + b.width), b2: Math.max(box.b2, b.y + b.height) }
        : { x: b.x, y: b.y, r: b.x + b.width, b2: b.y + b.height };
    });
    if (!box) return null;
    var p = svg.createSVGPoint();
    p.x = box.x; p.y = box.y + seatY; var tl = p.matrixTransform(m);
    p.x = box.r; p.y = box.b2 + seatY; var br = p.matrixTransform(m);
    return { left: tl.x, top: tl.y, right: br.x, bottom: br.y, width: br.x - tl.x, height: br.y - tl.y };
  }

  function contentParts(opts) {
    if (!svg || !st.kind) return [];
    var sel = ((opts && opts.glass) ? '' : '.panel, ') + '.polygon, .meas, .card, .sort-item, .bin, .choice, .shape, .badge, .summary-card';
    var out = [];
    var nodes = svg.querySelectorAll(sel);
    var m = svg.getScreenCTM && svg.getScreenCTM();
    var px = function (x) { return m ? m.a * x + m.e : x; }, py = function (y) { return m ? m.d * y + m.f : y; };
    for (var i = 0; i < nodes.length; i++) {
      var q = nodes[i]._rect;
      // on the glass, the polygon counts as its outline alone (see nook())
      var el = (opts && opts.glass && nodes[i] === st.polyG && st.fill) ? st.fill : nodes[i];
      var r = q
        ? { left: px(q.x), top: py(q.y + seatY), right: px(q.x + q.w), bottom: py(q.y + q.h + seatY),
            width: px(q.x + q.w) - px(q.x), height: py(q.y + q.h) - py(q.y) }
        : el.getBoundingClientRect();
      if (r.width > 4 && r.height > 4) out.push(r);
    }
    return out;
  }

  var api = {
    mount: mount, apply: apply, focus: focus, waitFor: waitFor, element: element,
    snapshot: snapshot, restore: restore,
    isEmpty: isEmpty, contentBox: contentBox, contentParts: contentParts,
    /** The summary's collected cards, in the lesson's order (game.js reviewSummary). */
    summaryCards: function () {
      var S = st.summary;
      return S ? S.collected.map(function (id) { return { id: id, el: S.cards[id] }; }).filter(function (c) { return c.el; }) : [];
    },
    summaryReplay: function (id) {
      var S = st.summary;
      if (!S) return Promise.resolve(false);
      var fade = function (el, o) { if (!el || !el.style) return; el.style.transition = 'opacity 240ms ease'; el.style.opacity = o; };
      if (id == null) {
        S.collected.forEach(function (k) { var c = S.cards[k]; if (c) { fade(c, ''); fade(c._mini, ''); } });
        setSummary('READY');
        return Promise.resolve(true);
      }
      var c = S.cards[id];
      if (!c) return Promise.resolve(false);
      setSummary('CARD_SELECTED', id);
      S.collected.forEach(function (k) { if (k !== id && S.cards[k]) { fade(S.cards[k], '.42'); fade(S.cards[k]._mini, '.42'); } });
      setSummary('LOCK_OTHER_CARDS', id);
      fade(c, ''); fade(c._mini, '');
      if (!reduced() && c._pop && c._pop.animate) {
        c._pop.style.transformBox = 'fill-box'; c._pop.style.transformOrigin = 'center';
        try { c._pop.animate([{ scale: '1' }, { scale: '1.06', offset: 0.45 }, { scale: '1' }], { duration: 360, easing: 'cubic-bezier(.3,1.4,.5,1)' }); } catch (e) {}
      }
      setSummary('REPLAY_EXPLANATION', id);
      if (c._linesG) while (c._linesG.firstChild) c._linesG.removeChild(c._linesG.firstChild);
      var ms = summaryReveal(c);
      return sumHold((ms || 0) + 200).then(function () { setSummary('SETTLE', id); return true; });
    },
    outsideCount: function () {
      if (!st.verts || st.verts.length < 4) return 0;
      return Poly.allDiagonals(st.verts.length).filter(function (d) { return !Poly.isDiagonalInside(st.verts, d[0], d[1]); }).length;
    },
    nook: function () {
      if (!st.panel || !st.polyG || !svg || !svg.getScreenCTM) return null;
      var m = svg.getScreenCTM(); if (!m) return null;
      var pf = panelFace(st.panel);
      var face = { left: m.a * pf.x + m.e, top: m.d * (pf.y + seatY) + m.f, right: m.a * (pf.x + pf.w) + m.e, bottom: m.d * (pf.y + pf.h + seatY) + m.f };
      var poly; try { poly = (st.fill || st.polyG).getBoundingClientRect(); } catch (e) { return null; }
      return { face: face, poly: poly };
    },
    swipeCardOffset: function () {
      var S = st.swipe, card = S && S.card;
      if (!card) return null;
      var tf = card.getAttribute('transform') || '';
      var t = /translate\(\s*([-\d.]+)[\s,]+([-\d.]+)\s*\)/.exec(tf), r = /rotate\(\s*([-\d.]+)/.exec(tf), k = /scale\(\s*([-\d.]+)/.exec(tf);
      return { dx: t ? +t[1] - SWIPE_HOME.x : 0, dy: t ? +t[2] - SWIPE_HOME.y : 0, rot: r ? +r[1] : 0, scale: k ? +k[1] : 1,
               cx: SWIPE_HOME.x, cy: SWIPE_HOME.y + seatY };
    },
    peekAnchor: function (o) {
      if (st.kind === 'summary') {
        var sc = st.summary && st.summary.active ? st.summary.cards[st.summary.active] : null;
        if (!sc || sc._collected) return null;
        var sr = sc._rect;
        return { frame: 'panel', at: 0.5, x: sr.x, y: sr.y + seatY, w: sr.w, h: sr.h };
      }
      if (st.panel) return seatY ? Object.assign({}, st.panel, { y: st.panel.y + seatY }) : st.panel;
      if (st.compare) {
        // the card the lesson is looking at — the one glowing — else the left
        var k = st.compareFocus && st.compare[st.compareFocus] ? st.compareFocus : 'left';
        if (st.compare[k] && st.compare[k].panel) {
          var cp = st.compare[k].panel;
          return seatY ? Object.assign({}, cp, { y: cp.y + seatY }) : cp;
        }
      }
      if (st.swipe) {
        var ch = SWIPE_HALF * ((global.CardFrame && CardFrame.option)
                               ? CardFrame.option.h / CardFrame.option.w : 1);
        var card = st.swipe.card;
        var tm = card && /translate\(\s*([-\d.]+)[\s,]+([-\d.]+)\s*\)/.exec(card.getAttribute('transform') || '');
        var home = !!card && (!tm || (Math.abs(+tm[1] - SWIPE_HOME.x) < 0.5 && Math.abs(+tm[2] - SWIPE_HOME.y) < 0.5));
        if (!home && !(o && o.home)) return null;
        return { frame: 'option', at: 0.5, pops: true,
                 x: SWIPE_HOME.x - SWIPE_HALF, y: SWIPE_HOME.y - ch + seatY,
                 w: SWIPE_HALF * 2, h: ch * 2 };
      }
      return null;
    },
    onTap: function (fn) { onTap = fn || function () {}; },
    hintRestart: function () { if (hintRearm) hintRearm(); },
    /** game.js: hold the stage's input while he speaks (see holdOn) */
    hold: function (on) { holdOn = !!on; },
    perch: function (on, ms) {
      if (!perchLog) return;
      var want = on ? '1' : '0';
      if (perchLog.style.opacity === want) return;
      perchLog.style.transition = (reduced() || ms === 0) ? '' : 'opacity ' + (ms || 320) + 'ms ease';
      perchLog.style.opacity = want;
    },
    perchAt: function () { var p = perchPoint(); return { x: p.x / W, y: p.y / H }; },
    blurLog: function (sd) {
      if (!perchLog || !svg) return;
      var f = svg.querySelector('#logSoft feGaussianBlur');
      if (!f) return;
      if (sd > 0.05) { f.setAttribute('stdDeviation', sd.toFixed(2)); perchLog.setAttribute('filter', 'url(#logSoft)'); }
      else { perchLog.removeAttribute('filter'); f.setAttribute('stdDeviation', '0'); }
    },
    teachBox: function () { return st.teachCopy && st.teachCopy.parentNode ? st.teachCopy.getBoundingClientRect() : null; },
    /** game.js: lift a card out and teach it (see teachShape) */
    teach: function (el, opts) { return teachShape(el, opts); },
    /** game.js: may a hint play now? (only while the lesson is only waiting) */
    hintGate: function (fn) { hintGate = typeof fn === 'function' ? fn : function () { return true; }; },
    /** Forget which interactions have been demonstrated (Restart). */
    forgetHints: function () { hintSeen = {}; },
    onEvent: function (fn) { onEvent = fn || function () {}; },
    seat: function (free) { plankFree = !!free; applySeat(true); },
    get seatY() { return seatY; },
    choicesEnterMs: function (n) { return reduced() ? 0 : 90 * Math.max(0, (n || 0) - 1) + ENTER_MS; },
    said: said,
    releaseHeld: releaseHeld,
    /** The board answers a vocabulary word (see THE WORD, SHOWN ON THE BOARD). */
    emphasizeConcept: emphasize,
    /** The child's own shapes, from the start again (Restart). */
    forgetMade: function () { made = {}; },
    /** Where the pick → connect step is (setConnect), or null off it. */
    connectState: function () { return st.connect || null; },
    leaveConnect: function () {
      if (!st.vstate && !st.sidesDone && !st.segment) return;
      st.vstate = null; st.sidesDone = null; st.segment = null; st.segLine = st.segGlow = null;
      if (st.polyG && st.verts) renderPoly();
    },
    flurry: flurry,
    get staleSuppressed() { return staleSuppressed; },
    get pendingTimers() { return sceneTimers.length; },
    get svg() { return svg; }, get state() { return st; },
    shapeVerts: shapeVerts,
    summaryState: function () { var S = st.summary; return S && st.kind === 'summary' ? { state: S.state, active: S.active, collected: S.collected.slice() } : null; },
    summaryPhase: function (name) {
      var S = st.summary;
      if (st.kind !== 'summary' || !S || !S.active) return;
      if (['SWIFTEE_ENTER', 'EXPLANATION', 'READING_PAUSE', 'SWIFTEE_EXIT'].indexOf(name) < 0) return;
      setSummary(name, S.active);
    },
    summaryGeometry: function (id) {
      var V = SUMMARY_VISUALS[id]; if (!V) return null;
      return { start: summaryVerts(id, false), end: summaryVerts(id, true), hi: (V.hi || []).slice(), line: V.line ? V.line.slice() : null,
               sides: V.sides ? V.sides.map(function (q) { return q.slice(); }) : null, wedge: V.wedge == null ? null : V.wedge,
               diags: !!V.diags, move: V.move ? V.move.slice() : null, marks: V.marks || null, tone: V.tone || null };
    }
  };
  global.Stage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : this);

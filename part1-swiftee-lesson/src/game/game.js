// game.js — wires everything and runs the screens.
(function (global) {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var pic = function (u) { return global.Preload && Preload.pick ? Preload.pick(u) : u; };
  var LANG = global.I18N && global.I18N.on ? global.I18N : null;
  var root, stageEl, hud, bubble, instruction, progress, loadEl, continueBtn, nextBtn;
  var director, current = -1, playing = false, settleTimer = null, mouthTimer = null, bubbleTimer = null;
  var buddyOn = true;
  var BEAT_WITHOUT_HIM_MS = 600;
  var present = false, entering = null, flightGen = 0;
  var riseWait = false;          // an entrance waiting for the swipe card to settle (entrance)
  var playGen = 0;
  var refitTimer = null, refitRaf = 0;
  var SAVE_KEY = 'swiftee.audio';
  var leaving = false;
  var quest = Quest.create(), rewardTimer;

  function reward(text, big) {
    clearTimeout(rewardTimer);
    var el = $('#reward');
    if (el) el.textContent = text || '';
    rewardTimer = setTimeout(function () { if (el) el.textContent = ''; }, 4000);

    if (!big) return;
    if (global.SFX) SFX.play('levelUp');
  }
  function entrance(quick, settled) {
    var ms = quick && typeof quick === 'object' ? quick.ms : null;
    if (quick && typeof quick === 'object') quick = !!quick.quick;
    if (!buddyOn || present || !global.Swiftee || !Swiftee.play) return Promise.resolve(false);
    if (entering) return entering;
    leaveGen++; leaving = false;
    if (Swiftee.pos === 'off' && Swiftee.place) {
      var back = markFor(current, null, Swiftee.size);
      if (back && back.pos !== 'off') Swiftee.place(back.pos, back.size);
    }
    if (!settled && swipeCardMoving()) {
      var screenAt = current, q = { quick: quick, ms: ms };
      riseWait = true;
      if (Swiftee.visible) Swiftee.visible(false);
      var waited = cardSettled().then(function () {
        // (a screen change since has its own entrance: this one is over)
        if (entering !== waited) return false;
        riseWait = false; entering = null;
        return screenAt === current ? entrance(q, true) : false;
      });
      entering = waited;
      return waited;
    }
    var done = function () { present = true; entering = null; syncPeekRim(); return true; };
    var wing = wingFor('from'); if (quick) wing.quick = true; if (ms) wing.ms = ms;
    entering = Promise.race([Swiftee.play('enter', wing), pause(1500)]).then(done, done);
    syncPeekRim();   // the rim is up before he rises behind it
    return entering;
  }

  function tourStops() {
    var S = global.Stage && Stage.state;
    var card = S && S.panelEl, shape = S && S.polyG;
    if (!card || !shape || !Swiftee.bounds) return null;
    var c = card.getBoundingClientRect(), s = shape.getBoundingClientRect(), me = Swiftee.bounds();
    if (!c.width || !s.width || !me || !me.height) return null;
    var k = 0.58, bh = me.height * k, bw = me.width * k;
    var left = s.left - bw * 0.54, right = s.right + bw * 0.54;
    var top = Math.max(bh * 0.5 + 30, s.top - bh * 0.2);
    var bottom = Math.min((global.innerHeight || 800) - bh * 0.55 - 12, s.bottom + bh * 0.55);
    return [
      { x: left, y: s.top + s.height * 0.46, scale: k, tilt: 7, hold: 180 },
      { x: s.left + s.width * 0.12, y: top, scale: k, tilt: 4 },
      { x: s.left + s.width * 0.5, y: top, scale: k * 0.96, tilt: 0, hold: 200 },
      { x: s.right - s.width * 0.12, y: top, scale: k, tilt: -4 },
      { x: right, y: s.top + s.height * 0.46, scale: k, tilt: -7, hold: 240 },
      { x: s.right - s.width * 0.08, y: bottom, scale: k, tilt: -3 },
      { x: s.left + s.width * 0.5, y: bottom, scale: k * 0.96, tilt: 0, hold: 200 },
      { x: s.left + s.width * 0.08, y: bottom, scale: k, tilt: 3 },
      { x: left, y: s.top + s.height * 0.46, scale: k, tilt: 7 }
    ];
  }
  /* he comes in from just off the upper left, already small and flying */
  function tourStart() {
    var me = Swiftee.bounds && Swiftee.bounds();
    if (!me || !me.height) return null;
    return { x: -me.width * 0.35, y: Math.max(me.height * 0.4, (global.innerHeight || 800) * 0.22), scale: 0.66, tilt: 12 };
  }
  function flyIn() {
    if (!buddyOn || !global.Swiftee || !Swiftee.play) return Promise.resolve(false);
    if (present) return Promise.resolve(true);
    if (entering) return entering;
    leaveGen++; leaving = false;
    var m = markFor(current, null, Swiftee.size);
    if (m && m.pos !== 'off' && Swiftee.place) Swiftee.place(m.pos, m.size);
    var screen = current, generation = playGen, flight = ++flightGen;
    var done = function () {
      if (screen !== current || generation !== playGen || flight !== flightGen) return false;
      present = true; entering = null; syncPeekRim(); placeBubble(); return true;
    };
    var shape = Stage.state.polyG && Stage.state.polyG.getBoundingClientRect();
    var look = shape && { x: (shape.left + shape.right) / 2, y: (shape.top + shape.bottom) / 2 };
    entering = Promise.race([Swiftee.play('enter', { from: 'air', tour: tourStops() || [], start: tourStart(), look: look, ms: 5400 }), pause(7500)]).then(done, done);
    return entering;
  }

  var leaving = false, leaveGen = 0;
  function leave() {
    if (!present || !global.Swiftee || !Swiftee.play) return Promise.resolve();
    present = false;
    leaving = true;
    var gen = ++leaveGen;
    var off = function () {
      if (gen !== leaveGen || present || entering) return;
      leaving = false; if (Swiftee.place) Swiftee.place('off', Swiftee.size); syncPeekRim();
    };
    return Promise.race([Swiftee.play('exit', wingFor('to')), pause(1200)]).then(off, off);
  }

  function pause(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var SCENE_ENTER_MS = 440;   // a card's arrival (stage.js enter(): 380ms) plus a breath

  function splitLine(text) {
    if (!text || text.length <= 32) return [text];
    var sentences = [], rest = text, m;
    while ((m = /^(.{3,}?[.!?\u2026\u0964\u0965])\s+(\S.*)$/.exec(rest))) { sentences.push(m[1]); rest = m[2]; }
    sentences.push(rest);
    if (sentences.length < 2) return [text];
    var BUDGET = 44;
    var parts = [];
    sentences.forEach(function (s0) {
      var last = parts[parts.length - 1];
      if (last && (last.length + 1 + s0.length) <= BUDGET) parts[parts.length - 1] = last + ' ' + s0;
      else parts.push(s0);
    });
    return parts;
  }

  var lineTimers = [];
  function clearLineTimers() { lineTimers.splice(0).forEach(clearTimeout); }

  var heldCard = null, restoringCard = false;
  function restoreHeldCard() {
    if (heldCard == null || restoringCard) return;
    var t = heldCard; heldCard = null;
    restoringCard = true;
    try { setCard(t); } finally { restoringCard = false; }
  }

  function plankVoice(opts, ctx) {
    var id = (global.VO && opts && opts.vo) ? opts.vo : null;
    if (id && VO.ready && !VO.isReady) {
      return VO.ready().then(function () {
        if (ctx && ctx.signal && ctx.signal.cancelled) return;
        return plankVoice(opts, ctx);
      });
    }
    var started = id ? VO.play(id) : null;
    if (!started) return Promise.resolve();
    if (global.Instruction && Instruction.voice) {
      Instruction.voice(function () { return (VO.id === id && VO.at) ? VO.at() : null; }, VO.words ? VO.words(id) : null);
    }
    if (ctx && ctx.onCancel) ctx.onCancel(function () { if (VO.id === id) VO.stop(); });
    return VO.finished ? VO.finished() : Promise.resolve();
  }

  var screenLine = null;
  function screenCtx() {
    var sig = { cancelled: false }, fns = [];
    screenLine = { sig: sig, fns: fns };
    return {
      signal: sig,
      onCancel: function (fn) {
        if (sig.cancelled) { try { fn(); } catch (e) {} return; }
        fns.push(fn);
      }
    };
  }
  function cancelScreenLine() {
    heldCard = null;
    var s = screenLine; screenLine = null;
    if (!s) return;
    s.sig.cancelled = true;
    s.fns.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
  }

  var rimEl = null;
  function syncPeekRim() {
    var want = !riseWait && global.Swiftee && Swiftee.pos === 'peek' && (present || entering || leaving) &&
               global.Stage && Stage.peekAnchor && Stage.peekAnchor({ home: true }) &&
               global.CardFrame && CardFrame.panel && Stage.svg && Stage.svg.getScreenCTM;
    if (!want) { if (rimEl) rimEl.style.display = 'none'; rimFollow(false); return; }
    var a = Stage.peekAnchor({ home: true }), m = Stage.svg.getScreenCTM();
    if (!m) { if (rimEl) rimEl.style.display = 'none'; return; }
    if (!rimEl) {
      rimEl = document.createElement('img');
      rimEl.className = 'peek-rim';
      rimEl.alt = '';
      rimEl.setAttribute('aria-hidden', 'true');
      rimEl.src = pic(CardFrame.panel.src);
      rimEl.style.cssText = 'position:absolute;z-index:4;pointer-events:none;';
      var host = (Swiftee.el && Swiftee.el.parentNode) || document.body;
      if (Swiftee.el && Swiftee.el.nextSibling) host.insertBefore(rimEl, Swiftee.el.nextSibling); else host.appendChild(rimEl);
    }
    var hostBox = rimEl.parentNode.getBoundingClientRect();
    var x = m.a * a.x + m.e - hostBox.left, y = m.d * a.y + m.f - hostBox.top;
    var w = m.a * a.w, h = m.d * a.h;
    var PF = CardFrame[a.frame || 'panel'] || CardFrame.panel;
    if (rimEl.getAttribute('src') !== pic(PF.src)) rimEl.src = pic(PF.src);
    var paneY = PF.pane ? PF.pane.y : 0.082;
    rimEl.style.display = '';
    rimEl.style.left = x + 'px'; rimEl.style.top = y + 'px';
    rimEl.style.width = w + 'px'; rimEl.style.height = h + 'px';
    var to = ((paneY + 0.004) * 100).toFixed(2), gone = ((paneY + 0.04) * 100).toFixed(2);
    var mask = 'linear-gradient(to bottom, #000 0%, #000 ' + to + '%, transparent ' + gone + '%)';
    rimEl.style.webkitMaskImage = mask; rimEl.style.maskImage = mask;
    rimFollow(true);
  }

  var rimRaf = 0;
  function rimFollow(on) {
    if (!on) { if (rimRaf) { (global.cancelAnimationFrame || clearTimeout)(rimRaf); rimRaf = 0; } if (rimEl) rimEl.style.transform = ''; return; }
    if (rimRaf || !global.requestAnimationFrame) return;
    var step = function () {
      rimRaf = 0;
      if (!rimEl || rimEl.style.display === 'none') return;
      var off = global.Stage && Stage.swipeCardOffset ? Stage.swipeCardOffset() : null;
      var m = Stage.svg && Stage.svg.getScreenCTM ? Stage.svg.getScreenCTM() : null;
      if (off && m) {
        rimEl.style.transformOrigin = '50% 50%';
        rimEl.style.transform = 'translate(' + (off.dx * m.a).toFixed(1) + 'px,' + (off.dy * m.d).toFixed(1) + 'px) rotate(' + off.rot.toFixed(2) + 'deg)' +
                                (Math.abs(off.scale - 1) > 1e-3 ? ' scale(' + off.scale.toFixed(4) + ')' : '');
      } else if (!off) {
        if (global.Stage && Stage.state && Stage.state.swipe) { rimEl.style.display = 'none'; rimEl.style.transform = ''; }
        return;
      }
      rimRaf = global.requestAnimationFrame(step);
    };
    rimRaf = global.requestAnimationFrame(step);
  }

  function wingFor(key) {
    var o = {};
    if (Swiftee.pos === 'peek') {
      o[key] = 'below';
      o.rise = Math.round(frame().h * (BIRD_H[Swiftee.size] || BIRD_H.small) * 0.8);
      if (popRise) { o.rise = popRise; if (key === 'to') o.ms = 420; }
    } else {
      o[key] = 'left';
    }
    return o;
  }

  function wantsBuddy(i) {
    var s = Screens.list[i];
    if (!s) return false;
    return !!Screens.wantsBuddyAt(i);
  }
  /** On a one- or two-card screen he says the instructions too (Screens.speaksAll). */
  function speaksAll(i) { return !!(Screens.speaksAll && Screens.speaksAll(i)); }

  function sceneKindAt(i) { return Screens.sceneKindAt ? Screens.sceneKindAt(i) : null; }

  function peeksBehind(i) {
    var k = sceneKindAt(i);
    return k === 'swipe-sort' || k === 'summary';
  }

  function markFor(i, curPos, curSize) {
    var s = Screens.list[i];
    if (!s || !s.swiftee || !wantsBuddy(i)) return null;
    var pos = s.swiftee.pos || curPos || 'left', size = s.swiftee.size || curSize || 'medium';
    var behind = peeksBehind(i);
    if (!s.swiftee.purpose) {
      if (behind) { pos = 'peek'; size = 'small'; }
      else if (!/^(left|top-left|log$)/.test(pos)) { pos = 'left-low'; size = 'medium'; }   // (the log is a left-hand mark too)
    } else if (pos === 'peek' && !behind) { pos = 'left-low'; size = 'medium'; }
    return { pos: pos, size: size };
  }

  var PRAISE_FOR = {
    keepGoing:  { t: 'Keep going!', vo: 'fb46' },   // right, and the same screen has more to do
    screenDone: { t: 'Amazing!', vo: 'fb47' },
    levelDone:  { t: 'Great job!', vo: 'fb03' }     // right, and the level is done
  };
  var EMOTE = { fb03: 'celebrate', fb46: 'nice', fb47: 'happy' };
  var NUDGE = [
    { t: 'Try again!', vo: 'fb32' }
  ];
  var CLUES = {
    curved:   { t: 'Not quite. A circle is curved. A polygon has only straight sides.', vo: 'fb44' },
    open:     { t: 'Not quite. This shape is open. A polygon must be closed.', vo: 'fb45' },
    compare:  { t: 'Try again! Compare the sides and angles now.', vo: 'fb41' }
  };
  var nudgeN = 0, feedbackScreen = -1;
  var cheerUntil = 0;   // the lesson does not move on while he is still saying it
  var missesHere = 0;   // wrong answers on the screen that is up
  var streak = 0, cheeredAt = 0;
  function doingWell() { return streak >= 3 && streak % 3 === 0 && cheeredAt !== streak; }
  var hintedHere = false;

  function direction(extra) {
    var o = Object.assign({}, extra || {});
    o.key = (Screens.list[current] || {}).id || String(current);
    o.misses = missesHere;
    if (missesHere && o.after == null) o.after = 'miss';
    return o;
  }

  var REACT_MS = 300;
  var verdictAt = 0;
  function afterVerdict(fn) {
    var screenAt = current, wait = Math.max(0, REACT_MS - (Date.now() - verdictAt));
    if (!wait) { fn(); return; }
    var h = setTimeout(function () { if (current === screenAt) fn(); }, wait);
    lineTimers.push(h);
  }

  var lessonLine = null, standing = null, inputLive = false;
  var inputSpec = null;
  var HOLDS_A_QUESTION = /^(think|question|examine|inspect)$/;
  var WATCHED = /^(draw-diagonals?|drag-vertex|sort|swipe)$/;
  function showStanding() {
    if (!standing || standing.screen !== current || !inputLive || !present) return false;
    say(standing.full, null, 0, null, null, { instant: true, passive: true });
    return true;
  }

  var lastFx = { kind: null, at: 0 };
  function verdictFx(kind, type) {
    if (!global.Juice || !global.Stage || !Stage.element) return;
    var now = Date.now();
    if (lastFx.kind === kind && now - lastFx.at < 300) return;
    lastFx = { kind: kind, at: now };
    // a dragged corner is answered on the whole shape it changed
    var drag = (type || (inputSpec && inputSpec.type)) === 'drag-vertex';
    var el = drag ? Stage.element('polygon') : (Stage.element('answer') || Stage.element('polygon'));
    try {
      if (kind === 'wrong') { if (Juice.bad) Juice.bad(el); }
      else if (kind === 'correct' && Juice.good) Juice.good(el);
    } catch (e) {}
  }

  var replyUp = null;   // the reply react() last started: { kind, teach, gen } (gen: its pop)
  function react(kind, said, o) {
    o = o || {};
    if (kind === 'correct' && !o.late && !o.owed && (o.last || (o.final && levelEnd())) && replying()) {
      oweCheer([kind, said, Object.assign({}, o, { owed: true })]);
      return;
    }
    if (kind === 'wrong' && !o.late) { missesHere++; streak = 0; cheeredAt = 0; }
    if (kind === 'correct' && !o.late) streak++;
    var after = function () { var f = o.after; o.after = null; if (f) f(); };
    if (!buddyOn) { after(); return; }   // the sound and the confetti carry the verdict
    if (!global.Swiftee || !Swiftee.play) { after(); return; }
    if (!o.late) {
      var plan = replyFor(kind, said, o);
      if (plan) {
        if (popping && replyUp && replyUp.gen === popGen && replyUp.kind !== kind && !replyUp.teach) { popGen++; popping = false; say(null); }
        if (inputLive) holdInput(true);
        cheerUntil = Math.max(cheerUntil, Date.now() + REACT_MS + 400);
      }
      var args = [kind, said, Object.assign({}, o, { late: true, plan: plan })];
      afterVerdict(function () { react.apply(null, args); });
      return;
    }
    if (o.walked) { after(); return; }
    var reply = o.plan;
    var face = function () {
      if (o.face === false || !present) return;
      if (o.face === 'dip') { try { if (Swiftee.bounce) Swiftee.bounce('notice'); } catch (e) {} return; }
      try {
        if (kind === 'wrong') Swiftee.play('oops', direction());
        else if (kind === 'correct') {
          var emote = reply && reply.lines[0] && reply.lines[0].emote;
          if (doingWell()) { cheeredAt = streak; Swiftee.play('celebrate', direction()); }
          else if (emote === 'point') {
            // "You got it!" — at the thing that was got
            var at = global.Stage && Stage.element && (Stage.element('answer') || Stage.element('polygon'));
            Swiftee.play('point', direction(at ? { at: at } : null));
          } else Swiftee.play(emote || (reply ? 'happySmall' : 'nod'), direction());
          // "Great job!" — the level's cheer — and a glint on the answer
          if (reply && reply.lines[0] && reply.lines[0].vo === 'fb03' && global.Juice && Juice.sparkle && Stage.element) {
            try { Juice.sparkle(Stage.element('answer') || Stage.element('polygon')); } catch (e) {}
          }
        }
      } catch (e) {}
    };
    if (!reply) { face(); after(); return; }
    var said_ = null;
    if (reply.teach) said_ = pop(reply.lines, teachHooks(reply.teach));
    else { reply.lines[0].face = face; said_ = pop(reply.lines); }
    replyUp = { kind: kind, teach: !!reply.teach, gen: popGen };
    if (o.after) Promise.resolve(said_).then(after, after);
  }

  function teachHooks(t) {
    var T = null, wasAt = null;
    function lift() {
      var walked = null;
      if (buddyOn && present && global.Swiftee && Swiftee.play) {
        wasAt = { pos: Swiftee.pos, size: Swiftee.size };
        try { walked = Swiftee.play('move', { to: 'teach', size: 'medium' }); } catch (e) {}
      }
      if (rimEl) { rimEl.style.display = 'none'; rimFollow(false); }
      return Promise.all([T.open(), Promise.resolve(walked)]).then(function () {
        placeBubble();
        if (buddyOn && present && global.Swiftee && Swiftee.play) { try { Swiftee.play('present', direction()); } catch (e) {} }
      });
    }
    return {
      open: function () {
        say(null);
        var screenAt = current;
        return pause(Math.round(450 * paceScale())).then(function () {
          if (current !== screenAt) return null;
          T = Stage.teach(t.el, t);
          return T ? lift() : null;
        });
      },
      cue: function (what) { if (T) T.show(what); },
      close: function () {
        var back = T ? T.close() : Promise.resolve();
        // and back to his corner as the card goes home
        if (wasAt && buddyOn && present && global.Swiftee && Swiftee.play) {
          try { back = Promise.all([back, Swiftee.play('move', { to: wasAt.pos, size: wasAt.size })]); } catch (e) {}
        }
        return Promise.resolve(back).then(function () { placeBubble(); syncPeekRim(); });
      }
    };
  }

  var inputSeq = 0, praisedInput = -1, lastPraiseAt = 0, wrongRepliedSeq = -1;
  var FINALE = [{ t: 'You are a polygon adventurer!', vo: 'p38b' }];
  var READY = { t: 'Now you know everything about polygons. You are ready to help Momo.', vo: 'p39' };
  var NUDGE_STRONG = { t: 'Try again!', vo: 'fb32' };
  var levelCheered = -1;
  function levelEnd() { return ((global.Quest && Quest.chapters) || []).some(function (c) { return c.end === current; }); }
  function praiseFor(o) {
    var done = !!(o.final || o.last);
    return (levelEnd() && done) ? PRAISE_FOR.levelDone : done ? PRAISE_FOR.screenDone : PRAISE_FOR.keepGoing;
  }
  function replyFor(kind, said, o) {
    if (o.walked) return null;
    var now = Date.now(), lines = [], pick = null;
    if (current !== feedbackScreen) { feedbackScreen = current; lastPraiseAt = 0; }
    if (kind === 'correct') {
      var ends = levelEnd() && (o.final || o.last);
      if ((o.quiet && !ends) || o.face === 'dip') return null;
      if (!o.final && !ends && inputSpec && inputSpec.praise === false) return null;
      var due = ends ? levelCheered !== current : o.final ? now - lastPraiseAt > 1500 : praisedInput !== inputSeq;
      if (!due) return null;
      praisedInput = inputSeq; lastPraiseAt = now;
      if (said && said.t && !ends) pick = said;
      else pick = praiseFor(o);
      if (pick === PRAISE_FOR.levelDone) levelCheered = current;
      lines.push({ t: pick.t, vo: pick.vo, mood: 'win', emote: EMOTE[pick.vo] });
    } else if (kind === 'wrong') {
      if (!inputLive && wrongRepliedSeq === inputSeq) return null;
      var lesson = o.teach && (Screens.list[current] || {}).teach;
      var set = lesson && (o.teach.kind ? lesson[o.teach.kind] : (o.teach.concave ? lesson.concave : lesson.convex));
      if (set && set.length && global.Stage && Stage.teach) {
        wrongRepliedSeq = inputSeq;
        return { lines: set.map(function (b) { return { t: b.say, vo: b.vo, mood: 'hint', show: b.show, on: b.on || 0, shows: b.shows }; }),
                 teach: o.teach };
      }
      var clue = o.reason && CLUES[o.reason];
      if (said && said.t) pick = said;
      else if (clue) pick = clue;
      else if (o.tries >= 2) pick = NUDGE_STRONG;
      else pick = NUDGE[nudgeN++ % NUDGE.length];
      wrongRepliedSeq = inputSeq;
      lines.push({ t: pick.t, vo: pick.vo, mood: 'hint', miss: true });
      var rem = (Screens.list[current] || {}).remind;
      var count = rem && rem.perCard ? (o.tries || 0) : missesHere;
      if (rem && rem.say && count >= (rem.after || 1)) lines.push({ t: rem.say, vo: rem.vo, mood: 'hint' });
    }
    return lines.length ? { lines: lines } : null;
  }

  function seatFurniture() {
    var r = stageEl && stageEl.getBoundingClientRect();
    if (!r || !r.width) return;
    var s = Math.min(r.width / 1000, r.height / 562);
    var padX = Math.max(0, Math.round((r.width - 1000 * s) / 2));
    var padY = Math.max(0, Math.round((r.height - 562 * s) / 2));
    var g0 = document.getElementById('game');
    if (g0) { g0.style.setProperty('--band-x', padX + 'px'); g0.style.setProperty('--band-y', padY + 'px'); }
    if (g0) {
      var sw = 1000 * s;
      g0.style.setProperty('--svw', (sw / 100).toFixed(3) + 'px');
      g0.style.setProperty('--u', Math.max(0.7, Math.min(1.4, sw / 1920)).toFixed(4));
      g0.style.setProperty('--story-k', (sw / 1672).toFixed(5));
    }
  }

  function frame() {
    // The visible 1000×562 stage box inside the container (meet-fit).
    var r = stageEl.getBoundingClientRect();
    var s = Math.min(r.width / 1000, r.height / 562);
    var w = 1000 * s, h = 562 * s;
    return { x: (r.width - w) / 2, y: (r.height - h) / 2, w: w, h: h, portrait: r.height > r.width };
  }

  var CAM_CLOSE = 1.25;                  // the close shot: everything a quarter larger
  var CAM_BLUR = 0.0036;                 // ...and the painting this far out of focus (of the board's height)
  var CAM_AT = { x: 0.5, y: 0.93 };      // the point held still: his feet on the centre mark
  var cam = { k: 1, blur: 0 }, camGen = 0, camAim = null;   // camAim: where a running move is going
  function applyCam() {
    var f = frame(), on = cam.k !== 1;
    var ox = f.x + CAM_AT.x * f.w, oy = f.y + CAM_AT.y * f.h;
    var bd = document.getElementById('backdrop'), sv = global.Stage && Stage.svg;
    [bd, sv].forEach(function (n) {
      if (!n) return;
      n.style.transformOrigin = on ? ox.toFixed(1) + 'px ' + oy.toFixed(1) + 'px' : '';
      n.style.transform = on ? 'scale(' + cam.k.toFixed(4) + ')' : '';
      n.style.willChange = on ? 'transform' : '';
    });
    if (bd) bd.style.filter = cam.blur > 0.0001 ? 'blur(' + (cam.blur * f.h).toFixed(2) + 'px)' : '';
    if (global.Stage && Stage.blurLog) Stage.blurLog(cam.blur * 562);
  }
  function camFor(close) { return (close && !frame().portrait && !(global.Juice && Juice.reducedMotion)) ? CAM_CLOSE : 1; }
  function setCam(close) {
    var k = camFor(close);
    if (camAim === k) return;
    camGen++; camAim = null;
    if (cam.k === k && cam.blur === (k !== 1 ? CAM_BLUR : 0)) return;
    cam.k = k; cam.blur = k !== 1 ? CAM_BLUR : 0;
    applyCam();
  }
  function cameraTo(k, ms, ctx) {
    var gen = ++camGen, k0 = cam.k, b0 = cam.blur, b1 = k !== 1 ? CAM_BLUR : 0;
    var dur = Math.max(0, (ms || 0) * paceScale());
    var raf = global.requestAnimationFrame ? function (f) { global.requestAnimationFrame(f); }
                                            : function (f) { setTimeout(function () { f(Date.now()); }, 16); };
    camAim = k;
    return new Promise(function (resolve) {
      var t0 = null;
      var settle = function () { if (camAim === k) camAim = null; cam.k = k; cam.blur = b1; applyCam(); relayout(); resolve(); };
      if (ctx && ctx.onCancel) ctx.onCancel(function () { if (gen === camGen) { camGen++; settle(); } else resolve(); });
      if (k0 === k || dur < 17) { settle(); return; }
      var step = function (t) {
        if (gen !== camGen) return;
        if (t0 == null) t0 = t;
        var u = Math.min(1, (t - t0) / dur);
        var e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        cam.k = k0 + (k - k0) * e; cam.blur = b0 + (b1 - b0) * e;
        applyCam();
        if (global.Swiftee && Swiftee.relayout) Swiftee.relayout();
        if (u < 1) raf(step); else { camGen++; settle(); }
      };
      raf(step);
    });
  }

  var BIRD_H = { tiny: 0.16, small: 0.22, medium: 0.28, large: 0.28 };   // tiny: inside the card's corner, the shape is the big thing
  var popRise = null;            // px: the rise that hides all of him behind the swipe card (layout)
  var CONTENT_FRAC = 0.764;      // (449 - 58) / 512, from the manifest bounds
  var EDGE = 8;                  // px of breathing room at the viewport edge

  /** Does this screen put a row of options up at any point? */
  function screenAsksChoices(scr) {
    var beats = (scr.beats || []).concat(
      Object.keys(scr.perTap || {}).reduce(function (a, k) { return a.concat(scr.perTap[k] || []); }, []));
    var has = function (o) { return !!(o && o.choices); };
    if (has(scr.stage)) return true;
    return beats.some(function (b) {
      return has(b.stage) ||
        (b.on && Object.keys(b.on).some(function (k) { return (b.on[k] || []).some(function (x) { return has(x.stage); }); })) ||
        (b.otherwise || []).some(function (x) { return has(x.stage); });
    });
  }

  function wantsRoomBelow(scr) {
    var beats = (scr.beats || []).concat(
      Object.keys(scr.perTap || {}).reduce(function (a, k) { return a.concat(scr.perTap[k] || []); }, []));
    var has = function (o) {
      return !!(o && o.measurements);
    };
    if (has(scr.stage)) return true;
    return beats.some(function (b) {
      return has(b.stage) ||
        (b.on && Object.keys(b.on).some(function (k) { return (b.on[k] || []).some(function (x) { return has(x.stage); }); })) ||
        (b.otherwise || []).some(function (x) { return has(x.stage); });
    });
  }

  function wantsBand(scr) {
    var beats = (scr.beats || []).concat(
      Object.keys(scr.perTap || {}).reduce(function (a, k) { return a.concat(scr.perTap[k] || []); }, []));
    var under = function (lb) { return !!lb && !/^(segment|diagonal|top)$/.test(lb.at || ''); };
    var has = function (o) { return !!(o && (under(o.label) || o.badge || (o.choices && o.choices.length))); };
    if (has(scr.stage)) return true;
    return beats.some(function (b) {
      return has(b.stage) ||
        (b.on && Object.keys(b.on).some(function (k) { return (b.on[k] || []).some(function (x) { return has(x.stage); }); })) ||
        (b.otherwise || []).some(function (x) { return has(x.stage); });
    });
  }

  function layout(pos, size) {
    var f = frame();

    // stageH * wanted fraction = cell * scale * CONTENT_FRAC
    var want = BIRD_H[size] || BIRD_H.medium;
    var scale = (f.h * want) / (256 * CONTENT_FRAC);

    var map = {
      'left':               { x: 0.20, y: 0.88 },
      'left-low':           { x: 0.15, y: 0.97 },
      'top-left':           { x: 0.075, y: 0.30, air: true },
      'middle':             { x: 0.50, y: 0.80 },
      'teach':              { x: 0.17, y: 0.82 },
      'centre':             { x: 0.50, y: 0.93 },
      'ledge':              { x: 0.17, y: 0.81 },
      'log':                (global.Stage && Stage.perchAt) ? Stage.perchAt() : { x: 0.144, y: 0.729 },
      'off':                { x: -0.3, y: 0.9 }
    };

    var clipPage = null;
    var anchor = global.Stage && Stage.peekAnchor && Stage.peekAnchor();
    if (anchor && !f.portrait) {
      var ax = function (x) { return (x / 1000); }, ay = function (y) { return (y / 562); };
      var PF = global.CardFrame && (CardFrame[anchor.frame || 'panel'] || CardFrame.panel);
      var paneY = (PF && PF.pane) ? PF.pane.y : 0.082;
      var rim = anchor.y + anchor.h * (paneY - 0.03);
      var birdH = f.h * (BIRD_H[size] || BIRD_H.small);
      var peekHalfW = birdH * 0.46;
      var peekAt = anchor.at == null ? 0.24 : anchor.at;      // corner cap, or wherever the card asks
      var peekX = Math.max(anchor.x + anchor.w * peekAt, (peekHalfW / f.w) * 1000 + 14);
      map['peek'] = { x: ax(peekX), y: ay(anchor.y) + (0.47 * birdH) / f.h };
      popRise = null;
      if (anchor.pops) {
        var feetPx = f.y + map['peek'].y * f.h, cutPx = f.y + ay(rim) * f.h;
        popRise = Math.round(birdH + (cutPx - feetPx) + 14);
      }
      var paneH = (global.CardFrame && CardFrame.panel && CardFrame.panel.pane) ? CardFrame.panel.pane.h : 0.85;
      map['corner'] = { x: ax(anchor.x + anchor.w * 0.13), y: ay(anchor.y + anchor.h * (paneY + paneH + 0.035)) };
      if (pos === 'peek') clipPage = f.y + ay(rim) * f.h;
    } else {
      map['peek'] = map['top-left'];
      map['corner'] = map['left-low'];
      popRise = null;
    }
    if (f.portrait) {
      // Stage letterboxes; put Swiftee below the box so he never covers it.
      map['left'] = { x: 0.18, y: 1.02 }; map['left-low'] = { x: 0.16, y: 1.02 };
      map['top-left'] = { x: 0.13, y: 0.26 };
      map['centre'] = { x: 0.5, y: 1.02 };
      var below = Math.max(120, (window.innerHeight || 800) - (f.y + f.h));
      scale = (below * 0.56) / (256 * CONTENT_FRAC);
    }

    var m = map[pos] || map['left-low'];
    if (pos !== 'off' && pos !== 'ledge' && pos !== 'log' && soloed()) { m = map['centre']; }

    var x = f.x + m.x * f.w;

    var y = f.y + m.y * f.h;

    if (f.portrait && pos !== 'off' && m.y >= 1) {
      y = Math.max(y, f.y + f.h + 8 + 256 * CONTENT_FRAC * scale);
    }

    if (cam.k !== 1 && pos !== 'off') {
      var cox = f.x + CAM_AT.x * f.w, coy = f.y + CAM_AT.y * f.h;
      x = cox + (x - cox) * cam.k; y = coy + (y - coy) * cam.k; scale *= cam.k;
    }

    var L = fit({ x: x, y: y, scale: scale }, pos);
    if (cam.k !== 1 && pos !== 'off') L.cam = cam.k;
    if (clipPage != null) L.clip = clipPage;
    if (m.air) L.air = true;
    return L;
  }

  function fit(L, pos) {
    if (pos === 'off') return L;
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var fb = frame();
    var X0 = fb.portrait ? 0 : fb.x, Y0 = fb.portrait ? 0 : fb.y;
    if (!fb.portrait) { vw = fb.x + fb.w; vh = fb.y + fb.h; }
    var cell = 256 * L.scale;
    var top = L.y - 0.877 * cell, bottom = L.y + 0.123 * cell;
    var left = L.x - cell / 2, right = L.x + cell / 2;

    if (bottom > vh - EDGE) L.y -= (bottom - (vh - EDGE));
    if (L.y - CONTENT_FRAC * cell < Y0 + EDGE) L.y = Y0 + EDGE + CONTENT_FRAC * cell;
    if (left < X0 + EDGE) L.x += X0 + EDGE - left;
    if (right > vw - EDGE) L.x -= right - (vw - EDGE);
    return L;
  }

  /** True while Swiftee is holding the middle of an otherwise empty stage. */
  function soloed() { return !!(global.Stage && Stage.isEmpty && Stage.isEmpty()); }

  var revealTimer = null, revealUnits = null, revealDone = null;
  var nextFrame = global.requestAnimationFrame ? function (f) { return global.requestAnimationFrame(f); } : function (f) { return setTimeout(f, 16); };
  var dropFrame = global.cancelAnimationFrame ? function (id) { global.cancelAnimationFrame(id); } : clearTimeout;
  function stopReveal() { if (revealTimer != null) dropFrame(revealTimer); revealTimer = null; }

  var glanced = false;    // his one look at the board per line
  function showUnit(u) {
    u.el.classList.add('in');
    (u.also || []).forEach(function (x) { x.classList.add('in'); });
    if (u.term && global.DualCode) {
      var inLine = u.el.closest ? u.el.closest('.bubble-line') : null;
      var lineText = inLine ? inLine.textContent : '';
      if (lineText && global.I18N && I18N.on) lineText = I18N.english(lineText) || lineText;
      var lit = DualCode.cueTerm(u.term, { line: lineText });
      if (lit && !glanced && present && !entering && global.Swiftee && Swiftee.lookAt && !Swiftee.busy && !Swiftee.locked) {
        glanced = true;
        var gb = Stage.contentBox && Stage.contentBox();
        if (gb) { try { Swiftee.lookAt({ x: (gb.left + gb.right) / 2, y: (gb.top + gb.bottom) / 2 }, 900); } catch (e) {} }
      }
    }
    if (global.Stage && Stage.said) {
      if (global.I18N && I18N.on) I18N.cues(u.el.textContent).forEach(function (w) { try { Stage.said(w); } catch (e) {} });
      else { try { Stage.said(u.el.textContent); } catch (e) {} }
    }
  }

  function revealAll() {
    stopReveal();
    if (!revealUnits) return false;
    var pending = revealUnits.filter(function (u) { return !u.el.classList.contains('in'); });
    pending.forEach(showUnit);
    revealUnits = null;
    var done = revealDone; revealDone = null;
    if (done) { try { done(true); } catch (e) {} }
    return pending.length > 0;
  }

  /** Split a rendered line into word-sized units, chips counting as one. */
  function unitsOf(line) {
    var out = [];
    (function split(node) {
      [].slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 1) {
          if (n.classList && n.classList.contains('dc-term')) {
            out.push({ el: n, term: n.getAttribute('data-term') });
            return;
          }
          if (n.classList && n.classList.contains('dc-keep')) {
            var chip = n.querySelector('.dc-term'), also = [];
            [].slice.call(n.childNodes).forEach(function (c) {
              if (c.nodeType !== 3 || !c.nodeValue) return;
              var pw = document.createElement('span'); pw.className = 'w'; pw.textContent = c.nodeValue;
              n.replaceChild(pw, c); also.push(pw);
            });
            if (chip) out.push({ el: chip, term: chip.getAttribute('data-term'), also: also });
            else also.forEach(function (pw) { out.push({ el: pw, term: null }); });
            return;
          }
          split(n);
          return;
        }
        if (n.nodeType !== 3) return;
        var frag = document.createDocumentFragment();
        n.nodeValue.split(/(\s+)/).forEach(function (p) {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
          var w = document.createElement('span');
          w.className = 'w'; w.textContent = p;
          frag.appendChild(w); out.push({ el: w, term: null });
        });
        node.replaceChild(frag, n);
      });
    })(line);
    return out;
  }

  function reveal(line, ms, units, clock, cues, o) {
    o = o || {};
    stopReveal(); revealDone = null;
    units = units || unitsOf(line);
    var finished = function (early) { if (o.onDone) { try { o.onDone(!!early); } catch (e) {} } };
    if (!units.length) { finished(); return; }

    if (o.instant) { units.forEach(showUnit); finished(); return; }

    line.classList.add('revealing');
    revealUnits = units; revealDone = o.onDone || null;

    var span = Math.max(240, (ms || 1400) - 160);   // a breath left at the end
    var per = span / units.length;
    var t0 = Date.now();
    var lead = Math.max(0, o.lead || 0);
    var i = 0;
    var firstWord = [], nWords = 0;
    units.forEach(function (u) { firstWord.push(nWords); nWords += Math.max(1, String((u.el && u.el.textContent) || '').trim().split(/\s+/).filter(Boolean).length); });
    var byWord = !!(cues && nWords !== units.length && cues.length === nWords);
    var cueAt = function (k) { var c = cues ? cues[byWord ? firstWord[k] : k] : null; return c != null ? c : k * per; };
    var step = function () {
      revealTimer = null;
      var wall = Date.now() - t0;
      if (wall < lead) { revealTimer = nextFrame(step); return; }
      var t = clock ? clock() : null;
      if (t == null) t = wall - lead;
      while (i < units.length && t >= cueAt(i)) {
        showUnit(units[i]);
        if (o.onWord) { try { o.onWord(i, units.length); } catch (e) {} }
        i++;
      }
      if (i >= units.length) {
        revealUnits = null;
        var d = revealDone; revealDone = null;
        if (d) { try { d(false); } catch (e) {} }
        return;
      }
      revealTimer = nextFrame(step);
    };
    step();
  }

  var swapTimer = null, pendingPut = null;
  var T_PANEL_LEAD = 140, T_SWAP_OUT = 170, T_SWAP_LEAD = 290;
  if (global.Timing) { T_PANEL_LEAD = Timing.PANEL_LEAD; T_SWAP_OUT = Timing.SWAP_OUT; T_SWAP_LEAD = Timing.SWAP_LEAD; }
  function say(text, mood, ms, clock, cues, o) {
    o = o || {};
    if (text && global.I18N && I18N.on) text = I18N.tr(text);
    stopReveal(); revealUnits = null; revealDone = null;
    clearTimeout(swapTimer); swapTimer = null; pendingPut = null;
    if (!text) {
      if (global.VO && VO.stop) VO.stop();
      bubble.classList.add('out'); bubble.classList.remove('show'); bubble.classList.remove('dim'); bubble.classList.remove('enter');
      // and the plank it stood aside for comes back. See heldCard.
      restoreHeldCard();
      return;
    }
    var k = o.scale == null ? 1 : o.scale;
    if (bubble.classList.contains('show')) {
      var outMs = Math.round(T_SWAP_OUT * k);
      var leadIn = Math.max(0, (o.lead == null ? T_SWAP_LEAD * k : o.lead) - outMs);
      bubble.classList.add('out'); bubble.classList.remove('show'); bubble.classList.remove('dim'); bubble.classList.remove('enter');
      if (outMs > 0) {
        pendingPut = function () { putLine(text, mood, ms, clock, cues, o, leadIn, true); };
        swapTimer = setTimeout(function () { swapTimer = null; var f = pendingPut; pendingPut = null; if (f) f(); }, outMs);
        return;
      }
      putLine(text, mood, ms, clock, cues, o, leadIn, true);
      return;
    }
    putLine(text, mood, ms, clock, cues, o, o.lead == null ? Math.round(T_PANEL_LEAD * k) : o.lead, false);
  }

  function putLine(text, mood, ms, clock, cues, o, lead, swapping) {
    if (!o || !o.instant) glanced = false;
    if (present && !entering && global.Swiftee && Swiftee.visible && Swiftee.pos !== 'off') Swiftee.visible(true);
    var line = bubble.querySelector('.bubble-line');
    if (global.DualCode) {
      line.innerHTML = DualCode.markup(text);
    } else {
      line.textContent = text;
    }
    bubble.classList.remove('out');
    bubble.classList.remove('dim');
    bubble.classList.toggle('passive', !!o.passive);
    bubble.classList.add(swapping ? 'pre-swap' : 'pre');
    var units = unitsOf(line);
    if (!o.instant) line.classList.add('revealing');
    bubble.classList.add('snap');
    fitLine();
    bubble.classList.remove('enter');
    void bubble.offsetWidth;                           // commit the start state
    bubble.classList.remove('pre'); bubble.classList.remove('pre-swap');
    bubble.classList.add('show');
    bubble.classList.add('enter');                     // the soft pop (index.html, bubbleIn)
    reveal(line, ms, units, clock, cues, { lead: lead, instant: o.instant, onDone: o.onDone, onWord: o.onWord });
    requestAnimationFrame(function () { bubble.classList.remove('snap'); });

    clearTimeout(refitTimer);
    if (refitRaf) cancelAnimationFrame(refitRaf);
    var again = function () { if (bubble.classList.contains('show')) fitLine(); };
    refitRaf = requestAnimationFrame(again);
    refitTimer = setTimeout(again, 700);
  }

  function fitLine() {
    bubble.style.maxWidth = '';
    placeBubble();
    paintSkin();
  }

  /** How many rows the line actually rendered on. */
  function lineRows(line) {
    var kids = line ? line.childNodes : [], boxes = [], k;
    for (k = 0; k < kids.length; k++) {
      var n = kids[k];
      if (n.nodeType !== 1 || !n.offsetWidth) continue;
      boxes.push({ top: n.offsetTop, bottom: n.offsetTop + n.offsetHeight,
                   l: n.offsetLeft, r: n.offsetLeft + n.offsetWidth });
    }
    var rows = [];
    boxes.forEach(function (b) {
      var mid = (b.top + b.bottom) / 2, row = null;
      for (var i = 0; i < rows.length; i++) if (mid > rows[i].top && mid < rows[i].bottom) { row = rows[i]; break; }
      if (!row) rows.push({ top: b.top, bottom: b.bottom, l: b.l, r: b.r });
      else {
        row.top = Math.min(row.top, b.top); row.bottom = Math.max(row.bottom, b.bottom);
        row.l = Math.min(row.l, b.l); row.r = Math.max(row.r, b.r);
      }
    });
    return rows;
  }

  function snugWidth() {
    var line = bubble.querySelector('.bubble-line');
    if (!line) return;
    var widest = 0;
    lineRows(line).forEach(function (row) { widest = Math.max(widest, row.r - row.l); });
    if (!widest) return;
    var cs = getComputedStyle(bubble);
    var chrome = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    var want = Math.ceil(widest + chrome + 3);
    if (want >= bubble.offsetWidth - 4) return;
    var before = bubble.style.maxWidth;
    bubble.style.maxWidth = want + 'px';
    if (rowsOfLine() > 3) bubble.style.maxWidth = before;
  }

  function rowsOfLine() {
    var line = bubble.querySelector('.bubble-line');
    if (!line) return 1;
    return lineRows(line).length || 1;
  }

  function placeBubble() {
    var L = layout(Swiftee.pos, Swiftee.size || 'medium');
    var f = frame();
    var solo = soloed();
    // (the stage box, not the window: see fit())
    var vw = f.portrait ? (window.innerWidth || document.documentElement.clientWidth) : f.x + f.w;
    var vh = f.portrait ? (window.innerHeight || document.documentElement.clientHeight) : f.y + f.h;
    var X0 = f.portrait ? 0 : f.x, Y0 = f.portrait ? 0 : f.y;
    var K = Math.max(0.7, Math.min(2.2, (parseFloat(getComputedStyle(bubble).fontSize) || 25.6) / 25.6));
    var GAP = 26 * K, MIN_W = 240 * K, MIN_H = 64 * K;
    var TAIL_GAP = 30 * K;

    bubble.style.marginLeft = '0px';

    // Everything the bubble must stay out of.
    var content = (Stage.teachBox && Stage.teachBox()) || (Stage.contentBox && Stage.contentBox());
    var cardBox = instruction && instruction.classList.contains('show')
      ? instruction.getBoundingClientRect() : null;
    var hudBox = hud.getBoundingClientRect();
    var nextBox = continueBtn && continueBtn.classList.contains('show') ? continueBtn.getBoundingClientRect()
      : (nextBtn && nextBtn.classList.contains('show') ? nextBtn.getBoundingClientRect() : null);

    if (readyOn && Swiftee.pos === 'ledge') {
      var bird = birdRect();
      if (bird && bird.width) {
        bubble.style.maxWidth = Math.max(MIN_W, Math.min(vw - GAP - (bird.right - bird.width * 0.12), 600 * K)) + 'px';
        snugWidth();
        var rw = bubble.offsetWidth, rh = bubble.offsetHeight;
        var rl = Math.max(X0 + GAP, Math.min(vw - rw - GAP, bird.right - bird.width * 0.12));
        var rt = Math.max(hudBox.bottom + GAP, bird.top + bird.height * 0.08 - rh);
        bubble.style.left = rl + 'px';
        bubble.style.top = rt + 'px';
        paintSkin();
        return;
      }
    }

    // With nothing on stage he simply speaks over the middle of the screen.
    if (solo || !content) {
      bubble.style.maxWidth = Math.min(f.w * 0.86, 1040 * K) + 'px';
      snugWidth();
      bubble.style.left = '50%';
      bubble.style.marginLeft = -(bubble.offsetWidth / 2) + 'px';
      var birdTop = L.y - 256 * L.scale * CONTENT_FRAC;
      bubble.style.top = Math.max(hudBox.bottom + GAP, birdTop - bubble.offsetHeight - TAIL_GAP) + 'px';
      paintSkin();
      return;
    }

    if (Swiftee.pos === 'peek' && present && !entering) {
      var headBox = Swiftee.bounds && Swiftee.bounds();
      if (headBox) {
        var roomTop = hudBox.bottom + GAP;
        var wantW = Math.min(f.w * 0.62, 760 * K);
        bubble.style.maxWidth = wantW + 'px';
        snugWidth();
        var bw2 = bubble.offsetWidth, bh2 = bubble.offsetHeight;
        var top2 = headBox.top - TAIL_GAP - bh2;
        if (top2 >= roomTop) {
          var left2 = (headBox.left + headBox.right) / 2 - bw2 / 2;
          left2 = Math.max(X0 + GAP, Math.min(vw - bw2 - GAP, left2));
          bubble.style.left = left2 + 'px';
          bubble.style.top = top2 + 'px';
          paintSkin();
          return;
        }
      }
    }

    if (global.Swiftee && Swiftee.pos !== 'off') {
      var overHead = birdRect();
      if (overHead && overHead.width) {
        var ABOVE_GAP = 22 * K;
        bubble.style.maxWidth = Math.min(f.w * 0.5, 620 * K) + 'px';
        snugWidth();
        var aw = bubble.offsetWidth, ah = bubble.offsetHeight;
        var atop = overHead.top - ABOVE_GAP - ah;
        var acx = (overHead.left + overHead.right) / 2;
        var teachOn = Stage.teachBox && Stage.teachBox();
        var onGlass = false;
        if (!teachOn && Stage.contentBox) {
          var cb0 = Stage.contentBox(), hx0 = (overHead.left + overHead.right) / 2, hy0 = overHead.top + overHead.height * 0.2;
          onGlass = !!(cb0 && hx0 > cb0.left && hx0 < cb0.right && hy0 > cb0.top && hy0 < cb0.bottom);
          if (!onGlass && cb0) onGlass = overHead.right > cb0.left + 8 && overHead.left < cb0.right - 8 && overHead.bottom > cb0.top + 8 && overHead.top < cb0.bottom - 8;
        }
        var aparts = teachOn ? [teachOn] : (Stage.contentParts ? Stage.contentParts(onGlass ? { glass: true } : {}) : []);
        var ablocks = [hudBox, nextBox].filter(function (b) { return b && b.width; });
        var aclear = function (x, y) {
          var box = { left: x, right: x + aw, top: y, bottom: y + ah };
          var hit = function (p, pad) {
            return box.left < p.right + pad && box.right > p.left - pad && box.top < p.bottom + pad && box.bottom > p.top - pad;
          };
          for (var pi2 = 0; pi2 < aparts.length; pi2++) if (hit(aparts[pi2], 10)) return false;
          for (var bi2 = 0; bi2 < ablocks.length; bi2++) if (hit(ablocks[bi2], 16)) return false;
          return true;
        };
        var lane = null;
        var tryAbove = function () {
          if (atop < f.y + GAP) return false;
          var tries = [acx - aw / 2, acx - aw * 0.78, acx - aw * 0.22];   // centred, above-left, above-right
          var lo = lane ? lane.l : f.x + GAP, hi = lane ? lane.r - aw : f.x + f.w - GAP - aw;
          for (var ti = 0; ti < tries.length; ti++) {
            var ax2 = Math.max(lo, Math.min(hi, tries[ti]));
            if (acx < ax2 + 12 * K || acx > ax2 + aw - 12 * K) continue;
            if (aclear(ax2, atop)) {
              bubble.style.left = ax2 + 'px';
              bubble.style.top = atop + 'px';
              paintSkin();
              return true;
            }
          }
          return false;
        };
        if (tryAbove()) return;
        if (content && acx < content.left) {
          var col = content.left - 12 * K - (f.x + GAP);
          if (col >= MIN_W && col < aw) {
            bubble.style.maxWidth = col + 'px';
            snugWidth();
            if (rowsOfLine() <= 4) {
              aw = bubble.offsetWidth; ah = bubble.offsetHeight; atop = overHead.top - ABOVE_GAP - ah;
              lane = { l: f.x + GAP, r: content.left - 12 * K };
              if (tryAbove()) return;
              lane = null;
            }
          }
        }
        if (aparts.length) {
          var laneL = f.x + GAP, laneR = f.x + f.w - GAP;
          var bandTop = overHead.top - ABOVE_GAP - ah * 2.4, bandBot = overHead.top;
          for (var li = 0; li < aparts.length; li++) {
            var lp = aparts[li];
            if (lp.bottom + 10 < bandTop || lp.top - 10 > bandBot) continue;    // not at that height
            if (lp.right <= acx && lp.right + 10 > laneL) laneL = lp.right + 10;
            if (lp.left >= acx && lp.left - 10 < laneR) laneR = lp.left - 10;
          }
          var laneW = laneR - laneL;
          if (laneW >= MIN_W && laneW < aw) {
            bubble.style.maxWidth = laneW + 'px';
            snugWidth();
            if (rowsOfLine() <= 4) {
              lane = { l: laneL, r: laneR };
              aw = bubble.offsetWidth; ah = bubble.offsetHeight; atop = overHead.top - ABOVE_GAP - ah;
              if (tryAbove()) return;
              lane = null;
            }
          }
        }
      }
    }

    // the bands live inside the FRAME — the letterboxed stage — not the window
    var FL = f.x + GAP, FR = f.x + f.w - GAP;
    var top = Math.max(f.y + GAP, (cardBox ? cardBox.bottom + 10 : f.y + GAP));
    var bottom = f.y + f.h - GAP - (nextBox ? nextBox.height + 16 : 0);

    var birdBox = null;
    if (global.Swiftee && Swiftee.bounds) {
      var bb = birdRect();
      if (bb && bb.width) {
        birdBox = {
          left: bb.left - TAIL_GAP, right: bb.right + TAIL_GAP,
          top: bb.top - TAIL_GAP, bottom: bb.bottom + TAIL_GAP
        };
      }
    }

    var slots = [
      { id: 'left',  x: FL,                   y: top, w: content.left - GAP - FL,  h: bottom - top },
      { id: 'right', x: content.right + GAP,  y: top, w: FR - content.right - GAP, h: bottom - top },
      { id: 'above', x: FL, y: top, w: FR - FL, h: content.top - top - GAP },
      { id: 'below', x: FL, y: content.bottom + GAP, w: FR - FL, h: bottom - content.bottom - GAP }
    ];

    var cornered = !!(global.Swiftee && Swiftee.pos === 'corner');
    var rows = (Stage.contentParts ? Stage.contentParts({ glass: cornered }) : [])
      .map(function (r) { return [r.top, r.bottom]; })
      .sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    rows.forEach(function (r) {
      var last = merged[merged.length - 1];
      if (last && r[0] <= last[1] + 2) last[1] = Math.max(last[1], r[1]);
      else merged.push([r[0], r[1]]);
    });
    for (var i = 0; i + 1 < merged.length; i++) {
      slots.push({ id: 'gap', x: FL, y: merged[i][1] + GAP,
                   w: FR - FL, h: merged[i + 1][0] - merged[i][1] - GAP * 2 });
    }

    var blocks = [birdBox];
    [hudBox, nextBox].forEach(function (b) {
      if (!b || !b.width) return;
      blocks.push({ left: b.left - 28 * K, right: b.right + 28 * K,
                    top: b.top - 28 * K, bottom: b.bottom + 28 * K });
    });

    blocks.forEach(function (box) {
      if (!box) return;
      slots = slots.map(function (r) {
        var ov = r.x < box.right && r.x + r.w > box.left &&
                 r.y < box.bottom && r.y + r.h > box.top;
        if (!ov) return r;
        var cands = [
          { id: r.id, x: r.x, y: r.y, w: r.w, h: box.top - r.y, over: true },
          { id: r.id, x: r.x, y: box.bottom, w: r.w, h: r.y + r.h - box.bottom },
          { id: r.id, x: r.x, y: r.y, w: box.left - r.x, h: r.h },
          { id: r.id, x: box.right, y: r.y, w: r.x + r.w - box.right, h: r.h }
        ].filter(function (c) { return c.w >= MIN_W && c.h >= MIN_H; });
        if (!cands.length) return r;
        var overHim = box === birdBox && Swiftee.pos === 'peek';
        cands.sort(function (a, b) { return ((overHim && b.over) - (overHim && a.over)) || ((b.w * b.h) - (a.w * a.h)); });
        return cands[0];
      });
    });

    if (cornered && Stage.nook) {
      var nk = Stage.nook();
      if (nk && birdBox) {
        var cs = { id: 'corner',
                   x: nk.face.left + 8, y: nk.face.top + 8,
                   w: (nk.poly.left - 16) - (nk.face.left + 8),
                   h: birdBox.top - (nk.face.top + 8) };
        var gp = Stage.contentParts ? Stage.contentParts({ glass: true }) : [];
        var capY = cs.y + cs.h, rightEdge = cs.x + cs.w;
        gp.forEach(function (p) {
          if (!(p.right > cs.x + 4 && p.left < rightEdge - 4 && p.top < capY && p.bottom > cs.y)) return;
          var beside = p.left - 12 - cs.x, above = p.top - 10 - cs.y;
          if (beside >= 300 * K || (beside >= 200 * K && above < 2 * MIN_H)) rightEdge = Math.min(rightEdge, p.left - 12);   // step in beside it
          else capY = Math.min(capY, p.top - 10);                                        // or stop above it
        });
        cs.w = rightEdge - cs.x;
        cs.h = capY - cs.y;
        if (cs.w >= 200 * K && cs.h >= MIN_H) slots = [cs];
      }
    }
    slots = slots.filter(function (r) { return r.id === 'corner' || (r.w >= MIN_W && r.h >= MIN_H); });

    if (!slots.length) {
      slots = [{ id: 'above', x: FL, y: top, w: FR - FL, h: Math.max(MIN_H, content.top - top) }];
    }

    // Prefer the side he is standing on, then the roomiest.
    var onLeft = L.x < (X0 + vw) / 2;
    var peeking = Swiftee.pos === 'peek';
    slots.sort(function (a, b) {
      var pref = function (r) {
        if (peeking) return r.id === 'above' ? 2 : 0;
        return (r.id === (onLeft ? 'left' : 'right')) ? 1 : 0;
      };
      return (pref(b) - pref(a)) || (b.w * b.h - a.w * a.h);
    });
    var SAFE = 10;
    var capFor = function (r) {
      var room = (r.id === 'left' || r.id === 'right')
        ? Math.min(r.w - SAFE, 640 * K)
        : Math.min(r.w - SAFE, f.w * 0.8);
      return room;
    };

    var size = function () { return { w: bubble.offsetWidth, h: bubble.offsetHeight }; };

    var headX = L.x, headY = L.y - 256 * L.scale * CONTENT_FRAC;
    var placeIn = function (r, ww, hh) {
      var wx = (r.id === 'left' || r.id === 'right')
        ? L.x - ww / 2
        : (peeking ? L.x - ww / 2
           : (onLeft ? Math.max(r.x, L.x - ww * 0.35) : Math.min(r.x + r.w - ww, L.x - ww * 0.65)));
      var wy = (r.id === 'left' || r.id === 'right')
        ? L.y - 256 * L.scale * CONTENT_FRAC - hh - TAIL_GAP
        : (r.id === 'corner' ? r.y + r.h - hh              // just over his head
           : (headY >= r.y + r.h / 2 ? r.y + r.h - hh : r.y));
      return {
        x: Math.max(r.x, Math.min(wx, r.x + r.w - ww)),
        y: Math.max(r.y, Math.min(wy, r.y + r.h - hh))
      };
    };

    var lineH = parseFloat(getComputedStyle(bubble).lineHeight) || 30;
    bubble.style.maxWidth = '100000px';
    var chrome = bubble.offsetHeight - lineH;
    var rowsOf = function (hh) { return Math.max(1, Math.round((hh - chrome) / lineH)); };

    // The top of his head, which is what the pointer has to reach.
    var reach = function (p, ww, hh) {
      var dx = Math.max(p.x - headX, 0, headX - (p.x + ww));
      var dy = Math.max(p.y - headY, 0, headY - (p.y + hh));
      return Math.sqrt(dx * dx + dy * dy);
    };

    var slot = null, w = 0, h = 0, best = Infinity;
    for (var si = 0; si < slots.length; si++) {
      var r = slots[si];
      bubble.style.maxWidth = capFor(r) + 'px';
      var m = size();
      var fits = m.h <= r.h && m.w <= r.w;
      var rows = rowsOf(m.h);
      var near = reach(placeIn(r, m.w, m.h), m.w, m.h);
      var score = Math.max(0, (near - TAIL_GAP * 2) / K) * 6   // every pixel past the tail's reach costs six
                + (rows - 1) * 40                          // one row is nicer
                + (rows > 2 ? 200 : 0)
                + (rows > 3 ? 20000 : 0)
                + (fits ? 0 : 2400 + Math.max(0, (m.h - r.h) / K));
      if (score < best) { best = score; slot = r; }
    }
    bubble.style.maxWidth = capFor(slot) + 'px';
    var m2 = size(); w = m2.w; h = m2.h;

    if (rowsOf(h) > 3) {
      var widest = null;
      slots.forEach(function (r) { if (!widest || capFor(r) > capFor(widest)) widest = r; });
      if (widest && widest !== slot) {
        slot = widest;
        bubble.style.maxWidth = capFor(slot) + 'px';
        var m3 = size(); w = m3.w; h = m3.h;
      }
    }

    snugWidth();
    var m4 = size(); w = m4.w; h = m4.h;
    var at = placeIn(slot, w, h);
    var x = at.x, y = at.y;

    bubble.style.left = x + 'px';
    bubble.style.top = y + 'px';

    var got = { left: x, right: x + w, top: y, bottom: y + h };
    var dx = 0, dy = 0;
    if (got.left < slot.x) dx = slot.x - got.left;
    else if (got.right > slot.x + slot.w) dx = (slot.x + slot.w) - got.right;
    if (got.top < slot.y) dy = slot.y - got.top;
    else if (got.bottom > slot.y + slot.h) dy = (slot.y + slot.h) - got.bottom;
    if (dx || dy) {
      bubble.style.left = (x + dx) + 'px';
      bubble.style.top = (y + dy) + 'px';
    }
    var parts = Stage.contentParts ? Stage.contentParts({ glass: !!(global.Swiftee && Swiftee.pos === 'corner') }) : [];
    var hits = function () {
      var l = parseFloat(bubble.style.left) || 0, t = parseFloat(bubble.style.top) || 0;
      var r = { left: l, right: l + bubble.offsetWidth, top: t, bottom: t + bubble.offsetHeight };
      var over = function (p) {
        return r.left < p.right - 1 && r.right > p.left + 1 && r.top < p.bottom - 1 && r.bottom > p.top + 1;
      };
      for (var i = 0; i < parts.length; i++) if (over(parts[i])) return true;
      return !!(birdBox && over(birdBox));
    };

    for (var attempt = 0; attempt < 3 && hits(); attempt++) {
      var cur = { width: bubble.offsetWidth, height: bubble.offsetHeight };
      var narrower = Math.max(MIN_W, cur.width * 0.78);
      var wasWide = bubble.style.maxWidth;
      bubble.style.maxWidth = narrower + 'px';
      if (rowsOfLine() > 3) { bubble.style.maxWidth = wasWide; break; }
      var now = { width: bubble.offsetWidth, height: bubble.offsetHeight };
      // Re-seat it in the slot at the new size.
      bubble.style.left = Math.max(slot.x, Math.min(parseFloat(bubble.style.left),
                                                    slot.x + slot.w - now.width)) + 'px';
      bubble.style.top = Math.max(slot.y, Math.min(parseFloat(bubble.style.top),
                                                   slot.y + slot.h - now.height)) + 'px';
      var afterL = parseFloat(bubble.style.left) || 0;
      bubble.style.left = (afterL + (slot.x - afterL > 0 ? slot.x - afterL : 0)) + 'px';
    }

    var fin = { w: bubble.offsetWidth, h: bubble.offsetHeight };
    if (fin.w < MIN_W - 1 || Math.max(rowsOf(fin.h), rowsOfLine()) > 3) {
      var widest2 = null;
      slots.forEach(function (r) { if (!widest2 || capFor(r) > capFor(widest2)) widest2 = r; });
      if (widest2) {
        bubble.style.maxWidth = capFor(widest2) + 'px';
        snugWidth();
        fin = { w: bubble.offsetWidth, h: bubble.offsetHeight };
        var p2 = placeIn(widest2, fin.w, fin.h);
        bubble.style.left = p2.x + 'px';
        bubble.style.top = p2.y + 'px';
      }
    }
    var wasW = bubble.offsetWidth;
    snugWidth();
    var nowW = bubble.offsetWidth;
    if (nowW < wasW - 1) {
      bubble.style.left = ((parseFloat(bubble.style.left) || 0) + (wasW - nowW) / 2) + 'px';
      fin = { w: nowW, h: bubble.offsetHeight };
    }
    var lx = parseFloat(bubble.style.left) || 0, ly = parseFloat(bubble.style.top) || 0;
    bubble.style.left = Math.max(X0 + GAP, Math.min(lx, vw - fin.w - GAP)) + 'px';
    bubble.style.top = Math.max(Y0 + GAP, Math.min(ly, vh - fin.h - GAP)) + 'px';

    paintSkin();
  }

  var TIP = { bottom: 7.2, top: 28.8, right: 28.8, left: 7.2 };   // unmirrored tip, along the edge
  var MOUTH_LO = 8.4, MOUTH_HI = 27.6, TAIL_SIZE = 36;

  function paintSkin() {
    var tail = bubble.querySelector('.bubble-tail');
    if (!tail) return;
    var r = layoutRect(bubble);
    if (!r.width || !r.height) return;
    var par = bubble.offsetParent, pr0 = par && par.getBoundingClientRect();
    var toPx = function (v, span) { if (!v) return NaN; var n = parseFloat(v); return /%$/.test(v) ? n * span / 100 : (/px$/.test(v) ? n : NaN); };
    if (pr0) {
      var sl = toPx(bubble.style.left, par.clientWidth), stp = toPx(bubble.style.top, par.clientHeight);
      if (isFinite(sl)) r.left = pr0.left + sl + (parseFloat(bubble.style.marginLeft) || 0);
      if (isFinite(stp)) r.top = pr0.top + stp + (parseFloat(bubble.style.marginTop) || 0);
    }
    var head = (global.Swiftee && Swiftee.locked === 'measuring') ? null : headPoint();
    if (!head) { bubble.removeAttribute('data-tail'); return; }

    // the edge that faces his head: below, above, or beside
    var edge = head.y > r.top + r.height ? 'bottom'
             : head.y < r.top ? 'top'
             : head.x > r.left + r.width ? 'right' : 'left';
    var vertical = edge === 'bottom' || edge === 'top';
    var len = vertical ? r.width : r.height;
    var aim = vertical ? head.x - r.left : head.y - r.top;   // where his head is, along the edge

    var unflippedLeansLow = TIP[edge] < 30;                  // the unmirrored tip is toward the edge's start
    var wantLow = aim < len / 2;
    var flip = unflippedLeansLow !== wantLow;
    var tipAt = flip ? TAIL_SIZE - TIP[edge] : TIP[edge];

    // the mouth stays on the straight run of the edge, clear of the corners
    var radius = parseFloat(getComputedStyle(bubble).borderRadius) || 26;
    var lo = radius - MOUTH_LO + 2, hi = len - radius - MOUTH_HI - 2;
    if (hi < lo) { lo = hi = (len - TAIL_SIZE) / 2; }
    var offset = Math.max(lo, Math.min(hi, aim - tipAt));

    bubble.setAttribute('data-tail', edge);
    if (flip) bubble.setAttribute('data-tail-flip', ''); else bubble.removeAttribute('data-tail-flip');
    bubble.style.setProperty(vertical ? '--tail-x' : '--tail-y', offset.toFixed(1) + 'px');

    // the bubble springs out of its mouth
    var mx = vertical ? offset + TAIL_SIZE / 2 : (edge === 'right' ? r.width : 0);
    var my = vertical ? (edge === 'bottom' ? r.height : 0) : offset + TAIL_SIZE / 2;
    bubble.style.transformOrigin = (mx / r.width * 100).toFixed(1) + '% ' + (my / r.height * 100).toFixed(1) + '%';
  }

  function layoutRect(el) {
    var p = el.offsetParent || el.ownerDocument.body;
    var pr = p.getBoundingClientRect();
    return {
      left: pr.left + el.offsetLeft, top: pr.top + el.offsetTop,
      width: el.offsetWidth, height: el.offsetHeight
    };
  }

  function birdRect() {
    if (!global.Swiftee) return null;
    var painted = Swiftee.bounds ? Swiftee.bounds() : null;
    var moving = !Swiftee.arrived || Swiftee.state === 'move' || Swiftee.state === 'enter';
    if (!moving && painted && painted.width) return painted;
    var L = layout(Swiftee.pos, Swiftee.size || 'medium');
    if (!L) return painted && painted.width ? painted : null;
    // the drawn bird, not the sprite cell: the same fraction seat() uses
    var h = 256 * L.scale * CONTENT_FRAC, w = h * 0.86;
    return { left: L.x - w / 2, right: L.x + w / 2, top: L.y - h, bottom: L.y, width: w, height: h };
  }

  function headPoint() {
    var b = birdRect();
    if (!b || !b.width) return null;
    return { x: b.left + b.width / 2, y: b.top + b.height * 0.18 };
  }

  function setCard(text) {
    if (text && bubble && bubble.classList.contains('show')) say(null);
    if (text && present && !entering && global.Swiftee && Swiftee.pos === 'peek') leave();
    if (global.Instruction) Instruction.show(text || null);
    placeBubble();
  }

  function relayout() {
    seatFurniture();
    applyCam();   // the camera's origin is in pixels of the board: a resize moves it
    Swiftee.relayout();
    syncPeekRim();
    placeBubble();
    paintSkin();
  }

  var AUTO_CEILING = 20000, HOLD_FLOOR = 300;
  var IDEA_RE = /\b(vertex|vertices|diagonals?|convex|concave|sides?|angles?|regular|irregular)\b/i;
  function holdFor(sc) {
    var say = String(sc.say || '').trim(), n = say ? say.split(/\s+/).length : 0;
    var idea = (sc.swiftee && sc.swiftee.purpose === 'concept') || IDEA_RE.test(say);
    return idea ? Math.min(1400, 1000 + 40 * n) : Math.min(900, 700 + 20 * n);
  }
  function autoAdvance(ctx, spec) {
    var gen = playGen, screenAt = current, off = false, t0 = Date.now();
    if (ctx && ctx.onCancel) ctx.onCancel(function () { off = true; });
    var sc = Screens.list[current] || {};
    var settleMs = spec && spec.pause != null ? spec.pause : null;
    var hold = settleMs != null ? settleMs : holdFor(sc);
    var alive = function () { return !off && gen === playGen && screenAt === current; };
    var ceiling = Math.max(200, AUTO_CEILING * paceScale());
    var quiet = function () {
      if (Date.now() - t0 > ceiling) return true;
      return !replying() && !entering && !(global.VO && VO.id);
    };
    var tries = 0;
    var go = function () {
      if (!alive()) return;
      if (global.Input && Input.advance && Input.advance()) return;
      if (++tries < 12) setTimeout(go, 250);
    };
    (function settle() {
      if (!alive()) return;
      if (!quiet()) { setTimeout(settle, 120); return; }
      // (a named pause is its own: it follows a flight, not his voice)
      var hushed = global.VO && VO.quietAt ? Date.now() - VO.quietAt : 0;
      var ms = settleMs != null ? settleMs : Math.max(HOLD_FLOOR, hold - Math.max(0, hushed));
      setTimeout(function () {
        if (!alive()) return;
        if (!quiet()) { settle(); return; }                  // something began in the breath
        go();
      }, Math.round(ms * paceScale()));
    })();
  }

  function setProgress(i) {
    progress.style.width = ((i + 1) / Screens.list.length * 100).toFixed(1) + '%';
  }

  function loadAudio() {
    try { var s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && global.SFX) SFX.restore(s); } catch (e) {}
  }
  function saveAudio() {
    try { if (global.SFX) localStorage.setItem(SAVE_KEY, JSON.stringify(SFX.state())); } catch (e) {}
  }

  function fire(beats) {
    (beats || []).forEach(function (b) {
      if (b.sfx && global.SFX) SFX.play(b.sfx, b);
      if (b.juice && global.Juice && Juice[b.juice]) Juice[b.juice](Stage.element(b.target), b);
      if (b.swiftee && buddyOn && present) {
        var bo = direction(b);
        if (Swiftee.isReaction && Swiftee.isReaction(b.swiftee)) afterVerdict(function () { if (buddyOn && present) Swiftee.play(b.swiftee, bo); });
        else Swiftee.play(b.swiftee, bo);
      }
      if (b.stage) Stage.apply(b.stage);
    });
  }

  var lineCtl = null;
  function speakLine(parts, type, ctx, held, faceAt) {
    var pace = Timing.scaleOf(ctx && ctx.cfg ? ctx.cfg.msPerWord : null);
    var plan = Timing.schedule(parts, { scale: pace, type: type, showing: bubble.classList.contains('show') });
    var steps = plan.parts, n = steps.length;
    var t0 = Date.now(), shift = 0, shown = -1, timers = [], endTimer = null, resolveLine = null, over = false;
    var endAt = plan.total;
    var ctl = {};
    lineCtl = ctl;
    var finish = function () {
      if (over) return; over = true;
      timers.forEach(clearTimeout); clearTimeout(endTimer);
      if (lineCtl === ctl) lineCtl = null;
      if (resolveLine) resolveLine();
    };
    var scheduleEnd = function (atMs) {
      clearTimeout(endTimer);
      endAt = atMs;
      endTimer = setTimeout(finish, Math.max(0, atMs - (Date.now() - t0)));
      lineTimers.push(endTimer);
    };
    var wordsDone = function (early) {
      // the last bubble's words are all in: the reading pause starts here
      if (ctx && ctx.phase) ctx.phase('reading');
      if (director) director.emit('dialogue:complete', { text: parts.map(function (p) { return typeof p === 'string' ? p : p.text; }).join(' '), type: type });
      clearTimeout(mouthTimer); Swiftee.speaking(false);
      if (early) scheduleEnd((Date.now() - t0) + steps[n - 1].hold);
    };
    var show = function (i) {
      if (over || i <= shown || i >= n) return;
      shown = i;
      var p = steps[i];
      if (faceAt) faceAt(i);
      say(p.text, null, null, null, p.cues, {
        lead: p.lead, scale: pace,
        onWord: function (w) { if (director) director.emit('dialogue:word', { part: i, word: w }); },
        onDone: i === n - 1 ? wordsDone : null
      });
    };
    var plant = function () {
      timers.forEach(clearTimeout); timers = [];
      for (var i = shown + 1; i < n; i++) {
        (function (j) {
          var h = setTimeout(function () { show(j); }, Math.max(0, steps[j].at - shift - (Date.now() - t0)));
          timers.push(h); lineTimers.push(h);
        }(i));
      }
    };
    /* the next bubble, now, and everything after it moves up by what was saved */
    ctl.next = function () {
      if (over || shown + 1 >= n) return false;
      var j = shown + 1;
      var gain = (steps[j].at - shift) - (Date.now() - t0);
      if (gain > 0) shift += gain;
      show(j); plant();
      scheduleEnd(endAt - Math.max(0, gain));
      return true;
    };

    Swiftee.speaking(true);
    clearTimeout(mouthTimer);
    mouthTimer = setTimeout(function () { Swiftee.speaking(false); }, plan.lastWord + 250);
    show(0); plant(); scheduleEnd(plan.total);

    clearTimeout(bubbleTimer);
    if (!screenAwaitsAction(current)) {
      bubbleTimer = setTimeout(function () {
        if (held) { say(null); return; }      // say(null) gives the plank back
        if (instruction && instruction.classList.contains('show')) say(null);
      }, plan.total + 1100);
    }
    return new Promise(function (res) {
      resolveLine = res;
      if (ctx && ctx.onCancel) ctx.onCancel(function () {
        finish(); clearTimeout(bubbleTimer); clearTimeout(mouthTimer); Swiftee.speaking(false);
        if (!(instruction && instruction.classList.contains('show'))) restoreHeldCard();
      });
    });
  }

  function settleLine(text, opts, ctx) {
    var pace = global.Timing ? Timing.scaleOf(ctx && ctx.cfg ? ctx.cfg.msPerWord : null) : 1;
    lessonLine = { full: text, screen: current };
    var up = bubble && bubble.querySelector ? bubble.querySelector('.bubble-line') : null;
    if (up && bubble.classList.contains('show') && global.Timing && Timing.repeats && Timing.repeats(text, up.textContent)) return Promise.resolve();
    say(text, null, 0, null, null, { instant: true, scale: pace });
    var ms = Math.round(((global.Timing && Timing.SWAP_OUT) || 170) * pace + ((global.Timing && Timing.SWAP_IN) || 240) * pace);
    return new Promise(function (res) {
      var h = setTimeout(res, ms);
      if (ctx && ctx.onCancel) ctx.onCancel(function () { clearTimeout(h); res(); });
    });
  }

  function voiceSpeaking() {
    if (!global.VO || !VO.id || !VO.at) return false;
    var at = VO.at();
    if (at == null) return false;
    var end = VO.spoken ? VO.spoken(VO.id) : 0;
    return !end || at < end;
  }
  function tapLine() {
    if (voiceSpeaking() || replying()) return true;
    if (swapTimer && pendingPut) {
      clearTimeout(swapTimer); swapTimer = null;
      var f = pendingPut; pendingPut = null; f();
      revealAll();
      return true;
    }
    if (revealAll()) return true;
    if (lineCtl && lineCtl.next()) return true;
    return director ? director.skip() : false;
  }

  var H = null;   // the live handler table, so one handler can hand off to another
  function handlers() {
    H = {
      stage: function (spec, ctx) {
        if (spec && spec.camera === 'wide') {
          standing = null; say(null);
          return cameraTo(1, spec.ms || 1000, ctx);
        }
        if (spec && spec.afterReveal) {
          var s2 = Object.assign({}, spec); delete s2.afterReveal;
          if (revealing) return revealing.then(function () { return H.stage(s2); });
          spec = s2;
        }
        var scr = Screens.list[current];
        if (spec && spec.kind && scr && scr.stage && scr.stage.kind === spec.kind) {
          spec = Object.assign({}, scr.stage, spec);
        }
        if (spec && spec.kind && scr) spec = Object.assign({}, spec, { below: wantsRoomBelow(scr) }, wantsBand(scr) ? { controls: true } : {});
        var applied = Stage.apply(spec);
        relayout();
        clearTimeout(settleTimer);
        settleTimer = setTimeout(relayout, 620);
        if (applied && typeof applied.then === 'function') return applied;
        if (spec && spec.kind && spec.kind !== 'vista' && !(global.Juice && Juice.reducedMotion)) return pause(SCENE_ENTER_MS);
        if (spec && spec.choices && spec.choices.length && !spec.cue && Stage.choicesEnterMs) return pause(Stage.choicesEnterMs(spec.choices.length));
      },
      swiftee: function handlerSwiftee(state, opts, ctx) {
        if (!buddyOn) {
          return new Promise(function (resolve) {
            var t = setTimeout(resolve, BEAT_WITHOUT_HIM_MS);
            if (ctx && ctx.onCancel) ctx.onCancel(function () { clearTimeout(t); resolve(); });
          });
        }
        if (state === 'enter' && opts && opts.from === 'air') return flyIn();
        if (state === 'perch' && present && global.Swiftee && Swiftee.play) {
          standing = null; say(null);
          var fr = frame();
          return Promise.resolve(Swiftee.play('perch', { size: (opts && opts.size) || Swiftee.size,
                                                         bow: Math.round(fr.h * 0.2), ms: (opts && opts.ms) || 1300 }))
            .then(function () { placeBubble(); }, function () {});
        }
        if (state === 'enter' && opts && opts.from === 'below' && !opts.to) {
          return entrance({ quick: !!opts.quick, ms: opts.ms }).then(function () { placeBubble(); });
        }
        if (state === 'exit' && opts && opts.to === 'below') { standing = null; say(null); return leave(); }
        if (state === 'enter' && present && !entering && opts && opts.to && opts.to === Swiftee.pos &&
            (!opts.size || opts.size === Swiftee.size)) return Promise.resolve();
        // Not on yet? He comes in first, then does what the beat asked.
        if (state !== 'enter' && !present) {
          return entrance().then(function () { return handlerSwiftee(state, opts, ctx); });
        }
        var o = direction(opts);
        if (Array.isArray(o.at)) o.at = o.at.map(function (a) { return Stage.element(a); });
        else if (o.at) o.at = Stage.element(o.at);

        var reacting = (Swiftee.isReaction && Swiftee.isReaction(state)) ||
                       /^(celebrate|nod|confused|encourage|surprised|proud|excited|happy)$/.test(state);
        var owed = reacting ? REACT_MS - (Date.now() - verdictAt) : 0;
        if (owed > 0) {
          return new Promise(function (res) {
            var h = setTimeout(res, owed);
            if (ctx && ctx.onCancel) ctx.onCancel(function () { clearTimeout(h); res(); });
          }).then(function () {
            if (ctx && ctx.signal && ctx.signal.cancelled) return;
            verdictAt = 0;
            return handlerSwiftee(state, opts, ctx);
          });
        }

        if (state === 'enter' && opts && opts.to && Swiftee.place) {
          standing = null; say(null);
          Swiftee.place(opts.to, opts.size || Swiftee.size);
          syncPeekRim();
        }
        if (state === 'happySmall' && doingWell()) {
          cheeredAt = streak;
          return Promise.race([Promise.resolve(Swiftee.play('celebrate', o, ctx)), pause(1100)]);
        }
        var p = Swiftee.play(state, o, ctx);
        if (state === 'enter') {
          var landed = function (r) { present = true; entering = null; return r; };
          p = Promise.resolve(p).then(landed, landed);
          entering = Promise.race([p, pause(9000)]).then(function (r) { landed(r); return r; });
        }
        if (state === 'move' || state === 'enter') p.then(placeBubble);
        return p;
      },
      test: function (name) {
        if (name === 'manyOutside') return !!(Stage.outsideCount && Stage.outsideCount() > 1);
        return false;
      },
      say: function handlerSay(text, opts, ctx) {
        if (LANG && text && !(opts && opts.inLang)) {
          opts = Object.assign({}, opts, {
            inLang: true,
            parts: opts && opts.parts ? LANG.trParts(text, opts.parts) : null,
            settledBy: opts && opts.settledBy ? LANG.tr(opts.settledBy) : (opts && opts.settledBy)
          });
          text = LANG.tr(text);
        }
        if (global.VO && opts && opts.vo && VO.ready && !VO.isReady) {
          return VO.ready().then(function () {
            if (ctx && ctx.signal && ctx.signal.cancelled) return;
            return handlerSay(text, opts, ctx);
          });
        }
        if (replying() && !(opts && opts.afterReply)) {
          return untilReplied(ctx).then(function () {
            if (ctx && ctx.signal && ctx.signal.cancelled) return;
            return handlerSay(text, Object.assign({}, opts, { afterReply: true }), ctx);
          });
        }
        if (!buddyOn) {
          if (global.Instruction) Instruction.show(text || null);
          return plankVoice(opts, ctx);
        }
        if (!present) {
          return entrance().then(function () {
            if (ctx && ctx.signal && ctx.signal.cancelled) return;
            return handlerSay(text, opts, ctx);
          });
        }
        var held = (global.Instruction && Instruction.current) ? Instruction.current() : null;
        if (held) { heldCard = held; setCard(null); }
        var voId = (global.VO && opts && opts.vo) ? opts.vo : null;
        if (voId && !VO.play(voId)) voId = null;    // no clip: the wall clock paces it
        var clockFor = function (offset) {
          if (!voId) return null;
          return function () {
            if (!global.VO || !VO.at || VO.id !== voId) return null;
            var at = VO.at();
            return at == null ? null : at - offset;
          };
        };
        var parts = (opts && opts.parts && opts.parts.length) ? opts.parts.slice() : splitLine(text);
        if (opts && opts.settledBy && parts.length > 1 && global.Timing && Timing.repeats) {
          for (var sk = 0; sk < parts.length - 1; sk++) {
            if (Timing.repeats(opts.settledBy, parts.slice(sk).join(' ')) && !Timing.repeats(opts.settledBy, parts.slice(sk + 1).join(' '))) {
              parts = parts.slice(0, sk).concat([parts.slice(sk).join(' ')]);
              break;
            }
          }
        }
        var sentences = [], curS = null;
        var faces = (opts && opts.faces) || [];
        parts.forEach(function (p, pIdx) {
          var n = String(p).trim().split(/\s+/).length;
          if (!curS) curS = { text: p, breaks: [], n: n, face: faces[pIdx] || null };
          else { curS.breaks.push(curS.n - 1); curS.text += ' ' + p; curS.n += n; }
          if (global.Timing && Timing.endsSentence && Timing.endsSentence(p)) { sentences.push(curS); curS = null; }
        });
        if (curS) sentences.push(curS);
        parts = sentences.map(function (x) { return x.text; });
        var faceAt = function (i) {
          var fc = sentences[i] && sentences[i].face;
          if (fc && buddyOn && present && global.Swiftee && Swiftee.play) { try { Swiftee.play(fc, direction()); } catch (e) {} }
        };
        var words = function (t) { return t.split(/\s+/).length; };
        var counts = parts.map(words);
        var total = counts.reduce(function (n, count) { return n + count; }, 0) || 1;
        var recorded = (global.VO && VO.words && voId) ? VO.words(voId) : null;
        if (!recorded || recorded.length !== total) recorded = null;

        var lineType = (opts && opts.type) || 'narration';
        lessonLine = { full: parts.join(' '), screen: current };
        if (director) director.emit('dialogue:start', { text: lessonLine.full, type: lineType, parts: parts.length });
        var clip0 = (global.VO && VO.seconds && voId) ? VO.seconds(voId) : 0;
        if (!clip0 && global.Timing && Timing.schedule) {
          var sp = speakLine(sentences, lineType, ctx, held, faceAt);
          if (!voId || !VO.finished) return sp;
          if (ctx && ctx.onCancel) ctx.onCancel(function () { if (VO.id === voId) VO.stop(); });
          return Promise.all([sp, VO.finished()]);
        }

        var t0Line = Date.now();
        var clipSecs = (global.VO && VO.seconds && voId) ? VO.seconds(voId) : 0;
        var reading = clipSecs ? Math.round(clipSecs * 1000) + (lineType === 'recap' ? 550 : 280)
                    : (opts.reading || 1200);
        var wordAt = 0;
        var offsets = parts.map(function (p, partIndex) {
          var offset = recorded ? recorded[wordAt] : reading * wordAt / total;
          wordAt += counts[partIndex];
          return offset;
        });
        var shares = parts.map(function (p, partIndex) {
          var share = recorded
            ? ((partIndex + 1 < parts.length ? offsets[partIndex + 1] : reading) - offsets[partIndex])
            : reading * counts[partIndex] / total;
          return clipSecs ? Math.max(320, share)
                                     : Math.max(Math.min(700, reading), share);
        });
        var spoken = shares.reduce(function (a, b) { return a + b; }, 0);
        var cuesFor = function (partIndex) {
          if (!recorded) return null;
          var first = 0;
          for (var ci = 0; ci < partIndex; ci++) first += counts[ci];
          return recorded.slice(first, first + counts[partIndex]).map(function (t) { return t - offsets[partIndex]; });
        };
        say(parts[0], null, shares[0], clockFor(offsets[0]), cuesFor(0)); faceAt(0);
        // the rest follow, each when the voice reaches it
        var partTimers = [];
        for (var pi = 1; pi < parts.length; pi++) {
          var at = offsets[pi];
          var early = voId ? T_SWAP_LEAD : 0;
          (function (t, share, when, partIndex) {
            var deadline = t0Line + when + 2000;
            var fire = function () {
              var clock = clockFor(0);
              var pos = clock ? clock() : null;
              if (pos != null && pos < when - early - 90 && Date.now() < deadline) {
                var again = setTimeout(fire, Math.min(320, Math.max(16, when - early - pos)));
                partTimers.push(again); lineTimers.push(again);
                return;
              }
              say(t, null, share, clockFor(when), cuesFor(partIndex)); faceAt(partIndex);
            };
            var h = setTimeout(fire, Math.max(0, when - early));
            partTimers.push(h); lineTimers.push(h);
          }(parts[pi], shares[pi], at, pi));
        }
        if (partTimers.length && ctx && ctx.onCancel) {
          ctx.onCancel(function () { partTimers.forEach(clearTimeout); });
        }
        var stop = function () { clearTimeout(mouthTimer); Swiftee.speaking(false); };
        talkFor(voId, spoken);

        clearTimeout(bubbleTimer);
        if (!screenAwaitsAction(current)) {
          bubbleTimer = setTimeout(function () {
            if (held) { say(null); return; }      // say(null) gives the plank back
            if (instruction && instruction.classList.contains('show')) say(null);
          }, spoken + 1100);
        }
        if (ctx && ctx.onCancel) ctx.onCancel(function () { if (!(instruction && instruction.classList.contains('show'))) restoreHeldCard(); });
        if (ctx && ctx.onCancel) ctx.onCancel(function () { clearTimeout(bubbleTimer); });
        if (ctx && ctx.onCancel) ctx.onCancel(stop);
        if (opts && opts.endsAt === 'words' && voId && VO.spoken && VO.spoken(voId)) {
          var saidBy = VO.spoken(voId);
          return new Promise(function (res) {
            var iv = setInterval(function () {
              if (VO.id !== voId || (VO.at && VO.at() >= saidBy)) { clearInterval(iv); res(); }
            }, 30);
            if (ctx && ctx.onCancel) ctx.onCancel(function () { clearInterval(iv); res(); });
          });
        }
        var paced = new Promise(function (res) {
          var t = setTimeout(res, spoken);
          if (ctx && ctx.onCancel) ctx.onCancel(function () { clearTimeout(t); res(); });
        });
        var heard = (global.VO && VO.finished) ? VO.finished() : Promise.resolve();
        return Promise.all([paced, heard]);
      },
      instruction: function handlerInstruction(text, opts, ctx) {
        if (LANG && text) text = LANG.tr(text);
        if (text && replying() && !(opts && opts.afterReply)) {
          return untilReplied(ctx).then(function () {
            if (ctx && ctx.signal && ctx.signal.cancelled) return;
            return handlerInstruction(text, Object.assign({}, opts, { afterReply: true }), ctx);
          });
        }
        if (text && buddyOn && speaksAll(current) && H && H.say) {
          if (lessonLine && lessonLine.screen === current && global.Timing && Timing.repeats && Timing.repeats(text, lessonLine.full)) {
            return settleLine(text, opts, ctx);
          }
          return H.say(text, opts || {}, ctx);
        }
        setCard(text);
        return plankVoice(opts, ctx);
      },
      focus: function (target, opts) {
        Stage.focus(target, opts.style);
        if ((opts.style === 'dim-others' || opts.style === 'lean') && global.Swiftee && Swiftee.pos === 'peek' && !present && !entering && Swiftee.place) {
          Swiftee.place('peek', Swiftee.size); syncPeekRim(); placeBubble();
        }
      },
      input: function (spec, ctx) {
        revealAll();
        // nothing the child is about to use is still waiting for its word
        if (Stage.releaseHeld) Stage.releaseHeld();

        bubble.classList.add('passive');
        placeBubble();
        inputLive = spec.type !== 'tap-anywhere';
        if (inputLive) inputSeq++;              // a new question: its first right answer is cheered
        standing = (inputLive && lessonLine && lessonLine.screen === current) ? lessonLine : null;

        if (global.Swiftee && Swiftee.warm) Swiftee.warm();

        var waiting = spec.type === 'tap-anywhere';
        if (waiting) autoAdvance(ctx, spec);
        if (ctx && ctx.onCancel) ctx.onCancel(function () { inputLive = false; inputSpec = null; });

        inputSpec = waiting ? null : spec;
        if (!waiting && buddyOn && present && global.Swiftee && Swiftee.stance) {
          Swiftee.stance(HOLDS_A_QUESTION.test(Swiftee.state || '') ? Swiftee.state : null);
        }
        var answered = spec.type === 'summary-review' ? reviewSummary(spec, ctx) : Stage.waitFor(spec, ctx);
        if (inputLive && replying()) { holdInput(true); holdForReply = true; }
        return answered.then(function (r) {
          inputLive = false; inputSpec = null;
          if (!waiting && global.Input) Input.mode('locked');
          bubble.classList.remove('dim');
          if (global.Swiftee && Swiftee.stance) Swiftee.stance(null);
          if (r && (r.result === 'correct' || r.result === 'wrong')) {
            verdictAt = Date.now();
            if (director) director.emit(r.result === 'correct' ? 'answer:correct' : 'answer:incorrect', { spec: spec, detail: r });
            if (spec.type !== 'multi-select' && spec.type !== 'swipe') verdictFx(r.result, spec.type);
          }
          if (waiting) say(null);
          else if (r && r.result === 'correct') {
            var earned = quest.award(current + ':' + spec.type);
            if (earned) reward(LANG ? LANG.t('rewardXp', { xp: earned }) : '+' + earned + ' XP. Challenge complete.', false);
            react('correct', null, { face: false, quiet: spec.praise === false, final: true, type: spec.type });
          } else if (r && r.result === 'wrong' && !spec.quietMiss) react('wrong', null, { face: false, final: true, reason: spec.reason });
          return r;
        }, function (e) { throw e; });
      },
      sfx: function (name, opts) { if (global.SFX) SFX.play(name, opts); },
      juice: function (name, target, opts) { if (global.Juice && Juice[name]) Juice[name](Stage.element(target), opts); }
    };
    return H;
  }

  /** Does any beat put text on the plank before the screen's first input? */
  function hasPlank(i) {
    var s = Screens.list[i]; if (!s) return false;
    if (speaksAll(i)) return false;   // he says the instructions on a card screen
    if (typeof s.instruction === 'string' && s.instruction) return true;
    var beats = (s.beats || []);
    var has = function (b) {
      if (!b) return false;
      if (typeof b.instruction === 'string' && b.instruction) return true;
      if (!wantsBuddy(i) && typeof b.say === 'string' && b.say) return true;
      if (b.on && Object.keys(b.on).some(function (k) { return (b.on[k] || []).some(has); })) return true;
      return (b.otherwise || []).some(has);
    };
    if (!wantsBuddy(i) && typeof s.say === 'string' && s.say) return true;
    return beats.some(has);
  }

  function textBeforeInput(s) {
    var beats = s.beats || [];
    for (var i = 0; i < beats.length; i++) {
      var b = beats[i];
      if (b.input) return false;
      if (b.instruction || b.say) return true;
    }
    return false;   // no input at all, or one with nothing said before it
  }

  function voIdsOf(i) {
    var s = Screens.list[i];
    if (!s) return [];
    var out = [];
    (function walk(beats) {
      (beats || []).forEach(function (b) {
        if (!b || typeof b !== 'object') return;
        if (b.vo) out.push(b.vo);
        if (b.on) Object.keys(b.on).forEach(function (k) { walk(b.on[k]); });
        if (b.otherwise) walk(b.otherwise);
        if (b.feedback) walk(b.feedback);
        if (b.parallel) walk(b.parallel);
      });
    }(s.beats));
    // and what the screen says back: its reminder, its teaching lines
    if (s.remind && s.remind.vo) out.push(s.remind.vo);
    if (s.teach) Object.keys(s.teach).forEach(function (k) { (s.teach[k] || []).forEach(function (b) { if (b && b.vo) out.push(b.vo); }); });
    return out;
  }
  /* every reply clip: the cheers, the nudges, and the stage's reasons */
  var REASONS = ['fb11', 'fb15', 'fb35', 'fb36', 'fb37', 'fb38', 'fb40', 'fb42', 'fb43'];
  function replyClips() {
    var out = NUDGE.concat([NUDGE_STRONG]).map(function (p) { return p.vo; });
    Object.keys(CLUES).forEach(function (k) { out.push(CLUES[k].vo); });
    Object.keys(PRAISE_FOR).forEach(function (k) { out.push(PRAISE_FOR[k].vo); });
    return out.concat(REASONS).filter(function (id, n, all) { return id && all.indexOf(id) === n; });
  }

  var warmedCues = false;
  function warmVoice(i) {
    if (!(global.VO && VO.preload)) return;
    var ids = voIdsOf(i).concat(voIdsOf(i + 1));
    if (i + 2 >= Screens.list.length) ids = ids.concat(FINALE.map(function (p) { return p.vo; }));
    if (!warmedCues && (i >= 1 || screenAwaitsAction(i))) {
      if (VO.ready && VO.isReady === false) {
        VO.ready().then(function () { if (!warmedCues) warmVoice(current < 0 ? i : current); });
      } else {
        warmedCues = true;
        ids = replyClips().concat(ids);
      }
    }
    try { VO.preload(ids); } catch (e) {}
  }

  function screenAwaitsAction(i) {
    var s = Screens.list[i];
    if (!s) return false;
    var found = false;
    (function walk(bs) {
      (bs || []).forEach(function (b) {
        if (!b || typeof b !== 'object' || found) return;
        if (b.input && b.input.type && b.input.type !== 'tap-anywhere') { found = true; return; }
        if (b.parallel) walk(b.parallel);
      });
    }(s.beats));
    return found;
  }

  var warmedArt = false;
  function warmArt(i) {
    if (warmedArt || i < 1 || typeof Image === 'undefined') return;
    warmedArt = true;
    try { if (global.MeasuringFrames && MeasuringFrames.image) (new Image()).src = pic(MeasuringFrames.image); } catch (e) {}
  }

  function runScreen(i) {
    var s = Screens.list[i];
    warmVoice(i);
    warmArt(i);
    // whatever the screen before was still going to say, it is not saying it
    cancelScreenLine();
    clearLineTimers();
    clearTimeout(bubbleTimer);
    say(null);
    if (global.Swiftee && Swiftee.settle) Swiftee.settle();
    missesHere = 0; hintedHere = false; inputSpec = null;
    popGen++; popping = false; clearTimeout(popDue); popDue = null; riseWait = false; cheerUntil = 0; holdForReply = false; owedCheer = null;
    if (Stage.hold) Stage.hold(false);
    setCard(null);
    clearTimeout(bubbleTimer);

    if (!screenAsksChoices(s) && global.Stage && Stage.apply) Stage.apply({ choices: null });
    if (global.Stage && Stage.leaveConnect) Stage.leaveConnect();

    setCam(s.camera === 'close');
    if (Stage.perch) Stage.perch(!!s.log, s.camera === 'close' ? 0 : undefined);
    buddyOn = wantsBuddy(i);

    if (s.instruction && !textBeforeInput(s)) {
      var ib = (s.beats || []).filter(function (b) { return b && b.instruction === s.instruction; })[0];
      if (buddyOn && speaksAll(i) && H && H.say) H.say(s.instruction, { vo: ib && ib.vo }, screenCtx());
      else { setCard(s.instruction); plankVoice({ vo: ib && ib.vo }, screenCtx()); }
    }
    if (!buddyOn && Swiftee.place) {
      Swiftee.place('off', Swiftee.size);
      present = false;
      syncPeekRim();
      say(null);
    }
    if (buddyOn && s.swiftee && Swiftee.place) {
      var mark = markFor(i, Swiftee.pos, Swiftee.size);
      var wantPos = mark.pos, wantSize = mark.size;
      if (s.swiftee.arrive === 'fly') {
        flightGen++;
        entering = null;
        present = false;
        say(null);
      }
      if (present && wantPos === 'peek' && sceneKindAt(i) === 'swipe-sort') {
        leaveGen++; leaving = false; present = false; entering = null; say(null);
      }
      if (present && (wantPos !== Swiftee.pos || wantSize !== Swiftee.size) && Swiftee.play) {
        Swiftee.play('move', { to: wantPos, size: wantSize });
      } else {
        Swiftee.place(wantPos, wantSize);
      }
      // On his mark but in the wing: his first beat brings him in.
      if (!present && Swiftee.visible) Swiftee.visible(false);
      syncPeekRim();
      placeBubble();
    }

    current = i; setProgress(i);
    if (Stage.seat) Stage.seat(!hasPlank(i));
    Stage.onTap(function (kind, said, info) {
      if (kind === 'correct' || kind === 'wrong') {
        verdictAt = Date.now();
        if (director) director.emit(kind === 'correct' ? 'answer:correct' : 'answer:incorrect', { perTap: true });
        if (!(inputSpec && inputSpec.type === 'tap-each') && !(info && info.soft) && !(info && info.marked)) verdictFx(kind);
      }
      var list = s.perTap ? (s.perTap[kind] || s.perTap.any) : null;
      if (list && kind === 'correct' && info && info.last === false) list = list.filter(function (b) { return !(b && b.juice === 'confetti' && b.target !== 'option'); });
      if (list) fire(list);
      var walked = !!(inputSpec && inputSpec.type === 'tap-each' && inputSpec.targets === 'sides');
      var dip = !!(inputSpec && inputSpec.type === 'tap-each');
      var cheer = kind === 'correct' && !said && inputSpec && inputSpec.cheer;
      if (cheer) said = PRAISE_FOR[info && info.last ? cheer.last : cheer.more] || null;
      var ro = { face: dip ? 'dip' : !(list && list.some(function (b) { return b && b.swiftee; })), walked: walked,
                 tries: info && info.tries, teach: info && info.teach, reason: info && info.reason,
                 last: !!(info && info.last),
                 after: info && typeof info.after === 'function' ? info.after : null };
      react(kind, said, ro);
    });
    if (global.Input) Input.mode('locked');
    try { snaps[i] = Stage.snapshot ? Stage.snapshot() : null; } catch (e) { snaps[i] = null; }
    return director.run(s.beats);
  }

  var revealing = null;   // the melt in progress, for beats that wait for it
  function revealWhenReady() {
    if (!global.Transition || !Transition.covered || !Transition.covered()) return;
    var done = false;
    var go = function () {
      if (done) return; done = true;
      director.off('stage', go);
      var p = Transition.reveal();
      revealing = p;
      var clear = function () { if (revealing === p) revealing = null; };
      p.then(clear, clear);
    };
    director.on('stage', go);
    setTimeout(go, 420);
  }

  function wipesAt(i) {
    var scr = Screens.list[i];
    if (!scr || i <= 0) return false;
    if (scr.transition === false) return false;
    var chapters = (global.Quest && Quest.chapters) || [];
    return chapters.some(function (c) { return c.end === i - 1; });
  }

  function changeScreen(i, first) {
    clearLineTimers();
    clearTimeout(bubbleTimer);
    say(null);
    if (first || !global.Transition || !wipesAt(i)) {
      var r = runScreen(i);
      revealWhenReady();
      return r;
    }
    var runAt = playGen;
    return Transition.cover().then(function () {
      if (runAt !== playGen) return Director.CANCELLED;
      var p = runScreen(i);
      revealWhenReady();
      return p;
    });
  }

  async function play(from) {
    if (playing) return; playing = true;
    var gen = ++playGen;
    var start = from || 0;
    for (var i = start; i < Screens.list.length; i++) {
      var nextMark = wantsBuddy(i) ? markFor(i, Swiftee.pos, Swiftee.size) : null;
      var hidden = /^(peek|corner)$/;
      var switchesHiding = !!(nextMark && present && nextMark.pos !== Swiftee.pos &&
                              (hidden.test(nextMark.pos) || hidden.test(Swiftee.pos || '')));
      cancelScreenLine(); clearLineTimers(); clearTimeout(bubbleTimer); say(null);
      if (i > start && present && (!wantsBuddy(i) || switchesHiding)) { await leave(); if (gen !== playGen) return; }
      var r = await changeScreen(i, i === start);
      if (gen !== playGen) return;                 // a restart took over while this waited
      if (r === Director.CANCELLED) { playing = false; return; }
      if (replying()) { await untilReplied(); if (gen !== playGen) return; }
      var badge = quest.complete(i);
      if (badge) { reward(LANG ? LANG.t('badgeUnlocked', { badge: LANG.tr(badge.name) }) : 'Badge unlocked: ' + badge.name + '.', true); }
    }
    playing = false;
    finish();
  }

  var tailWatch = null;
  function tailWhenHome() {
    clearInterval(tailWatch);
    var since = Date.now(), away = false;
    var repaint = function () { if (bubble && bubble.classList.contains('show')) paintSkin(); };
    tailWatch = setInterval(function () {
      // (either walk: the tape round the sides, or the protractor round the corners)
      var out = !!(global.Swiftee && (Swiftee.locked === 'measuring' || Swiftee.locked === 'angle-measuring'));
      // the walk takes its lock a moment after the tap: step aside then
      if (out && !away) { away = true; bubble.classList.remove('back'); bubble.classList.add('away'); repaint(); }
      if (out && Date.now() - since < 20000) return;
      // not gone yet (the walk has not started) — keep waiting, briefly
      if (!away && Date.now() - since < 1500) return;
      clearInterval(tailWatch); tailWatch = null;
      bubble.classList.remove('away');
      if (away) { say(null); return; }
      repaint();
    }, 120);
  }

  function buddyReacts(state) {
    if (!buddyOn || !present || entering || !global.Swiftee || Swiftee.locked) return;
    // perform(): a reaction outranks a gesture still playing, never a bigger one
    try { if (Swiftee.perform) Swiftee.perform(state, direction()); else if (Swiftee.play) Swiftee.play(state, direction()); } catch (e) {}
  }

  var popGen = 0, popping = false, popDue = null, holdForReply = false;
  /* the swipe practice: he is behind the card in hand */
  function behindCard() {
    if (!global.Swiftee || !global.Stage || !Stage.state || !Stage.state.swipe) return false;
    var m = markFor(current, null, Swiftee.size);
    return !!(m && m.pos === 'peek');
  }
  function popsHere() {
    return !!(buddyOn && inputLive && inputSpec && inputSpec.type === 'swipe' && behindCard());
  }
  function holdInput(on) {
    clearTimeout(popDue); popDue = null;
    if (on) {
      if (Stage.hold) Stage.hold(true);
      if (global.Input && Input.mode && Input.mode() !== 'locked') Input.mode('locked');
      popDue = setTimeout(function () { if (!popping) holdInput(false); }, 3000);
      return;
    }
    if (Stage.hold) Stage.hold(false);
    if (inputLive && global.Input && Input.mode && Input.mode() === 'locked') {
      Input.mode('polygon', { unguarded: true });
      // the 3 s of stillness before a hint count from the hand-over
      if (Stage.hintRestart) Stage.hintRestart();
    }
  }
  function swipeCardMoving() {
    var S = global.Stage && Stage.state && Stage.state.swipe;
    if (!S || !global.Swiftee || Swiftee.pos !== 'peek') return false;
    var card = S.card;
    if (!card) return true;
    if (Stage.peekAnchor && !Stage.peekAnchor()) return true;          // not at home
    return !!(card.getAnimations && card.getAnimations().some(function (a) { return a.playState === 'running'; }));
  }
  function cardSettled() {
    var until = Date.now() + 1200;
    return new Promise(function (res) {
      (function check() {
        if (!swipeCardMoving() || Date.now() > until) { res(); return; }
        setTimeout(check, 40);
      })();
    });
  }
  /* The pace the director is running at (a harness runs the lesson fast). */
  function paceScale() {
    var cfg = director && director.configure ? director.configure({}) : null;
    return (global.Timing && Timing.scaleOf && cfg) ? Timing.scaleOf(cfg.msPerWord) : 1;
  }
  function talkFor(vid, ms) {
    if (!global.Swiftee || !Swiftee.speaking) return;
    Swiftee.speaking(true);
    clearTimeout(mouthTimer);
    var t0 = Date.now(), end = (vid && VO.spoken) ? VO.spoken(vid) : 0;
    var check = function () {
      mouthTimer = null;
      var on = !!vid && VO.id === vid, at = on && VO.at ? VO.at() : null;
      var over = vid ? (!on || (end && at != null && at >= end) || Date.now() - t0 > (end || ms) + 2500)
                     : Date.now() - t0 >= ms;
      if (over) { Swiftee.speaking(false); return; }
      mouthTimer = setTimeout(check, 40);
    };
    mouthTimer = setTimeout(check, vid ? 40 : Math.max(0, ms));
  }
  function popLine(ln, hooks) {
    var text = ln.t, k = paceScale(), T = global.Timing || {};
    var enText = text;
    if (LANG && text) text = LANG.tr(text);
    var vid = (global.VO && ln.vo && VO.play && VO.play(ln.vo)) ? ln.vo : null;
    var clock = vid ? function () { return (global.VO && VO.id === vid && VO.at) ? VO.at() : null; } : null;
    var cues = null;
    if (vid && VO.words) { var rec = VO.words(vid); if (rec && rec.length === String(text).trim().split(/\s+/).length) cues = rec; }
    if (!cues && T.cues) cues = T.cues(text, vid ? 1 : k);
    var len = vid && VO.seconds ? VO.seconds(vid) : 0;
    var lastWord = cues && cues.length ? cues[cues.length - 1] : Math.round(1500 * k);
    var win = ln.mood === 'win';
    var voiced = len ? (win && VO.spoken && VO.spoken(vid) ? VO.spoken(vid) : Math.round(len * 1000)) : 0;
    var after = win ? Math.round(250 * k)
              : (T.readingPause ? Math.round(T.readingPause(text, k) * (vid ? 0.45 : 1)) : 900);
    var hold = voiced ? voiced + after : lastWord + after + Math.round(400 * k);
    say(text, ln.mood || null, hold, clock, cues);
    cheerUntil = Math.max(cheerUntil, Date.now() + hold);
    talkFor(vid, voiced || (lastWord + Math.round(300 * k)));
    var shows = ln.shows ? ln.shows.slice() : ln.show ? [{ what: ln.show, on: ln.on || 0 }] : [];
    if (LANG && text !== enText) shows = shows.map(function (sh) { return { what: sh.what, on: LANG.wordIndex(enText, text, sh.on || 0) }; });
    if (hooks && hooks.cue) shows.forEach(function (sh) {
      var g = popGen, cueMs = cues && cues[sh.on || 0] != null ? cues[sh.on || 0] : 0, t0 = Date.now(), fired = false;
      var fire = function () { if (!fired && g === popGen) { fired = true; hooks.cue(sh.what); } };
      if (vid) {
        (function wait() {
          if (fired || g !== popGen) return;
          var at = (VO.id === vid && VO.at) ? VO.at() : null;
          if ((at != null && at >= cueMs) || (at == null && Date.now() - t0 > 400) || Date.now() - t0 > cueMs + 1500) { fire(); return; }
          setTimeout(wait, 25);
        })();
      } else setTimeout(fire, cueMs + Math.round((T.PANEL_LEAD || 120) * k));
    });
    if (!vid) return pause(hold);
    var gw = popGen, t1 = Date.now(), ceiling = hold + (voiced ? 2500 : 8000), target = voiced || Infinity;
    return new Promise(function (res) {
      (function tick() {
        if (gw !== popGen) { res(); return; }
        var on = VO.id === vid, at = on && VO.at ? VO.at() : null;
        var said = !on ? (voiced || Date.now() - t1 >= hold - after) : (at != null && at >= target);
        if (said || Date.now() - t1 > ceiling) { setTimeout(res, after); return; }
        setTimeout(tick, 30);
      })();
    });
  }
  function pop(lines, hooks) {
    var gen = ++popGen, screen = current;
    var behind = behindCard(), held = inputLive;
    popping = true;
    if (held) holdInput(true);
    clearTimeout(bubbleTimer);
    var alive = function () { return gen === popGen && screen === current; };
    var finish = function () {
      if (gen !== popGen) return;
      popping = false; cheerUntil = Date.now();
      if (screen === current && (held || holdForReply)) {
        holdForReply = false;
        // (and the hint waits for 3 s of stillness from here: holdInput)
        holdInput(false);
      }
      if (owedCheer) payCheer();
    };
    return (present ? Promise.resolve(true) : entrance(behind ? undefined : true)).then(function () {
      if (!alive() || !present) return;
      return hooks && hooks.open ? hooks.open() : null;
    }).then(function () {
      if (!alive() || !present) return;
      return lines.reduce(function (chain, ln) {
        return chain.then(function () {
          if (!alive()) return;
          if (typeof ln.face === 'function') ln.face();
          else if (ln.face && Swiftee.play) { try { Swiftee.play(ln.face, direction()); } catch (e) {} }
          return popLine(ln, hooks);
        });
      }, Promise.resolve());
    }).then(function () {
      if (!alive()) return;
      if (behind) {
        say(null);
        var closed = hooks && hooks.close ? hooks.close() : null;
        return Promise.resolve(closed).then(function () { if (alive()) return leave(); });
      }
      if (hooks && hooks.keep) return;
      if (!hooks || !hooks.close) { if (!showStanding()) say(null); return; }
      // a teaching moment ends with the card back in its place first
      say(null);
      return hooks.close().then(function () { if (alive()) showStanding(); });
    }).then(finish, finish);
  }
  function replying() { return popping || !!owedCheer || cheerUntil > Date.now(); }
  var owedCheer = null;
  function oweCheer(args) {
    var o = owedCheer = { screen: current, args: args };
    setTimeout(function () { if (owedCheer === o) payCheer(); }, 4000);
  }
  function payCheer() {
    var o = owedCheer; owedCheer = null;
    if (o && o.screen === current) react.apply(null, o.args);
  }
  function untilReplied(ctx) {
    var until = Date.now() + 9000;
    return new Promise(function (res) {
      (function check() {
        if ((ctx && ctx.signal && ctx.signal.cancelled) || !replying() || Date.now() > until) { res(); return; }
        setTimeout(check, 50);
      })();
    });
  }

  function hintGesture(p) {
    if (hintedHere || !p || p.rung !== 'idle') return;
    if (!inputSpec || !buddyOn || !present || entering || !global.Swiftee || !Swiftee.perform) return;
    if (inputSpec.type === 'tap-each') return;
    var box = Stage.contentBox && Stage.contentBox();
    var at = box ? { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 } : null;
    hintedHere = true;
    Swiftee.perform('hint', direction({ at: at }));
  }

  function reviewSummary(spec, ctx) {
    return new Promise(function (resolve) {
      var lines = {}; (spec.cards || []).forEach(function (c) { lines[c.id] = c; });
      var cards = Stage.summaryCards ? Stage.summaryCards() : [];
      var busy = false, over = false, offs = [];
      if (global.Input) Input.mode('polygon');
      var ready = function () { busy = false; if (nextBtn) nextBtn.classList.remove('wait'); if (Stage.summaryReplay) Stage.summaryReplay(null); };
      var end = function () {
        if (over) return; over = true;
        offs.forEach(function (f) { f(); }); offs = [];
        if (nextBtn) nextBtn.classList.remove('show', 'wait');
        cards.forEach(function (c) { c.el.style.cursor = ''; });
      };
      var onNext = function (e) {
        if (e) e.preventDefault();
        if (over || busy) return;
        if (global.SFX) SFX.play('select');
        end(); resolve({ result: 'tap' });
      };
      if (nextBtn) {
        nextBtn.classList.remove('wait'); nextBtn.classList.add('show');
        nextBtn.addEventListener('click', onNext);
        offs.push(function () { nextBtn.removeEventListener('click', onNext); });
        placeBubble();
      }
      cards.forEach(function (c) {
        c.el.style.cursor = 'pointer';
        var tap = function (e) {
          if (over || busy || (global.Input && Input.guarded)) return;
          var L = lines[c.id]; if (!L) return;
          if (e) { e.preventDefault(); e.stopPropagation(); }
          busy = true;
          if (nextBtn) nextBtn.classList.add('wait');
          if (global.SFX) SFX.play('pop', { gain: 0.4 });
          var shown = Stage.summaryReplay ? Stage.summaryReplay(c.id) : Promise.resolve();
          var told = Promise.resolve(H && H.say ? H.say(L.say, { vo: L.vo, type: 'narration' }, ctx) : null);
          Promise.all([shown, told]).then(function () {
            if (over) return;
            // a breath to read it, then the collection is all his again
            setTimeout(function () { if (!over) ready(); }, Math.round(500 * paceScale()));
          }, function () { if (!over) ready(); });
        };
        c.el.addEventListener('pointerdown', tap);
        offs.push(function () { c.el.removeEventListener('pointerdown', tap); });
      });
      if (ctx && ctx.onCancel) ctx.onCancel(function () { end(); });
    });
  }

  function finish() {
    say(null); setCard(null);
    if (global.Music) Music.mood('win');
    var gen = playGen;
    finaleOn = true;
    pop(FINALE.map(function (f) { return { t: f.t, vo: f.vo, mood: 'win' }; }), { keep: true }).then(function () {
      if (gen !== playGen) return;
      if (!finaleOn || readyOn) return;
      setTimeout(function () {
        if (gen === playGen && finaleOn && !readyOn) readyScene();
      }, Math.round(1800 * paceScale()));
    });
    // one burst, wide, for the finale — two from different points read as a stutter
    if (global.Juice) Juice.confetti(Stage.svg, { count: 72, spread: 2.6 });
    if (global.SFX) SFX.sequence(['drumroll', 1.2, 'levelUp', 0.3, 'sparkle']);
    Swiftee.play('excited').then(function () { return Swiftee.play('proud'); });
    hud.querySelector('.replay').classList.add('show');
  }

  var finaleOn = false, readyOn = false, readyUp = false, continueLabel = null;
  function readyScene() {
    if (leaving || readyOn || !continueBtn) return;
    readyOn = true; readyUp = false; finaleOn = false;
    var gen = playGen;
    var snow = global.Transition && Transition.cover ? Transition.cover() : Promise.resolve();
    snow.then(function () {
      if (gen !== playGen) return;
      say(null);
      if (global.Swiftee && Swiftee.settle) Swiftee.settle({ now: true });
      Stage.apply({ kind: 'ready' });
      root.classList.add('ready-scene');
      var label = continueBtn.querySelector('span');
      if (label) { if (continueLabel == null) continueLabel = label.textContent; label.textContent = LANG ? LANG.t('playPartTwoButton') : 'Play Part 2'; }
      continueBtn.classList.add('show');
      Swiftee.place('ledge', 'large');
      if (Swiftee.visible) Swiftee.visible(true);
      return global.Transition && Transition.reveal ? Transition.reveal() : null;
    }).then(function () {
      if (gen !== playGen) return;
      readyUp = true;
      return pop([{ t: READY.t, vo: READY.vo, mood: 'win', face: 'wave' }], { keep: true });
    }).then(function () {
      if (gen !== playGen || !readyOn) return;
      if (global.RunnerStage && RunnerStage.on) {
        setTimeout(function () { if (gen === playGen && readyOn) RunnerStage.start(); }, END_READ);
      }
    });
  }
  var END_READ = 1300;   // the last line, read, before the game takes the screen
  function leaveReady() {
    finaleOn = false;
    if (!readyOn) return;
    readyOn = false; readyUp = false;
    if (root) root.classList.remove('ready-scene');
    var label = continueBtn && continueBtn.querySelector('span');
    if (label && continueLabel != null) label.textContent = continueLabel;
  }

  function goOn() {
    if (leaving || !continueBtn) return;
    leaving = true;
    var gen = playGen, href = continueBtn.href;
    var snow = global.Transition && Transition.cover ? Transition.cover() : Promise.resolve();
    snow.then(function () {
      if (gen !== playGen) { leaving = false; return; }
      try { global.location.assign(href); } catch (e) { leaving = false; }
    });
  }

  var warmed = false;
  function warmPart2() {
    if (warmed || !continueBtn || typeof global.fetch !== 'function') return;
    var loc = global.location || {};
    if (!/^https?:$/.test(loc.protocol || '') || !/\/part1-swiftee-lesson\//.test(loc.pathname || '')) return;
    warmed = true;
    var base = new URL('.', continueBtn.href).href;          // …/part2-frozen-rush/game/
    var get = function (url) {
      return global.fetch(url, { priority: 'low' }).then(function (r) { return r.ok ? r.arrayBuffer() : null; });
    };
    get(base + 'js/asset-versions.js').then(function (buf) {
      if (!buf) return;
      var src = new TextDecoder().decode(buf), v = {}, m;
      var re = /"(assets\/[^"]+)":\s*"([0-9a-f]+)"/g;
      while ((m = re.exec(src))) v[m[1]] = m[2];
      var ogg = false;
      try { ogg = !!new Audio().canPlayType('audio/ogg; codecs="opus"'); } catch (e) {}
      var w = Math.min(global.innerWidth, global.innerHeight * 16 / 9);
      var mem = global.navigator && navigator.deviceMemory;
      var hd = w * (global.devicePixelRatio || 1) / 1920 >= 1.15 && w >= 1000 && !(mem && mem < 4);
      var avif = !!(global.ImgFormat && ImgFormat.avif);      // as engine.js assetUrl asks (the same probe)
      var art = [], sound = [];
      Object.keys(v).forEach(function (p) {
        // the hd character sheets replace the base ones on a big sharp screen, never both
        var asWebp = p.replace(/\.avif$/, '.webp');
        if (/\/hd\//.test(p) ? !hd : hd && /^assets\/char\/[^/]+$/.test(p) && v[asWebp.replace('assets/char/', 'assets/char/hd/')]) return;
        if (/\.avif$/.test(p) ? !avif : avif && /\.webp$/.test(p) && v[p.replace(/\.webp$/, '.avif')]) return;
        if (/\.ogg$/.test(p)) {
          if (!ogg) return;
          var take = /\/vo-lines(?:-([a-z]+))?\./.exec(p);
          if (take && (take[1] || 'en') !== (LANG ? (LANG.voice ? LANG.lang : '-') : 'en')) return;
          sound.push(p);
        } else art.push(p);
      });
      var queue = ['index.html', 'css/style.css', 'css/screens.css', 'js/locales.js', 'js/i18n.js', 'js/main.js', 'js/engine.js',
                   'js/hud.js', 'js/tutorial.js'].map(function (f) { return base + f; })
        .concat(art.concat(sound.sort(function (a, b) { return /bgm/.test(a) - /bgm/.test(b); }))
          .map(function (p) { return base + p + '?v=' + v[p]; }));
      var next = function () {
        var url = queue.shift();
        if (url) return get(url).catch(function () {}).then(next);
      };
      next(); next(); next();
    }).catch(function () {});
  }

  function restart() {
    resetLesson();
    setTimeout(function () { play(0); }, 200);
  }
  function restartStory() {
    if (!global.Story || !Story.start) { restart(); return; }
    resetLesson();
    current = -1;
    if (global.Swiftee && Swiftee.visible) Swiftee.visible(false);   // he flies in on screen 1, after it
    Story.start({ lift: function () {}, done: function () { play(0); } });
  }
  function resetLesson() {
    // a restart from inside the story (the review tool) ends it first
    if (global.Story && Story.active) Story.stop();
    playGen++; popGen++; popping = false; cheerUntil = 0; holdForReply = false; owedCheer = null;
    if (Stage.hold) Stage.hold(false);
    // and the second run's music is the lesson's, not the finale's louder tune
    if (global.Music && Music.mood) Music.mood('play');
    flightGen++; entering = null; present = false;
    director.abort(); playing = false;
    if (global.Swiftee && Swiftee.settle) Swiftee.settle({ now: true });
    clearTimeout(rewardTimer);
    quest = Quest.create(); say(null); snaps = [];
    if (Stage.forgetMade) Stage.forgetMade();   // a new lesson: no shapes made yet
    if (Stage.forgetHints) Stage.forgetHints();
    if (global.SFX && SFX.cancelSequences) SFX.cancelSequences();
    hud.querySelector('.replay').classList.remove('show');
    if (continueBtn) continueBtn.classList.remove('show');
    if (nextBtn) nextBtn.classList.remove('show', 'wait');
    leaveReady();   // (playGen has moved on, so a snow already falling stays here too)
    Stage.apply({ kind: 'vista' });
    var first0 = Screens.list[0] || {};
    if (camFor(first0.camera === 'close') !== cam.k) cameraTo(camFor(first0.camera === 'close'), 700);
    Swiftee.place('left', 'large');
  }

  function boot() {
    root = $('#game'); stageEl = $('#stage'); hud = $('#hud'); bubble = $('#bubble');
    instruction = $('#instruction'); progress = $('#progress'); loadEl = $('#loading');
    continueBtn = $('#continue');
    // on to Part 2 in the same language (and the review bar's link to it)
    if (LANG) [continueBtn, $('#jump .dev-go')].forEach(function (a) { if (a && a.getAttribute('href')) a.setAttribute('href', LANG.keep(a.getAttribute('href'))); });
    nextBtn = $('#next');
    // pressed on the hand-over screen, and only there (readyScene), through the snow
    if (continueBtn) continueBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (!readyUp) return;
      if (global.SFX) SFX.play('select');
      if (global.RunnerStage && RunnerStage.on) { RunnerStage.start(); return; }
      goOn();
    });

    Stage.mount(stageEl);
    Swiftee.mount(root, { layout: layout });
    var first = Screens.list[0] || {};
    setCam(first.camera === 'close');
    if (Stage.perch) Stage.perch(!!first.log, 0);
    Swiftee.place('left', 'large'); Swiftee.visible(false);   // he flies in on screen 1

    if (global.Juice) Juice.stage(stageEl);
    if (global.Transition) Transition.mount(root);
    if (global.Input) {
      Input.attach(stageEl);
      Input.mode('locked');
      Input.on('tap', function () { tapLine(); });

      Input.on('down', function () {
        // held (he is up, or about to be): nothing the child does here counts
        if (!inputLive || popping || Input.mode() === 'locked') return;
        if (director) { director.mark(Director.STATES ? Director.STATES.USER_INTERACTING : 'USER_INTERACTING'); director.emit('interaction:start', {}); }
        if (bubble.classList.contains('show')) bubble.classList.add('dim');
        if (inputSpec && WATCHED.test(inputSpec.type) && buddyOn && present && global.Swiftee && Swiftee.attend) Swiftee.attend(true);
        if (inputSpec && inputSpec.type === 'swipe' && present && !entering && global.Swiftee && Swiftee.pos === 'peek') { say(null); leave(); }
      });
      ['pointerup', 'pointercancel'].forEach(function (type) {
        (stageEl.ownerDocument.defaultView || global).addEventListener(type, function () {
          if (inputLive && director) director.mark(Director.STATES ? Director.STATES.WAITING_FOR_USER : 'WAITING_FOR_USER');
        });
      });
      var lastNoticed = 0;
      Input.on('down', function () {
        var t = Date.now();
        if (t - lastNoticed < 400) return;
        if (!buddyOn || !present || entering || popping) return;
        if (!global.Swiftee || !Swiftee.bounce) return;
        if (Date.now() < cheerUntil) return;       // he is already saying something
        lastNoticed = t;
        try { Swiftee.bounce('notice'); } catch (e) {}
      });
    }
    if (global.SFX) SFX.key('C pentatonic');
    loadAudio();

    director = Director.create(handlers(), { msPerWord: 300, sayMinMs: 900, readablePauseMs: 0, feedbackSettleMs: 900 });
    // the last screen is the summary: Part 2 starts loading behind it (warmPart2)
    director.on('start', function () { if (current === Screens.list.length - 1) warmPart2(); });
    director.on('start', function () {
      if (current >= Screens.list.length - 2 && global.RunnerStage && RunnerStage.on) RunnerStage.preload();
    });
    if (Stage.onEvent) Stage.onEvent(function (name, payload) {
      director.emit(name, payload);
      if (name === 'hint:show') hintGesture(payload);
      if (name === 'answer:selected' && popsHere() && !(payload && payload.correct)) holdInput(true);
      if (name === 'measurement:start' && payload && (payload.what === 'side' || payload.what === 'angle')) tailWhenHome();
      if (name === 'compare:outside') buddyReacts('surprised');
      if (name === 'compare:react' && payload && payload.state) buddyReacts(payload.state);
    });
    if (Stage.hintGate) Stage.hintGate(function () {
      if (!director || director.state !== 'WAITING_FOR_USER') return false;
      if (global.VO && VO.at && VO.at() != null) return false;
      if (revealUnits) return false;
      if (entering || leaving || popping) return false;
      if (global.Input && Input.mode && Input.mode() === 'locked') return false;
      if (global.Swiftee && (Swiftee.busy || Swiftee.locked)) return false;
      if (global.Transition && Transition.covered && Transition.covered()) return false;
      if (cheerUntil > Date.now()) return false;
      return true;
    });
    if (Stage.summaryPhase) {
      director.on('swiftee', function (e) {
        var o = (e && e.opts) || {};
        if (e && e.state === 'enter' && o.from === 'below' && !o.to) Stage.summaryPhase('SWIFTEE_ENTER');
        if (e && e.state === 'exit' && o.to === 'below') Stage.summaryPhase('SWIFTEE_EXIT');
      });
      director.on('dialogue:start', function () { Stage.summaryPhase('EXPLANATION'); });
      director.on('dialogue:complete', function () { Stage.summaryPhase('READING_PAUSE'); });
    }

    var muteBtn = hud.querySelector('.mute');
    muteBtn.addEventListener('click', function () {
      var m = global.SFX ? SFX.mute() : true;
      if (global.VO && VO.playing) { try { VO.playing.muted = m; } catch (e) {} }
      this.classList.toggle('on', m); this.setAttribute('aria-pressed', String(m)); saveAudio();
    });

    hud.querySelector('.restart').addEventListener('click', restart);
    hud.querySelector('.replay').addEventListener('click', restart);
    muteBtn.classList.toggle('on', !!(global.SFX && SFX.isMuted()));

    bubble.addEventListener('pointerdown', function () { tapLine(); });

    window.addEventListener('resize', relayout);
    seatFurniture();   // the stage's scale is known before anything is placed against it

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(relayout, function () {});
      if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', relayout);
    }

    if (global.Story && Story.mount) Story.mount({ root: root, pace: paceScale });

    startLoading();
    if (global.TitleFx) TitleFx.mount(loadEl);

    wireJump();

    var startEl = $('#start');
    var armed = false;
    startEl.addEventListener('pointerdown', function () {
      if (armed) return;
      armed = true;
      if (global.SFX) { SFX.unlock(); SFX.play('pop'); }
      if (global.TitleFx) TitleFx.pressDown();
    });
    // Released without completing the tap: undo the squash, keep the screen.
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      startEl.addEventListener(ev, function () {
        if (!armed) return;
        armed = false;
        if (global.TitleFx) TitleFx.pressUp();
      });
    });

    startEl.addEventListener('click', function () {
      if (!preloaded) { pendingStart = function () { startEl.click(); }; return; }
      if (global.Story && Story.active) return;
      if (global.SFX) { SFX.unlock(); if (!autoPress) SFX.play('sparkle'); }
      autoPress = false;
      var skipping = storySkip;
      var storyNext = !skipping && global.Story && Story.enabled && Story.enabled();
      if (global.Music && !storyNext) Music.start();
      if (global.TitleFx) { TitleFx.pressUp(); TitleFx.press(); }
      var curtain = function () {
        setTimeout(function () { loadEl.classList.add('gone'); }, 120);
        setTimeout(function () { if (global.TitleFx) TitleFx.stop(); }, 640);
      };
      var skip = storySkip; storySkip = false;
      if (!skip && global.Story && Story.enabled && Story.enabled()) {
        var lifted = false;
        Story.start({
          lift: function () { if (!lifted) { lifted = true; curtain(); } },
          done: function () { if (global.Music) Music.start(); play(0); }
        });
        return;
      }
      curtain();
      setTimeout(function () { play(0); }, 430);
    });

    if (global.RunnerStage && RunnerStage.opening) loadEl.classList.add('auto');
    global.Lesson = {
      startHosted: function () { autoPress = true; storySkip = true; startEl.click(); },
      showTitle: function () { loadEl.classList.remove('auto', 'auto-tap'); },
      devReady: function () {
        var go = function () { try { if (director && director.abort) director.abort(); } catch (e) {} finaleOn = true; readyScene(); };
        if (loadEl && !loadEl.classList.contains('gone')) { storySkip = true; startEl.click(); setTimeout(go, 900); }
        else go();
      }
    };
    var autoLoc = global.location || {};
    if (/[?&]auto=1\b/.test(autoLoc.search || '')) {
      loadEl.classList.add('auto');
      var tryStart = function () {
        var probe = null, played = null;
        try { probe = new Audio(SILENT_WAV); played = probe.play(); } catch (e) { played = null; }
        var go = function () { autoPress = true; startEl.click(); };
        if (!played || !played.then) { go(); return; }
        played.then(function () {
          try { probe.pause(); } catch (e) {}
          go();
        }, function (err) {
          if (err && err.name === 'NotAllowedError') loadEl.classList.add('auto-tap');
          else go();
        });
      };
      if (preloaded) tryStart(); else pendingStart = tryStart;
    }
  }
  var storySkip = false;
  var autoPress = false;
  var SILENT_WAV = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YSADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

  var preloaded = false, pendingStart = null;
  function startLoading() {
    var P = global.Preload;
    var ready = function () {
      preloaded = true;
      loadEl.classList.remove('loading');
      loadEl.classList.add('ready');
      if (pendingStart) { var go = pendingStart; pendingStart = null; setTimeout(go, 0); }
    };
    if (!P) { ready(); return; }
    loadEl.classList.add('loading');
    var fill = $('#title-loading-fill'), label = $('#title-loading-label'), bar = $('#title-loading');
    P.onProgress(function (f) {
      var pct = Math.floor(f * 100);
      if (fill) fill.style.width = pct + '%';
      if (label) label.textContent = LANG ? LANG.t('loadingPercent', { percent: pct }) : 'Loading\u2026 ' + pct + '%';
      if (bar) bar.setAttribute('aria-valuenow', String(pct));
    });
    var keep = /^assets\/(vo|story)\//;
    P.want((global.PreloadList && PreloadList.urls) || [], { keep: keep });
    if (global.Swiftee && Swiftee.sheetUrls) P.want(Swiftee.sheetUrls());
    FACES.forEach(function (f) { P.font(f); });
    if (LANG && LANG.font && LANG.fontReady) [600, 700, 800].forEach(function (w) { P.font(w + ' 1em "' + LANG.font + '"', LANG.t('lessonTitle'), LANG.fontReady()); });
    var voice = (global.VO && VO.ready) ? VO.ready() : Promise.resolve();
    if (global.StoryMusic && StoryMusic.ext) P.want(['assets/story/story-music.' + StoryMusic.ext()], { keep: keep });
    voice.then(function () { if (global.VO && VO.urls) P.want(VO.urls(), { keep: keep }); }, function () {})
      .then(function () { P.seal(); });
    P.done.then(ready);
  }
  var FACES = ['700 1em Nunito', '800 1em Nunito', '600 1em Fredoka', '700 1em Fredoka'];

  function goTo(n) {
    if (!(n >= 0 && n < Screens.list.length)) return;
    // a jump from inside the story ends it here: no Scene 5 hand-over after it
    if (global.Story && Story.active) Story.stop();
    playGen++; popGen++; popping = false; cheerUntil = 0; holdForReply = false; owedCheer = null;
    if (Stage.hold) Stage.hold(false);
    flightGen++; entering = null;
    director.abort();
    playing = false;
    cancelScreenLine(); clearLineTimers(); clearTimeout(bubbleTimer); say(null);
    if (global.Swiftee && Swiftee.settle) Swiftee.settle({ now: true });
    if (n > 0 && global.Swiftee && Swiftee.markArrived) Swiftee.markArrived();
    hud.querySelector('.replay').classList.remove('show');
    if (continueBtn) continueBtn.classList.remove('show');
    leaveReady();

    var snap = snaps[n];
    if (snap && snap.spec && Stage.restore) {
      if (global.Swiftee && Swiftee.place) {
        var ms = markFor(n, Swiftee.pos, Swiftee.size);
        Swiftee.place(ms ? ms.pos : 'off', ms ? ms.size : Swiftee.size);
        if (!present && Swiftee.visible) Swiftee.visible(false);
      }
      if (Stage.seat) Stage.seat(!hasPlank(n));
      var ok = false;
      try { ok = Stage.restore(snap); } catch (e) { ok = false; }
      if (ok) { syncPeekRim(); setTimeout(function () { play(n); }, 80); return; }
    }

    var built = -1;
    for (var b = n; b >= 0; b--) {
      var sp = Screens.list[b].stage;
      if (sp && sp.kind) { built = b; break; }
    }
    if (global.Swiftee && Swiftee.place) {
      var mb = built >= 0 ? markFor(built, Swiftee.pos, Swiftee.size) : null;
      Swiftee.place(mb ? mb.pos : 'off', mb ? mb.size : Swiftee.size);
    }
    if (Stage.seat) Stage.seat(!hasPlank(n));
    if (built >= 0) Stage.apply(Screens.list[built].stage);
    if (global.Swiftee && Swiftee.place) {
      var m = markFor(n, Swiftee.pos, Swiftee.size);
      Swiftee.place(m ? m.pos : 'off', m ? m.size : Swiftee.size);
      if (!present && Swiftee.visible) Swiftee.visible(false);
    }
    setTimeout(function () { play(n); }, 80);
  }

  var snaps = [];

  function wireJump() {
    var box = $('#jump-sel');
    if (!box || !global.Screens) return;
    var dev = false;
    try {
      var loc = global.location || {};
      dev = /[?&]dev=1\b/.test(loc.search || '');
    } catch (e) { dev = false; }
    if (!dev) { var host = $('#jump'); if (host) host.remove(); return; }
    var host2 = $('#jump'); if (host2) host2.removeAttribute('hidden');
    // the Momo and Popo story that opens the game, from its first scene (restartStory)
    if (global.Story && Story.enabled && Story.enabled()) {
      var so = document.createElement('option');
      so.value = 'story';
      so.textContent = '0. story (Momo & Popo)';
      box.appendChild(so);
    }
    var withGame = global.RunnerStage && RunnerStage.on;
    var addOpt = function (value, label) {
      var o = document.createElement('option'); o.value = value; o.textContent = label; box.appendChild(o);
    };
    if (withGame) { addOpt('start1', 'Start 1. Frozen Rush cover'); addOpt('start2', 'Start 2. Swiftee at the broken path'); }
    Screens.list.forEach(function (s, i) {
      var o = document.createElement('option');
      o.value = i;
      o.textContent = (i + 1) + '. ' + s.id;
      box.appendChild(o);
    });
    if (withGame) { addOpt('end1', 'End 1. Last line, then the game'); addOpt('end2', 'End 2. Swiftee at the ditch'); }
    // (and the picker says where the review is: the game's opening, or its break)
    if (withGame && RunnerStage.opening) box.value = /[?&]devat=break\b/.test((global.location || {}).search || '') ? 'start2' : 'start1';
    function jump(n) {
      n = Math.max(0, Math.min(Screens.list.length - 1, n));
      if (!preloaded && global.Preload) { Preload.done.then(function () { jump(n); }); return; }
      if (loadEl && !loadEl.classList.contains('gone')) {
        storySkip = true;
        var s = $('#start'); if (s) s.click();
        setTimeout(function () { goTo(n); }, 600);
      } else goTo(n);
    }
    box.addEventListener('change', function () {
      box.blur();
      if (box.value === 'story') {
        if (loadEl && !loadEl.classList.contains('gone')) { var s0 = $('#start'); if (s0) s0.click(); }
        else restartStory();
        return;
      }
      if (/^(start|end)[12]$/.test(box.value)) { if (global.RunnerStage) RunnerStage.devJump(box.value); return; }
      if (global.RunnerStage && RunnerStage.leave) RunnerStage.leave();
      // The picker and the Back button change screen the same way: goTo().
      jump(+box.value);
    });
    // one screen back or on, from wherever the lesson is
    Array.prototype.forEach.call(host2.querySelectorAll('.dev-step'), function (b) {
      b.addEventListener('click', function () {
        if (global.RunnerStage && RunnerStage.leave) RunnerStage.leave();
        jump(current + (+b.getAttribute('data-step')));   // (from the title, either way is screen 1)
      });
    });
    // and the hand-over to Part 2 keeps dev on, so its own bar is there too
    if (continueBtn) continueBtn.search = '?dev=1' + (LANG ? '&lan=' + LANG.lang : '');
    if (director && director.on) {
      director.on('start', function () {
        if (current >= 0 && +box.value !== current) box.value = current;
      });
    }
  }

  function start() {
    var F = global.ImgFormat;
    if (F && F.ready && !F.settled) F.ready.then(boot); else boot();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  global.Game = {
    relayout: relayout,
    get screen() { return current; },
    get buddy() { return { on: buddyOn, present: present, entering: !!entering }; },
    get director() { return director; }
  };

})(typeof window !== 'undefined' ? window : this);

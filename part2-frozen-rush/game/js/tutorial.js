// THE FIRST-PLAY TUTORIAL.

const W = 1920, H = 1080;
const clampN = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

import { fitBubble, BUBBLE } from './bubble.js';

/* WHICH RECORDED LINE BELONGS TO WHICH STEP (docs/VO-SCRIPT.md, CFG.vo.lines). */
const VO = {
  meet: 'tut-1-meet', goal: 'tut-2-goal', rock: 'tut-3-watch', jump: 'tut-4-jump',
  gap: 'tut-5-broken',
  use: 'tut-6-use', fit: 'tut-7-fit'
};
const HEAD = { up: 362, right: 86 };
const TUT_LANG = (typeof globalThis !== 'undefined' && globalThis.I18N && globalThis.I18N.on) ? globalThis.I18N : null;

export class Tutorial {
  constructor(root, game, opts = {}) {
    this.root = root;
    this.game = game;
    this.mode = opts.mode || 'full';
    this.onHandOff = opts.onHandOff || null;
    this.onHost = opts.onHost || null;
    this.handedOff = false;
    this._hosted = false; this._hostT = 0;
    this.el = {
      layer: root.getElementById('tutorial'),
      veil: root.getElementById('tut-veil'),
      focus: root.getElementById('tut-focus'),
      canvas: root.getElementById('game-canvas'),
      bubble: root.getElementById('tut-bubble'),
      shape: root.getElementById('tut-shape'),
      text: root.getElementById('tut-text'),
      hand: root.getElementById('tut-hand')
    };
    this.step = -1;
    this.done = false;
    this.t = 0;                    // seconds the current step has been on screen
    this.hold = 0;                 // a follow-up line's remaining time
    this.follow = null;
    this._built = false;
    this._wasPaused = false;
    this.spoke = false; this.voDur = 0; this._wordStep = 0.055;
    this.voWords = null; this.voId = null;

    const d = root && root.fonts;
    if (d && d.ready && d.ready.then) d.ready.then(() => { this._boxH = 0; this._sizeKey = null; }).catch(() => {});
  }

  get steps() {
    const HEAD_UP = HEAD.up, HEAD_RIGHT = HEAD.right;
    const momoHeadX = () => {
      try {
        const p = this.game._player && this.game._player();
        if (p && typeof p.drawX === 'number') return p.drawX + HEAD_RIGHT;
      } catch (e) { /* he is not up yet */ }
      return 430 + HEAD_RIGHT;
    };
    const momo = () => {
      let feet = 840, x = 430;
      try {
        const p = this.game._player && this.game._player();
        if (p && typeof p.feetY === 'number') feet = p.feetY;
        if (p && typeof p.drawX === 'number') x = p.drawX;
      } catch (e) { /* fall back to where he stands */ }
      const hx = x + HEAD_RIGHT, hy = feet - HEAD_UP;
      const ry = 58;
      return { x: hx, y: hy + ry, rx: 86, ry, aimX: hx, world: true };
    };
    const all = [
      {
        id: 'meet',
        at: g => ['RUN_SEGMENT_1', 'JUMP_CHALLENGE_1'].includes(g.state),
        spot: momo,
        text: 'This is Momo. He needs to find his friend.',
        focus: 'mammoth',
        advance: 0, pause: true
      },
      {
        id: 'goal',
        at: g => ['RUN_SEGMENT_1', 'JUMP_CHALLENGE_1'].includes(g.state),
        spot: momo,
        text: 'Help Momo cross the Frozen Pass!',
        focus: 'mammoth',
        advance: 0, pause: true
      },
      {
        id: 'rock',
        at: g => this.rockAhead(g) !== null,
        spot: g => {
          const sx = this.rockAhead(g);
          return sx === null ? null : { x: sx, y: 780, rx: 150, ry: 140, world: true };
        },
        text: 'Watch out!',
        focus: 'rock',
        advance: 0, pause: true
      },
      {
        id: 'jump',
        at: g => !!g.jumpEnabled,
        spot: () => ({ x: 960, y: 560, rx: 260, ry: 40, aimX: momoHeadX(), world: true }),
        text: 'Tap to jump over obstacles.',
        advance: 'jumped', pause: 'line'
      },
      {
        id: 'gap',
        /* The ice has to have actually broken: g.open runs 0 -> 1 as the ground gives way. */
        at: g => (g.gapsThisPhase || []).some(gp => gp && (gp.open || 0) > 0.75) &&
                 ['PHASE_INTRO', 'PHASE_ACTIVE', 'LEVEL_2_INTRO', 'LEVEL_2_OVERVIEW'].includes(g.state) &&
                 (() => { const p = this.game._player && this.game._player(); return !p || p.state !== 'SHAKE'; })(),
        spot: g => {
          const gp = (g.gapsThisPhase || [])[0];
          if (!gp) return null;
          const cx = (gp.x0 + gp.x1) / 2 - g.worldX;
          return { x: cx, y: 900, rx: Math.max(150, (gp.x1 - gp.x0) * 0.62), ry: 62, world: true };
        },
        text: 'Oh no! The path is broken.',
        focus: 'gap',
        advance: 0, pause: true
      },
      {
        id: 'use',
        at: g => ['PHASE_INTRO', 'PHASE_ACTIVE', 'LEVEL_2_OVERVIEW', 'LEVEL_2_FOCUS'].includes(g.state),
        spot: () => null,
        text: 'Use the right ice piece to fix the path.',
        sign: 99, focus: 'blocks',
        advance: 0, pause: false
      },
      {
        id: 'cut',
        at: g => !!g.l2 && g.state === 'LEVEL_2_ACTIVE' && this.diagonalBox(g) !== null,
        spot: g => this.diagonalBox(g),
        text: '',
        handOnly: true,
        demo: true,
        advance: 'cut', pause: false, hand: null
      },
      {
        id: 'fit',
        at: g => ['PHASE_SUCCESS', 'PHASE_DONE', 'PHASE_RUN',
                  'LEVEL_2_SUCCESS', 'BRIDGE_2_COMPLETE'].includes(g.state),
        spot: momo,
        text: 'Perfect fit! Keep going!',
        advance: 0, pause: false
      }
    ];
    const at = (id) => all.findIndex((s) => s.id === id);
    const gap = all[at('gap')];
    const host = { id: 'host', at: gap.at, host: true, advance: 'host', pause: true };
    const usePiece = Object.assign({}, all[at('use')], { text: 'Use the right piece to fix the path.', vo: 'tut-6b-piece' });
    if (this.mode === 'intro') return all.slice(0, at('gap') + 1);
    if (this.mode === 'end') return [host, usePiece].concat(all.slice(at('use') + 1));
    return all;
  }

  /* ---- where things are ---- */

  /** The nearest rock still ahead of the character, in stage x, or null. */
  rockAhead(g) {
    const list = this.game._obstacles ? this.game._obstacles().list : [];
    let best = null;
    for (const o of list) {
      if (o.passed || o.hits >= 3) continue;
      const sx = o.x - g.worldX;
      if (sx > 620 && sx < 1050 && (best === null || sx < best)) best = sx;
    }
    return best;
  }

  diagonalBox(g) {
    const L = g.l2;
    if (!L || !L.pts || !L.pts.length || L.pieces) return null;
    // not while it is falling into the river or being lowered back in
    if (L.fall || (L.respawn || 0) > 0) return null;
    const n = L.pts.length;
    const j = n / 2;
    if (!Number.isInteger(j)) return null;            // no opposite corner to aim at
    const at = i => ({ x: L.pos.x + L.pts[i].x * L.scale, y: L.pos.y + L.pts[i].y * L.scale });
    const a = at(0), b = at(j);
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    return {
      x: cx, y: cy,
      rx: Math.max(90, Math.abs(b.x - a.x) / 2 + 46),
      ry: Math.max(70, Math.abs(b.y - a.y) / 2 + 46),
      from: a, to: b,
      world: false
    };
  }

  /* ---- lifecycle ---- */

  begin() {
    if (this._built) return;
    this._built = true;
    if (this.el.layer) this.el.layer.addEventListener('click', () => this.tap());
    this.step = 0;
    this.t = 0;
  }

  beats(text) {
    const key = (text || '') + '|' + (this.voDur || 0);
    if (this._beatKey === key) return this._beatPlan;
    if (TUT_LANG && text) text = TUT_LANG.tr(text);
    const parts = String(text || '').match(/[^.!?\u0964\u0965]+[.!?\u0964\u0965]*/g) || [];
    const lines = parts.map(t => t.trim()).filter(Boolean);
    let plan;
    if (!lines.length) plan = [];
    else if (this.voDur > 0) {
      const w = this.voWords, counts = lines.map(t => t.trim().split(/\s+/).filter(Boolean).length);
      const need = counts.reduce((a, b) => a + b, 0);
      if (w && w.length === need) {
        let i = 0;
        plan = lines.map((t, k) => {
          const at = w[i];
          i += counts[k];
          const end = i < w.length ? w[i] : this.voDur;
          return { text: t, dur: Math.max(0.7, end - at), at, i0: i - counts[k] };
        });
        plan[plan.length - 1].dur += 0.45;
      } else {
        const total = lines.reduce((a, t) => a + t.length, 0) || 1;
        plan = lines.map(t => ({ text: t, dur: Math.max(0.7, this.voDur * t.length / total) }));
        plan[plan.length - 1].dur += 0.45;
      }
    } else {
      plan = lines.map(t => ({ text: t, dur: clampN(1.0 + t.length * 0.055, 1.55, 3.6) }));
    }
    for (const b of plan) {
      const words = b.text.trim().split(/\s+/).filter(Boolean).length || 1;
      const floor = (words - 1) * 0.055 + Tutorial.WORD_IN + Tutorial.SETTLE;
      if (b.dur < floor) b.dur = floor;
    }
    this._beatKey = key; this._beatPlan = plan;
    return plan;
  }

  /** Which sentence is showing at t seconds into the step, and how long it has. */
  beatAt(text, t) {
    const plan = this.beats(text);
    if (!plan.length) return { text: '', dur: 0 };
    let acc = 0;
    for (let i = 0; i < plan.length; i++) {
      acc += plan[i].dur;
      if (t < acc || i === plan.length - 1) return plan[i];
    }
    return plan[plan.length - 1];
  }

  readShown(text) {
    return this.beats(text).reduce((a, b) => a + b.dur, 0);
  }
  readTime(text) {
    return Math.max(this.readShown(text), this.voDur || 0) + Tutorial.READ_PAUSE;
  }

  tap() { /* intentionally nothing: see above */ }

  /** The player did the thing an action step was waiting for. */
  didAction(name) {
    if (this.done) return;
    const s = this.steps[this.step];
    if (s && s.advance === name) {
      if (s.follow) { this.follow = s.follow; this.hold = 1.4; }
      this.next();
    }
  }

  next() {
    if (this.game.saySign) this.game.saySign('');
    if (this.game._l2Demo) this.game._l2Demo(false);
    this.step++;
    this.t = 0;
    this._hosted = false; this._hostT = 0;              // a host step is told once, its own
    this.spoke = false;                                // the new step has not been read aloud yet
    this.voDur = 0; this.voWords = null; this.voId = null;
    if (this.el.text) this.el.text.classList.remove('waiting');
    if (this.el.bubble) this.el.bubble.classList.remove('held');
    if (this.step >= this.steps.length) {
      if (this.mode === 'intro' && this.onHandOff) { this.handOff(); return; }
      this.finish();
    }
  }

  handOff() {
    if (this.handedOff || this.done) return;
    this.handedOff = true;
    if (this.game.saySign) this.game.saySign('');
    this.pause();
    this.show(null);
    if (this.game.setDialogue) this.game.setDialogue(true);
    let where = null;
    try { where = this.where(); } catch (e) { where = null; }
    try { this.onHandOff(where); } catch (e) { /* the host's business: nothing to undo here */ }
  }

  where() {
    const g = this.game.debug();
    let feet = 840, x = 430;
    try {
      const p = this.game._player && this.game._player();
      if (p && typeof p.feetY === 'number') feet = p.feetY;
      if (p && typeof p.drawX === 'number') x = p.drawX;
    } catch (e) { /* where he stands by default */ }
    const head = this.toView({ x: x + HEAD.right, y: feet - HEAD.up, world: true }, g);
    const gaps = (g.gapsThisPhase || []).filter(Boolean);
    const far = gaps.reduce((a, b) => (!a || b.x1 > a.x1 ? b : a), null);
    const surface = 840;
    const lip = this.toView({ x: far ? far.x1 - g.worldX : 1500, y: surface, world: true }, g);
    const st = this.root.getElementById('stage');
    const r = st ? st.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 };
    const win = this.root.defaultView || { innerWidth: 1, innerHeight: 1 };
    const W = win.innerWidth || 1, H = win.innerHeight || 1;
    const k = (n) => +n.toFixed(4);
    return {
      head: { x: Math.round(head.x), y: Math.round(head.y) },
      lip: { x: Math.round(lip.x), y: Math.round(lip.y) },
      zoom: k(g.zoom || 1),
      stage: { x: k(r.left / W), y: k(r.top / H), w: k(r.width / W), h: k(r.height / H) }
    };
  }

  skipTo(id) {
    const i = this.steps.findIndex((s) => s.id === id);
    if (i < 0 || i <= this.step) return false;
    this.step = i - 1;
    this.next();
    return true;
  }

  finish() {
    if (this.game.saySign) this.game.saySign('');
    if (this.game._l2Demo) this.game._l2Demo(false);
    if (this.done) return;
    this.done = true;
    // the tutorial is over: the game must never be left believing a line is still up
    this._presenting = false;
    if (this.game.setDialogue) this.game.setDialogue(false);
    this.resume();
    this.hideFocus();
    if (this.el.layer) this.el.layer.hidden = true;
    this._bubbleKey = null;
  }

  pause(asking) {
    if (this._wasPaused && this._askingPause === !!asking) return;
    this._wasPaused = true; this._askingPause = !!asking;
    this.game.setPaused(true, { asking: !!asking });
  }
  resume() {
    if (!this._wasPaused) return;
    this._wasPaused = false;
    this.game.setPaused(false);
  }

  /* ---- one tick, called from the host's animation frame ---- */
  static WARMUP = 1.1;              // seconds of game time before the first step

  static READ_PAUSE = 1.0;

  static WORD_IN = 0.46;

  static SETTLE = 0.12;

  update(dt) {
    if (this.done || this.step < 0 || this.handedOff) return;
    const g = this.game.debug();

    if (g.complete || g.state === 'COMPLETE' || g.state === 'FINAL_RUN') {
      this.finish();
      return;
    }
    if (this.step === 0 && (g.t || 0) < Tutorial.WARMUP) {
      this.resume();
      this.show(null);
      return;
    }

    const anim = this.game.mammothState && this.game.mammothState();
    if (anim === 'JUMP_AIR' || anim === 'LAND') this.didAction('jumped');
    if ((g.attempts || 0) > 0) this.didAction('cut');

    // the follow-up line ("Nice hop!") runs on its own clock over the next step
    if (this.hold > 0) {
      this.hold -= dt;
      if (this.hold <= 0) this.follow = null;
    }

    const s = this.steps[this.step];
    if (!s) { this.finish(); return; }

    if (!s.at(g)) {
      // nothing is presenting while a step waits for its moment
      if (this._presenting) { this._presenting = false; if (this.game.setDialogue) this.game.setDialogue(false); }
      if (this.t > 0 && typeof s.advance === 'number') { this.next(); return; }
      if (s.advance === 'cut' && (g.attempts || 0) > 0) { this.next(); return; }
      this.resume(); this.show(null); return;
    }
    if (s.host) {
      if (!this.onHost) { this.next(); return; }
      this.pause(false);
      this.show(null);
      if (this.game.setDialogue) this.game.setDialogue(true);
      if (!this._hosted) {
        this._hosted = true; this._hostT = 0;
        try { this.onHost(s.id, this.where()); } catch (e) { /* the host's own business */ }
      }
      this._hostT += dt;
      if (this._hostT > 16) this.next();
      return;
    }

    const onSignStep = typeof s.sign === 'number';
    const box = onSignStep ? null : s.spot(g);
    if (!onSignStep && !box) { this.resume(); this.show(null); return; }

    this.t += dt;
    const holdFor = s.pause === 'line' ? this.readTime(this.follow || (typeof s.text === 'function' ? s.text(g) : s.text)) : null;
    const frozen = s.pause === true ||
                   (holdFor !== null && this.t < holdFor) ||
                   (typeof s.pause === 'number' && this.t < s.pause);
    if (frozen) this.pause(typeof s.pause === 'number' || s.pause === 'line'); else this.resume();

    const describing = typeof s.advance === 'number';
    const line = this.follow || (typeof s.text === 'function' ? s.text(g) : s.text);
    if (!this.spoke && line) {
      this.spoke = true;
      let dur = 0;
      try { dur = (this.game.say && this.game.say(s.vo || VO[s.id] || '')) || 0; }
      catch (e) { dur = 0; }
      this.voDur = dur;
      this.voId = s.vo || VO[s.id] || null;
      this.voWords = this.voId && this.game.voWords ? this.game.voWords(this.voId) : null;
    }
    const beat = this.beatAt(line, this.t);
    this._beat = beat;
    const text = beat.text;
    this._beatDur = beat.dur;

    this._presenting = !!line && this.t < this.readTime(line);
    const usingVoice = !!(this.voWords && this.voId);
    const speaking = usingVoice ? this.game.voAt(this.voId) >= 0 : true;
    const coming = !usingVoice || speaking || !this.game.voComing || this.game.voComing(this.voId);
    const waiting = usingVoice && !speaking && coming;
    const sentence = this.step + ':' + (beat && beat.i0 != null ? beat.i0 : text);
    if (speaking && usingVoice) this._heard = sentence;
    if (this.el.text) this.el.text.classList.toggle('waiting', waiting);
    if (this.el.bubble) this.el.bubble.classList.toggle('held', waiting && this._heard !== sentence);
    if (this.game.setDialogue) this.game.setDialogue(this._presenting);

    if (s.handOnly) {
      if (this.el.bubble) this.el.bubble.hidden = true;
      this.hideFocus();
      if (s.demo && this.game._l2Demo) this.game._l2Demo(true);
      this.show(this.toView(box, g), '', false, s.hand || null, false, null, true);
      return;
    }
    const onSign = typeof s.sign === 'number';
    if (onSign) {
      this.game.saySign(this.t < s.sign ? line : '', this.voDur);
      if (this.el.bubble) this.el.bubble.hidden = true;
      this.showFocus(s.focus || null);            // the row stays lit for as long as the step does
      this.show(null, '', false, s.hand || null, false, null, true);
      if (describing && this.t >= this.readTime(line)) this.next();
      return;
    }
    const keepBox = describing || this.t < this.readTime(line);
    this.show(this.toView(box, g), text, describing, s.hand || null, keepBox, s.focus || null, s.pause === false);

    if (describing && this.t >= this.readTime(line)) this.next();
  }

  toView(box, g) {
    const k = g.zoom || 1;
    if (!box.world || k <= 1.0005) return box;
    const fx = g.zoomVX, fy = g.zoomVY;
    const out = {
      x: fx + (box.x - fx) * k,
      y: fy + (box.y - fy) * k,
      world: box.world
    };
    // both axes scale, or an oval stops matching the row it hugs
    if (box.r !== undefined) out.r = box.r * k;
    if (box.aimX !== undefined) out.aimX = fx + (box.aimX - fx) * k;
    if (box.belowY !== undefined) out.belowY = fy + (box.belowY - fy) * k;
    if (box.handX !== undefined) out.handX = fx + (box.handX - fx) * k;
    if (box.handY !== undefined) out.handY = fy + (box.handY - fy) * k;
    if (box.rx !== undefined) out.rx = box.rx * k;
    if (box.ry !== undefined) out.ry = box.ry * k;
    return out;
  }

  setWords(text) {
    const el = this.el.text;
    if (!el) return;
    const words = (text || '').trim().split(/\s+/).filter(Boolean).length || 1;
    const span = (this._beatDur || (this.voDur > 0 ? this.voDur : 0));
    const room = span - Tutorial.WORD_IN - Tutorial.SETTLE;
    this._wordStep = (span > 0 && words > 1 && room > 0)
      ? clampN(room / (words - 1), 0.055, 0.55)
      : 0.055;
    const beat = this._beat;
    const all = this.voWords;
    let at = null;
    if (all && beat && beat.i0 != null && all.length >= beat.i0 + words) {
      el.dataset.w0 = String(beat.i0);
      const now = (this.voId && this.game.voAt) ? this.game.voAt(this.voId) : -1;
      const base = now >= 0 ? Math.max(all[beat.i0], now) : all[beat.i0];
      at = [];
      for (let k = 0; k < words; k++) at.push(Math.max(0, all[beat.i0 + k] - base));
    }
    const KEY = /^(friend|cross|watch|tap|jump|broken|right|fix|perfect|ice|rope|cut|swipe)[!.,?]*$/i;
    const NAME = /^(momo|frozen)[!.,?]*$/i;
    const parts = (text || '').split(/(\s+)/);
    const list = parts.filter(p => p && !/^\s+$/.test(p));       // the words alone, without the gaps
    const loudAt = w => (w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w)) || (TUT_LANG ? TUT_LANG.isWord(w, 'tutKeyWords') : KEY.test(w));
    let pow = list.findIndex(loudAt);
    if (pow < 0) pow = list.findIndex(w => TUT_LANG ? TUT_LANG.isWord(w, 'nameMomo') : NAME.test(w));
    let i = 0, n = 0;
    el.textContent = '';
    for (const p of parts) {
      if (!p) continue;
      if (/^\s+$/.test(p)) { el.appendChild(document.createTextNode(p)); continue; }
      const w = document.createElement('span');
      w.className = n === pow ? 'w pow' : 'w';
      n++;
      const k = i++;
      w.style.setProperty('--i', k);
      if (this._wordStep) w.style.setProperty('--wd', this._wordStep.toFixed(3) + 's');
      if (at && at[k] != null) w.style.setProperty('--wdly', at[k].toFixed(3) + 's');
      else w.style.removeProperty('--wdly');
      w.textContent = p;
      el.appendChild(w);
    }
  }

  hugWords(b) {
    const tx = this.el.text;
    if (!b || !tx) return;
    b.style.width = ''; b.style.paddingBottom = '';      // measure the natural wrap, not the last hug
    const cs = getComputedStyle(b);
    const padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0, padT = parseFloat(cs.paddingTop) || 0;
    const lines = () => {
      const ws = [];
      for (const w of tx.querySelectorAll('.w')) ws.push({ l: w.offsetLeft, r: w.offsetLeft + w.offsetWidth, t: w.offsetTop });
      const tops = [];
      for (const w of ws) if (!tops.includes(w.t)) tops.push(w.t);
      let widest = 0;
      for (const t of tops) {
        let a = Infinity, z = -Infinity;
        for (const w of ws) if (w.t === t) { if (w.l < a) a = w.l; if (w.r > z) z = w.r; }
        if (z - a > widest) widest = z - a;
      }
      return { widest, n: tops.length };
    };
    let cur = lines();
    for (let pass = 0; pass < 3 && cur.widest > 0; pass++) {
      const settled = b.style.width && Math.abs(parseFloat(b.style.width) - (cur.widest + 2 + padL + padR)) < 4;
      if (settled) break;
      const wasWidth = b.style.width;
      let ok = false;
      for (const slack of [2, 5, 10, 18]) {
        b.style.width = Math.ceil(cur.widest + slack + padL + padR) + 'px';
        const after = lines();
        if (after.n <= cur.n) { ok = true; cur = after; break; }
      }
      if (!ok) { b.style.width = wasWidth; break; }
    }
    if (cur.n >= 2 && cur.widest > 0) {
      const startW = parseFloat(b.style.width) || (cur.widest + padL + padR);
      let bestW = startW, best = cur;
      for (let w = startW * 0.94; w > startW * 0.5; w *= 0.94) {
        b.style.width = Math.ceil(w) + 'px';
        const now = lines();
        if (now.n > cur.n) break;
        bestW = w; best = now;
      }
      b.style.width = Math.ceil(best.widest + 4 + padL + padR) + 'px';
      if (lines().n > cur.n) b.style.width = Math.ceil(bestW) + 'px';
    }
    const trim = this.inkTrim(tx);
    if (trim > 0.5) b.style.paddingBottom = Math.max(0, padT - trim) + 'px';
  }

  inkTrim(tx) {
    const st = getComputedStyle(tx);
    const font = st.fontWeight + ' ' + st.fontSize + ' ' + st.fontFamily;
    if (this._trimFont === font) return this._trim;
    let trim = 0;
    try {
      this._probe = this._probe || document.createElement('canvas');
      const c = this._probe.getContext('2d');
      c.font = font;
      const m = c.measureText('Hxdp');
      const fsz = parseFloat(st.fontSize) || 20;
      const asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent, cap = m.actualBoundingBoxAscent;
      trim = (asc && desc && cap) ? desc - (asc - cap) : 0;
      trim = Math.max(0, Math.min(trim, fsz * 0.3));
    } catch (e) { trim = 0; }
    this._trimFont = font; this._trim = trim;
    return trim;
  }

  /* ---- the focus canvas ---- */
  showFocus(kind) {
    const f = this.el.focus;
    if (!f) return;
    const key = kind + ':' + this.step;
    if (this._focusKey !== key) {
      this._focusKey = key;
      try { this.game.renderFocus(f, kind); }
      catch (e) { /* nothing to lift: the sheet and the words still read */ }
    }
    if (f.hidden) f.hidden = false;
  }
  hideFocus() {
    const f = this.el.focus;
    if (f && !f.hidden) f.hidden = true;
    this._focusKey = null;
  }

  /* ---- the layer ---- */
  show(box, text, describing, gesture, keepBox, focus, running) {
    const L = this.el.layer;
    if (!L) return;
    if (!box) {
      if (!L.hidden) L.hidden = true;
      this.hideFocus();
      return;
    }
    if (L.hidden) L.hidden = false;
    if (this.el.veil) this.el.veil.hidden = !describing || !!running;
    if (!describing) this.hideFocus();

    const pc = (v, of) => (v / of * 100).toFixed(2) + '%';
    const rx = box.rx !== undefined ? box.rx : box.r;
    const ry = box.ry !== undefined ? box.ry : box.r;

    if (describing && focus) this.showFocus(focus);
    const b = this.el.bubble;
    const fresh = !!(this.el.text && this.el.text.textContent !== text);
    if (b && fresh) {
      this.setWords(text);
      this._boxH = 0;                 // force a re-measure on the new wrap
    }
    if (b) {
      const st = this.root.getElementById('stage');
      if (b && keepBox && b.hidden) { b.hidden = false; this._boxH = 0; }
      const sizeKey = st ? st.clientWidth + 'x' + st.clientHeight : '';
      const inkW = this.el.text ? this.el.text.scrollWidth : 0;
      const reflowed = this._hugInkW !== undefined && Math.abs(inkW - this._hugInkW) > 1;
      if (st && b && !b.hidden && (fresh || reflowed || !this._boxH || this._sizeKey !== sizeKey)) {
        this._sizeKey = sizeKey;
        this.hugWords(b);
        this._hugInkW = this.el.text ? this.el.text.scrollWidth : 0;
      }
      if (st && b && !b.hidden && (fresh || !this._boxH || b.offsetWidth !== this._measW || b.offsetHeight !== this._measH)) {
        this._measW = b.offsetWidth; this._measH = b.offsetHeight;
        if (b.offsetHeight && st.clientHeight) this._boxH = b.offsetHeight / st.clientHeight * H;
        if (b.offsetWidth && st.clientWidth) this._boxW = b.offsetWidth / st.clientWidth * W;
      }
      const HALF = (this._boxH || 200) / 2;
      const stageK = st && st.clientHeight ? H / st.clientHeight : 1;
      const tailCss = clampN((b.offsetHeight || 120) * BUBBLE.tailLen, BUBBLE.tailLenMin, BUBBLE.tailLenMax);
      const GAP = tailCss * stageK + 6;
      const upY = box.y - ry - GAP - HALF;
      const dnY = (box.belowY !== undefined ? box.belowY : box.y + ry) + GAP + HALF;
      const upFits = upY - HALF > 0;
      const dnFits = dnY + HALF < H;
      let above, y;
      if (upFits) { above = true; y = upY; }
      else if (dnFits) { above = false; y = dnY; }
      else {
        // neither side fits: take the roomier one and clamp the box onto the stage
        above = (box.y - ry) > (H - (box.y + ry));
        y = clampN(above ? upY : dnY, HALF + 8, H - HALF - 8);
      }
      const halfW = Math.min((this._boxW || 420) / 2 + 12, W / 2);
      let bx = clampN(box.x, halfW, W - halfW);
      const signEl = this.root.getElementById('instruction-pill');
      const panel = this.root.getElementById('instruction');
      if (signEl && panel && !panel.hidden && st) {
        const sr = signEl.getBoundingClientRect(), sb = st.getBoundingClientRect();
        const kx = W / (st.clientWidth || 1), ky = H / (st.clientHeight || 1);
        const sRight = (sr.right - sb.left) * kx, sBottom = (sr.bottom - sb.top) * ky;
        if (y - HALF < sBottom + 8) bx = Math.max(bx, Math.min(sRight + halfW + 10, W - halfW));
      }
      b.style.left = pc(bx, W);
      b.style.top = pc(y, H);
      b.dataset.side = above ? 'above' : 'below';
      const boxW = this._boxW || 420;
      const aimX = box.aimX !== undefined ? box.aimX : box.x;
      const lean = aimX >= bx ? 1 : -1;
      const tipFrac = Math.min(BUBBLE.tailBaseMax / (b.offsetWidth || 400), BUBBLE.tailBase) * 0.62;
      const at = clampN(0.5 + (aimX - bx) / boxW - lean * tipFrac, 0.14, 0.86);
      const key = [above ? 'a' : 'b', at.toFixed(2), lean, text, b.offsetWidth, b.offsetHeight].join('|');
      if (this._bubbleKey !== key && this.el.shape) {
        this._bubbleKey = key;
        fitBubble(this.el.shape, b, { side: above ? 'below' : 'above', at, lean });
      }
    }
    if (fresh) {
      if (b) { b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; }
      // a bubble arriving pops: the kit's pop, or the local bloop
      if (keepBox && this.game.sfx) { try { this.game.sfx('popIn'); } catch (e) { /* silent is fine */ } }
    }
    const hd = this.el.hand;
    if (hd) {
      if (gesture) {
        hd.hidden = false;
        hd.dataset.gesture = gesture;      // CSS picks tap or sweep off this
        hd.style.left = pc(box.handX !== undefined ? box.handX : box.x, W);
        // a spot may keep a taller zone clear than where the hand belongs (handX, handY)
        hd.style.top = pc(box.handY !== undefined ? box.handY : box.y, H);
      } else if (!hd.hidden) hd.hidden = true;
    }
    // the box goes when it has been read; the hand carries on
    if (b) b.hidden = !keepBox;
    L.style.pointerEvents = 'none';
  }

  destroy() { this.resume(); }
}

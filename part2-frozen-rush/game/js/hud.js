// HUD controller — owns every DOM element outside the canvas and mirrors the

import { fitBubble } from './bubble.js';

export const KEY_WORD = /^(.*?\bthe\s+(?:[a-z]+\s+)*)([a-z]+?)(s?)([.!]?)$/i;

const HUD_LANG = (typeof globalThis !== 'undefined' && globalThis.I18N && globalThis.I18N.on) ? globalThis.I18N : null;
/** A translated question's parts, as KEY_WORD's: [, before, key, '', after]. */
function keyWordOf(marked) {
  const m = /^([\s\S]*?)<strong>([\s\S]*?)<\/strong>([\s\S]*)$/.exec(marked || '');
  return m ? [m[0], m[1], m[2], '', m[3]] : null;
}

export class Hud {
  /** A stage point where the zoomed canvas actually draws it. */
  static toView(view, p) {
    const k = view && view.k || 1;
    if (k <= 1.0005) return p;
    return { x: view.x + (p.x - view.x) * k, y: view.y + (p.y - view.y) * k };
  }

  constructor(root = document) {
    this.el = {
      pause: root.getElementById('btn-pause'),
      sound: root.getElementById('btn-sound'),
      sound2: root.getElementById('btn-sound2'),
      hint: root.getElementById('btn-hint'),
      restart: root.getElementById('btn-restart'),
      resume: root.getElementById('btn-resume'),
      paused: root.getElementById('paused'),
      hand: root.getElementById('hand-hint'),
      instruction: root.getElementById('instruction'),
      pill: root.getElementById('instruction-pill'),
      text: root.getElementById('instruction-text'),
      complete: root.getElementById('complete'),
      replay: root.getElementById('btn-replay'),
      rotate: root.getElementById('rotate')
    };
    this.paused = false;
    this.lastMessage = null;
    this._onResize = () => { this._fit = null; this.checkOrientation(); this.fitInstruction(); };
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { this._fit = null; this.fitInstruction(); }).catch(() => {});
    }
  }

  setGlyph(btn, name) { if (btn) btn.dataset.icon = name; }

  /** Pause and Resume are one control, so it swaps glyph rather than moving. */
  pauseLabel(isPaused) {
    this.setGlyph(this.el.pause, isPaused ? 'play' : 'pause');
    if (this.el.pause) this.el.pause.setAttribute('aria-label', HUD_LANG ? HUD_LANG.t(isPaused ? 'resumeButton' : 'pauseButton') : (isPaused ? 'Resume' : 'Pause'));
  }

  /** Sound state on both copies of the control, HUD and pause panel. */
  soundLabel(on) {
    for (const b of [this.el.sound, this.el.sound2]) {
      if (!b) continue;
      this.setGlyph(b, on ? 'sound-on' : 'sound-off');
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', HUD_LANG ? HUD_LANG.t(on ? 'soundOn' : 'soundOff') : (on ? 'Sound on' : 'Sound off'));
    }
  }

  updateHand(h) {
    const el = this.el.hand;
    if (!el) return;
    if (this._tutHand === undefined) {
      const d = el.ownerDocument || document;
      this._tutHand = d.getElementById('tut-hand');
      this._tutLayer = d.getElementById('tutorial');
    }
    const tutoring = this._tutHand && !this._tutHand.hidden &&
                     this._tutLayer && !this._tutLayer.hidden;
    if (!h.handHint || tutoring) { if (!el.hidden) el.hidden = true; return; }
    // the demonstration hand points at a rope, so it moves with the view as well
    const p = Hud.toView(h.view, h.handHint);
    el.style.left = (p.x / 1920 * 100).toFixed(2) + '%';
    el.style.top = (p.y / 1080 * 100).toFixed(2) + '%';
    if (el.hidden) el.hidden = false;
  }

  showWin(h) {
    if (window.Juice) {
      clearInterval(this._nudge);
      this._nudge = setInterval(() => {
        if (!this.el.complete || this.el.complete.hidden) { clearInterval(this._nudge); return; }
        try { Juice.nudge(this.el.replay); } catch (e) { clearInterval(this._nudge); }
      }, 3800);
    }
  }

  setInstruction(message) {
    const el = this.el.text;
    if (!el) return;
    const marked = HUD_LANG && message ? HUD_LANG.html(message) : null;
    if (marked != null) message = String(marked).replace(/<\/?strong>/g, '');
    const m = this._plain ? null : marked != null ? keyWordOf(String(marked).trim()) : KEY_WORD.exec((message || '').trim());
    el.textContent = '';
    this._voiceSpans = [];
    this._voiceTail = null;
    this._voiceScheduled = false;
    this._voiceWaitingAt = performance.now();
    let n = 0;
    const words = (message || '').trim().split(/\s+/).filter(Boolean).length || 1;
    this._voiceMeasured = !!(this._voId && this._voWords && this._voWords.length === words && this._soundOn);
    const step = this._voDur > 0 ? Math.min(0.55, Math.max(0.07, (this._voDur * 0.82) / Math.max(1, words - 1))) : 0.16;
    const word = (text, cls, space) => {
      if (!text) return;
      if (space && el.childNodes.length) el.appendChild(document.createTextNode(' '));
      const s = document.createElement('span');
      const punctuation = /^[.!?]+$/.test(text);
      s.className = this._voiceMeasured ? 'vo-pending' + (cls.includes('key') ? ' key' : '') : cls;
      if (this._voiceMeasured) {
        s.dataset.voiceClass = cls;
        if (punctuation) this._voiceTail = s;
        else this._voiceSpans.push(s);
      }
      s.style.setProperty('--i', n++);
      s.style.setProperty('--wd', step.toFixed(3) + 's');
      s.textContent = text;
      el.appendChild(s);
    };
    if (!m) {
      for (const w of (message || '').trim().split(/\s+/)) word(w, 'iw', true);
      this.fitInstruction();
      return;
    }
    for (const w of m[1].trim().split(/\s+/)) word(w, 'iw', true);
    word((m[2] + m[3]).toUpperCase(), 'iw key', true);
    if (marked != null) {
      m[4].split(/(\s+)/).filter(Boolean).reduce((gap, w) => { if (/^\s+$/.test(w)) return true; word(w, 'iw', gap); return true; }, false);
      this.fitInstruction();
      return;
    }
    word(m[4], 'iw', false);                                  // the sentence keeps its full stop
    this.fitInstruction();
  }

  syncVoice(game) {
    if (!this._voiceMeasured || !this._voiceSpans?.length || !game) return;
    const at = game.voAt(this._voId);
    const all = this._voiceTail ? [...this._voiceSpans, this._voiceTail] : this._voiceSpans;
    if (!this._voiceScheduled && at >= 0) {
      for (let i = 0; i < all.length; i++) {
        const s = all[i];
        s.style.animationDelay = ((this._voWords[Math.min(i, this._voWords.length - 1)] - at)).toFixed(3) + 's';
        s.className = s.dataset.voiceClass;
      }
      this._voiceScheduled = true;
    }
    if (this._voiceScheduled) {
      const state = game.paused ? 'paused' : 'running';
      for (const s of all) s.style.animationPlayState = state;
      if (at >= 0 && !game.paused) for (let i = 0; i < all.length; i++) {
        const onset = this._voWords[Math.min(i, this._voWords.length - 1)];
        if (at < onset + 0.025) continue;
        const animation = all[i].getAnimations()[0];
        if (animation && animation.effect.getComputedTiming().progress == null)
          all[i].style.animationDelay = (-Math.min(0.42, at - onset)).toFixed(3) + 's';
      }
      return;
    }
    const waited = performance.now() - this._voiceWaitingAt;
    const coming = !game.voComing || game.voComing(this._voId);
    if (!coming && waited > 60 && game.soundOn()) {
      all.forEach((s, i) => {
        s.style.animationDelay = (i * 0.07).toFixed(3) + 's';
        s.className = s.dataset.voiceClass;
      });
      this._voiceScheduled = true;
      return;
    }
    if (!game.soundOn() || waited > 5000) {
      for (const s of all) {
        s.style.animationDelay = '-1s';
        s.className = s.dataset.voiceClass;
      }
      this._voiceScheduled = true;
    }
  }

  setQuestions(sets) {
    const clean = a => (a || []).filter(s => typeof s === 'string' && s.trim()).map(s => HUD_LANG ? HUD_LANG.tr(s) : s);
    this._questions = { band: clean(sets && sets.band), centered: clean(sets && sets.centered) };
    this._fit = null;
    this.fitInstruction();
  }

  _room(pill) {
    if (!(pill.clientWidth > 0)) return 0;
    const cs = getComputedStyle(pill);
    const ceil = parseFloat(cs.maxWidth);
    const w = ceil > 0 ? ceil : pill.clientWidth;
    return w - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }

  /** Widest-sentence fit for the board as it is currently classed. */
  _measureFit(mode) {
    const el = this.el.text, pill = this.el.pill;
    const avail = this._room(pill);
    if (!(avail > 0)) return null;
    const fitFor = need => (need > 0 ? (avail * 0.94) / need : 1);
    const lines = this._questions && this._questions[mode];
    if (!lines || !lines.length) return fitFor(el.scrollWidth);
    const probe = el.cloneNode(false);
    probe.removeAttribute('id');
    probe.removeAttribute('aria-live');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;' +
                          'white-space:nowrap;pointer-events:none;';
    probe.style.setProperty('--fit', '1');
    pill.appendChild(probe);
    let worst = 1;
    try {
      for (const s of lines) {
        probe.textContent = s;
        worst = Math.min(worst, fitFor(probe.scrollWidth));
      }
    } finally {
      probe.remove();
    }
    return worst;
  }

  fitInstruction() {
    const el = this.el.text, pill = this.el.pill, root = this.el.instruction;
    if (!el || !pill) return;
    const banner = !!(root && root.classList.contains('banner'));
    const mode = (root && root.classList.contains('centered')) ? 'centered' : 'band';
    this._fit = this._fit || {};
    if (!banner && this._fit[mode] != null) { el.style.setProperty('--fit', this._fit[mode]); return; }
    el.style.setProperty('--fit', '1');
    const run = () => {
      const raw = banner ? (() => {
        const avail = this._room(pill);
        const need = el.scrollWidth;
        return (avail > 0 && need > 0) ? (avail * 0.94) / need : null;
      })() : this._measureFit(mode);
      if (raw == null) return;
      const fit = Math.max(0.62, Math.min(1, raw)).toFixed(3);
      if (!banner) this._fit[mode] = fit;
      el.style.setProperty('--fit', fit);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run); else run();
  }

  /** @param {{onPause:Function,onReplay:Function,onStamp?:Function}} handlers */
  bind(handlers) {
    this.handlers = handlers;

    const press = (btn, fn) => {
      if (!btn) return;
      btn.addEventListener('pointerdown', e => { e.preventDefault(); btn.classList.add('pressed'); if (window.Juice) { try { Juice.pop(btn, { power: 0.6 }); } catch (err) { /* no juice */ } } });
      const off = () => btn.classList.remove('pressed');
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('pointerleave', off);
      window.addEventListener('pointerup', off);
      btn.addEventListener('click', fn);
    };

    const setPaused = v => {
      this.paused = v;
      this.pauseLabel(v);
      if (this.el.paused) this.el.paused.hidden = !v;
      handlers.onPause(v);
    };
    press(this.el.pause, () => setPaused(!this.paused));
    press(this.el.resume, () => setPaused(false));
    press(this.el.restart, () => { setPaused(false); handlers.onReplay(); });

    const toggleSound = () => {
      const on = handlers.onSound ? handlers.onSound() : true;
      this.soundLabel(on);
    };
    press(this.el.sound, toggleSound);
    press(this.el.sound2, toggleSound);

    // the hint re-states the objective; it never points at the answer
    press(this.el.hint, () => {
      if (handlers.onHint) handlers.onHint();
      if (this.el.hint) this.el.hint.classList.remove('nudge');
    });

    this.el.replay.addEventListener('click', () => {
      this.paused = false;
      this.pauseLabel(false);
      if (this.el.paused) this.el.paused.hidden = true;
      handlers.onReplay();
    });

    // the banner's drawn shape follows its box when the window changes
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    this.checkOrientation();
  }

  /** Portrait phones get a rotate prompt rather than a squashed 16:9 stage. */
  checkOrientation() {
    const portrait = window.innerHeight > window.innerWidth * 1.05 && window.innerWidth < 900;
    this.el.rotate.hidden = !portrait;
  }

  /** Called by the engine only when its HUD state actually changes. */
  update(h) {
    const message = h.instruction || '';

    const el = this.el.instruction;
    this._voDur = h.voDur || 0;          // paces the fallback reveal
    this._voId = h.voId || '';
    this._voWords = h.voWords || null;
    this._soundOn = !!h.soundOn;
    this._plain = !!h.signBanner;
    if (el) el.classList.toggle('banner', !!h.signBanner);
    if (el) el.classList.toggle('centered', !!h.signCentre);
    const outOfSync = message && (el.hidden || el.classList.contains('leaving'));
    if (message !== this.lastMessage || outOfSync) {
      const isNewLine = message !== this.lastMessage;
      this.lastMessage = message;
      if (message) {
        clearTimeout(this._leaveT);
        this.setInstruction(message);
        el.hidden = false;
        el.classList.remove('leaving');
        const now = performance.now();
        if (isNewLine && !(this._dropAt && now - this._dropAt < 760)) {
          this._dropAt = now;
          this.el.pill.style.animation = 'none';
          void this.el.pill.offsetWidth;
          this.el.pill.style.animation = '';
        }
      } else {
        // slide away instead of vanishing on a display:none flip
        this.el.instruction.classList.add('leaving');
        clearTimeout(this._leaveT);
        this._leaveT = setTimeout(() => {
          if (this.el.instruction.classList.contains('leaving')) this.el.instruction.hidden = true;
        }, 300);
      }
    }

    this.updateHand(h);
    if (this._soundWas !== h.soundOn) { this._soundWas = h.soundOn; this.soundLabel(h.soundOn); }
    // the hint asks for attention only once the learner has been stuck a while
    if (this.el.hint) this.el.hint.classList.toggle('nudge', !!h.hintNudge);

    // TEMPORARY review control: up whenever the game is playable and not yet complete

    if (this.el.complete.hidden === h.complete) {
      this.el.complete.hidden = !h.complete;
      if (h.complete) this.showWin(h);
    }

  }

  destroy() {
    clearTimeout(this._leaveT);
    clearTimeout(this._flashT);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
  }
}

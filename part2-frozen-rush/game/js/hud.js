/* HUD controller — owns every DOM element outside the canvas and mirrors the
   engine's HUD state onto it. The engine never touches the DOM itself. */

import { fitBubble } from './bubble.js';

/* THE WORD THE QUESTION IS ABOUT, which is set apart in capitals and blue.
 *
 * This was /^(.*?\bthe\s+)([a-z]+?)(s?)([.!]?)$/i — everything up to "the", then ONE
 * word, then the full stop. Right for Part 1, whose questions were "Cut the TRIANGLE.";
 * wrong for every question this game now asks, because Part 2's curriculum puts an
 * adjective in front of the noun. Measured across the nine: EIGHT of them failed to
 * match and were rendered with no highlight at all. Only "Draw all the diagonals."
 * still worked, which is why it went unnoticed — the one line anybody spot-checked.
 *
 * It is the same assumption that made voIdFor() silent for the six rope crossings, and
 * it is fixed the same way: allow any number of words between "the" and the noun, and
 * highlight the LAST of them.
 *
 * Exported because the tests assert what the board renders and were carrying their own
 * copy of the old pattern — two copies of a rule is how they drifted apart in the first
 * place. A tutorial sentence is never run through this (see `_plain`/signBanner): the
 * key-word treatment is for questions. */
export const KEY_WORD = /^(.*?\bthe\s+(?:[a-z]+\s+)*)([a-z]+?)(s?)([.!]?)$/i;

/* THE GAME'S LANGUAGE (js/i18n.js, ?lan=hi and the rest), or null in English — when every word
   below is the one it always was. The engine keeps telling the HUD its English; the HUD shows it
   in the language. A translated question carries its own key word, marked <strong>, because no
   English pattern can find a noun in Hindi: "अवतल <strong>बहुभुज</strong> को काटें।" */
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
      /* hint / sound / pause are gone from the markup. The lookups stay because every
         use of them is already guarded — press() ignores a missing button, and the
         label helpers skip a null — so the pause panel's own controls keep working if
         anything ever opens it again. */
      pause: root.getElementById('btn-pause'),
      sound: root.getElementById('btn-sound'),
      sound2: root.getElementById('btn-sound2'),
      hint: root.getElementById('btn-hint'),
      restart: root.getElementById('btn-restart'),
      resume: root.getElementById('btn-resume'),
      paused: root.getElementById('paused'),
      hand: root.getElementById('hand-hint'),
      /* No jump button any more (see index.html): the stage is the control. The lookup
         is gone with it rather than kept guarded — a lookup with no user is how a dead
         element gets wired back up by the next person reading this file. */
      instruction: root.getElementById('instruction'),
      pill: root.getElementById('instruction-pill'),
      text: root.getElementById('instruction-text'),
      /* No `sub` lookup: the second line on the board was removed (see index.html).
         A lookup with no user is how a dead element gets wired back up by the next
         person reading this file — the same rule the pause and hint lookups above
         are kept under, and they at least still have callers. */
      complete: root.getElementById('complete'),
      replay: root.getElementById('btn-replay'),
      /* oops and retry are gone from the markup: a crash recovers by itself now and
         there is no failure panel. The lookups are not kept "just in case" — every
         use of them went with them, and a lookup with no user is how a dead element
         gets resurrected by the next person reading this file. */
      rotate: root.getElementById('rotate')
    };
    this.paused = false;
    this.lastMessage = null;
    /* The board's one type size is measured in pixels, so it is only valid for the stage
       it was measured at — and only for the face it was measured in. A resize invalidates
       it, and so does Baloo 2 arriving after the first paint: measured in the fallback
       face the longest question needs a different ratio than it does in the real one. */
    this._onResize = () => { this._fit = null; this.checkOrientation(); this.fitInstruction(); };
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { this._fit = null; this.fitInstruction(); }).catch(() => {});
    }
  }

  /* Pick an icon by NAME. The mask URLs live in the stylesheet: a url() inside a
     custom property is resolved against the sheet that consumes it, not the
     document, so setting them inline resolved every glyph to /css/assets/... and
     404'd. A data attribute cannot go wrong that way. */
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

  /* There is no verdict mark any more. A tick and a cross used to be positioned here,
     over the crossing; a right answer now throws confetti from the engine's own
     particle layer and a wrong one gets no mark at all — see cutShape(). */

  /* The idle hand. Positioned in stage coordinates converted to percentages, so it
     lands on the rope at any viewport size rather than at a fixed pixel offset. */
  updateHand(h) {
    const el = this.el.hand;
    if (!el) return;
    /* ONE HAND, EVER. The tutorial puts its own hand on the rope for the cut step
       and this idle hint fires after 13s of no input — which the tutorial spends
       waiting for exactly that swipe. So both were up together, two hands on two
       different animations demonstrating the same gesture. The tutorial’s is the
       one that stays: it is placed on the rope the step is about, and it is the
       hand the player was already being taught to follow. */
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

  /* THE ENDING'S BANNER. The coins are gone (see index.html): the words are the reward, so all
     this does is fit the speech shape to the box they need. */
  showWin(h) {
    /* The banner's shape is drawn for the box the words need — the same bubble as the
       tutorial's, without a tail (nobody in particular is saying it). Once now, and again
       after the pop-in has settled, because the box measures differently mid-bounce. */
    /* NO ENDING BANNER TO FIT. It was a drawn speech shape sized to its words; the whole
       panel was removed so the dance is what the ending shows. */
    if (window.Juice) {
      clearInterval(this._nudge);
      this._nudge = setInterval(() => {
        if (!this.el.complete || this.el.complete.hidden) { clearInterval(this._nudge); return; }
        try { Juice.nudge(this.el.replay); } catch (e) { clearInterval(this._nudge); }
      }, 3800);
    }
  }

  /* THE POLYGON'S NAME IS SET APART IN THE SENTENCE — "Cut the TRIANGLE", "Cut all the
     QUADRILATERALS.": the noun in capitals, heavier and in the game's key-word blue, the full
     stop kept (the owner's own wording). The engine's sentence is untouched (tests and the
     recall path read it); this is how it is shown. A sentence that does not fit the pattern
     is shown whole. */
  /** The sentence, WORD BY WORD so each can ease in (see .instruction-text .iw). The polygon's
      name keeps its `key` class — the tests and the blue styling both look for it — and the full
      stop is its own span with no space before it, so it stays tight against the name. */
  setInstruction(message) {
    const el = this.el.text;
    if (!el) return;
    // in the game's language, the key word the translation marks; in English, the pattern's
    const marked = HUD_LANG && message ? HUD_LANG.html(message) : null;
    if (marked != null) message = String(marked).replace(/<\/?strong>/g, '');
    const m = this._plain ? null : marked != null ? keyWordOf(String(marked).trim()) : KEY_WORD.exec((message || '').trim());
    el.textContent = '';
    this._voiceSpans = [];
    this._voiceTail = null;
    this._voiceScheduled = false;
    this._voiceWaitingAt = performance.now();
    let n = 0;
    /* IN STEP WITH THE VOICE, like the dialogue: when the question is spoken the reveal is
       spread across the clip. The engine hands the seconds over in the HUD state. */
    const words = (message || '').trim().split(/\s+/).filter(Boolean).length || 1;
    this._voiceMeasured = !!(this._voId && this._voWords && this._voWords.length === words && this._soundOn);
    // spread across the whole spoken line, measured on the last word (see Tutorial.setWords)
    /* WITHOUT A VOICE THE REVEAL WAS 0.21 SECONDS. The stagger falls back to 0.07s a
       word, so a four-word question finished revealing in 0.21s while each word's own
       ease is 420ms — every word was still animating when the last one started, which
       reads as one pop rather than as a sentence arriving. The whole point of the
       word-at-a-time treatment was invisible.
       0.16 spreads a four-word line over about half a second and a seven-word one over
       a second, which is close to the pace a recording would set. When there IS a
       recording voDur wins, exactly as before — this only changes the silent case. */
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
      /* A TRANSLATION GOES ON AFTER ITS KEY WORD: a case ending joined to it (Odia's
         "ବହୁଭୁଜ" + "କୁ") without a space, then the rest of the sentence word by word */
      m[4].split(/(\s+)/).filter(Boolean).reduce((gap, w) => { if (/^\s+$/.test(w)) return true; word(w, 'iw', gap); return true; }, false);
      this.fitInstruction();
      return;
    }
    word(m[4], 'iw', false);                                  // the sentence keeps its full stop
    this.fitInstruction();
  }

  /** Schedule each word against the real audio clock. CSS carries the timing after
      this one call, so a slow render frame cannot delay two short words at once. */
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
    /* AND NEVER FOR A VOICE THAT IS NOT COMING. The words used to wait up to five seconds for
       their line whatever had become of it — and after a missed stroke the plank goes back to
       the question, whose voice was spoken when it was first asked and is not spoken again. So
       the plank sat on screen EMPTY for five seconds after every miss (measured on all three
       crossings). Words wait only while their line is being spoken or held to be spoken next;
       otherwise they come in at the silent pace, a beat after the plank (the beat is for a line
       whose say() lands on the next tick). */
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

  /* THE SENTENCE IS FITTED TO THE BOARD — the board is never fitted to the sentence.
   *
   * It used to be the other way round: the plank was shrink-to-fit, so its width was
   * whatever the words needed. The middle of the plank is ONE PIECE OF ART stretched
   * across that width (plank-m, 1498x478, see the background rules), so the wood grain
   * and the snow along the top were scaled horizontally by however long the question
   * happened to be. Measured across the nine: between 1.40x and 2.50x, a different
   * amount every time. That is the "squeezed, not natural" report — the grain smears,
   * the snowdrifts stretch into streaks, and because it changes per question the sign
   * never reads as the same physical object twice.
   *
   * A real sign is one plank. So the plank is now a fixed width (see the CSS) and the
   * TYPE gives way instead, which is what signwriting has always done: the stretch is
   * one constant value for every question, and a long sentence is simply set smaller on
   * the same board.
   *
   * UPDATE: the board hugs its sentence again, but without the smear. Its WIDTH follows
   * the words, capped at the fixed length this describes, and the middle art is cropped
   * at its own aspect instead of stretched (see .instruction-pill::before). The TYPE SIZE
   * is still fitted as below, against that cap, so it stays one size for the game.
   *
   * Measured rather than guessed, because the font is loaded late and its metrics are
   * not knowable from the string: the words are laid out at full size, the overflow is
   * read off the layout, and --fit scales the type down only if there is one. Most
   * questions need no scaling at all and get --fit 1.
   *
   * scrollWidth, not getBoundingClientRect: the words animate in on a transform and a
   * measured rect would be whatever the scale was on that frame. scrollWidth is layout,
   * which transforms do not touch.
   */
  /* ONE SIZE FOR EVERY QUESTION, NOT ONE SIZE PER QUESTION.
   *
   * This used to measure the sentence that happened to be up and scale the type to it.
   * Each question fitted its own board, so the type was a different size on nearly every
   * crossing — "Cut the convex polygon." set large, "Draw 2 diagonals from the same
   * vertex." set small — and the sign changed character as you played. That is the
   * "text size is not constant in whole game" report, and it is the same fault the plank
   * itself had before it was given a fixed width: something that should be one physical
   * object being rebuilt to suit each string.
   *
   * So the fit is now measured ACROSS EVERY QUESTION THE GAME CAN ASK, once, and the
   * smallest one wins. The longest sentence is the one that sets the type size, exactly
   * as a signwriter would lay out a set of signs; every shorter question is set at that
   * same size with more clear wood either side. Nothing ever overflows, because the
   * sentence that defines the size is by construction the one that fits worst.
   *
   * The corpus comes from setQuestions() (main.js passes it from CFG), so a question
   * added later is measured with the rest and cannot silently push a line off the plank.
   * With no corpus it falls back to fitting the current sentence, which is what a
   * banner line — a different element with its own width — still does.
   */
  /* TWO BOARDS, MEASURED SEPARATELY. The six rope crossings sit in the left band, where
     the plank is 33 stage units — all the option row leaves room for. Part 2's three sit
     in the middle, where there is no option row and the plank is 40u. Different widths
     hold different sentences, so each is fitted to its own longest and the two land at
     the same type size rather than one being shrunk to the other's constraint.
     @param {{band?: string[], centered?: string[]}} sets */
  setQuestions(sets) {
    // (measured in the words the board will show: the game's language, when it has one)
    const clean = a => (a || []).filter(s => typeof s === 'string' && s.trim()).map(s => HUD_LANG ? HUD_LANG.tr(s) : s);
    this._questions = { band: clean(sets && sets.band), centered: clean(sets && sets.centered) };
    this._fit = null;
    this.fitInstruction();
  }

  /* THE ROOM ON THE LONGEST BOARD, not on the board as it stands. The plank hugs its
     sentence now (see .instruction-pill), so its current width is the words it happens
     to hold, and fitting to that would only ever confirm the size already set. The
     ceiling is max-width; clientWidth is kept as the "is it laid out at all" check,
     because a hidden board measures nothing and must not cache a fit of 1. */
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
    /* NINETY-FOUR PER CENT OF THE SPACE, NOT ALL OF IT. Filling it exactly means the
       sentence that sets the size ends up flush against the caps with no clear wood at
       all. Leaving a margin in the fit gives every line some wood either side. */
    const fitFor = need => (need > 0 ? (avail * 0.94) / need : 1);
    const lines = this._questions && this._questions[mode];
    if (!lines || !lines.length) return fitFor(el.scrollWidth);
    /* MEASURED IN A PROBE, NOT IN THE LIVE ELEMENT.
     *
     * The first version wrote each sentence into #instruction-text and put the real words
     * back afterwards. That is synchronous and never paints, but it does mean the board
     * briefly HOLDS a sentence it is not showing — and anything that reads the DOM from
     * outside this call (a test, an assistive tool, a MutationObserver) can be handed it.
     * The plank is the one element in the game whose contents are an assertion about what
     * the learner is being asked, so it is not the place to scribble.
     *
     * The probe is a clone with the same class inside the same pill, so it inherits every
     * font rule including --k, and it is measured in the REAL face — Baloo 2 loads late
     * and a detached element with fallback metrics would size the board to the wrong one.
     * visibility:hidden keeps it out of the picture; absolute keeps it out of the layout. */
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
    /* A banner is a different board — wider, and its own type size (see the .banner
       rules) — so it keeps fitting the line it is showing. Only the question board,
       the one the player sees on all nine crossings, is held constant. */
    const banner = !!(root && root.classList.contains('banner'));
    const mode = (root && root.classList.contains('centered')) ? 'centered' : 'band';
    this._fit = this._fit || {};
    if (!banner && this._fit[mode] != null) { el.style.setProperty('--fit', this._fit[mode]); return; }
    el.style.setProperty('--fit', '1');
    /* Deferred one frame: called straight after the words are appended, the pill has
       not been laid out at the new content yet and clientWidth is the previous
       question's. */
    const run = () => {
      const raw = banner ? (() => {
        const avail = this._room(pill);
        const need = el.scrollWidth;
        return (avail > 0 && need > 0) ? (avail * 0.94) / need : null;
      })() : this._measureFit(mode);
      if (raw == null) return;
      /* A floor at 0.62. Below that the type is too small to be the thing you look at,
         and a sentence that cannot fit even then should be shortened rather than shrunk. */
      const fit = Math.max(0.62, Math.min(1, raw)).toFixed(3);
      if (!banner) this._fit[mode] = fit;
      el.style.setProperty('--fit', fit);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run); else run();
  }

  /** @param {{onPause:Function,onReplay:Function,onStamp?:Function}} handlers */
  bind(handlers) {
    this.handlers = handlers;

    // pointerdown (not click) so a tap registers on the same frame it lands.
    // preventDefault also suppresses the browser's own :active state, so the
    // pressed look has to be driven by a class or the button never appears to move.
    // TEMPORARY review control: jump to the ending. Guarded like every other lookup.

    /* NOTHING HERE BINDS A JUMP. The jump is a tap on the stage, which the engine reads
       off the canvas itself — there is no DOM control to press, to swap art on, to
       restart a ring on, or to keep in step with the keyboard. */

    // every icon button gets the same press feedback, so the whole cluster behaves
    // as one family
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

    /* NO "TRY AGAIN" BINDING, and no keyboard/pointer tracking behind it. Both belonged
       to the Ouch card: the binding to its button, and the two capture-phase listeners to
       a `_kbd` flag that decided whether opening the card should focus that button. The
       card is gone (a crash plays out and the run resumes on its own — see OBSTACLE_HIT),
       so the button has no element, the flag had no reader, and the listeners ran on every
       key and pointer press for the whole session to maintain it. The engine's
       retryObstacle() is untouched: it is called by the engine itself, not from here. */

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
    /* `h.helper` is gone from the payload. It was a second instruction line, removed
       on request, and G.helper had been pinned to the empty string ever since — so
       `h.helper || h.instruction` was provably just h.instruction. */
    const message = h.instruction || '';

    /* SHOWN WHENEVER THERE IS SOMETHING TO SAY, not only when the line CHANGES.
     *
     * This was a diff-driven state machine: it acted only when `message` differed from
     * the last one it had seen. That leaves the element stuck if anything hides it by
     * any other route, because the message has not changed so nothing puts it back.
     * Observed exactly that — engine state PHASE_ACTIVE with "Cut the triangle." in
     * G.instruction, and the element sitting at `class="instruction leaving"`,
     * `hidden=true`, with the right text inside it. The one thing telling the learner
     * what to look for was invisible for the whole phase.
     *
     * The re-assert costs a couple of property reads per HUD push and cannot get
     * stuck: if there is a message and the element is not showing it, it shows it.
     * The entrance animation is still only restarted for a genuinely NEW line, so a
     * re-assert does not make the pill flash. */
    /* NO PROGRESS TRAIL (the user: "remove the left side progress bar"). The journey card
       that sat in the sky at the top left — Momo, the stones and the cave — is never shown:
       it stays `hidden`, as the markup leaves it, and nothing is built into it, so none of
       its art is fetched either. (setTrail is left in place, unused; the question board
       that shared the left band with it now has the band to itself.) */

    const el = this.el.instruction;
    this._voDur = h.voDur || 0;          // paces the fallback reveal
    this._voId = h.voId || '';
    this._voWords = h.voWords || null;
    this._soundOn = !!h.soundOn;
    /* A BANNER IS A SENTENCE, NOT A QUESTION. The key-word treatment takes the noun after "the"
       and sets it in capitals and blue — right for "Cut the TRIANGLE.", wrong for the teaching
       line, where it produced "Use the right ice piece to fix the PATH." */
    this._plain = !!h.signBanner;
    // a tutorial sentence is a wide banner; a question sits in its left band (see the CSS)
    if (el) el.classList.toggle('banner', !!h.signBanner);
    /* PART 2 CENTRES THE QUESTION. Part 1's plank lives in the left band to stay clear
       of the hanging row; Part 2's crossing has one block, brought to the middle of the
       stage, so the left band is not where the eye is and a sign parked there reads as
       abandoned. A class on the same element — same board, same type, moved. */
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
        /* RESTART THE DROP ONLY FOR A NEW LINE, NEVER FOR A RE-ASSERT — and never while one
           is still running. Two things can ask for the panel in quick succession: the staged
           intro handing the plank from the tutorial's teaching line to the phase's question,
           and a rapid tap or a scene change arriving on top of that. Restarting mid-fall
           snaps the plank back above the frame and drops it again, which is the overlapping
           animation this guards. The drop is 760ms (signDrop in style.css); inside that
           window a new line changes the words and keeps the fall it is already making. */
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

    /* NO FAILURE PANEL TO SYNC. This block showed the Ouch card and, when it opened,
       focused TRY AGAIN so a keyboard player could press Space straight away. Both are
       gone with the card: a crash plays out and the run resumes at the nearest
       checkpoint by itself, so there is nothing to open and nothing to focus. */
  }

  destroy() {
    clearTimeout(this._leaveT);
    clearTimeout(this._flashT);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
  }
}

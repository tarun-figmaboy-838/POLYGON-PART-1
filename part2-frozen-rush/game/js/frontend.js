// Cover -> gameplay.
export class Frontend {
  constructor(root, game) {
    this.game = game;
    this.root = root;
    this.el = {
      cover: root.getElementById('cover'),
      play: root.getElementById('btn-play'),
      loadingNote: root.getElementById('cover-loading'),
      loadingFill: root.getElementById('cover-loading-fill'),
      loadingLabel: root.getElementById('cover-loading-label')
    };
    this.state = 'ENTERING';
    this._timers = [];
  }

  /** @param {{onStart:Function, onPress?:Function}} handlers */
  init(handlers) {
    this.handlers = handlers;
    this.bind();
    this.el.cover.hidden = false;
    this.state = 'IDLE';
  }

  setLoading(v) {
    this.loading = !!v;
    this.el.cover.classList.toggle('loading', this.loading);
    if (this.el.play) this.el.play.setAttribute('aria-disabled', this.loading ? 'true' : 'false');
    if (this.el.loadingNote) this.el.loadingNote.hidden = !this.loading;
    if (this.loading) this.setProgress(this._progress || 0);
    if (!this.loading && this.pendingStart) { this.pendingStart = false; this.wait(560, () => this.start()); }
  }

  /** The loading bar, 0..1 — forward only (engine.js NET already never goes back). */
  setProgress(f) {
    this._progress = Math.max(this._progress || 0, Math.min(1, f || 0));
    const pct = Math.floor(this._progress * 100);
    if (this.el.loadingFill) this.el.loadingFill.style.width = pct + '%';
    // (in the game's language, js/i18n.js ?lan=, when it has one)
    const lan = typeof globalThis !== 'undefined' && globalThis.I18N && globalThis.I18N.on ? globalThis.I18N : null;
    if (this.el.loadingLabel) this.el.loadingLabel.textContent = lan ? lan.t('loadingPercent', { percent: pct }) : 'Loading… ' + pct + '%';
    if (this.el.loadingNote) this.el.loadingNote.setAttribute('aria-valuenow', String(pct));
  }

  bind() {
    const press = (btn, fn) => {
      if (!btn) return;
      // pointerdown + preventDefault kills :active, so drive the pressed look here
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        btn.classList.add('pressed');
      });
      const up = () => btn.classList.remove('pressed');
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointerleave', up);
      btn.addEventListener('pointercancel', up);
      window.addEventListener('pointerup', up);
      btn.addEventListener('click', fn);
    };

    press(this.el.play, () => this.start());

    this._onKey = e => {
      if (this.el.cover.hidden) return;
      if (e.key === 'Enter' || e.code === 'Space') { e.preventDefault(); this.start(); }
    };
    window.addEventListener('keydown', this._onKey);
  }

  /** Use the game's own sound palette, so the screens and the game agree. */
  sfx(name) { if (this.game.sfx) this.game.sfx(name); }

  /** The cover slides away and the run begins. */
  start() {
    if (this.loading) { this.pendingStart = true; return; }   // it waits for the last file, then goes
    if (this.state === 'READY') return;
    this.state = 'READY';
    this.sfx('ui');
    if (this.handlers && this.handlers.onPress) { try { this.handlers.onPress(); } catch (e) { /* the host's */ } }

    this.el.cover.classList.add('leaving');
    this.wait(400, () => {
      this.el.cover.hidden = true;
      this.el.cover.classList.remove('leaving');
      this.state = 'EXITING';
      if (this.handlers && this.handlers.onStart) this.handlers.onStart();
    });
  }

  wait(ms, fn) { const t = setTimeout(fn, ms); this._timers.push(t); return t; }

  destroy() {
    this._timers.forEach(clearTimeout);
    window.removeEventListener('keydown', this._onKey);
  }
}

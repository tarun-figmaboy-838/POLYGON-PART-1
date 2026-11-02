// director.js — runs each screen as a paced sequence of awaitable beats.
(function (global) {
  'use strict';

  var DEFAULTS = {
    msPerWord: 280,
    sayMinMs: 900,
    readablePauseMs: 400,
    sayMaxMs: 9000,
    beatCeilingMs: 12000,
    // A brief hold after feedback so it registers before anything moves.
    feedbackSettleMs: 500
  };

  /* The states, by name. Exposed so a caller never has to spell one. */
  var STATES = {
    IDLE: 'IDLE', ENTERING: 'ENTERING',
    DIALOGUE_REVEAL: 'DIALOGUE_REVEAL', DIALOGUE_READING: 'DIALOGUE_READING',
    WAITING_FOR_USER: 'WAITING_FOR_USER', USER_INTERACTING: 'USER_INTERACTING',
    CHECKING: 'CHECKING', FEEDBACK: 'FEEDBACK', EXITING: 'EXITING', NEXT_STEP: 'NEXT_STEP'
  };

  function Token() {
    this.cancelled = false;
    this._fns = [];
  }
  Token.prototype.onCancel = function (fn) {
    if (this.cancelled) { try { fn(); } catch (e) {} return; }
    this._fns.push(fn);
  };
  Token.prototype.cancel = function () {
    if (this.cancelled) return;
    this.cancelled = true;
    var fns = this._fns; this._fns = [];
    for (var i = 0; i < fns.length; i++) { try { fns[i](); } catch (e) {} }
  };

  var CANCELLED = { cancelled: true };

  /** Sleep that resolves early (as cancelled) when the token fires. */
  function sleep(ms, token) {
    return new Promise(function (resolve) {
      if (token.cancelled) return resolve(CANCELLED);
      var id = setTimeout(function () { resolve(); }, Math.max(0, ms));
      token.onCancel(function () { clearTimeout(id); resolve(CANCELLED); });
    });
  }

  function guard(promiseLike, token, ceiling) {
    return new Promise(function (resolve) {
      var done = false;
      function finish(v) { if (done) return; done = true; clearTimeout(id); resolve(v); }
      var id = setTimeout(function () { finish({ timedOut: true }); }, ceiling);
      token.onCancel(function () { finish(CANCELLED); });
      Promise.resolve(promiseLike).then(finish, function (err) {
        if (global.console) console.warn('Director: beat failed, continuing —', err && err.message || err);
        finish({ failed: true });
      });
    });
  }

  function words(s) { return String(s || '').trim().split(/\s+/).filter(Boolean).length; }

  function lineTypeAt(beats, i) {
    var T = global.Timing;
    if (T && T.lineType) { try { return T.lineType(beats, i); } catch (e) {} }
    return 'narration';
  }

  function settledByAt(beats, i) {
    var T = global.Timing, own = beats[i] && beats[i].say;
    if (!T || !T.repeats || typeof own !== 'string') return null;
    for (var k = i + 1; k < beats.length; k++) {
      var b = beats[k];
      if (!b || typeof b !== 'object') continue;
      if (b.say != null) return null;
      if (typeof b.instruction === 'string') return T.repeats(b.instruction, own) ? b.instruction : null;
      if (b.input || b.branch != null) return null;
    }
    return null;
  }

  function create(handlers, options) {
    handlers = handlers || {};
    var cfg = {};
    for (var k in DEFAULTS) cfg[k] = DEFAULTS[k];
    for (var o in (options || {})) if (o in cfg) cfg[o] = options[o];

    var current = null;      // token for the running sequence
    var skipRequested = null;// resolver for the current skippable beat
    var listeners = {};
    var state = STATES.IDLE;

    function emit(name, payload) {
      var list = (listeners[name] || []).slice();
      for (var i = 0; i < list.length; i++) { try { list[i](payload); } catch (e) {} }
    }

    /* ONE STATE AT A TIME, and every change said out loud. */
    function setState(to, info) {
      if (!to || to === state) return;
      var from = state; state = to;
      emit('state', { from: from, to: to, info: info || null });
    }

    function ctxFor(token) {
      return {
        signal: token,
        onCancel: function (fn) { token.onCancel(fn); },
        cfg: cfg,
        phase: function (name) {
          if (token !== current || token.cancelled) return;
          if (name === 'reading') setState(STATES.DIALOGUE_READING);
          else if (name === 'reveal') setState(STATES.DIALOGUE_REVEAL);
        }
      };
    }

    function call(name, args) {
      var fn = handlers[name];
      if (typeof fn !== 'function') return Promise.resolve();
      try { return Promise.resolve(fn.apply(null, args)); }
      catch (e) { return Promise.reject(e); }
    }

    /* --- individual beats ----------------------------------------- */

    function beatWait(beat, token) {
      return sleep(beat.wait, token);
    }

    function beatSay(beat, token, info) {
      var text = beat.say;
      var type = (info && info.type) || 'narration';
      var reading = Math.min(cfg.sayMaxMs, Math.max(cfg.sayMinMs, words(text) * cfg.msPerWord + 400));
      var ctx = ctxFor(token);
      var started = Date.now();
      var hasHandler = typeof handlers.say === 'function';

      setState(STATES.DIALOGUE_REVEAL, { text: text, type: type });
      emit('say', { text: text, vo: beat.vo, type: type });
      lastWasSpeech = true;
      var voDone = guard(call('say', [text, { vo: beat.vo, reading: reading, parts: beat.parts, type: type, settledBy: info && info.settledBy, faces: beat.faces, endsAt: beat.endsAt }, ctx]), token, cfg.beatCeilingMs)
        .then(function (r) {
          if (r && (r.failed || r.timedOut)) return sleep(Math.max(0, reading - (Date.now() - started)), token);
          return r;
        });

      var floor = sleep(hasHandler ? cfg.sayMinMs : reading, token);
      var skip = new Promise(function (resolve) { skipRequested = resolve; });

      return Promise.race([
        Promise.all([voDone, floor]),
        skip.then(function () {
          // enforce the minimum even on skip
          var elapsed = Date.now() - started;
          return sleep(Math.max(0, cfg.sayMinMs - elapsed), token);
        })
      ]).then(function (r) {
        skipRequested = null;
        return r;
      });
    }

    function beatInstruction(beat, token, info) {
      var type = (info && info.type) || 'narration';
      if (beat.instruction) setState(STATES.DIALOGUE_REVEAL, { text: beat.instruction, type: type });
      emit('instruction', { text: beat.instruction, type: type });
      if (beat.instruction) lastWasSpeech = true;
      var opts = {};
      for (var key in beat) opts[key] = beat[key];
      opts.type = type;
      return guard(call('instruction', [beat.instruction, opts, ctxFor(token)]), token, cfg.beatCeilingMs);
    }

    function beatSwiftee(beat, token) {
      emit('swiftee', { state: beat.swiftee, opts: beat });
      var p = call('swiftee', [beat.swiftee, beat, ctxFor(token)]);
      var transitional = /^(enter|exit|move|hop|perch)$/.test(beat.swiftee);
      if (beat.await === false || (!transitional && beat.await !== true)) return Promise.resolve();
      return guard(p, token, cfg.beatCeilingMs);
    }

    function beatFocus(beat, token) {
      emit('focus', { target: beat.focus, opts: beat });
      return guard(call('focus', [beat.focus, beat, ctxFor(token)]), token, cfg.beatCeilingMs);
    }

    function beatStage(beat, token) {
      emit('stage', beat.stage);
      return guard(call('stage', [beat.stage, ctxFor(token)]), token, cfg.beatCeilingMs);
    }

    function beatSfx(beat) {
      call('sfx', [beat.sfx, beat]).catch(function () {});
      return Promise.resolve();
    }

    function beatJuice(beat) {
      call('juice', [beat.juice, beat.target, beat]).catch(function () {});
      return Promise.resolve();
    }

    var lastWasSpeech = false;

    function beatInput(beat, token) {
      var settle = lastWasSpeech ? sleep(cfg.readablePauseMs, token) : Promise.resolve();
      lastWasSpeech = false;
      return settle.then(function (r) {
        if (r === CANCELLED || token.cancelled) return CANCELLED;
        return armInput(beat, token);
      });
    }

    function armInput(beat, token) {
      setState(STATES.WAITING_FOR_USER, { spec: beat.input });
      emit('input', { spec: beat.input });
      emit('interaction:enabled', { spec: beat.input });
      return new Promise(function (resolve) {
        if (token.cancelled) return resolve(CANCELLED);
        token.onCancel(function () { resolve(CANCELLED); });
        call('input', [beat.input, ctxFor(token)]).then(resolve, function (err) {
          if (global.console) console.warn('Director: input handler failed —', err && err.message || err);
          resolve({ failed: true });
        });
      }).then(function (r) {
        if (r !== CANCELLED && token === current) {
          setState(STATES.CHECKING, { result: r && r.result });
          emit('interaction:complete', { spec: beat.input, result: r && r.result, detail: r });
        }
        return r;
      });
    }

    function beatBranch(beat, token, state) {
      var key = state.last && state.last.result != null ? String(state.last.result) : 'otherwise';
      var list = beat.on && beat.on[key] || beat.otherwise || [];
      var asked = state.last;
      return inFeedback(list, token, state, key, function () { return runList(list, token, state); }).then(function (r) {
        if (r === CANCELLED || token.cancelled) return CANCELLED;
        if (beat.until != null && key !== String(beat.until) && state.last !== asked) return beatBranch(beat, token, state);
        return r;
      });
    }

    function inFeedback(list, token, st, key, body) {
      setState(STATES.FEEDBACK, { result: key });
      emit('feedback:start', { result: key });
      return body().then(function (r) {
        if (r !== CANCELLED && token === current) emit('feedback:complete', { result: key });
        return r;
      });
    }

    /* --- the loop --------------------------------------------------- */

    function runBeat(beat, token, state, info) {
      if (token.cancelled) return Promise.resolve(CANCELLED);
      if (typeof beat === 'number') return sleep(beat, token);
      if (typeof beat === 'function') {
        return guard(beat(state, ctxFor(token)), token, cfg.beatCeilingMs);
      }
      if (beat.stage != null)       return beatStage(beat, token);
      if (beat.wait != null)        return beatWait(beat, token);
      if (beat.say != null && beat.alt && beat.alt.if && typeof handlers.test === 'function') {
        var useAlt = false;
        try { useAlt = !!handlers.test(beat.alt.if); } catch (e) { useAlt = false; }
        if (useAlt) beat = Object.assign({}, beat, beat.alt, { alt: null });
      }
      if (beat.say != null)         return beatSay(beat, token, info);
      if (beat.instruction != null) return beatInstruction(beat, token, info);
      if (beat.swiftee != null)     return beatSwiftee(beat, token);
      if (beat.focus != null)       return beatFocus(beat, token);
      if (beat.sfx != null)         return beatSfx(beat);
      if (beat.juice != null)       return beatJuice(beat);
      if (beat.input != null) {
        return beatInput(beat, token).then(function (r) { state.last = r; return r; });
      }
      if (beat.branch != null)      return beatBranch(beat, token, state);
      if (beat.parallel != null) {
        return Promise.all(beat.parallel.map(function (b) { return runBeat(b, token, state, info); }));
      }
      if (beat.feedback != null) {
        // Sugar: a feedback beat is a list followed by the settle hold.
        var key = state.last && state.last.result != null ? String(state.last.result) : 'feedback';
        return inFeedback(beat.feedback, token, state, key, function () {
          return runList(beat.feedback, token, state).then(function (r) {
            if (r === CANCELLED) return r;
            return sleep(cfg.feedbackSettleMs, token);
          });
        });
      }
      return Promise.resolve();
    }

    function runList(beats, token, state) {
      var i = 0;
      function next() {
        if (token.cancelled) return Promise.resolve(CANCELLED);
        if (i >= beats.length) return Promise.resolve(state);
        var at = i++;
        var beat = beats[at];
        emit('beat', { index: at, beat: beat });
        var info = null;
        if (beat && typeof beat === 'object' && (beat.say != null || typeof beat.instruction === 'string')) {
          info = { type: lineTypeAt(beats, at), settledBy: beat.say != null ? settledByAt(beats, at) : null };
        }
        return runBeat(beat, token, state, info).then(function (r) {
          if (r === CANCELLED) return CANCELLED;
          return next();
        });
      }
      return next();
    }

    var api = {
      run: function (beats) {
        api.abort();
        var token = current = new Token();
        var state = { last: null, results: [] };
        lastWasSpeech = false;
        setState(STATES.ENTERING);
        emit('start', { count: beats.length });
        return runList(beats, token, state).then(function (r) {
          var mine = current === token;
          if (mine) current = null;
          emit('end', { cancelled: r === CANCELLED });
          if (r !== CANCELLED && mine) { setState(STATES.NEXT_STEP); emit('step:complete', {}); }
          return r === CANCELLED ? CANCELLED : state;
        });
      },

      /** Cancel whatever is running. Safe to call when nothing is. */
      abort: function () {
        if (current) { var t = current; current = null; t.cancel(); emit('abort', {}); }
        skipRequested = null;
        setState(STATES.IDLE);
      },

      skip: function () {
        if (skipRequested) { var r = skipRequested; skipRequested = null; r(); return true; }
        return false;
      },

      mark: function (name) {
        if (name === STATES.USER_INTERACTING && (state === STATES.WAITING_FOR_USER)) setState(name);
        else if (name === STATES.WAITING_FOR_USER && state === STATES.USER_INTERACTING) setState(name);
        else if (name === STATES.EXITING) setState(name);
        return state;
      },

      /** Put one of the lesson's own events on the stream. */
      emit: function (name, payload) { emit(name, payload); return api; },

      get running() { return !!current; },
      get state() { return state; },

      on: function (name, fn) { (listeners[name] || (listeners[name] = [])).push(fn); return api; },
      off: function (name, fn) {
        var l = listeners[name]; if (!l) return api;
        var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); return api;
      },

      configure: function (o) { for (var k in o) if (k in cfg) cfg[k] = o[k]; return cfg; }
    };
    return api;
  }

  global.Director = { create: create, CANCELLED: CANCELLED, STATES: STATES };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Director;

})(typeof window !== 'undefined' ? window : this);

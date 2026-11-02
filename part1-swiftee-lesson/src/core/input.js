// input-mode.js — one pointer stream, routed by mode.
(function (global) {
  'use strict';

  var MODES = ['locked', 'dialogue', 'polygon'];
  var GUARD_MS = 220;          // long enough to outlast one tap's pointerup
  var TAP_SLOP = 14;           // px of travel still counted as a tap

  var el = null;
  var mode = 'locked';
  var listeners = {};
  var guardUntil = 0;
  var down = null;
  var attached = false;

  function emit(name, payload) {
    var list = (listeners[name] || []).slice();
    for (var i = 0; i < list.length; i++) {
      try { list[i](payload); } catch (e) { if (global.console) console.warn('Input: listener for "' + name + '" threw', e); }
    }
  }

  function now() { return Date.now(); }

  function onDown(e) {
    down = { x: e.clientX, y: e.clientY, t: now(), id: e.pointerId };
    emit('down', e);
  }

  function onUp(e) {
    var d = down; down = null;
    if (!d) return;
    var moved = Math.hypot((e.clientX || 0) - d.x, (e.clientY || 0) - d.y);
    if (moved <= TAP_SLOP) emit('tap', e);        // a tap; anything further is a drag
  }

  function onCancel() { down = null; }

  function guarded() { return now() < guardUntil; }
  function arm(ms) { guardUntil = now() + (ms == null ? GUARD_MS : ms); }

  var Input = {

    attach: function (target) {
      if (attached && el === target) return Input;
      Input.detach();
      el = target;
      if (!el) return Input;
      el.addEventListener('pointerdown', onDown);
      (el.ownerDocument.defaultView || global).addEventListener('pointerup', onUp);
      (el.ownerDocument.defaultView || global).addEventListener('pointercancel', onCancel);
      attached = true;
      return Input;
    },

    detach: function () {
      if (!el || !attached) { attached = false; return Input; }
      var win = (el.ownerDocument && el.ownerDocument.defaultView) || global;
      el.removeEventListener('pointerdown', onDown);
      win.removeEventListener('pointerup', onUp);
      win.removeEventListener('pointercancel', onCancel);
      attached = false;
      return Input;
    },

    mode: function (m, o) {
      if (m == null) return mode;
      if (MODES.indexOf(m) < 0) { if (global.console) console.warn('Input: unknown mode "' + m + '"'); return mode; }
      mode = m;
      down = null;
      if (!(o && o.unguarded)) arm();
      emit('mode', m);
      return mode;
    },

    advance: function () {
      if (mode !== 'dialogue' || guarded()) return false;
      arm();
      emit('advance', null);
      return true;
    },

    /** True while stage drag handlers should ignore pointers. */
    get guarded() { return guarded(); },

    on: function (name, fn) { (listeners[name] || (listeners[name] = [])).push(fn); return Input; },
    off: function (name, fn) {
      var l = listeners[name];
      if (!l) return Input;
      if (!fn) { listeners[name] = []; return Input; }
      var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
      return Input;
    }
  };

  global.Input = Input;
  if (typeof module !== 'undefined' && module.exports) module.exports = Input;

})(typeof window !== 'undefined' ? window : this);

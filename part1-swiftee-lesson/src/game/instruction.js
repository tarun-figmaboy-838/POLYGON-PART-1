// instruction.js — the plank at the top of every screen.
(function (global) {
  'use strict';

  var el = null, textEl = null, current = null, swapTimer = null, ro = null;

  var MIN_PX = 15;
  function fit() {
    if (!el || !textEl) return;
    textEl.style.whiteSpace = 'nowrap';
    el.style.fontSize = '';
    var size = parseFloat(global.getComputedStyle(el).fontSize) || 24;
    var guard = 0;
    while (textEl.scrollWidth > textEl.clientWidth + 1 && size > MIN_PX && guard++ < 40) {
      size -= 1;
      el.style.fontSize = size + 'px';
    }
    if (textEl.scrollWidth > textEl.clientWidth + 1) textEl.style.whiteSpace = 'normal';
  }

  function mount() {
    if (el) return el;
    el = global.document.getElementById('instruction');
    if (!el) return null;
    textEl = el.querySelector('.instruction-text');

    var publish = function () {
      var h = el.classList.contains('show') ? Math.ceil(el.getBoundingClientRect().height) : 0;
      if (global.Game && Game.relayout) Game.relayout();
    };
    if (global.ResizeObserver) {
      ro = new ResizeObserver(publish);
      ro.observe(el);
    } else {
      global.addEventListener('resize', publish);
    }
    el.__publish = publish;
    global.addEventListener('resize', function () { if (current) fit(); publish(); });
    return el;
  }

  function show(text) {
    if (!mount()) return;
    if (text && global.I18N && I18N.on) text = I18N.tr(text);
    clearTimeout(swapTimer);
    el.classList.remove('fading');

    if (!text) {
      stopVoice();
      current = null;
      el.classList.remove('show');
      swapTimer = setTimeout(function () {
        if (!current && textEl) textEl.innerHTML = '';
        el.__publish();
      }, 180);
      return;
    }
    if (text === current) return;
    stopVoice();

    var write = function () {
      if (global.DualCode && DualCode.markup) textEl.innerHTML = DualCode.markup(text);
      else textEl.textContent = text;
      el.classList.add('show');
      fit();
      el.__publish();
      writing = false;
      if (pendingVoice) applyVoice();
    };

    if (current) {
      // out, then in — so the two sentences are never on the plank together
      el.classList.add('fading');
      current = text;
      writing = true;
      swapTimer = setTimeout(function () {
        el.classList.remove('fading');
        write();
      }, 160);
    } else {
      current = text;
      write();
    }
  }

  var pendingVoice = null, writing = false, voiceRaf = 0, voiceUnits = null;
  function stopVoice() {
    pendingVoice = null;
    if (voiceRaf) { (global.cancelAnimationFrame || clearTimeout)(voiceRaf); voiceRaf = 0; }
    if (voiceUnits) { voiceUnits.forEach(function (u) { u.classList.add('in'); }); voiceUnits = null; }
  }
  function voice(clock, cues) {
    mount();
    pendingVoice = { clock: clock, cues: cues };
    if (!writing) applyVoice();
  }
  function applyVoice() {
    var v = pendingVoice; pendingVoice = null;
    if (!v || !textEl || !current) return;
    var doc = textEl.ownerDocument, units = [];
    [].slice.call(textEl.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var frag = doc.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(function (p) {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(doc.createTextNode(p)); return; }
          var s = doc.createElement('span'); s.className = 'pw'; s.textContent = p; frag.appendChild(s); units.push(s);
        });
        textEl.replaceChild(frag, n);
      } else if (n.nodeType === 1) { n.classList.add('pw'); units.push(n); }
    });
    if (!units.length) return;
    voiceUnits = units;
    var first = [], nw = 0;
    units.forEach(function (u) { first.push(nw); nw += Math.max(1, String(u.textContent).trim().split(/\s+/).length); });
    var byCue = !!(v.cues && v.cues.length === nw);
    var i = 0, t0 = Date.now();
    var ceil = (byCue && v.cues.length ? v.cues[v.cues.length - 1] : units.length * 320) + 2500;
    var raf = global.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    var tick = function () {
      voiceRaf = 0;
      var t = v.clock ? v.clock() : null;
      if ((t == null && Date.now() - t0 > 600) || Date.now() - t0 > ceil) { stopVoice(); return; }
      while (i < units.length && t != null && t >= (byCue ? v.cues[first[i]] : i * 320)) { units[i].classList.add('in'); i++; }
      if (i >= units.length) { voiceUnits = null; return; }
      voiceRaf = raf(tick);
    };
    tick();
  }

  global.Instruction = {
    show: show,
    voice: voice,
    /** The sentence on the plank right now, or null. */
    current: function () { return current; }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.Instruction;
})(typeof window !== 'undefined' ? window : this);

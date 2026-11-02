// vo.js — Swiftee's voice.
(function (global) {
  'use strict';
  var I = global.I18N;
  var BASE = 'assets/vo/' + (I && I.on && I.voice ? I.lang + '/' : '');
  var playsOgg = (function () {
    try {
      var a = document.createElement('audio');
      return !!(a.canPlayType && a.canPlayType('audio/ogg; codecs="opus"'));
    } catch (e) { return false; }
  }());
  var current = null, known = {};   // known[id] = false once a clip has failed to load
  var liveId = null;
  var index = null, secs = {}, revs = {}, wordMs = {}, spokenMs = {};
  var indexWait = null, indexSettled = false;
  var offDisk = (function () {
    try { return (global.location && global.location.protocol) === 'file:'; } catch (e) { return false; }
  }());
  function useIndex(j) {
    (j && j.clips || []).forEach(function (id) { index[id] = true; });
    secs = (j && j.seconds) || {};
    revs = (j && j.rev) || {};
    wordMs = (j && j.words) || {};
    spokenMs = (j && j.spoken) || {};
  }
  var silent = !!(I && I.on && !I.voice) || !playsOgg;
  function loadIndex() {
    if (silent) { index = {}; indexSettled = true; return Promise.resolve(); }
    if (indexWait || indexSettled) return indexWait;
    if (offDisk) {
      index = {};
      var doc = global.document;
      if (!doc || !doc.createElement) { indexSettled = true; return Promise.resolve(); }
      indexWait = new Promise(function (res) {
        var s = doc.createElement('script'), done = false;
        var end = function () { if (!done) { done = true; res(); } };
        s.onload = s.onerror = end;
        setTimeout(end, 2500);                 // a missing file must not hold the voice up
        s.src = BASE + 'index.js';
        (doc.head || doc.documentElement).appendChild(s);
      }).then(function () { useIndex(global.VO_INDEX); }).then(function () { indexSettled = true; });
      return indexWait;
    }
    if (typeof fetch !== 'function') {
      indexSettled = true;
      return Promise.resolve();
    }
    index = {};
    indexWait = fetch(BASE + 'index.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(useIndex)
      .catch(function () {}).then(function () { indexSettled = true; });
    return indexWait;
  }
  loadIndex();

  function ready() { return indexSettled ? Promise.resolve() : (indexWait || loadIndex()); }

  /** The clip's own file, as the server has it. */
  function rawUrl(id) {
    var v = revs[id];
    // (off the disk there is no cache to outwit, and no query on a file path)
    return BASE + id + '.ogg' + (v && !offDisk ? '?v=' + v : '');
  }
  function url(id) {
    var u = rawUrl(id);
    return (global.Preload && Preload.url) ? Preload.url(u) : u;
  }

  function muted() { return !!(global.SFX && SFX.isMuted && SFX.isMuted()); }
  var quietAt = 0;
  function voiceBus(on) { if (!on) quietAt = Date.now(); try { if (global.SFX && SFX.voice) SFX.voice(on); } catch (e) {} }

  var settle = null;                 // resolves the promise finished() handed out
  var waiting = null;
  var guard = null;

  function done() {
    var f = settle; settle = null;
    if (guard) { clearTimeout(guard); guard = null; }
    if (f) { try { f(); } catch (e) {} }
  }

  function leftMs(a, id) {
    var len = (a && isFinite(a.duration) && a.duration > 0) ? a.duration * 1000
            : (secs[id] ? secs[id] * 1000 : 0);
    if (!len) return 12000;                        // nothing measured it: the ceiling
    var at = (a && isFinite(a.currentTime)) ? a.currentTime * 1000 : 0;
    return Math.max(0, len - at);
  }

  function finished() {
    if (!current) return Promise.resolve();
    if (settle) return waiting;
    var hold = current, id = liveId;
    waiting = new Promise(function (resolve) { settle = resolve; });
    guard = setTimeout(done, leftMs(hold, id) + 1500);
    if (!(hold.duration > 0) && hold.addEventListener) {
      var retimed = false;
      hold.addEventListener('loadedmetadata', function () {
        if (retimed || current !== hold || !settle) return;
        retimed = true;
        clearTimeout(guard);
        guard = setTimeout(done, leftMs(hold, id) + 1500);
      });
    }
    return waiting;
  }

  function at() {
    if (!current) return null;
    var t = current.currentTime;
    return (typeof t === 'number' && isFinite(t)) ? t * 1000 : null;
  }

  function stop() {
    liveId = null;
    if (!current) { done(); return; }
    try { current.pause(); current.currentTime = 0; } catch (e) {}
    current = null;
    voiceBus(false);
    done();                          // anything waiting on it is released now
  }

  /** Play the clip for a line. Returns the Audio element, or null. */
  function play(id) {
    if (silent || !id || typeof Audio === 'undefined' || known[id] === false || muted()) return null;
    if (!offDisk && (!index || !index[id])) return null;
    stop();
    var a;
    if (warm[id] && warm[id].src !== url(id)) { delete warm[id]; var wo = warmOrder.indexOf(id); if (wo >= 0) warmOrder.splice(wo, 1); }
    if (warm[id]) {
      a = warm[id];
      delete warm[id];
      var wi = warmOrder.indexOf(id); if (wi >= 0) warmOrder.splice(wi, 1);
      try { a.currentTime = 0; } catch (e) {}
    } else {
      try { a = new Audio(url(id)); } catch (e) { return null; }
    }
    return start(a, id);
  }

  function start(a, id) {
    a.preload = 'auto';
    a.volume = 0.95;
    if (hiddenNow()) a.muted = true;
    a.addEventListener('error', function () {
      if (current !== a) return;              // an element already replaced is nothing to us
      var next = null, src = a.src || '';
      if (/^blob:/.test(src)) next = rawUrl(id);
      if (next && next !== src) {
        var b = null;
        try { b = new Audio(next); } catch (e) { b = null; }
        if (b) { start(b, id); return; }
      }
      known[id] = false;
      if (global.console) console.warn('[VO] missing or failed: ' + url(id));
      current = null; liveId = null; voiceBus(false); done();
    });
    a.addEventListener('ended', function () { if (current === a) { current = null; liveId = null; voiceBus(false); done(); } });
    current = a;
    liveId = id;
    voiceBus(true);
    var lastT = -1, lastTick = Date.now();
    var watch = setInterval(function () {
      if (current !== a) { clearInterval(watch); return; }
      var t = a.currentTime;
      if (t !== lastT) { lastT = t; lastTick = Date.now(); return; }
      if (!a.paused && !a.ended && Date.now() - lastTick > 2000) {
        clearInterval(watch);
        if (global.console) console.warn('[VO] playback stalled, going on without it: ' + id);
        try { a.pause(); } catch (e) {}
        current = null; liveId = null; voiceBus(false); done();
      }
    }, 250);
    var p = a.play();
    if (p && p.catch) p.catch(function () {
      // refused (autoplay policy) or failed: release anything waiting on it
      if (global.console) console.warn('[VO] could not play ' + id);
      if (current === a) { current = null; liveId = null; voiceBus(false); done(); }
    });
    return a;
  }

  var warm = {}, warmOrder = [];
  var WARM_MAX = 48;   // clips are 10-17 KB; the replies alone are ~27 (game.js warmVoice)
  function preload(ids) {
    if (silent) return;
    (ids || []).forEach(function (id) {
      if (!id || warm[id] || known[id] === false) return;
      if (!offDisk && (!index || !index[id])) return;
      try {
        var a = new Audio(url(id));
        a.preload = 'auto';
        a.addEventListener('error', function () {
          delete warm[id];
          if (/^blob:/.test(a.src || '')) return;                          // play() will try the file itself
          known[id] = false;
        });
        warm[id] = a;
        warmOrder.push(id);
        while (warmOrder.length > WARM_MAX) { var old = warmOrder.shift(); if (old !== id) delete warm[old]; }
      } catch (e) {}
    });
  }

  function hiddenNow() { try { return !!(global.document && global.document.hidden); } catch (e) { return false; } }
  if (global.document && global.document.addEventListener) {
    global.document.addEventListener('visibilitychange', function () {
      if (!current) return;
      try { current.muted = hiddenNow() || muted(); } catch (e) {}
    });
  }

  function seconds(id) { return (id && secs[id]) || 0; }

  /** Start of each spoken word, in milliseconds from the clip start. */
  function words(id) { return (id && wordMs[id]) || null; }

  function spoken(id) { return (id && spokenMs[id]) || 0; }

  /** Every clip's file, in the format this browser plays — the loading bar's list. */
  function urls() { return Object.keys(index || {}).map(rawUrl); }

  global.VO = { play: play, stop: stop, finished: finished, preload: preload, seconds: seconds, words: words, spoken: spoken, at: at,
                urls: urls,
                ready: ready,
                get isReady() { return indexSettled; },
                get quietAt() { return quietAt; },
                get playing() { return current; },
                get id() { return liveId; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.VO;
})(typeof window !== 'undefined' ? window : this);

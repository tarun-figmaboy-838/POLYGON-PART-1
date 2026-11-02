// preload.js — the loading bar: every file the lesson and the story need, fetched before Start.
(function (global) {
  'use strict';

  var LIMIT = 5, STALL_MS = 15000, CAP_MS = 120000, FONT_MS = 8000, FONT_BYTES = 30000;
  var jobs = {}, queue = [], listeners = [];
  var active = 0, total = 0, loaded = 0, shown = 0, planned = 0, settledN = 0, sealed = false, isDone = false;
  var finish;
  var done = new Promise(function (r) { finish = r; });
  var usable = (function () {
    try { return typeof global.fetch === 'function' && global.location && global.location.protocol !== 'file:'; }
    catch (e) { return false; }
  }());
  var sizes = (global.PreloadList && global.PreloadList.sizes) || {};
  function sizeOf(u) { return sizes[String(u).split('?')[0]] || 40000; }
  var twins = (global.PreloadList && global.PreloadList.avif) || {};
  function pick(u) {
    if (!u || !global.ImgFormat || !global.ImgFormat.avif) return u;
    return twins[String(u).split('?')[0]] || u;
  }

  function emit() {
    var f = total > 0 ? Math.min(1, loaded / total) : 1;
    if (f > shown) shown = f;                                    // forward only
    for (var i = 0; i < listeners.length; i++) { try { listeners[i](shown); } catch (e) {} }
  }
  function check() {
    if (isDone || !sealed || settledN < planned) return;
    isDone = true; shown = 1; emit(); finish();
  }
  function settle(job, blob) {
    if (job.settled) return;
    job.settled = true;
    if (job.started) active = Math.max(0, active - 1);
    if (blob && job.keep) { try { job.blobUrl = URL.createObjectURL(blob); } catch (e) { job.blobUrl = null; } }
    loaded += Math.max(0, job.expect - job.got); job.got = job.expect;
    settledN++;
    emit(); check(); pump();
  }

  function run(job) {
    job.started = true;
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var stall = 0, cap = setTimeout(function () { if (ctl) ctl.abort(); }, CAP_MS);
    function arm() { clearTimeout(stall); stall = setTimeout(function () { if (ctl) ctl.abort(); }, STALL_MS); }
    function end(blob) { clearTimeout(stall); clearTimeout(cap); settle(job, blob); }
    arm();
    global.fetch(job.url, ctl ? { signal: ctl.signal } : undefined).then(function (res) {
      if (!res.ok) throw new Error(String(res.status));
      var cl = Number(res.headers.get('content-length')) || 0;
      if (cl && cl !== job.expect) { total += cl - job.expect; job.expect = cl; }
      var type = res.headers.get('content-type') || '';
      if (!res.body || !res.body.getReader) return res.blob().then(function (b) { end(job.keep ? b : null); });
      var reader = res.body.getReader(), parts = [];
      function pull() {
        return reader.read().then(function (r) {
          if (r.done) { end(job.keep ? new Blob(parts, type ? { type: type } : undefined) : null); return; }
          if (job.keep) parts.push(r.value);
          arm();
          var add = Math.min(r.value.byteLength, Math.max(0, job.expect - job.got));
          job.got += add; loaded += add; emit();
          return pull();
        });
      }
      return pull();
    }).catch(function () { end(null); });                       // failed, stalled or aborted: done
  }

  var pumpQueued = false;
  function later() {
    if (pumpQueued) return;
    pumpQueued = true;
    Promise.resolve().then(function () { pumpQueued = false; pump(); });
  }
  function pump() {
    while (active < LIMIT && queue.length) {
      queue.sort(function (a, b) { return a.expect - b.expect; });
      var job = queue.shift();
      if (job.settled) continue;
      active++;
      run(job);
    }
  }

  function add(url, keep) {
    if (!url || jobs[url]) { if (jobs[url] && keep) jobs[url].keep = true; return; }
    var job = { url: url, expect: sizeOf(url), got: 0, keep: !!keep, settled: false, started: false, blobUrl: null };
    jobs[url] = job;
    total += job.expect; planned++;
    if (!usable) settle(job, null);
    else { queue.push(job); later(); }
  }

  var api = {
    want: function (urls, opts) {
      var keep = opts && opts.keep;
      (urls || []).forEach(function (u) { u = pick(u); add(u, keep ? keep.test(u) : false); });
      emit();
    },
    font: function (css, text, after) {
      var key = 'font:' + css + (text ? '|' + text : '');
      if (jobs[key]) return;
      // (not one of the five fetch slots: the browser loads the face itself)
      var job = { url: key, expect: FONT_BYTES, got: 0, keep: false, settled: false, started: false, blobUrl: null };
      jobs[key] = job; total += job.expect; planned++;
      var fonts = global.document && global.document.fonts;
      if (!fonts || !fonts.load || !usable) { settle(job, null); return; }
      var t = setTimeout(function () { settle(job, null); }, FONT_MS + (after ? FONT_MS : 0));
      var go = function () {
        (text ? fonts.load(css, text) : fonts.load(css)).then(function () { clearTimeout(t); settle(job, null); }, function () { clearTimeout(t); settle(job, null); });
      };
      if (after && after.then) after.then(go, go); else go();
    },
    seal: function () { sealed = true; check(); },
    onProgress: function (fn) { listeners.push(fn); try { fn(shown); } catch (e) {} },
    url: function (u) { var j = jobs[u]; return (j && j.blobUrl) || u; },
    pick: pick,
    done: done
  };
  global.Preload = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);

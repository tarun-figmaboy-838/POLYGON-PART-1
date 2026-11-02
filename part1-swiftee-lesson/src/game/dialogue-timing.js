// dialogue-timing.js — when each word arrives, and how long the line is left up.
(function (global) {
  'use strict';

  var WORD_MS = 280;

  var QUICK = { a: 1, an: 1, the: 1, to: 1, is: 1, it: 1, of: 1, and: 1,
                in: 1, on: 1, at: 1, or: 1, so: 1, we: 1, i: 1, am: 1 };
  var WEIGHTY = { diagonal: 1, diagonals: 1, polygon: 1, polygons: 1,
                  pentagon: 1, pentagons: 1, hexagon: 1, vertex: 1, vertices: 1,
                  convex: 1, concave: 1, regular: 1, irregular: 1,
                  'non-adjacent': 1, angles: 1, sides: 1, equal: 1 };

  var AFTER = [
    [/(…|\.\.\.)["”’)]*$/, 600],   // ellipsis — the longest think
    [/[?]["”’)]*$/, 480],
    [/[.!\u0964\u0965]["”’)]*$/, 420],   // (and the danda, the full stop of Hindi, Marathi and Odia)
    [/[,;:]["”’)]*$/, 220]
  ];

  var clean = function (w) {
    return String(w).toLowerCase().replace(/[^a-z\u0900-\u0963\u0966-\u0dff\u200c\u200d-]/g, '');
  };

  /** The gap owed BEFORE the next word, given the word just shown. */
  function gapAfter(word) {
    var w = clean(word);
    var ms = WORD_MS;
    if (QUICK[w]) ms -= 70;
    else if (WEIGHTY[w] || w.length >= 9) ms += 90;
    for (var i = 0; i < AFTER.length; i++) {
      if (AFTER[i][0].test(String(word))) { ms += AFTER[i][1]; break; }
    }
    return ms;
  }

  function words(text) {
    return String(text == null ? '' : text).trim().split(/\s+/).filter(Boolean);
  }

  var WRITTEN_PACE = 300;            // the director's msPerWord in real play

  function scaleOf(msPerWord) {
    if (!msPerWord || msPerWord <= 0) return 1;
    return Math.min(1, msPerWord / WRITTEN_PACE);
  }

  function cues(text, scale, breaks) {
    var k = scale == null ? 1 : scale;
    var ws = words(text), out = [], at = 0;
    for (var i = 0; i < ws.length; i++) {
      out.push(Math.round(at * k));
      at += gapAfter(ws[i]);
      if (breaks && breaks.indexOf(i) >= 0 && !/[.!?…,;:\u0964\u0965]["”’)]*$/.test(ws[i])) at += FRAGMENT_GAP;
    }
    return out;
  }

  function readingPause(text, scale) {
    var n = words(text).length;
    var ms = Math.min(3600, Math.max(1500, 900 + n * 200));
    return Math.round(ms * (scale == null ? 1 : scale));
  }

  function interactionDelay(text, scale) {
    var n = words(text).length;
    var ms = n <= 6 ? Math.min(650, Math.max(500, 380 + n * 45))
                    : Math.min(800, Math.max(650, 470 + n * 30));
    return Math.round(ms * (scale == null ? 1 : scale));
  }

  var FRAGMENT_GAP = 450;
  function endsSentence(text) { return /[.!?…\u0964\u0965]["”’)]*\s*$/.test(String(text || '')); }

  var PANEL_MS = 220, PANEL_LEAD = 120, SWAP_OUT = 170, SWAP_IN = 220, SWAP_LEAD = 270;

  function norm(t) {
    return String(t || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\u0900-\u0963\u0966-\u0dff\u200c\u200d\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  /** Does `instruction` only repeat the end of `line`? */
  function repeats(instruction, line) {
    var a = norm(instruction), b = norm(line);
    if (!a || !b) return false;
    return b === a || (b.length > a.length && b.slice(b.length - a.length) === a && b.charAt(b.length - a.length - 1) === ' ');
  }
  function lineText(b) {
    if (!b || typeof b !== 'object') return null;
    if (typeof b.say === 'string') return b.say;
    if (typeof b.instruction === 'string') return b.instruction;
    return null;
  }
  function lineType(beats, i) {
    var list = beats || [];
    if (list[i] && list[i].pace === 'recap') return 'recap';
    var own = lineText(list[i]);
    var answersToCome = false;
    for (var k = i + 1; k < list.length; k++) {
      var b = list[k];
      if (!b || typeof b !== 'object') continue;                // a bare number is a wait
      var said = lineText(b);
      if (said != null) {
        if (b.instruction != null && own && repeats(said, own)) continue;   // a settle, not a new line
        return 'narration';
      }
      if (b.instruction === null) continue;                      // clearing the card is not a line
      if (b.stage && b.stage.choices && b.stage.choices.length) { answersToCome = true; continue; }
      if (b.stage && b.stage.kind) return 'narration';           // a new scene arrives first
      if (b.input) {
        var t = b.input.type;
        if (t === 'tap-anywhere') return 'narration';
        if (t === 'choice' || t === 'multi-select' || t === 'swipe') return answersToCome ? 'question' : 'question-ready';
        return 'action';
      }
      if (b.branch != null || b.feedback != null) return 'narration';
    }
    return 'narration';
  }

  /** The beat after the last word, for a line of this kind. */
  var RECAP_PAUSE = 550;   // the summary's reading pause: 0.4–0.7s, then the card moves on
  function finalPause(type, text, scale) {
    if (type === 'recap') return Math.round(RECAP_PAUSE * (scale == null ? 1 : scale));
    return (type === 'action' || type === 'question-ready') ? interactionDelay(text, scale) : readingPause(text, scale);
  }

  function schedule(parts, opts) {
    opts = opts || {};
    var k = opts.scale == null ? 1 : opts.scale;
    var list = (parts || []).map(function (p) { return typeof p === 'string' ? { text: p, breaks: null } : p; })
                            .filter(function (p) { return p && String(p.text || '').trim(); });
    var out = [], at = 0, lastWord = 0;
    for (var i = 0; i < list.length; i++) {
      var lead = Math.round((i === 0 && !opts.showing ? PANEL_LEAD : SWAP_LEAD) * k);
      var c = cues(list[i].text, k, list[i].breaks);
      var first = at + lead;
      lastWord = first + (c.length ? c[c.length - 1] : 0);
      var hold = i + 1 < list.length
        ? (endsSentence(list[i].text) ? readingPause(list[i].text, k) : Math.round(FRAGMENT_GAP * k))
        : finalPause(opts.type || 'narration', list[i].text, k);
      out.push({ text: list[i].text, at: at, lead: lead, cues: c, hold: hold });
      at = lastWord + hold;
    }
    return { parts: out, lastWord: lastWord, total: at };
  }

  global.Timing = {
    cues: cues,
    readingPause: readingPause,
    lineType: lineType,
    repeats: repeats,
    endsSentence: endsSentence,
    schedule: schedule,
    PANEL_LEAD: PANEL_LEAD, SWAP_OUT: SWAP_OUT, SWAP_IN: SWAP_IN, SWAP_LEAD: SWAP_LEAD,
    scaleOf: scaleOf
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Timing;

})(typeof window !== 'undefined' ? window : this);

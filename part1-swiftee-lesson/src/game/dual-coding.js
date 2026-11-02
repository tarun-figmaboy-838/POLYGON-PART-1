// dual-coding.js — the same idea through two channels at once.
(function (global) {
  'use strict';

  var TERMS = {
    polygon:   { color: '#1030c8', tint: '#e3e9ff', target: 'polygon',          mode: 'pop' },
    vertex:    { color: '#8a5200', tint: '#fff2d6', target: 'polygon.vertices', mode: 'pop' },
    side:      { color: '#0b7a5e', tint: '#d8f5ec', target: 'polygon.sides',    mode: 'none' },
    diagonal:  { color: '#8a3d00', tint: '#fff4cc', target: 'polygon.diagonals', mode: 'trace' },
    angle:     { color: '#1d7a2e', tint: '#ddf6e1', target: 'polygon.vertices', mode: 'pop' },
    convex:    { color: '#0f6f86', tint: '#e4f8fc', target: 'polygon',          mode: 'pop' },
    concave:   { color: '#95590a', tint: '#fff3dd', target: 'polygon',          mode: 'pop' },
    regular:   { color: '#0a6c60', tint: '#e3f8f4', target: 'polygon',          mode: 'pop' },
    irregular: { color: '#54399e', tint: '#f1ebfe', target: 'polygon',          mode: 'pop' },
    'line segment': { target: null, mode: 'none' },
    drag:      { target: null, mode: 'none' },
    draw:      { target: null, mode: 'none' },
    tap:       { target: null, mode: 'none' },
    pick:      { target: null, mode: 'none' },
    inside:    { target: null, mode: 'none' },
    outside:   { target: null, mode: 'none' },
    inward:    { target: null, mode: 'none' },
    equal:     { target: null, mode: 'none' }
  };

  var FORMS = [
    ['irregular', 'irregular'],
    ['polygons', 'polygon'], ['polygon', 'polygon'],
    ['vertices', 'vertex'], ['vertex', 'vertex'],
    ['diagonals', 'diagonal'], ['diagonal', 'diagonal'],
    ['sides', 'side'], ['side', 'side'],
    ['angles', 'angle'], ['angle', 'angle'],
    ['convex', 'convex'], ['concave', 'concave'],
    ['regular', 'regular'],
    ['line segment', 'line segment'],
    ['drag', 'drag'], ['draw', 'draw'], ['tap', 'tap'], ['pick', 'pick'],
    ['outside', 'outside'], ['inside', 'inside'], ['inward', 'inward'],
    ['equal', 'equal']
  ];

  var RE =new RegExp('\\b(' + FORMS.map(function (f) { return f[0]; }).join('|') + ')\\b', 'gi');
  var LOOKUP = {};
  FORMS.forEach(function (f) { LOOKUP[f[0]] = f[1]; });

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function markup(text) {
    if (!text) return '';
    if (global.I18N && I18N.on) return markupWords(text);
    var out = '', last = 0, m;
    RE.lastIndex = 0;
    while ((m = RE.exec(text)) !== null) {
      var term = LOOKUP[m[1].toLowerCase()];
      var def = TERMS[term];
      if (!def) continue;
      out += esc(text.slice(last, m.index));
      var chip = '<span class="dc-term" data-term="' + term + '"><span class="dc-ink">' + esc(m[0]) + '</span></span>';
      last = m.index + m[0].length;

      var tail = /^[.,!?;:%)\]]+/.exec(text.slice(last));
      if (tail) {
        out += '<span class="dc-keep">' + chip + esc(tail[0]) + '</span>';
        last += tail[0].length;
      } else {
        out += chip;
      }
    }
    out += esc(text.slice(last));
    return out;
  }

  var EDGE = /^([(\[{"'\u201c\u2018]*)([\s\S]*?)([.,!?;:%)\]}"'\u201d\u2019\u2026\u0964\u0965]*)$/;
  function markupWords(text) {
    var out = '';
    String(text).split(/(\s+)/).forEach(function (p) {
      if (!p) return;
      if (/^\s+$/.test(p)) { out += p; return; }
      var m = EDGE.exec(p) || ['', '', p, ''];
      var term = m[2] ? I18N.termOf(m[2]) : null;
      if (!term || !TERMS[term]) { out += esc(p); return; }
      var chip = '<span class="dc-term" data-term="' + term + '"><span class="dc-ink">' + esc(m[2]) + '</span></span>';
      out += esc(m[1]);
      out += m[3] ? '<span class="dc-keep">' + chip + esc(m[3]) + '</span>' : chip;
    });
    return out;
  }

  function cueTerm(term, ctx) {
    var def = TERMS[term];
    if (!def || !global.Stage) return false;
    if (!Stage.emphasizeConcept) return false;
    try { return Stage.emphasizeConcept(term, ctx) > 0; } catch (e) { return false; }
  }

  global.DualCode = {
    markup: markup,
    cueTerm: cueTerm
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.DualCode;

})(typeof window !== 'undefined' ? window : this);

// snowflake.js — the shape of a snow crystal, as path data.
(function (global) {
  'use strict';

  var ARMS = 6;
  var TAU = Math.PI * 2;

  var BUILDS = [
    { at: [0.30, 0.52, 0.74], len: [0.34, 0.26, 0.17], spread: 60, plate: 0.17, tip: 0.13 },
    { at: [0.38, 0.66],       len: [0.30, 0.34],       spread: 52, plate: 0.22, tip: 0.10 },
    { at: [0.58],             len: [0.20],             spread: 64, plate: 0.13, tip: 0.09 }
  ];

  function n(v) { return Math.round(v * 100) / 100; }

  /** Rotate a unit vector by `a` radians. */
  function rot(x, y, a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [x * c - y * s, x * s + y * c];
  }

  function path(r, seed) {
    var b = BUILDS[((seed | 0) % BUILDS.length + BUILDS.length) % BUILDS.length];
    var d = [], k, j, a, u, v, bx, by, e, tipA;

    for (k = 0; k < ARMS; k++) {
      a = (k / ARMS) * TAU - Math.PI / 2;         // first arm points up
      u = Math.cos(a); v = Math.sin(a);

      // the stem
      d.push('M0 0L' + n(u * r) + ' ' + n(v * r));

      // paired branches, shortening toward the tip
      for (j = 0; j < b.at.length; j++) {
        bx = u * r * b.at[j]; by = v * r * b.at[j];
        e = rot(u, v, b.spread * Math.PI / 180);
        d.push('M' + n(bx) + ' ' + n(by) + 'L' + n(bx + e[0] * r * b.len[j]) + ' ' + n(by + e[1] * r * b.len[j]));
        e = rot(u, v, -b.spread * Math.PI / 180);
        d.push('M' + n(bx) + ' ' + n(by) + 'L' + n(bx + e[0] * r * b.len[j]) + ' ' + n(by + e[1] * r * b.len[j]));
      }

      // a small fork at the very end, so the arm finishes instead of stopping
      tipA = 150 * Math.PI / 180;
      e = rot(u, v, tipA);
      d.push('M' + n(u * r) + ' ' + n(v * r) + 'L' + n(u * r + e[0] * r * b.tip) + ' ' + n(v * r + e[1] * r * b.tip));
      e = rot(u, v, -tipA);
      d.push('M' + n(u * r) + ' ' + n(v * r) + 'L' + n(u * r + e[0] * r * b.tip) + ' ' + n(v * r + e[1] * r * b.tip));
    }

    // the hexagonal plate at the centre
    var p = r * b.plate, pts = [];
    for (k = 0; k < ARMS; k++) {
      a = (k / ARMS) * TAU - Math.PI / 2;
      pts.push(n(Math.cos(a) * p) + ' ' + n(Math.sin(a) * p));
    }
    d.push('M' + pts.join('L') + 'Z');

    return d.join('');
  }

  function svg(size, seed, o) {
    o = o || {};
    var r = size / 2 * 0.92;
    var d = path(r, seed);
    var w = o.weight || Math.max(1.2, size * 0.012);
    return '<svg viewBox="' + (-size / 2) + ' ' + (-size / 2) + ' ' + size + ' ' + size + '" ' +
           'width="' + size + '" height="' + size + '" aria-hidden="true" ' +
           'style="display:block;overflow:visible">' +
           '<path d="' + d + '" fill="none" stroke="' + (o.glow || 'rgba(186,226,255,.85)') + '" ' +
             'stroke-width="' + (w * 3.4).toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round"/>' +
           '<path d="' + d + '" fill="none" stroke="' + (o.stroke || '#ffffff') + '" ' +
             'stroke-width="' + w.toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round"/>' +
           '</svg>';
  }

  global.Snowflake = { path: path, svg: svg };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Snowflake;

})(typeof window !== 'undefined' ? window : this);

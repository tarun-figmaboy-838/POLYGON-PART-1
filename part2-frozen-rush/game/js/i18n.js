/* A COPY of part1-swiftee-lesson/src/core/i18n.js, written by part1-swiftee-lesson/tools/build-locales.js —
   edit that one and run the tool; the two halves of the game read ?lan= by the same rules. */
// THE GAME IN ANOTHER LANGUAGE — ?lan=hi (or mr, te, gu, od; en is the default).
(function (global) {
  'use strict';

  var LANGS = ['en', 'hi', 'mr', 'te', 'gu', 'od'];
  var ALIAS = { or: 'od', ory: 'od', odia: 'od', oriya: 'od', hin: 'hi', mar: 'mr', tel: 'te', guj: 'gu', eng: 'en' };
  /* the BCP 47 tag for <html lang> — Odia's is "or", whatever the address calls it */
  var HTML_LANG = { en: 'en', hi: 'hi', mr: 'mr', te: 'te', gu: 'gu', od: 'or' };
  var FONT = { hi: 'Baloo 2', mr: 'Baloo 2', te: 'Baloo Tammudu 2', gu: 'Baloo Bhai 2', od: 'Baloo Bhaina 2' };
  var SCRIPT = { hi: 'deva', mr: 'deva', te: 'telu', gu: 'gujr', od: 'orya' };
  var VOICED = { hi: true };
  var TERM_KEYS = [
    ['irregular', 'termIrregular'], ['polygon', 'termPolygon'], ['vertex', 'termVertex'],
    ['diagonal', 'termDiagonal'], ['side', 'termSide'], ['angle', 'termAngle'],
    ['convex', 'termConvex'], ['concave', 'termConcave'], ['regular', 'termRegular'],
    ['line segment', 'termLineSegment'], ['drag', 'termDrag'], ['draw', 'termDraw'],
    ['outside', 'termOutside'], ['inside', 'termInside'], ['inward', 'termInward'], ['equal', 'termEqual']
  ];
  var LEAD = /^[(\[{"'“‘«]+/;
  var TAIL = /[.,!?;:%)\]}"'”’»…।॥—–-]+$/;

  function asked(loc) {
    var q = '';
    try { q = String((loc && loc.search) || ''); } catch (e) { q = ''; }
    var m = /[?&](?:lan|lang)=([^&#]*)/i.exec(q);
    if (!m) return 'en';
    var v = '';
    try { v = decodeURIComponent(m[1]); } catch (e) { v = m[1]; }
    v = v.trim().toLowerCase();
    return ALIAS[v] || v;
  }

  function make(lang, data) {
    data = data || {};
    var EN = data.en || {};
    if (LANGS.indexOf(lang) < 0 || !data[lang]) lang = 'en';
    var LOC = data[lang] || EN;
    var on = lang !== 'en';
    var misses = [];

    var plain = function (s) { return String(s == null ? '' : s).replace(/<\/?strong>/g, ''); };
    var norm = function (s) {
      return plain(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
    };
    var bare = function (w) { return String(w == null ? '' : w).replace(LEAD, '').replace(TAIL, '').toLowerCase(); };
    var words = function (s) { return plain(s).trim().split(/\s+/).filter(Boolean); };

    var REV = {}, BACK = {}, PART = {};
    Object.keys(EN).forEach(function (k) {
      var v = EN[k];
      if (typeof v === 'string') {
        if (!(norm(v) in REV)) REV[norm(v)] = k;
        if (typeof LOC[k] === 'string' && !(norm(LOC[k]) in BACK)) BACK[norm(LOC[k])] = k;
      } else if (/Parts$/.test(k) && Array.isArray(v)) {
        v.forEach(function (p, i) { if (!(norm(p) in PART)) PART[norm(p)] = [k, i]; });
      }
    });

    function fill(s, vars) {
      if (!vars) return s;
      return String(s).replace(/\{(\w+)\}/g, function (m, n) { return vars[n] != null ? String(vars[n]) : m; });
    }
    function t(key, vars) {
      var v = LOC[key];
      if (v == null) v = EN[key];
      if (v == null) return '';
      return fill(v, vars);
    }
    function miss(s) {
      if (misses.indexOf(s) < 0 && misses.length < 200) misses.push(s);
    }
    var looksEnglish = function (s) { return /[A-Za-z]{2,}/.test(s) && !/[ऀ-෿]/.test(s); };

    function find(s) {
      var k = REV[norm(s)];
      if (k && LOC[k] != null) return LOC[k];
      var p = PART[norm(s)];
      if (p && LOC[p[0]] && LOC[p[0]][p[1]] != null) return LOC[p[0]][p[1]];
      var cm = /^(\d+(?:\.\d+)?)\s*cm$/.exec(String(s).trim());
      if (cm) return cm[1] + ' ' + t('unitCm');
      return null;
    }
    function tr(text) {
      if (!on || text == null) return text;
      var s = String(text);
      if (!s || !looksEnglish(s)) return text;
      var hit = find(s);
      if (hit == null) { miss(s); return text; }
      return plain(hit);
    }
    /* Part 2's plank keeps its key word: "Cut the concave <strong>polygon</strong>." */
    function html(text) {
      if (!on || text == null) return text;
      var s = String(text);
      if (!s || !looksEnglish(s)) return text;
      var hit = find(s);
      if (hit == null) { miss(s); return text; }
      return hit;
    }
    function trParts(text, parts) {
      if (!on || !parts || !parts.length) return parts || null;
      var k = REV[norm(text)] || REV[norm([].concat(parts).join(' '))];
      var tp = k ? LOC[k + 'Parts'] : null;
      if (tp && tp.length) return tp.slice();
      return null;
    }
    function english(text) {
      if (!on) return text == null ? '' : String(text);
      var k = BACK[norm(text)];
      return k && typeof EN[k] === 'string' ? plain(EN[k]) : '';
    }

    function inList(word, list) {
      if (!list || !list.length) return false;
      var w = bare(word);
      if (!w) return false;
      for (var i = 0; i < list.length; i++) {
        var e = String(list[i]).toLowerCase();
        if (e.charAt(e.length - 1) === '*') { if (w.indexOf(e.slice(0, -1)) === 0) return true; }
        else if (w === e) return true;
      }
      return false;
    }
    function isWord(word, key) { return inList(word, LOC[key]); }
    function termOf(word) {
      for (var i = 0; i < TERM_KEYS.length; i++) if (inList(word, LOC[TERM_KEYS[i][1]])) return TERM_KEYS[i][0];
      return null;
    }
    var CUE_KEYS = Object.keys(EN).filter(function (k) { return /^term/.test(k) && Array.isArray(EN[k]); });
    function cues(word) {
      if (!on) return word == null ? [] : [String(word)];
      var out = [];
      CUE_KEYS.forEach(function (k) {
        if (inList(word, LOC[k])) (EN[k] || []).forEach(function (e) { if (out.indexOf(e) < 0) out.push(e); });
      });
      return out;
    }
    function enKeyOf(word) {
      var w = bare(word);
      for (var i = 0; i < CUE_KEYS.length; i++) if ((EN[CUE_KEYS[i]] || []).indexOf(w) >= 0) return CUE_KEYS[i];
      return null;
    }
    function wordIndex(en, trText, i) {
      var ew = words(en), tw = words(trText);
      if (!on) return i;
      if (!tw.length) return 0;
      var key = ew[i] != null ? enKeyOf(ew[i]) : null;
      if (key) {
        var n = 0, j, seen = 0, last = -1;
        for (j = 0; j <= i && j < ew.length; j++) if (enKeyOf(ew[j]) === key) n++;
        for (j = 0; j < tw.length; j++) {
          if (inList(tw[j], LOC[key])) { seen++; last = j; if (seen === n) return j; }
        }
        if (last >= 0) return last;
      }
      if (ew.length <= 1) return 0;
      return Math.min(tw.length - 1, Math.round(i * (tw.length - 1) / (ew.length - 1)));
    }

    function keep(url) {
      if (!on || url == null) return url;
      var s = String(url);
      if (/[?&]lan=/.test(s)) return s;
      var hash = '', h = s.indexOf('#');
      if (h >= 0) { hash = s.slice(h); s = s.slice(0, h); }
      return s + (s.indexOf('?') >= 0 ? '&' : '?') + 'lan=' + lang + hash;
    }

    function applyDom(root) {
      var doc = root && (root.ownerDocument || root);
      if (!on || !root || !root.querySelectorAll) return 0;
      var n = 0;
      [].slice.call(root.querySelectorAll('[data-i18n]')).forEach(function (el) {
        var v = t(el.getAttribute('data-i18n'));
        if (!v) return;
        if (el.hasAttribute('data-i18n-html')) el.innerHTML = v; else el.textContent = v;
        n++;
      });
      [].slice.call(root.querySelectorAll('[data-i18n-aria]')).forEach(function (el) {
        var v = t(el.getAttribute('data-i18n-aria'));
        if (v) { el.setAttribute('aria-label', v); n++; }
      });
      [].slice.call(root.querySelectorAll('[data-i18n-title]')).forEach(function (el) {
        var v = t(el.getAttribute('data-i18n-title'));
        if (v) { el.setAttribute('title', v); n++; }
      });
      if (doc && doc.documentElement && doc.documentElement.classList) doc.documentElement.classList.remove('i18n-wait');
      return n;
    }

    return {
      lang: lang, on: on, voice: !on || !!VOICED[lang],
      htmlLang: HTML_LANG[lang] || 'en',
      font: on ? FONT[lang] || null : null,
      script: on ? SCRIPT[lang] || null : null,
      labels: data.languageLabels || null,
      t: t, tr: tr, html: html, trParts: trParts, english: english,
      termOf: termOf, cues: cues, isWord: isWord, wordIndex: wordIndex,
      keep: keep, applyDom: applyDom,
      misses: misses,
      make: function (l) { return make(ALIAS[l] || l, data); }
    };
  }

  var I = make(asked(global.location), global.POLYGON_LOCALES || null);

  var doc = global.document;
  if (doc && doc.documentElement) {
    var html = doc.documentElement;
    if (I.on) {
      html.setAttribute('lang', I.htmlLang);
      if (I.script) html.setAttribute('data-font', I.script);
    }
    var fontWait = Promise.resolve();
    if (I.font && doc.createElement && doc.head) {
      fontWait = new Promise(function (res) {
        var link = doc.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=' + I.font.replace(/ /g, '+') + ':wght@500;600;700;800&display=swap';
        link.onload = link.onerror = function () { res(); };
        setTimeout(res, 3000);                 // a font that will not come does not hold the game
        doc.head.appendChild(link);
      });
    }
    I.fontReady = function () { return fontWait; };
    if (I.on) {
      if (doc.readyState === 'loading' && doc.addEventListener) doc.addEventListener('DOMContentLoaded', function () { I.applyDom(doc); });
      else I.applyDom(doc);
    } else if (html.classList) html.classList.remove('i18n-wait');
  }

  global.I18N = I;
  if (typeof module !== 'undefined' && module.exports) module.exports = I;
})(typeof window !== 'undefined' ? window : this);

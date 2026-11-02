#!/usr/bin/env node
// playthrough.browser.js — the whole lesson, in a real browser, via Playwright.
'use strict';

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHECKS_ONLY = process.argv.includes('--checks');
const HEADED = process.argv.includes('--headed');
const VOICED = process.env.VOICED === '1' || process.argv.includes('--voiced');
const SHOT_DIR = (() => { const i = process.argv.indexOf('--shots'); return i > 0 ? process.argv[i + 1] : null; })();

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.map': 'application/json'
};

function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': rel.startsWith('assets/') ? 'public, max-age=3600' : 'no-store'
      });
      res.end(buf);
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port })));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let fails = 0;
  const t = (label, ok, extra) => {
    if (ok) console.log('  ok   ' + label);
    else { fails++; console.log('  FAIL ' + label + (extra ? '  ' + extra : '')); }
  };

  const { server, port } = await serve();
  const URL = `http://127.0.0.1:${port}/index.html?story=0` + (process.env.LAN ? '&lan=' + process.env.LAN : '');

  const browser = await chromium.launch({
    ...(process.env.CHROME ? { executablePath: process.env.CHROME } : { channel: 'chrome' }),
    headless: !HEADED,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio',
           '--autoplay-policy=no-user-gesture-required',
           '--disable-features=AudioServiceOutOfProcess,AudioServiceSandbox']
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  if (VOICED) await page.addInitScript(() => {
    const V = window.__voiced = { clips: [], openWhileSpeaking: [], openNotWaiting: [], hintOverVoice: [], dupes: [], words: [] };
    let wordClip = null, partBase = 0, lastLine = null, lastText = '', seenK = null;
    const nWords = (s) => { s = String(s || '').trim(); return s ? s.split(/\s+/).length : 0; };
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver((muts) => {
        const VO = window.VO; if (!VO || !VO.id || !VO.at || !VO.playing) return;
        muts.forEach((m) => {
          const el = m.target;
          if (!el.classList || !el.classList.contains('in') || /\bin\b/.test(m.oldValue || '') || !el.closest) return;
          const line = el.closest('#bubble .bubble-line'); if (!line) return;
          const at = VO.at(); if (at == null) return;
          // one play of one clip; a new bubble for it starts after the last one's words
          if (VO.playing !== wordClip) { wordClip = VO.playing; partBase = 0; lastLine = null; lastText = ''; seenK = new Set(); }
          const text = line.textContent || '';
          if (lastLine && (line !== lastLine || text !== lastText)) partBase += nWords(lastText);
          lastLine = line; lastText = text;
          const r = document.createRange(); r.setStart(line, 0); r.setEndBefore(el);
          const before = r.toString();
          const k = partBase + nWords(before) - (before && !/\s$/.test(before) ? 1 : 0);
          if (seenK.has(k)) return;
          seenK.add(k);
          const cues = VO.words(VO.id) || [];
          if (k >= 0 && k < cues.length) V.words.push({ id: VO.id, k, text: (el.textContent || '').trim(), at: Math.round(at), cue: cues[k] });
        });
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    });
    const P = HTMLMediaElement.prototype, play = P.play, pause = P.pause;
    const idOf = (el) => { const u = el.currentSrc || el.src || ''; if (/^blob:/.test(u) && window.VO && window.VO.id) return window.VO.id;
                           return u.split('/').pop().split('?')[0].replace(/\.(ogg|mp3)$/, ''); };
    P.play = function () {
      const rec = { id: idOf(this), at: Math.round(performance.now()), end: null, screen: window.Game && window.Game.screen };
      V.clips.push(rec); this.__rec = rec;
      this.addEventListener('ended', () => { if (!rec.end) { rec.end = 'ended'; rec.endAt = Math.round(performance.now()); } }, { once: true });
      return play.apply(this, arguments);
    };
    P.pause = function () {
      const rec = this.__rec;
      if (rec && !rec.end && this.currentTime > 0 && this.duration && this.currentTime < this.duration - 0.05) {
        const said = window.VO && window.VO.spoken ? window.VO.spoken(rec.id) : 0;
        rec.end = said && this.currentTime * 1000 >= said - 20 ? 'ended' : 'CUT at ' + this.currentTime.toFixed(2) + 's';
        rec.endAt = Math.round(performance.now());
      }
      return pause.apply(this, arguments);
    };
    const note = (list, what) => { const last = list[list.length - 1]; if (!last || last.what !== what) list.push({ what, n: 1 }); else last.n++; };
    (function watch() {
      try {
        const G = window.Game, VO = window.VO, In = window.Input;
        if (G && G.director && VO && In) {
          const id = VO.id, at = VO.at ? VO.at() : null;
          const speaking = id && at != null && at < ((VO.spoken && VO.spoken(id)) || 99999);
          const open = In.mode() === 'polygon' && G.director.state === 'WAITING_FOR_USER';
          const scr = G.screen + ' ' + ((window.Screens.list[G.screen] || {}).id || '');
          if (open && speaking) note(V.openWhileSpeaking, scr + ' (' + id + ')');
          const hinting = document.querySelector('.gesture-ghost, .hint-hand, .swipe-ghost');
          if (hinting && speaking) note(V.hintOverVoice, scr + ' (' + id + ')');
          const n = (sel) => document.querySelectorAll(sel).length;
          const d = [['.swiftee', 1], ['#bubble', 1], ['.teach-sheet', 1], ['.peek-rim', 1]].filter(([sel, max]) => n(sel) > max).map(([sel]) => sel + ' x' + n(sel));
          if (d.length) note(V.dupes, scr + ' ' + d.join(' '));
        }
      } catch (e) {}
      requestAnimationFrame(watch);
    })();
  });

  const errors = [], missing = [];
  const starved = [];   // the host ran out of memory; see the note on HOST_LIMIT
  let crashed = null;
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('crash', () => { crashed = 'page crashed'; });
  const HOST_LIMIT = /INSUFFICIENT_RESOURCES|OUT_OF_MEMORY|ERR_INSUFFICIENT/i;
  const CANCELLED = /ERR_ABORTED|ERR_CONNECTION_ABORTED/i;
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const from = (m.location() && m.location().url) || '';
    if (from.includes('favicon')) return;
    const text = m.text();
    if (HOST_LIMIT.test(text)) { starved.push('console: ' + text); return; }
    errors.push('console: ' + text);
  });
  page.on('response', (r) => {
    if (r.status() === 404) missing.push(r.url());
  });
  page.on('requestfailed', (r) => {
    if (r.url().includes('fonts.g')) return;
    const why = ((r.failure() || {}).errorText) || '';
    if (HOST_LIMIT.test(why)) { starved.push(r.url() + ' (' + why + ')'); return; }
    if (CANCELLED.test(why)) { starved.push(r.url() + ' (' + why + ')'); return; }
    missing.push(r.url() + ' (' + why + ')');
  });

  const safe = async (fn, fallback) => {
    try { return await fn(); }
    catch (e) { crashed = crashed || String(e.message).split('\n')[0]; return fallback; }
  };

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.Game && window.Game.director, null, { timeout: 20000 });

  await page.evaluate(() => {
    window.__seen = new Set();
    window.__asked = [];
    window.__cues = { correct: 0, wrong: 0 };
    window.SFX.play = (n) => { if (n === 'correct') window.__cues.correct++; if (n === 'wrong') window.__cues.wrong++; return true; };
    window.SFX.sequence = () => 0;
    if (!window.__voiced) {
      window.Game.director.configure({ sayMinMs: 120, msPerWord: 8, feedbackSettleMs: 40, beatCeilingMs: 6000, readablePauseMs: 60 });
      if (window.SFX && SFX.isMuted && !SFX.isMuted()) SFX.mute();
    }
    window.Game.director.on('start', () => window.__seen.add(window.Game.screen));
    window.__buddy = [];
    window.__startAt = {};
    window.Game.director.on('start', () => {
      const at = performance.now(); window.__startAt[window.Game.screen] = at;
      setTimeout(() => {
        const s = window.Game.screen;
        if (s === 0 || performance.now() - (window.__startAt[s] || 0) < 500) return;
        const el = window.Swiftee && window.Swiftee.el; if (!el) return;
        const st = window.Swiftee.state;
        const scr = window.Screens.list[s];
        const waitsToFly = !!(scr.swiftee && scr.swiftee.arrive === 'fly' && !window.Game.buddy.present);
        const on = parseFloat(getComputedStyle(el).opacity) > 0.05 || st === 'enter' || waitsToFly;
        const must = !!(scr.swiftee && scr.swiftee.purpose);
        const may = window.Screens.wantsBuddyAt ? window.Screens.wantsBuddyAt(s)
                  : (window.Screens.wantsBuddy ? window.Screens.wantsBuddy(scr) : must);
        const leaving = st === 'exit', measuring = !!document.querySelector('.swiftee-measuring, .swiftee-angle-measuring') || /measuring/.test((window.Swiftee && window.Swiftee.locked) || '');
        const bad = must ? !(on || leaving || measuring) : (!may && on && !leaving);
        if (bad) window.__buddy.push((s + 1) + ':' + (on ? 'on' : 'off'));
      }, 1400);
    });
    window.Game.director.on('input', ({ spec }) => { window.__pending = spec; window.__asked.push(spec.type); });
  });

  const shot = SHOT_DIR
    ? async (n) => { await safe(() => page.screenshot({ path: path.join(SHOT_DIR, n) })); }
    : async () => {};
  if (SHOT_DIR) fs.mkdirSync(SHOT_DIR, { recursive: true });

  await shot('01-start.png');
  await page.click('#start');

  await sleep(1100);
  const inFlight = await safe(() => page.evaluate(() => {
    const r = window.Swiftee.bounds();
    const el = window.Swiftee.el;
    const settled = el.getBoundingClientRect();
    return {
      visible: getComputedStyle(el).opacity !== '0',
      state: window.Swiftee.state,
      airborne: (function () {
        var c = document.querySelector('canvas.sleigh-intro');
        return !!(c && c.style.display !== 'none' && getComputedStyle(window.Swiftee.el).opacity === '0');
      })(),
      y: Math.round(r.bottom), settledY: Math.round(settled.bottom)
    };
  }), {});
  await shot('02-arrival.png');
  t('he rides in on the sleigh', inFlight.airborne && inFlight.state === 'enter', JSON.stringify(inFlight));

  await safe(() => page.waitForFunction(
    () => { const c = window.Swiftee.el.lastChild; return window.Swiftee.state !== 'enter' &&
          !((c.getAttribute('data-sheet') || '') + getComputedStyle(c).backgroundImage).includes('flapping'); },
    null, { timeout: 20000 }));
  const landed = await safe(() => page.evaluate(() => ({
    visible: getComputedStyle(window.Swiftee.el).opacity !== '0',
    state: window.Swiftee.state,
    grounded: !(((c) => (c.getAttribute('data-sheet') || '') + getComputedStyle(c).backgroundImage)(window.Swiftee.el.lastChild)).includes('flapping')
  })), {});
  t('he lands and settles into talking', landed.visible && landed.grounded, JSON.stringify(landed));

  const handoff = await safe(() => page.evaluate(() => {
    const c = document.querySelector('canvas.sleigh-intro');
    let ink = 0;
    if (c && c.width) {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 400) if (d[i] > 24) ink++;
    }
    return {
      canvasHidden: !c || c.style.display === 'none',
      ink: ink,
      swifteeShown: getComputedStyle(window.Swiftee.el).opacity === '1'
    };
  }), { canvasHidden: false, ink: -1, swifteeShown: false });
  t('the intro hands over to exactly one bird and leaves nothing behind',
    handoff.canvasHidden && handoff.ink === 0 && handoff.swifteeShown, JSON.stringify(handoff));

  await sleep(1200);
  const baseline = await safe(() => page.evaluate(() => ({
    nodes: document.getElementsByTagName('*').length -
           document.querySelectorAll('.layer-panel *, .layer-poly *, .layer-ui *').length,
    anims: document.getAnimations().length
  })), { nodes: 0, anims: 0 });

  await safe(() => page.evaluate(() => {
    window.__rows = {};
    const line = document.querySelector('.bubble-line');
    if (!line) return;
    const sample = () => {
      const bub = document.querySelector('#bubble');
      if (!bub || !bub.classList.contains('show')) return;
      if (parseFloat(getComputedStyle(bub).opacity) < 0.05) return;
      const turn = document.getElementById('rotate');
      if (turn && getComputedStyle(turn).display !== 'none') return;
      const kids = [].slice.call(line.childNodes).filter((n) => n.nodeType === 1 && n.offsetWidth);
      if (!kids.length) return;
      const rows = [];
      kids.forEach((k) => {
        const top = k.offsetTop, bottom = top + k.offsetHeight, mid = (top + bottom) / 2;
        const row = rows.find((r) => mid > r.top && mid < r.bottom);
        if (row) { row.top = Math.min(row.top, top); row.bottom = Math.max(row.bottom, bottom); } else rows.push({ top, bottom });
      });
      const n = rows.length;
      const s = window.Game.screen;
      window.__rows[s] = Math.max(window.__rows[s] || 0, n);
    };
    new MutationObserver(() => setTimeout(sample, 900)).observe(line, { childList: true, subtree: true });
  }), null);
  await shot('03-landed.png');

  /* ---- the child ------------------------------------------------- */

  const toScreen = (pts) => page.evaluate((qs) => {
    const svg = window.Stage.svg, m = svg.getScreenCTM(), pt = svg.createSVGPoint();
    const seat = (window.Stage && window.Stage.seatY) || 0;
    return qs.map((q) => { pt.x = q.x; pt.y = q.y + seat; const r = pt.matrixTransform(m); return { x: r.x, y: r.y }; });
  }, pts);

  const dragPath = async (from, to, steps = 8) => {
    const [a, b] = await toScreen([from, to]);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps);
    }
    await sleep(50);
    await page.mouse.move(b.x, b.y);
    await sleep(50);
    await page.mouse.up();
  };

  const tapNth = async (sel, n = 0) => {
    const box = await page.evaluate(({ s, i }) => {
      const el = window.Stage.svg.querySelectorAll(s)[i];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, { s: sel, i: n });
    if (!box) return false;
    await page.mouse.click(box.x, box.y);
    return true;
  };

  const st = () => page.evaluate(() => {
    const s = window.Stage.state;
    return { verts: s.verts, n: s.n, picked: s.picked, segment: s.segment, sidesDone: (s.sidesDone || []).length,
             diagonals: (s.diagonals || []).map((d) => [d[0], d[1]]) };
  });

  async function act(spec) {
    await page.waitForFunction(() => !window.Input.guarded, null, { timeout: 6000 }).catch(() => {});
    const free = () => page.waitForFunction(() => window.Input.mode() !== 'locked', null, { timeout: 15000 }).catch(() => {});

    switch (spec.type) {
      case 'summary-review': {
        await page.waitForSelector('#next.show', { timeout: 60000 });
        await page.click('#next');
        await page.waitForFunction(() => !document.querySelector('#next.show'), null, { timeout: 10000 });
        return;
      }
      case 'tap-anywhere': {
        const scr = await page.evaluate(() => window.Game.screen);
        // (on to the next screen — or, after the last one, the finale)
        await page.waitForFunction(s => window.Game.screen !== s || window.Input.mode() !== 'dialogue' ||
          !!document.querySelector('#hud .replay.show'), scr, { timeout: 30000 });
        if (await page.evaluate(() => !!document.querySelector('#next.show'))) throw new Error('a Next button showed in the lesson on screen ' + scr);
        return;
      }

      case 'vertex-pick':
        await page.waitForFunction(() => window.Stage.svg.querySelectorAll('.vertex').length > 0, null, { timeout: 8000 });
        await tapNth('.vertex', 0);
        return;

      case 'draw-diagonal':
      case 'draw-diagonals': {
        const s = await st();
        const from = spec.from === 'picked' ? s.picked : spec.from;
        if (spec.sides && s.sidesDone === 0) { await dragPath(s.verts[from], s.verts[(from + 1) % s.n]); return; }
        if (spec.sides && s.sidesDone === 1) { await dragPath(s.verts[from], s.verts[(from + s.n - 1) % s.n]); return; }
        const used = new Set(s.diagonals.map((d) => d.slice().sort((a, b) => a - b).join('-')));
        const adj = (i, j) => Math.abs(i - j) === 1 || Math.abs(i - j) === s.n - 1;
        const targets = [];
        for (let j = 0; j < s.n; j++) {
          if (j === from || adj(from, j)) continue;
          if (used.has([Math.min(from, j), Math.max(from, j)].join('-'))) continue;
          targets.push(j);
        }
        for (let k = 0; k < (spec.count || 1) && k < targets.length; k++) {
          await free();
          const cur = await st();
          await dragPath(cur.verts[from], cur.verts[targets[k]]);
          await sleep(140);
        }
        return;
      }

      case 'drag-vertex': {
        const s = await st();
        const i = spec.vertex === 'any' ? 0 : spec.vertex;
        const c = s.verts.reduce((a, p) => ({ x: a.x + p.x / s.verts.length, y: a.y + p.y / s.verts.length }), { x: 0, y: 0 });
        const tt = s.verts.length === 4 ? 1.35 : 0.9;   // (a quadrilateral's dent is past its middle)
        const to = spec.until === 'concave'
          ? { x: s.verts[i].x + (c.x - s.verts[i].x) * tt, y: s.verts[i].y + (c.y - s.verts[i].y) * tt }
          : { x: s.verts[i].x + 30, y: s.verts[i].y - 80 };
        await dragPath(s.verts[i], to, 16);
        return;
      }

      case 'choice': {
        await page.waitForFunction(() => window.Stage.svg.querySelectorAll('.choice').length > 0, null, { timeout: 8000 });
        const idx = await page.evaluate((want) =>
          [...window.Stage.svg.querySelectorAll('.choice')].findIndex((e) => e.getAttribute('data-label') === want), spec.correct);
        await tapNth('.choice', Math.max(0, idx));
        return;
      }

      case 'multi-select': {
        await page.waitForFunction(() => window.Stage.svg.querySelectorAll('.card').length > 0, null, { timeout: 8000 });
        const flags = await page.evaluate(() => [...window.Stage.svg.querySelectorAll('.card')].map((c) => !!(c._opt && c._opt.correct)));
        for (let i = 0; i < flags.length; i++) if (flags[i]) { await free(); await tapNth('.card', i); await sleep(150); }
        return;
      }

      case 'tap-each': {
        const sel = spec.targets === 'sides' ? '.edge' : '.vertex';
        for (let k = 0; k < (spec.count || 5); k++) { await tapNth(sel, k); await sleep(140); }
        return;
      }

      case 'swipe': {
        for (let guard = 0; guard < 30; guard++) {
          const st = await page.evaluate(() => {
            const S = window.Stage.state.swipe;
            if (!S) return null;
            if (S.i >= S.items.length) return 'done';
            if (!S.card) return 'wait';
            return {
              i: S.i,
              right: window.Poly.isRegular(S.card._verts) ? 'regular' : 'irregular',
              home: { x: 500, y: 268 }
            };
          });
          if (st === null || st === 'done') return;
          if (st === 'wait') { await sleep(140); continue; }

          const handedBack = () => page.waitForFunction(() => window.Input.mode() !== 'locked' || !window.Stage.state.swipe, null, { timeout: 15000 });
          await handedBack();

          const left = { x: st.home.x - 150, y: st.home.y };
          const right = { x: st.home.x + 150, y: st.home.y };
          const toward = (side) => (side === 'regular' ? left : right);
          const other = st.right === 'regular' ? 'irregular' : 'regular';

          if (st.i === 0) {
            // a twitch: must not classify
            await dragPath(st.home, { x: st.home.x + 14, y: st.home.y }, 4);
            await sleep(220);
            const moved = await page.evaluate(() => window.Stage.state.swipe.i);
            if (moved !== 0) throw new Error('a 14px twitch classified the card');
            // the wrong side: must not advance
            await dragPath(st.home, toward(other), 8);
            await sleep(700);
            const stillHere = await page.evaluate(() => window.Stage.state.swipe.i);
            if (stillHere !== 0) throw new Error('a wrong swipe advanced the round');
            // and while he is up saying why, the card is his: a swipe does nothing
            const locked = await page.evaluate(() => window.Input.mode() === 'locked');
            if (!locked) throw new Error('the card could be taken while he was answering a wrong swipe');
            await dragPath(st.home, toward(st.right), 8);
            await sleep(250);
            const heldStill = await page.evaluate(() => window.Stage.state.swipe.i);
            if (heldStill !== 0) throw new Error('a swipe while he was speaking was taken as an answer');
            await handedBack();
          }

          const before = st.i;
          await dragPath(st.home, toward(st.right), 8);
          await page.waitForFunction((b) => {
            const S = window.Stage.state.swipe;
            return !S || S.i > b;
          }, before, { timeout: 6000 }).catch(() => {});
          await sleep(120);
        }
        return;
      }

      case 'sort': {
        for (let guard = 0; guard < 26; guard++) {
          const move = await page.evaluate(() => {
            const S = window.Stage.state.sort;
            if (!S || S.placed >= S.total) return null;
            const item = S.items.find((it) => !it._placed);
            if (!item) return 'wait';
            const c = window.Poly.classify(item._verts);
            const bin = S.bins.find((b) => ({ convex: c.convex, concave: c.concave, regular: c.regular, irregular: c.irregular })[b._bin.id]);
            if (!bin) return 'wait';
            return { from: item._pos || item._home,
                     to: { x: bin._rect.x + bin._rect.w / 2, y: bin._rect.y + bin._rect.h / 2 } };
          });
          if (move === null) return;
          if (move === 'wait') { await sleep(150); continue; }
          await free();
          await dragPath(move.from, move.to, 8);
          await sleep(180);
        }
        return;
      }

    }
  }

  const N = await page.evaluate(() => window.Screens.list.length);
  const t0 = Date.now();
  let stalls = 0, lastScreen = -1, lastChange = Date.now(), stalled = null;

  while (!CHECKS_ONLY && Date.now() - t0 < (VOICED ? 1500000 : 360000) && !crashed) {
    const done = await safe(() => page.evaluate(() => !!document.querySelector('#hud .replay.show')), true);
    if (done || crashed) break;

    const screen = await safe(() => page.evaluate(() => window.Game.screen), lastScreen);
    if (screen !== lastScreen) { lastScreen = screen; lastChange = Date.now(); }
    else if (Date.now() - lastChange > (VOICED ? 180000 : 60000)) {
      stalled = await safe(() => page.evaluate(() => {
        const s = window.Stage.state, S = s.sort;
        return { screen: window.Game.screen, id: (window.Screens.list[window.Game.screen] || {}).id,
                 mode: window.Input.mode(), guarded: window.Input.guarded, kind: s.kind,
                 next: !!document.querySelector('#next.show'),
                 sort: S ? { placed: S.placed, total: S.total } : null };
      }), null);
      stalls++; break;
    }

    const spec = await safe(() => page.evaluate(() => { const s = window.__pending; window.__pending = null; return s; }), null);
    if (spec) {
      try { await act(spec); }
      catch (e) {
        const msg = String(e.message).split('\n')[0];
        if (/Target closed|crash|Session closed|closed/i.test(msg)) { crashed = crashed || msg; break; }
        errors.push('act ' + spec.type + ' on screen ' + screen + ': ' + msg);
      }
    }
    await sleep(50);
  }

  const finished = await safe(() => page.evaluate(() => !!document.querySelector('#hud .replay.show')), false);
  const seen = await safe(() => page.evaluate(() => window.__seen.size), 0);
  const asked = await safe(() => page.evaluate(() => window.__asked), []);
  const cues = await safe(() => page.evaluate(() => window.__cues), { correct: 0, wrong: 0 });
  const screen = await safe(() => page.evaluate(() => window.Game.screen), -1);
  await shot('04-finish.png');

  /* ---- the checks only a browser can make ------------------------ */

  const hit = await safe(() => page.evaluate(() => {
    const r = window.Stage.svg.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height * 0.8);
    let node = el, chain = [];
    while (node && chain.length < 6) {
      const cls = node.className;
      chain.push(node.id || (cls && (typeof cls === 'string' ? cls : cls.baseVal)) || node.tagName || node.nodeName);
      node = node.parentNode;
    }
    return { id: el && el.id, chain: chain.join(' < ') };
  }), { id: null, chain: '' });
  t('a tap in the play area reaches the stage, not an overlay',
    hit.id !== 'start' && !/loading/.test(hit.chain), JSON.stringify(hit));

  const pivot = await safe(() => page.evaluate(async () => {
    const rect = () => { const r = window.Swiftee.el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width)]; };
    const nap = (ms) => new Promise((r) => setTimeout(r, ms));
    let prev = '', same = 0;
    for (let i = 0; i < 40 && same < 3; i++) {
      await nap(120);
      const now = JSON.stringify(rect());
      same = now === prev ? same + 1 : 0;
      prev = now;
    }
    const out = [];
    const screenOf = () => (window.Game && window.Game.screen) + '|' + (window.Swiftee && (window.Swiftee.pos + ':' + window.Swiftee.size));
    const settled = async () => {
      for (let k = 0; k < 20; k++) {
        const moving = (window.Swiftee.el.getAnimations ? window.Swiftee.el.getAnimations() : []).filter((a) => a.playState === 'running');
        if (!moving.length) return;
        await nap(60);
      }
    };
    for (const s of ['idle', 'wave', 'think', 'celebrate', 'confused', 'surprised', 'point', 'idle']) {
      window.Swiftee.play(s);
      await new Promise((r) => setTimeout(r, 450));
      await settled();
      out.push([s, rect(), screenOf()]);
    }
    return out;
  }), [['none', [0, 0, 0]]]);
  // Only readings from the same screen can be compared with each other.
  const onScreen = pivot[0] && pivot[0][2];
  const sameScreen = pivot.filter((p) => p[2] === onScreen);
  const first = sameScreen.length ? JSON.stringify(sameScreen[0][1]) : '[]';
  const drift = sameScreen.filter((p) => JSON.stringify(p[1]) !== first);
  t('Swiftee does not shift when the expression changes', drift.length === 0,
    drift.map((d) => d[0] + '=' + d[1].join(',')).join(' '));

  const sprite = await safe(() => page.evaluate(async () => {
    const cell = window.Swiftee.el.lastChild, seen = new Set();
    for (let i = 0; i < 12; i++) { seen.add(cell.getAttribute('data-frame') || getComputedStyle(cell).backgroundPosition); await new Promise((r) => setTimeout(r, 60)); }
    return { frames: seen.size, image: cell.getAttribute('data-sheet') || getComputedStyle(cell).backgroundImage, scale: window.Swiftee.scale };
  }), { frames: 0, image: '' });
  t('the sprite sheet is loaded and advancing frames',
    sprite.frames > 2 && /swiftee_/.test(sprite.image), JSON.stringify(sprite).slice(0, 120));

  /* Nothing cropped, nothing oversized, nothing overlapping. */
  const fitCheck = await safe(() => page.evaluate(() => {
    const r = window.Swiftee.el.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight;
    return {
      offLeft: Math.round(0 - r.left), offTop: Math.round(0 - r.top),
      offRight: Math.round(r.right - vw), offBottom: Math.round(r.bottom - vh),
      heightPct: Math.round(r.height / vh * 100)
    };
  }), {});
  t('Swiftee is fully on screen, not cropped at any edge',
    fitCheck.offLeft <= 1 && fitCheck.offTop <= 1 && fitCheck.offRight <= 1 && fitCheck.offBottom <= 1,
    JSON.stringify(fitCheck));
  t('Swiftee is not oversized', fitCheck.heightPct > 0 && fitCheck.heightPct <= 46, fitCheck.heightPct + '% of window height');

  const overlap = await safe(() => page.evaluate(() => {
    const box = (s) => { const e = document.querySelector(s); if (!e || !e.classList.contains('show')) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
    const over = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const parts = window.Stage.contentParts ? window.Stage.contentParts() : [];
    const hits = [];
    const bubble = box('#bubble'), card = box('#instruction');
    const hud = document.querySelector('#hud').getBoundingClientRect();
    let bird = window.Swiftee.bounds && window.Swiftee.bounds();
    if (window.Swiftee.pos === 'peek') bird = null;
    const against = (r, label) => { if (r && parts.some((p) => over(r, p))) hits.push(label); };
    against(bubble, 'bubble/stage');
    against(card, 'card/stage');
    against(bird, 'swiftee/stage');
    if (over(bubble, card)) hits.push('bubble/card');
    if (over(card, hud)) hits.push('card/hud');
    if (over(bubble, hud)) hits.push('bubble/hud');
    return hits.length ? { screen: window.Game.screen, id: (window.Screens.list[window.Game.screen] || {}).id, hits: hits } : null;
  }), null);
  t('no overlay covers the lesson, the character or another overlay',
    !overlap, overlap ? 'screen ' + (overlap.screen + 1) + ' ' + overlap.id + ': ' + overlap.hits.join(', ') : '');

  const bg = await safe(() => page.evaluate(() => {
    const back = document.getElementById('backdrop');
    const css = back ? getComputedStyle(back).backgroundImage : '';
    return { src: /ice-vista/.test(css) ? css : null,
             flakes: document.querySelectorAll('.weather .flake').length,
             gust: document.querySelectorAll('.weather .gust .flake').length,
             dots: document.querySelectorAll('.weather circle:not([fill^="url"])').length,
             clouds: document.querySelectorAll('.weather .cloud').length };
  }), { src: null, flakes: 0, clouds: 0 });
  t('the painted vista is present with its weather',
    !!bg.src && bg.flakes > 10 && bg.gust > 0 && bg.dots === 0, JSON.stringify(bg));
  t('no vector clouds are drawn over the painted sky', bg.clouds === 0, String(bg.clouds));

  await safe(() => page.setViewportSize({ width: 400, height: 820 }));
  await sleep(900);
  await shot('05-portrait.png');
  const portrait = await safe(() => page.evaluate(() => {
    const r = window.Swiftee.el.getBoundingClientRect();
    const turn = document.getElementById('rotate');
    const ts = turn && getComputedStyle(turn);
    const tb = turn && turn.getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
             cropped: r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1,
             asksToTurn: !!(ts && ts.display !== 'none' && tb.width >= innerWidth - 1 && tb.height >= innerHeight - 1) };
  }), { overflow: 0, cropped: false, asksToTurn: false });
  t('no horizontal overflow at phone width', portrait.overflow <= 0, JSON.stringify(portrait));
  t('a portrait phone is asked to turn', portrait.asksToTurn, JSON.stringify(portrait));

  if (!CHECKS_ONLY) {
    t('played to the end and the replay button appeared', finished, 'stopped at screen ' + screen);
    t('all ' + N + ' screens were visited', seen === N, seen + '/' + N);
    const buddy = await safe(() => page.evaluate(() => window.__buddy), []);
    t('Swiftee is on screen only where he has a purpose', buddy.length === 0, buddy.join(' '));
    t('all 11 interaction types were exercised', new Set(asked).size === 11, [...new Set(asked)].join(','));
    t('correct cues fired', cues.correct > 0, JSON.stringify(cues));
    t('never stalled on a screen', stalls === 0, stalled ? JSON.stringify(stalled) : '');
    if (VOICED) {
      const V = await safe(() => page.evaluate(() => window.__voiced), null);
      if (V) {
        const cut = V.clips.filter((c) => /CUT/.test(c.end || ''));
        const over = [];
        for (let i = 1; i < V.clips.length; i++) { const a = V.clips[i - 1], b = V.clips[i]; if (a.endAt && b.at < a.endAt - 40) over.push(b.id + ' over ' + a.id); }
        console.log('  note  voiced: ' + V.clips.length + ' clips played');
        t('voiced: no line cut off before its last word', cut.length === 0, cut.map((c) => c.id + ' ' + c.end + ' (screen ' + c.screen + ')').join('; '));
        t('voiced: one voice at a time', over.length === 0, over.join('; '));
        t('voiced: no input open while he is speaking', V.openWhileSpeaking.length === 0, JSON.stringify(V.openWhileSpeaking.slice(0, 6)));
        t('voiced: no hint over his voice', V.hintOverVoice.length === 0, JSON.stringify(V.hintOverVoice.slice(0, 6)));
        t('voiced: nothing on the page twice', V.dupes.length === 0, JSON.stringify(V.dupes.slice(0, 6)));
        const lag = V.words.map((w) => ({ ...w, e: w.at - w.cue }));
        const early = lag.filter((w) => w.e < -60), late = lag.filter((w) => w.e > (w.k === 0 ? 260 : 180));
        const es = lag.map((w) => w.e).sort((a, b) => a - b);
        console.log('  note  voiced: ' + lag.length + ' words timed against the voice; lag median ' + (es[es.length >> 1] || 0) + ' ms, 95% within ' + (es[Math.floor(es.length * 0.95)] || 0) + ' ms');
        t('voiced: every word appears as it is said', lag.length > 100 && !early.length && !late.length,
          early.concat(late).slice(0, 8).map((w) => w.id + ' "' + w.text + '" at ' + w.at + ' ms, said at ' + w.cue).join('; ') || ('only ' + lag.length + ' words seen'));
      }
    }
  }
  if (!CHECKS_ONLY) {
    const settled = await safe(() => page.evaluate(async () => {
      await new Promise((r) => setTimeout(r, 1500));
      return { nodes: document.getElementsByTagName('*').length -
                      document.querySelectorAll('.layer-panel *, .layer-poly *, .layer-ui *').length,
               anims: document.getAnimations().length };
    }), { nodes: 1e9, anims: 1e9 });
    const grew = { nodes: settled.nodes - baseline.nodes, anims: settled.anims - baseline.anims };
    t('nothing leaks across a full lesson', grew.nodes < 120 && grew.anims < 60,
      JSON.stringify({ baseline, settled, grew }));
  }

  if (!CHECKS_ONLY) {
    const rows = await safe(() => page.evaluate(() => window.__rows || {}), {});
    const wrapped = Object.keys(rows).filter((k) => rows[k] > 1);
    const bad = Object.keys(rows).filter((k) => rows[k] > 3);
    console.log('  note  lines measured: ' + Object.keys(rows).length +
      ', on one row: ' + (Object.keys(rows).length - wrapped.length) +
      (wrapped.length ? ', wrapping: ' + wrapped.map((k) => (Number(k) + 1) + '(' + rows[k] + ')').join(' ') : ''));
    t('no line runs past three rows', bad.length === 0,
      bad.map((k) => 'screen ' + (Number(k) + 1) + ' = ' + rows[k] + ' rows').join(', '));
  }

  if (!CHECKS_ONLY) {
    const scene = await safe(() => page.evaluate(() => ({
      suppressed: window.Stage.staleSuppressed,
      pending: window.Stage.pendingTimers
    })), { suppressed: -1, pending: -1 });
    t('no scene leaves timers running behind it', scene.pending === 0, JSON.stringify(scene));
  }

  t('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  t('no missing assets', missing.length === 0, missing.slice(0, 3).join(' | '));
  t('the browser survived the run', !crashed, crashed || '');
  if (starved.length) {
    console.log('  note  the host ran out of memory ' + starved.length + ' time(s) — not a build failure');
    console.log('        ' + starved[0]);
  }

  console.log('  ' + (CHECKS_ONLY ? 'render checks only' : `screens: ${N}, inputs answered: ${asked.length}`) +
              `, elapsed ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(fails ? `\n${fails} FAILED` : '\nbrowser playthrough clean');

  await browser.close().catch(() => {});
  server.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error('\nbrowser playthrough could not complete: ' + String(e.message).split('\n')[0]);
  console.error('(if this box is short of memory for a headless Chrome, try --checks)');
  process.exit(1);
});

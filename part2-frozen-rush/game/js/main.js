// Entry point.

import { createGame, CFG } from './engine.js';
import { Hud } from './hud.js';
import { Frontend } from './frontend.js';
import { Tutorial } from './tutorial.js';

const canvas = document.getElementById('game-canvas');
const hud = new Hud(document);

hud.setQuestions({
  band: CFG.levelOne.phases.map(p => p.instruction),        // the six rope crossings, left band
  centered: CFG.levelTwo.levels.map(c => c.instruction)     // Part 2's three, middle of the stage
});

const params = new URLSearchParams(location.search);
const num = (key, min, max, fallback) => {
  const v = Number(params.get(key));
  return Number.isFinite(v) && v >= min && v <= max ? v : fallback;
};
const flag = (key, fallback) => {
  const v = params.get(key);
  if (v === null) return fallback;
  return v !== '0' && v !== 'false';
};

const options = {
  speed: num('speed', 300, 900, 520),
  fast: num('fast', 1, 8, 1),
  sound: flag('sound', true),
  reduced: flag('reduced', false),
  // review tools (the skip-to-ending control). Off in a shipped build.
  dev: flag('dev', false)
};

let front = null;

let tut = null;
let lastComplete = false;

const jumpAt = options.dev ? params.get('at') : null;
let devSel = null;       // the bar's picker, kept in step with the crossing being played

const tutFlag = params.get('tutorial');
const wantTutorial = tutFlag !== '0' && tutFlag !== 'false';

const lessonPart = params.get('lesson') || (flag('intro', false) ? 'intro' : flag('resume', false) ? 'end' : null);
const hosted = window.parent !== window;
const tutMode = lessonPart === 'intro' ? 'intro' : lessonPart === 'end' ? 'end' : 'full';
// ?lesson=end in the lesson's frame has no cover: the host says when to begin
const coverless = hosted && lessonPart === 'end';
const devAt = options.dev ? params.get('devat') : null;       // review: ?devat=break, straight to the break
function tellHost(word, more) {
  if (!hosted) return;
  try { window.parent.postMessage(Object.assign({ iceAge: word }, more || {}), '*'); } catch (e) { /* no host */ }
}
function handOffToLesson(where) {
  if (hosted) { tellHost('lesson', { where }); return; }
  const q = new URLSearchParams({ intro: '0', auto: '1' });
  if (options.dev) q.set('dev', '1');
  const lan = globalThis.I18N && globalThis.I18N.on ? globalThis.I18N.lang : '';
  if (lan) q.set('lan', lan);                                // the lesson in the game's language
  location.href = '../../part1-swiftee-lesson/index.html?' + q.toString();
}

const stageEl = document.getElementById('stage');
const wantScale = () => {
  const forced = Number(params.get('rs'));
  if (Number.isFinite(forced) && forced >= 1 && forced <= 2) return forced;
  const r = stageEl ? stageEl.getBoundingClientRect() : null;
  const cssW = r && r.width ? r.width : window.innerWidth;
  const k = cssW * (window.devicePixelRatio || 1) / 1920;
  return Math.min(2, Math.max(0.5, Math.round(k * 4) / 4));
};

if (document.fonts && document.fonts.load) {
  for (const w of [700, 800, 900]) document.fonts.load(w + ' 20px "Baloo 2"').catch(() => {});
}

const wantHd = () => {
  const forced = params.get('hd');
  if (forced === '1') return true;
  if (forced === '0') return false;
  if (params.has('rs')) return Number(params.get('rs')) >= 1.15;
  const r = stageEl ? stageEl.getBoundingClientRect() : null;
  const cssW = r && r.width ? r.width : window.innerWidth;
  const mem = navigator.deviceMemory;                 // Chrome only; undefined elsewhere
  return wantScale() >= 1.15 && cssW >= 1000 && !(mem && mem < 4);
};

const game = createGame(canvas, {
  renderScale: wantScale(),
  sound: options.sound,                  // known before the loading bar plans its list: a muted run fetches no soundtrack
  hidden: () => { const el = document.getElementById('rotate'); return !!(el && !el.hidden); },
  hdArt: wantHd(),
  renderScaleForced: params.has('rs'),   // a forced scale is a request; the fps guard leaves it alone
  onReady: () => {
    tellHost('ready');                   // the art is in: Play is live, or a hosted run can start
    if (coverless) { readyToBegin = true; if (beginAsked) beginHosted(); return; }
    if (flag('p2', false)) { game.begin(); game.skipToPartTwo(); return; }
    if (jumpAt !== null) {
      game.begin();
      if (jumpAt === 'end') game.skipToEnd(); else game.skipToCrossing(Number(jumpAt));
      return;
    }
    if (flag('skip', false)) { game.begin(); startTutorial(); return; }
    if (front) game.loaded.then(() => front.setLoading(false));   // and every file is in: the bar's last step
  },
  onHud: state => {
    hud.update(state);
    if (devSel) devSel.value = state.complete ? 'end' : state.playing ? String(state.step) : '';
    if (front && !!state.complete !== lastComplete) {
      lastComplete = !!state.complete;
    }
  }
});

setInterval(() => hud.syncVoice(game), 25);

function startTutorial() {
  if (!wantTutorial || tut) return;
  tut = new Tutorial(document, game, {
    mode: tutMode,
    onHandOff: handOffToLesson,
    // the return's break: held still for the lesson's Swiftee, who answers with 'said'
    onHost: hosted ? (id, where) => tellHost('swiftee', { id, where }) : null
  });
  tut.begin();
  // review: straight to the break (the run is skipped to it by skipToPartTwo)
  if (devAt === 'break') tut.skipTo(tutMode === 'end' ? 'host' : 'gap');
  let last = performance.now();
  const tick = now => {
    if (!tut || tut.done) { tut = null; return; }
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    try {
      tut.update(dt);
    } catch (err) {
      console.error('the tutorial stopped on an error; the game continues without it', err);
      try { tut.finish(); } catch (e) { game.setPaused(false); }
      tut = null;
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

{
  const veil = document.getElementById('p2-veil');
  const focus = document.getElementById('p2-focus');
  let wasOn = false;
  const tick = () => {
    requestAnimationFrame(tick);
    hud.syncVoice(game);
    if (!veil || !focus) return;
    let on = false;
    try { on = !!game.debug().p2Focus; } catch (e) { on = false; }
    if (on !== wasOn) {
      wasOn = on;
      veil.hidden = !on;
      focus.hidden = !on;
      // leave nothing behind on the way out, or the last frame of the slab lingers
      if (!on) {
        const fx = focus.getContext('2d');
        if (fx) fx.clearRect(0, 0, focus.width, focus.height);
      }
    }
    if (on) game.renderFocus(focus, 'slab');
  };
  requestAnimationFrame(tick);
}

{
  const stage = document.getElementById('stage');
  const REACH = 130;
  const overRope = e => {
    let G; try { G = game.debug(); } catch (err) { return false; }
    if (!G || G.state !== 'PHASE_ACTIVE' || !G.l1 || !stage) return false;
    const r = stage.getBoundingClientRect();
    if (!r.width) return false;
    const sx = (e.clientX - r.left) / r.width * 1920, sy = (e.clientY - r.top) / r.height * 1080;
    const k = G.zoom || 1;
    const px = k > 1.0005 ? G.zoomVX + (sx - G.zoomVX) / k : sx;
    const py = k > 1.0005 ? G.zoomVY + (sy - G.zoomVY) / k : sy;
    for (const s of G.l1.shapes) {
      if (s.state !== 'hang') continue;
      const ax = s.anchorX === undefined ? s.x : s.anchorX;
      if (py < s.y - (s.h || 200) / 2 + 40 && Math.abs(px - ax) < REACH) return true;
    }
    return false;
  };
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    if (stage) stage.classList.toggle('on-rope', overRope(e));
  }, { passive: true });
  canvas.addEventListener('pointerleave', () => { if (stage) stage.classList.remove('on-rope'); });
}

game.setOptions(options);

if (!flag('skip', false) && jumpAt === null && !coverless) {
  front = new Frontend(document, game);
  front.init({
    onPress: () => {
      tellHost('play');
      if (hosted) { try { if (window.parent.__lessonUnlock) window.parent.__lessonUnlock(); } catch (e) { /* another origin */ } }
    },
    onStart: () => {
      game.begin();
      if (devAt === 'break') game.skipToPartTwo();
      startTutorial();
    }
  });
  front.setLoading(true);
  game.loadProgress(f => front.setProgress(f));
}

let readyToBegin = false, beginAsked = false, begun = false;
function beginHosted() {
  beginAsked = true;
  if (!coverless || begun || !readyToBegin) return;
  begun = true;
  game.holdAudio(false);                // its sound comes up with it
  game.begin();
  if (devAt === 'break') game.skipToPartTwo();
  startTutorial();
  tellHost('running');
}
if (lessonPart && hosted) {
  window.iceAgeBegin = beginHosted;
  window.iceAgeUnlock = () => game.unlockAudio();
  window.addEventListener('message', (e) => {
    if (e.source !== window.parent || !e.data || typeof e.data !== 'object') return;
    const w = e.data.iceAge;
    if (w === 'begin') beginHosted();
    else if (w === 'jump') game.jump();
    else if (w === 'said') { if (tut) tut.didAction('host'); }
    else if (w === 'quiet') { game.fadeMusic(900); setTimeout(() => game.suspendAudio(), 1000); }
  });
}

if (options.dev && !hosted) {
  const bar = document.createElement('div');
  bar.className = 'dev-bar';
  bar.setAttribute('data-dev', '1');
  const tag = document.createElement('span');
  tag.className = 'dev-tag'; tag.textContent = 'DEV';
  const back = document.createElement('a');
  back.className = 'dev-go';
  back.href = '../../part1-swiftee-lesson/index.html?dev=1' + (globalThis.I18N && globalThis.I18N.on ? '&lan=' + globalThis.I18N.lang : '');
  back.textContent = '◀ Part 1';
  const sel = document.createElement('select');
  sel.setAttribute('aria-label', 'Jump to screen');
  const drawing = (CFG.levelTwo && CFG.levelTwo.levels) || [];
  const rope = (CFG.levelOne && CFG.levelOne.phases) || [];
  const items = [['', 'Title screen']]
    .concat(drawing.map((c, i) => [String(i), (i + 1) + '. ' + c.instruction]))
    .concat(rope.map((p, i) => [String(drawing.length + i), (drawing.length + i + 1) + '. ' + p.instruction]))
    .concat([['end', 'Ending']]);
  for (const [value, label] of items) {
    const o = document.createElement('option');
    o.value = value; o.textContent = label;
    sel.appendChild(o);
  }
  sel.value = jumpAt === null ? '' : jumpAt;
  sel.addEventListener('change', () => {
    const q = new URLSearchParams(location.search);
    q.set('dev', '1');
    if (sel.value === '') q.delete('at'); else q.set('at', sel.value);
    location.search = q.toString();
  });
  bar.append(tag, back, sel);
  document.body.appendChild(bar);
  devSel = sel;
}

{
  let refitTimer = 0;
  const refit = () => { clearTimeout(refitTimer); refitTimer = setTimeout(() => game.setRenderScale(wantScale()), 120); };
  window.addEventListener('resize', refit);
  window.addEventListener('orientationchange', refit);
}
if (coverless) game.holdAudio(true);
game.warmAudio();

if (window.Juice) {
  try { Juice.stage(document.getElementById('stage')); Juice.configure({ sound: false, particles: false, intensity: 0.9 }); }
  catch (e) { /* no juice: the controls still work, they just do not bounce */ }
}

hud.bind({
  onPause: paused => game.setPaused(paused),
  onReplay: () => game.restart(),
  // returns the new state so the HUD can swap the glyph without asking again
  onSound: () => game.toggleSound(),
  // re-states the objective; it never reveals which chunk is the answer
  onHint: () => game.replayInstruction()
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && !hud.paused) { game.setPaused(true); game.suspendAudio(); }
  else if (!document.hidden && !hud.paused) { game.setPaused(false); game.resumeAudio(); }
});

window.addEventListener('beforeunload', () => {
  game.destroy();
  hud.destroy();
  if (tut) tut.destroy();
  if (front) front.destroy();
});

// Handy for debugging from the console; harmless in production.
window.iceAgeGame = game;

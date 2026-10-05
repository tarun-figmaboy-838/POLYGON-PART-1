/* Entry point.
   Boots the canvas engine, the DOM HUD and the cover/character-select front end,
   and exposes a few optional URL overrides for playtesting:

     index.html?speed=380      run speed in px/s (300–900)
     index.html?sound=0        start muted
     index.html?reduced=1      reduced-motion mode (less shake, fewer particles)
     index.html?skip=1         skip the cover/select screens and run immediately
     index.html?p2=1           straight to PART 2 — begins the run and jumps to the
                               collapse that opens Part 2's first level, so the whole
                               sequence plays without the seven Part 1 crossings first.
                               The tutorial is suppressed with it (it teaches Part 1).
     index.html?tutorial=0     never show the first-play tutorial
     index.html?tutorial=1     always show it, however many times it has been seen
     index.html?fast=4         fast-forward: simulation steps per rendered frame (1–8).
                               Steps the simulation rather than scaling dt, so physics
                               is identical to normal play — it just spends less wall
                               clock. Every pause in the game is a fixed duration in
                               milliseconds, so ?speed cannot shorten a playthrough.
*/

import { createGame, CFG } from './engine.js';
import { Hud } from './hud.js';
import { Frontend } from './frontend.js';
import { Tutorial } from './tutorial.js';

const canvas = document.getElementById('game-canvas');
const hud = new Hud(document);

/* EVERY QUESTION THE PLANK CAN CARRY, handed over before the first one is shown.
   The board sizes its type to the longest of them once and keeps that size for the whole
   game, instead of re-fitting itself to each sentence — see Hud.setQuestions. Read from
   CFG rather than listed here, so a crossing added later is measured with the rest. */
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

/* ?panel=1 — THE PROGRESS PANEL'S ALIGNMENT, VISIBLE, IN THE REAL GAME.
 *
 * The card's frame is a nine-sliced picture and the journey inside it is a percentage
 * safe area, so "is it aligned?" is a question about two things that are drawn by
 * different mechanisms and cannot be compared by eye. The overlay draws the boundaries
 * the numbers actually describe — the card, the safe area, where the art's own cavity
 * is, the stones' shared baseline and each stone's centre — so a misalignment is
 * something you can see and measure rather than something you suspect.
 *
 * A query flag rather than a build switch: it costs nothing when it is off, and it is
 * the same way every other review control here is reached. Shift+P toggles it too, so
 * it can be turned on in the middle of a crossing without reloading and losing the run. */
if (flag('panel', false) && hud.el && hud.el.trail) hud.el.trail.classList.add('debug');
window.addEventListener('keydown', e => {
  if (e.key === 'P' && e.shiftKey && hud.el && hud.el.trail) hud.el.trail.classList.toggle('debug');
});

/* ...AND THE GUIDES ALONE WERE NOT ENOUGH. Shift+P draws the boundaries but nothing can
   be moved, which is the wrong half of the job: seeing that the row sits 68px inside the
   cavity does not tell you what it should be instead. The editor makes the same parts
   draggable, in the running game — where Momo is walking, the crossings are arriving and
   the card slides away for a question, none of which a still mock-up shows.

   Imported dynamically so it costs a shipped build nothing: the file is never fetched
   unless ?panel=1 is on the URL. It fails quietly if it is not there — over file:// a
   module cannot be fetched at all, which is a limitation of the scheme, not a fault. */
if (flag('panel', false)) {
  import('./panel-edit.js')
    .then(m => { if (hud.el && hud.el.trail) m.startPanelEditor(hud.el.trail); })
    .catch(() => { /* not served, or file:// — the guides still work */ });
}


let front = null;

let tut = null;
let lastComplete = false;

/* ?at= — WHERE THE REVIEW BAR JUMPED TO, and only with ?dev=1: a crossing number counted
   from 0 in the order they are met, or 'end'. The bar reloads the page for every jump, so
   each one starts from a clean run instead of from whatever state the last left behind.
   No cover and no tutorial on a jump, the same as ?p2=1. */
const jumpAt = options.dev ? params.get('at') : null;
let devSel = null;       // the bar's picker, kept in step with the crossing being played

/* THE TUTORIAL RUNS EVERY TIME, and the remembering is gone on purpose.
 *
 * It was suppressed after the first play, held in localStorage. That is the
 * conventional choice and it was the wrong one here, for a reason that showed up the
 * moment anyone tried to look at it: once the flag is set the tutorial is invisible
 * and there is no way back to it from inside the game — so a returning player, a
 * second child on the same browser, a classroom machine, or anyone reviewing the
 * build gets dropped straight into gameplay with no explanation and no clue that a
 * tutorial exists at all. A stored flag also makes the feature untestable by hand:
 * it works once and then appears broken forever.
 *
 * It is six short steps with a Skip in the corner, so the cost of showing it again is
 * one tap; the cost of hiding it is a player who never learns the cut. ?tutorial=0
 * suppresses it, which is what the test suite passes.
 */
const tutFlag = params.get('tutorial');
const wantTutorial = tutFlag !== '0' && tutFlag !== 'false';

/* INSIDE SWIFTEE'S LESSON (the user's game-lesson kit). The lesson's page —
   part1-swiftee-lesson/index.html, which the site's root opens — runs this page in a frame, twice:
     ?lesson=intro  the experience opens here: the cover and Play, the avalanche, and the
                    tutorial up to the broken path; then the world is held still and the lesson
                    is told where Momo and the hole are ('lesson'). Its Swiftee flies in over this
                    frame, snow blows across, and the lesson takes the screen.
     ?lesson=end    back after the lesson: no cover and no Play — it starts on the host's 'begin'
                    — the avalanche and the run with nothing said, and at the break the game holds
                    still for the lesson's Swiftee ('swiftee'), until 'said'. Then the plank, the
                    question and the praise, and the journey plays on to the friend.
   Opened on its own, with no ?lesson, this page plays exactly as it always has. (?intro=1 and
   ?resume=1, the earlier page-to-page hand-over, are read as intro and end.) */
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
/* THE INTRO IS OVER. In the lesson's frame the lesson takes it from here; opened on its own (the
   old link), the lesson's page is opened instead, going straight to its first screen. */
function handOffToLesson(where) {
  if (hosted) { tellHost('lesson', { where }); return; }
  const q = new URLSearchParams({ intro: '0', auto: '1' });
  if (options.dev) q.set('dev', '1');
  const lan = globalThis.I18N && globalThis.I18N.on ? globalThis.I18N.lang : '';
  if (lan) q.set('lan', lan);                                // the lesson in the game's language
  location.href = '../../part1-swiftee-lesson/index.html?' + q.toString();
}

/* THE BACKBUFFER AT SCREEN RESOLUTION. The stage is CSS-fitted to the window; the canvas
   behind it renders at (stage CSS width x devicePixelRatio) / 1920 times its 1920x1080
   layout, rounded to a quarter and capped at 2, so a hi-DPI laptop or a 4K screen gets
   real pixels instead of a stretched 1080p. ?rs=N forces it (the tests use it). */
const stageEl = document.getElementById('stage');
const wantScale = () => {
  const forced = Number(params.get('rs'));
  if (Number.isFinite(forced) && forced >= 1 && forced <= 2) return forced;
  const r = stageEl ? stageEl.getBoundingClientRect() : null;
  const cssW = r && r.width ? r.width : window.innerWidth;
  const k = cssW * (window.devicePixelRatio || 1) / 1920;
  /* THE FLOOR IS 0.5, NOT 1 — and that one character was costing most of the frame.

     k is exactly the right number: the stage's CSS width times the device ratio, over
     the 1920 the game is laid out in. On a 1280-wide stage at dpr 1 it comes to 0.667,
     meaning 'fill 1280x720, which is all this display can show'. Math.max(1, ...) then
     threw that away and asked for 1920x1080 — 2.25x the pixels — which the browser
     immediately scaled back DOWN to 1280. Every one of those extra pixels was blended
     for nothing, and measured on this machine the game's own draw was 38.4ms against a
     16.7ms budget for 60fps.

     Below 1 there is nothing to lose: the backbuffer matches the display one to one, so
     it is not softer than what the screen can show. Above 1 is still worth having for a
     hi-DPI panel, which is what the cap at 2 is for. 0.5 is the floor because half of
     1920 is still 960 wide and anything less is visibly soft on a small window. */
  return Math.min(2, Math.max(0.5, Math.round(k * 4) / 4));
};

/* WARM THE TYPE AND THE PRESSED PICTURES. Baloo 2 is only fetched when text first uses it,
   and the first text a player sees is the tutorial bubble — so the first sentence flashed
   in a fallback face for a moment. document.fonts.load starts the fetch now, behind the
   cover. The two pressed button pictures used to be <link rel=preload>, which Chrome
   warns about on every load because they are not painted within seconds; an Image()
   fetch is the same warm-up without the warning. The three weights are the only ones any
   text in the game is set in (index.html asks Google Fonts for these three and no more):
   a fourth warmed here is a download nothing draws. */
if (document.fonts && document.fonts.load) {
  for (const w of [700, 800, 900]) document.fonts.load(w + ' 20px "Baloo 2"').catch(() => {});
}
/* Nothing to warm here any more: the PLAY button is a single take, so there is no second
   picture that has to be in the cache before the first press. */

/* THE HD CHARACTER SET IS FOR TABLETS AND LAPTOPS, NOT PHONES. A 3x phone's stage is dense
   enough to qualify by scale alone, and that is exactly where six 3780x2880 sheets are a
   problem: a small device that cannot decode them was left with no character at all. So the
   set needs a dense screen AND a stage at least 1000 CSS px wide (every phone is under that,
   tablets and laptops are over) AND, where the browser says, at least 4 GB. ?hd=1/0 forces
   it. The scale itself still follows the screen, so a phone's canvas stays crisp. */
const wantHd = () => {
  const forced = params.get('hd');
  if (forced === '1') return true;
  if (forced === '0') return false;
  // a forced scale is a request for that whole path: ?rs=2 means the hd set too, on any stage
  if (params.has('rs')) return Number(params.get('rs')) >= 1.15;
  const r = stageEl ? stageEl.getBoundingClientRect() : null;
  const cssW = r && r.width ? r.width : window.innerWidth;
  const mem = navigator.deviceMemory;                 // Chrome only; undefined elsewhere
  return wantScale() >= 1.15 && cssW >= 1000 && !(mem && mem < 4);
};

const game = createGame(canvas, {
  renderScale: wantScale(),
  sound: options.sound,                  // known before the loading bar plans its list: a muted run fetches no soundtrack
  /* True while the stage cannot be seen: the rotate prompt covers it in portrait. The engine
     skips PAINTING while this holds; the simulation keeps running (see the frame loop). */
  hidden: () => { const el = document.getElementById('rotate'); return !!(el && !el.hidden); },
  hdArt: wantHd(),
  renderScaleForced: params.has('rs'),   // a forced scale is a request; the fps guard leaves it alone
  onReady: () => {
    tellHost('ready');                   // the art is in: Play is live, or a hosted run can start
    if (coverless) { readyToBegin = true; if (beginAsked) beginHosted(); return; }
    /* STRAIGHT TO PART 2. Part 2 begins after Part 1's seventh crossing — about five
       minutes of play — which is far too long a loop to review one of its levels on.
       ?p2=1 begins the run and jumps to the collapse that opens Part 2, so the whole
       sequence still plays: the ice gives way, he recoils, the scene is held to be
       read, the slab lights up, the question is asked. The tutorial is skipped with it,
       because it teaches Part 1's controls and would freeze the game over the top. */
    if (flag('p2', false)) { game.begin(); game.skipToPartTwo(); return; }
    // the review bar's jump (?dev=1&at=N): into the run, then straight to that crossing
    if (jumpAt !== null) {
      game.begin();
      if (jumpAt === 'end') game.skipToEnd(); else game.skipToCrossing(Number(jumpAt));
      return;
    }
    if (flag('skip', false)) { game.begin(); startTutorial(); return; }
    /* THE COVER IS ALREADY UP (see below); the art has finished loading, so PLAY goes live.
       Before this the cover itself waited for the whole art set — five to six seconds of
       blank page on the deployment before anything appeared at all. */
    if (front) game.loaded.then(() => front.setLoading(false));   // and every file is in: the bar's last step
  },
  onHud: state => {
    hud.update(state);
    if (devSel) devSel.value = state.complete ? 'end' : state.playing ? String(state.step) : '';
    /* The Ouch panel used to be fed the explorer's own hurt frames from here. Both
       the panel and the frame pump are gone: the crash animation plays on the CANVAS
       now, from the delivered knockout sheet, which is where it always belonged.

       The WIN panel does still want a picture of the character, and it is filled once
       on the transition rather than every HUD tick — onHud fires on every state change
       and re-setting the same background image on each of them is work for nothing. */
    if (front && !!state.complete !== lastComplete) {
      lastComplete = !!state.complete;
      /* Nothing to fill: the win panel has no hero picture any more. The character on
         the CANVAS behind it is celebrating next to the friend who was waiting, which
         is the picture that matters, and a still copy of him on the panel competed
         with it — as well as covering the pair of them. */
    }
  }
});

// The voice clock keeps moving on a slow drawing frame. Check short word onsets
// between renders so the sign does not wait for the next full canvas paint.
setInterval(() => hud.syncVoice(game), 25);

/* THE TUTORIAL'S OWN TICK, on its own animation frame rather than inside onHud.

   Two reasons, and both are the kind that only show up once it is wired the other
   way. onHud fires from the engine update, which the tutorial PAUSES — so driving it
   from there would stop it dead on its first explaining step, with nothing left
   running to resume it. And onHud only fires when its state object CHANGES, so it is
   not a per-frame signal at all.

   This loop keeps running while the simulation is frozen, which is exactly the
   point, and the tutorial reads what it needs from debug() itself. */
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
    /* THE TUTORIAL'S CLOCK IS REAL TIME, capped only against a tab switch.
     *
     * It was capped at 50ms a frame, which is the right cap for a SIMULATION — a big step
     * tunnels a collider through a rock. The tutorial simulates nothing; it times words
     * against a voice-over, and the voice plays on the audio clock, which is real seconds
     * whatever the frame rate. So on a slow renderer the two came apart: measured on a
     * headless run at about 8fps, the sentences arrived at a quarter speed while the
     * recording ran on, and the second half of a line appeared as the voice finished
     * saying it. 0.25s still swallows the jump a backgrounded tab produces (rAF stops, so
     * the first frame back can be seconds) without slowing the reading on any device that
     * renders at four frames a second or better. */
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    /* AND IF THE TUTORIAL EVER THROWS, THE GAME MUST NOT BE LEFT FROZEN.
       This layer PAUSES the simulation while a line is read, so an exception escaping
       update() does not merely stop the tutorial — it stops the animation frame that would
       have resumed the game, and the player is left looking at a still screen with no way
       out. Found for real: a say() that threw took the whole loop down on the first line.
       That specific hole is plugged where it happened, and this is the failsafe behind it:
       whatever goes wrong, the tutorial is finished properly — which resumes the game and
       clears its overlay — and the fault is reported rather than swallowed silently. */
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

/* THE PART 2 FOCUS LAYER, driven on its own frame.
 *
 * Crossing 1 asks the learner to work ON one block, so that block has to be the only
 * sharp thing on screen. The whole game is one canvas, so the trick is the tutorial's:
 * blur everything with a sheet, then draw the subject back on top of it, sharp.
 *
 * WHY ITS OWN LOOP AND NOT onHud. onHud only fires when the state object CHANGES, so it
 * is not a per-frame signal — it can raise and lower the sheet, but the canvas above it
 * has to be repainted every frame while the slab is growing, travelling and being
 * dragged on. The same reason the tutorial keeps a loop of its own.
 *
 * It is cheap when nothing is happening: one boolean read per frame, and the canvas is
 * only cleared and redrawn while the layer is actually up.
 */
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
    /* The engine publishes the flag onto its own state object rather than only through
       the HUD payload, so this loop can read it without waiting for a change event. */
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

/* THE HAND ONLY OVER A ROPE. The canvas keeps an arrow; when the pointer is over a rope
   that can be cut right now, the stage gets .on-rope and the stylesheet swaps in the
   browser's hand. Decided on pointermove, not per frame: it only has to be right when
   the pointer moves, and reading the debug state on a move is far cheaper than a rAF
   loop for something most players (touch) never see at all. The reach is generous —
   it is an invitation, not the hit test, which lives in the engine. */
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

/* THE COVER SHOWS AT ONCE, with PLAY held until the art has loaded. The cover needs only
   its own picture and the PLAY art, which the stylesheet fetches on its own, so there is no
   reason to sit on a blank page while the sheets and sounds arrive behind it. */
if (!flag('skip', false) && jumpAt === null && !coverless) {
  front = new Frontend(document, game);
  // (back from the lesson the run starts from its beginning, avalanche and all — the user: "after
  // learning game, show avalanche in the momo game, do not remove it" — and the tutorial's
  // 'resume' part says nothing until the broken path, then picks up with "Use the right ice piece…")
  front.init({
    // the host's sound opens on this press (a tap in a frame is not one on its page in Safari)
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

/* THE HOSTED RUN (?lesson=end): it begins once, on the host's 'begin' (sent every half second
   until it hears 'running') or window.iceAgeBegin(), and not before its art is in. */
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
  // the lesson opens this page's sound from its own tap (Safari does not count it here otherwise)
  window.iceAgeUnlock = () => game.unlockAudio();
  window.addEventListener('message', (e) => {
    if (e.source !== window.parent || !e.data || typeof e.data !== 'object') return;
    const w = e.data.iceAge;
    if (w === 'begin') beginHosted();
    // a jump key pressed on the lesson's page while this frame is up (runner-stage.js keyToGame)
    else if (w === 'jump') game.jump();
    else if (w === 'said') { if (tut) tut.didAction('host'); }
    else if (w === 'quiet') { game.fadeMusic(900); setTimeout(() => game.suspendAudio(), 1000); }
  });
}

/* THE REVIEW BAR (?dev=1) — the same bar the Swiftee lesson has, so the two parts are
   reviewed the same way: back to the lesson, and a picker for every screen of this game.
   The title, each crossing by its own instruction in the order they are met, the ending.
   The list is read from CFG, so a crossing added or reordered there shows up here.

   Built here rather than written into index.html, so a shipped page carries none of it,
   and marked data-dev so a suite can tell a review tool from the game. */
/* (NOT INSIDE THE LESSON: there the lesson's own review bar covers the whole experience — Start,
   every screen, End — and this one, drawn inside the frame on top of it, was the bar the reviewer
   saw and used: its picker reloaded the frame by itself and broke the opening — the user: "jump not
   working". Opened on its own with ?dev=1, the game keeps its bar.) */
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

/* Re-pick the backbuffer scale when the window changes (a zoom, a monitor swap, a rotate).
   The art set stays as chosen at boot; only the pixel count follows. */
{
  let refitTimer = 0;
  const refit = () => { clearTimeout(refitTimer); refitTimer = setTimeout(() => game.setRenderScale(wantScale()), 120); };
  window.addEventListener('resize', refit);
  window.addEventListener('orientationchange', refit);
}
// (the lesson's return frame waits unseen from the lesson's second-last screen: not a sound out of
// it — no music bed, no wind — until the hosted run begins, beginHosted; the user)
if (coverless) game.holdAudio(true);
// decode the recordings now, not on the first tap: a cue that is still loading when it is
// first needed falls back to a different sound, which is what made the fit sound vary
game.warmAudio();

/* JUICE on the controls only. The world is canvas and has its own squash, dust and
   hit-stop; juice.js is for the DOM: the JUMP button hops when pressed, a stamp pops as
   it lands, the ending banner does a tada, Play again nudges when ignored. Sound and
   particles stay off — the engine's audio and particle layers are the single owners. */
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

/* No keydown listener here any more. It existed to flash the JUMP button so a keyed
   jump looked like a pressed control; with the button gone the engine's own key
   handler (Space / ArrowUp / W) is the whole of it. */

/* Auto-pause when the tab loses focus so the character is never mid-jump on return.

   AND SILENCE IT. Pausing only stopped the simulation: the AudioContext kept running
   and the music element kept playing, so a backgrounded tab went on making noise from
   a game that was frozen — which on a phone means the music plays over whatever the
   child switched to, and the tab keeps a decoder alive for no reason. Both are
   suspended here and resumed together with the simulation. */
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

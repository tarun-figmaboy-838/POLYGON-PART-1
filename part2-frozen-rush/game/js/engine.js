// Ice Age Mammoth Runner — gameplay engine (canvas, no external deps).

import { pointsOf as verifiedPoints, sidesOf as verifiedSides } from './polygons.js';
import { optionShapes } from './option-shapes.js';
import { ASSET_V, ASSET_SIZE } from './asset-versions.js';
import { VO_HI } from './vo-hi.js';

const VO_TAKES = { hi: VO_HI };
const VO_I18N = typeof globalThis !== 'undefined' ? globalThis.I18N : null;
const VO_TAKE = VO_I18N && VO_I18N.on && VO_I18N.voice ? VO_TAKES[VO_I18N.lang] || null : null;
const SILENT_VO = !!(VO_I18N && VO_I18N.on && !VO_TAKE);

function showsAvif() {
  const F = typeof globalThis !== 'undefined' ? globalThis.ImgFormat : null;
  return !!(F && F.avif);
}

export function webpUrl(src) {
  const v = ASSET_V[src];
  return v ? src + '?v=' + v : src;
}

export function assetUrl(src) {
  if (src.endsWith('.webp') && showsAvif()) {
    const avif = src.slice(0, -5) + '.avif';
    if (ASSET_V[avif]) src = avif;
  }
  const v = ASSET_V[src];
  return v ? src + '?v=' + v : src;
}

export const NET = (() => {
  const LIMIT = 5, STALL_MS = 15000, CAP_MS = 120000;
  const jobs = new Map(), queue = [], listeners = [];
  let active = 0, total = 0, loaded = 0, shown = 0, planned = 0, settledN = 0, sealed = false, finish;
  const done = new Promise(r => { finish = r; });
  const usable = typeof fetch === 'function' && typeof location !== 'undefined' && location.protocol !== 'file:';
  const sizeOf = url => ASSET_SIZE[url.split('?')[0]] || 40000;
  const emit = () => {
    const f = total > 0 ? Math.min(1, loaded / total) : 1;
    if (f > shown) shown = f;                                  // forward only
    for (const fn of listeners) { try { fn(shown, settledN, planned); } catch (e) { /* a listener is not the loader's problem */ } }
  };
  const check = () => { if (sealed && settledN >= planned) { shown = 1; emit(); finish(); } };
  const settle = (job, blob) => {
    if (job.settled) return;
    job.settled = true; job.blob = blob;
    loaded += Math.max(0, job.expect - job.got); job.got = job.expect;
    settledN++; active = Math.max(0, active - (job.started ? 1 : 0));
    job.resolve(blob);
    emit(); check(); pump();
  };
  const run = async job => {
    job.started = true;
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    let stall = 0;
    const cap = setTimeout(() => ctl && ctl.abort(), CAP_MS);
    const arm = () => { clearTimeout(stall); stall = setTimeout(() => ctl && ctl.abort(), STALL_MS); };
    try {
      arm();
      const res = await fetch(job.url, ctl ? { signal: ctl.signal } : undefined);
      if (!res.ok) throw new Error(res.status);
      const cl = Number(res.headers.get('content-length')) || 0;
      if (cl && cl !== job.expect) { total += cl - job.expect; job.expect = cl; }
      const type = res.headers.get('content-type') || '';
      let blob;
      if (res.body && res.body.getReader) {
        const reader = res.body.getReader(), parts = [];
        for (;;) {
          const { done: end, value } = await reader.read();
          if (end) break;
          parts.push(value); arm();
          const add = Math.min(value.byteLength, Math.max(0, job.expect - job.got));
          job.got += add; loaded += add; emit();
        }
        blob = new Blob(parts, type ? { type } : undefined);
      } else blob = await res.blob();
      clearTimeout(stall); clearTimeout(cap);
      settle(job, blob);
    } catch (e) {
      clearTimeout(stall); clearTimeout(cap);
      settle(job, null);                                       // failed, stalled or aborted: done, and the file's own URL is used
    }
  };
  let pumpQueued = false;
  const later = () => { if (pumpQueued) return; pumpQueued = true; Promise.resolve().then(() => { pumpQueued = false; pump(); }); };
  const pump = () => {
    while (active < LIMIT && queue.length) {
      queue.sort((a, b) => a.expect - b.expect);
      const job = queue.shift();
      if (job.settled) continue;
      active++; run(job);
    }
  };
  const want = (url, bytes) => {
    let job = jobs.get(url);
    if (!job) {
      job = { url, expect: bytes || sizeOf(url), got: 0, settled: false, started: false, blob: null };
      job.promise = new Promise(r => { job.resolve = r; });
      jobs.set(url, job);
      total += job.expect; planned++;
      if (!usable) settle(job, null);
      else { queue.push(job); later(); }
      emit();
    }
    return job;
  };
  return {
    get: (url, bytes) => want(url, bytes).promise,
    /** Put a file on the list without waiting for it. */
    plan: (url, bytes) => { want(url, bytes); },
    /** The list is complete: the bar can finish once everything on it is in. */
    seal: () => { sealed = true; check(); },
    onProgress: fn => { listeners.push(fn); fn(shown, settledN, planned); },
    get progress() { return { fraction: shown, loaded, total, settled: settledN, planned }; },
    done
  };
})();

export const CFG = {
  W: 1920, H: 1080,
  surfaceY: 840,
  mammothX: 430,
  runSpeed: 520,
  gravity: 2612,
  jumpVel: -1371,          // 360px apex, 1.05s airtime
  coyoteMs: 200,           // pressed a moment late off the ground still counts
  bufferMs: 250,           // pressed a moment early still fires on landing
  jumpLead: 300, jumpLeadBackS: 0.9,
  leadBackMax: 0.6,
  totalDistance: 11200,
  path: {
    srcW: 1640, srcH: 530, tileX: 56, tileW: 1536,
    scale: 1.24, surfaceRatio: 0.4377, contentBottom: 0.7321
  },
  obstacle: {
    height: 112, drawHeight: 184, sinkRatio: 0.11, runRoomS: 3.4, pairScale: 1,
    leadS: 3.0, retryLeadS: 0.7,
    roomMin: 2.6,
    runs: [
      { room: [3.4] },
      { room: [3.0, 3.0] },
      { room: [3.2, 2.8] },
      { room: [2.8, 3.2] },
      { room: [3.0, 2.8], kinds: ['rock', 'log', 'bone'] },
      { room: [2.8, 3.2, 2.8], kinds: ['rock', 'log', 'bone', 'rock'] }
    ]
  },
  sprite: {
    cw: 420, ch: 320, cols: 6, baseGap: 27, scale: 1.12, fps: 15,
    cellK: 1,
    hd: { k: 1.5, minRenderScale: 1.15 },
    tremorFps: 16.67, lookFps: 9,
    idleFps: 9, idleBlend: true,
    handover: 0.12,
    handoverFast: 0.08,
    startle: 0.5,
    hop: { crouch: 0.16, arcs: [[0.48, 42], [0.42, 28]], land: 0.10, absorb: 0.24, toIdle: 0.22 },
    tremble: {
      plan: [
        [0, 200], [1, 180], [2, 220], [3, 200],
        [4, 110], [5, 95], [6, 85],
        [4, 90], [5, 90], [6, 90], [5, 90], [4, 90], [5, 90], [6, 90], [5, 90], [4, 90], [5, 90], [6, 90], [5, 90],
        [7, 150], [8, 150], [9, 140],
        [10, 150], [11, 200]
      ],
      strong: [7, 18],
      shakeX: 7, shakeY: 3, shakeRot: 0.035, squash: 0.04
    },
    koFps: 15
  },

  characters: [
    {
      id: 'mammoth', name: 'Momo', tag: 'Brave Little Explorer',
      theme: '#F2A93B', theme2: '#C4631B',
      blurb: 'Woolly, warm and completely unbothered by a blizzard.',
      stats: { Speed: 3, Grip: 5, Grit: 5 },
      sheets: {
        run: 'assets/char/mammoth-run.webp',
        jump: 'assets/char/mammoth-jump-v2.webp',
        skid: 'assets/char/mammoth-skid.webp',
        hurt: 'assets/char/mammoth-hurt.webp',
        idle: 'assets/char/mammoth-idle.webp',
        tremble: 'assets/char/mammoth-tremble.webp',
      },
      frames: { run: 36, jump: 24, skid: 36, hurt: 36, idle: 12, tremble: 12 },
      hd: {
        run: 'assets/char/hd/mammoth-run.webp', jump: 'assets/char/hd/mammoth-jump-v2.webp',
        skid: 'assets/char/hd/mammoth-skid.webp',
        hurt: 'assets/char/hd/mammoth-hurt.webp', idle: 'assets/char/hd/mammoth-idle.webp',
        tremble: 'assets/char/hd/mammoth-tremble.webp'
      },
      koStars: true,
      // named poses inside the jump sheet
      jumpMap: { idle: 0, crouch: 1, launch: 2, rise: 3, apex: 4, fall: 5, preLand: 6, land: 7, absorb: 8, alert: 9 },
      scale: 1.75, stride: 1120,
      contacts: [3, 11, 21, 30],
      voice: 'trumpet'
    }
  ],
  timing: {
    avalancheRoar: 900, avalancheSweep: 1900, avalancheSettle: 1000,
    run1: 1400, postJump1: 4200, run2: 2600, postJump2: 1900,
    breakSkid: 1400, levelIntro: 420, shapeDrop: 560,
    gapBeat: 900, signBeat: 700, dropStagger: 220,
    focus: 500, split: 280, fly: 820,
    celebrate: 700, holdRepair: 500, crossfade: 4200,
    introRead: 1400,
    // how long the knockout plays before the Try Again card pops in
    knockout: 1100, recover: 3000,
    // how long an instruction banner stays before sliding away
    instructionHold: 3800, instructionRemind: 2200
  },
  levelOne: {
    gapW: 620,             // one crevasse, centred on the stage
    gapWMulti: 415,        // legacy fixed width, kept for the one-ditch fallback

    bearing: 0.03,
    plugLap: 0.14,
    zoomK: 1.24, zoomInMs: 900, zoomOutMs: 520,
    charBack: 212, rowRight: 1680,
    skyTop: 200,
    maxRocks: 4,
    ditchMin: 130,
    ditchGap: 150,         // ice island between two crevasses; wider, so a three-hole stretch reads longer
    mouth: 1.6,
    notch: 'off',            // 'off' after review: the plain neck looked natural, the faceted break did not
    throatDepth: 36,
    clearance: 470,
    clearOfPlayer: 300,
    // and the row stops short of the right edge, so there is sky beyond the last piece
    rowInset: 210,
    waterDepth: 190,       // open water at the foot of the ice shelf
    teeterMs: 420,
    slabW: 340, slabH: 132,
    optionH: 234,
    optionMargin: 20,      // clear air between neighbours, so no two chunks overlap
    rigY: 150,             // the line the ropes hang from, inside the fog bank
    optionY: 470,
    dropGravity: 2600,
    bridgeMs: 620,         // how long the ice takes to grow out to the wedged slab
    phases: [

      { id: 4, ditches: 1, options: 3,
        targets: ['concaveHexagon'],
        distractors: ['regularPentagon', 'regularHeptagon'],
        rotate: 0, swing: 0,
        instruction: 'Cut the concave polygon.',
        voId: 'p2-4-concave',
        sub: 'Choose the polygon that is concave.' },

      { id: 5, ditches: 1, options: 3,
        targets: ['regularHexagon'],
        distractors: ['concavePentagon', 'concaveHeptagon'],
        rotate: 0, swing: 0,
        instruction: 'Cut the convex polygon.',
        voId: 'p2-5-convex',
        sub: 'Choose the polygon that is convex.' },

      { id: 6, ditches: 1, options: 4,
        targets: ['concavePentagon', 'concavePentagon2'],
        distractors: ['regularPentagon', 'concaveHeptagon'],
        rotate: 0, swing: 0,
        instruction: 'Cut the concave pentagon.',
        voId: 'p2-6-concave-pentagon',
        sub: 'Choose both polygons that are concave pentagons.' },

      { id: 7, ditches: 1, options: 4,
        targets: ['regularHexagon', 'irregularConvexHexagon'],
        distractors: ['regularPentagon', 'concaveHexagon'],
        rotate: 0, swing: 0,
        instruction: 'Cut the convex hexagon.',
        voId: 'p2-7-convex-hexagon',
        // two answers here as well; see the note on level 6
        sub: 'Choose both polygons that are convex hexagons.' },

      { id: 8, ditches: 2, options: 6,
        targets: ['concavePentagon', 'concaveHexagon', 'concaveHeptagon'],
        distractors: ['regularPentagon', 'irregularConvexHexagon', 'regularOctagon'],
        rotate: 0, swing: 0,
        instruction: 'Cut all the concave ones.',
        voId: 'p2-8-all-concave',
        sub: 'Choose all the polygons that are concave.' },

      { id: 9, ditches: 2, options: 6,
        targets: ['regularPentagon', 'regularQuadrilateral', 'regularOctagon'],
        distractors: ['concavePentagon', 'concaveHexagon', 'concaveHeptagon'],
        rotate: 0, swing: 0,
        instruction: 'Cut all the convex ones.',
        voId: 'p2-9-all-convex',
        sub: 'Choose all the polygons that are convex.' }
    ],
    // which phases are preceded by a rock to jump, so it never becomes every phase
    jumpBefore: [4, 5, 6, 7, 8, 9],
    runMs: [8500, 8000, 9000, 8000, 9000, 8500]
  },

  levelTwo: {
    enabled: true,
    levels: [
      {
        id: 1,
        mechanic: 'cut-diagonal',
        shape: 'regularHexagon',
        hexR: 167,
        ditches: 2,
        focusK: 2.17,
        instruction: 'Cut along a diagonal.',
        voId: 'p2-1-diagonal'
      },
      {
        id: 2,
        mechanic: 'draw-all-diagonals',
        shape: 'iceQuadrilateral',
        hexR: 105,
        restK: 1.45,
        ditches: 2,
        focusK: 3.28,
        instruction: 'Draw all the diagonals.',
        voId: 'p2-2-diagonals'
      },
      {
        id: 3,
        mechanic: 'same-vertex-diagonals',
        shape: 'regularPentagon',
        hexR: 114,
        restK: 1.5,
        restDX: 45,
        ditches: 2,
        focusK: 2.85,
        instruction: 'Draw 2 diagonals from the same vertex.',
        voId: 'p2-3-samevertex'
      }
    ],

    shape: 'regularHexagon',
    hexR: 139,                // half the slab's drawn width; the ring is normalised to +-1
    ditchGap: 120,            // the pillar the slab balances on, between the two holes
    bearing: 0.03,            // the overlap each half takes on its lip; levelOne.bearing
    homeLift: 6,              // px of daylight under it, so it reads as resting not sunk

    overviewMs: 2200,
    formMs: 900,
    afterFallMs: 3000,
    teeterMs: 190,   // just long enough to see it reach the mouth; it is not a wobble any more
    popMs: 520, popK: 1.14, glowMs: 760,
    focusMs: 820,
    focusX: 0.5, focusY: 0.56, focusK: 2.63,
    dragSnap: 1.9,            // x cut.vertexSnap: how near a corner a finger has to land
    wrongMs: 700,             // how long a nudge holds before the slab is live again
    holdMs: 200, unfocusMs: 320,

    wrongDrops: { side: true, shortDiagonal: true, corners: false },
    dropMs: 900,              // the tumble into the water
    respawnMs: 1100,          // the next slab lowering into place
    instructions: {
      corners: 'Connect two vertices.',
      side: "That's a side — try a diagonal.",
      shortDiagonal: 'Cut right across, vertex to opposite vertex.',
      // a real diagonal, drawn twice: not a mistake, so it is not treated as one
      already: 'That one is done — find another.',
      // two good diagonals, but not from one corner: the constraint, not the concept
      sameVertex: 'Start this one at the same vertex.'
    },
    hintVo: { corners: 'hint-corners', side: 'hint-side', shortDiagonal: 'hint-short', already: 'hint-already', sameVertex: 'hint-samevertex' },
  },
  rope: { src: 'assets/env/rope-tied.webp', artW: 96, cordW: 35, cord: [96, 1216], seg: 280,
          knot: [1222, 1303], fray: [1262, 1303], bow: 7, bowSwing: 9 },
  ending: { zoomK: 1.42, zoomMs: 1700 },
  vo: {
    src: 'assets/audio/vo-lines.ogg', gain: 1,
    lines: {
      'tut-1-meet':   [0.00, 3.93, [0.05, 0.63, 0.97, 2.06, 2.26, 2.48, 2.59, 2.77, 3.42]],   // "This is Momo. He needs to find his friend."
      'tut-2-goal':   [4.28, 2.95, [0.07, 0.33, 0.95, 1.40, 1.65, 2.30]],   // "Help Momo cross the Frozen Pass!"
      'tut-3-watch':  [7.54, 0.90, [0.06, 0.33]],   // "Watch out!"
      'tut-4-jump':   [8.56, 2.49, [0.06, 0.33, 0.41, 0.99, 1.54]],   // "Tap to jump over obstacles."
      'tut-5-broken': [11.23, 2.86, [0.06, 0.26, 1.16, 1.45, 1.91, 2.20]],  // "Oh no! The path is broken."
      'tut-6-use':    [14.48, 3.30, [0.06, 0.54, 1.22, 1.62, 1.98, 2.19, 2.45, 2.63, 2.79]],  // "Use the right ice piece to fix the path."
      'tut-7-fit':    [18.31, 2.43, [0.06, 0.77, 1.48, 1.79]],  // "Perfect fit! Keep going!"
      'sign-triangle':      [20.87, 1.40, [0.06, 0.33, 0.60]],
      'sign-quadrilateral': [22.63, 1.67, [0.06, 0.33, 0.56]],
      'sign-pentagon':      [24.70, 1.37, [0.06, 0.33, 0.59]],
      'sign-hexagon':       [26.46, 1.42, [0.06, 0.34, 0.84]],
      'sign-heptagon':      [28.29, 1.44, [0.06, 0.37, 0.80]],
      'sign-pentagons':     [30.12, 1.98, [0.06, 0.39, 1.05, 1.66]],
      'sign-hexagons':      [32.47, 2.05, [0.06, 0.42, 1.29, 1.76]],
      'win-yay':            [34.70, 1.08, [0.06]],
      'p2-1-diagonal': [36.777, 1.95, [0.12, 0.38, 0.74, 0.82]], // Cut along a diagonal.
      'p2-2-diagonals': [39.377, 2.55, [0.2, 0.88, 1.16, 1.28]], // Draw all the diagonals.
      'p2-3-samevertex': [42.577, 3.4, [0.18, 0.54, 0.8, 1.58, 1.74, 1.88, 2.24]], // Draw two diagonals from the same vertex.
      'p2-4-concave': [46.627, 2.53, [0.18, 0.54, 0.68, 1.36]], // Cut the concave polygon.
      'p2-5-convex': [49.807, 2.62, [0.2, 0.6, 0.76, 1.48]], // Cut the convex polygon.
      'p2-6-concave-pentagon': [53.077, 2.54, [0.18, 0.52, 0.68, 1.38]], // Cut the concave pentagon.
      'p2-7-convex-hexagon': [56.267, 2.6, [0.18, 0.54, 0.7, 1.4]], // Cut the convex hexagon.
      'p2-8-all-concave': [59.517, 2.58, [0.18, 0.66, 0.86, 0.98, 1.68]], // Cut all the concave ones.
      'p2-9-all-convex': [62.747, 2.54, [0.18, 0.62, 0.86, 0.98, 1.72]], // Cut all the convex ones.
      'hint-corners': [65.937, 2.15, [0.1, 0.64, 0.94]], // Connect two vertices.
      'hint-side': [68.737, 3.3, [0.16, 0.5, 0.58, 1.62, 1.62, 2.08, 2.16]], // That's a side — try a diagonal.
      'hint-short': [72.687, 4.5, [0.14, 0.62, 0.9, 1.9, 2.7, 2.96, 3.4]], // Cut right across, vertex to opposite vertex.
      'hint-already': [77.837, 2.9, [0.18, 0.48, 0.64, 0.76, 1.7, 1.7, 2.04]], // That one is done — find another.
      'hint-samevertex': [81.387, 2.88, [0.18, 0.52, 0.88, 1.12, 1.22, 1.36, 1.74]],
      'tut-6b-piece': [84.917, 2.934, [0.06, 0.54, 1.22, 1.62, 1.83, 2.09, 2.27, 2.43]],
    }
  },
  music: { src: 'assets/audio/bgm-ice-hunt.ogg', gain: 0.17, duck: 0.35, fadeMs: 2200 },

  sfx: {
    step:   { src: 'assets/audio/freesound_community-foot_steps_snow_heavy-38297.ogg',
              mode: 'onset', dur: 0.40, gain: 0.42, rate: 0.10 },
    jump:   { src: 'assets/audio/dragon-studio-heavy-whoosh-06-414584.ogg',
              mode: 'onset', dur: 0.55, gain: 0.50, rate: 0.06 },
    land:   { src: 'assets/audio/universfield-ground-impact-352053.ogg',
              mode: 'onset', dur: 0.75, gain: 0.55, rate: 0.06 },
    // the shape wedging home: the heaviest thing in the game
    wedge:  { src: 'assets/audio/dragon-studio-heavy-boulder-thud-515257.ogg',
              mode: 'onset', dur: 1.10, gain: 0.62, rate: 0.05 },
    rumble: { src: 'assets/audio/themediaguy-earthquake-rumble-amp-cracking-379298.ogg',
              mode: 'window', at: 0, dur: 2.60, gain: 0.55, rate: 0.02 },
    ui:     { src: 'assets/audio/floraphonic-punchy-taps-ui-5-183901.ogg',
              mode: 'onset', dur: 0.22, gain: 0.45, rate: 0.08 },
    tremble: { src: 'assets/audio/dragon-studio-cartoon-blinking-372481.ogg',
              mode: 'window', at: 0.04, dur: 0.50, gain: 0.55, rate: 0.03 },
    knockout: { src: 'assets/audio/universfield-sad-trumpet-278822.ogg',
              mode: 'window', at: 0.12, dur: 2.20, gain: 0.60, rate: 0.02 }
  },
  hint: { slotMs: 7000, idleMs: 13000, showMs: 1300 },
  cut: { vertexSnap: 34 },

  comedy: {
    swayHz: 0.22, swayRad: 0.030,
    tremorHz: 9.5,        // knock-knees frequency. Above ~12 it reads as video noise
    scareDecay: 1.35,     // seconds for a full fright to fall away
    shakeHoldMs: 1250,    // how long the fright state holds when there is no shake art
    peerQuiver: 0.17,     // the tremble never quite stops while he is over the hole
    recoilPx: 26,         // the double take: back off the lip...
    recoilMs: 260,
    peerPx: 15,           // ...then lean in for a look
    gulpEvery: 2.3,       // a swallow, so a long think never reads as a hung game
    wobbleX: 5.6,         // px of sideways knock at full fright, before sprite scale
    wobbleRot: 0.05,      // radians of nervous roll
    wobbleSq: 0.05,       // jelly squash, as a fraction
    jiggleRadius: 240, jiggleDecay: 2.2
  },

  juice: {
    stopWedge: 62,        // ms frozen when a correct chunk seats
    stopSplash: 44,       // ms frozen when a wrong chunk hits the water
    stopHit: 96,          // ms frozen when the character walks into the rock
    respawnBlinkS: 1.0,
    stopLand: 40,         // ms frozen as his feet hit the ice: the trample
    punchLand: 0.014,     // and the frame's flinch with it
    stopBreak: 110,       // ms frozen on the frame the ice gives way
    stopMax: 130,         // hard ceiling: no event may freeze longer than this
    punchWedge: 0.018, punchHit: 0.026, punchBreak: 0.03, punchWin: 0.022,
    punchMs: 300
  },
  colors: {
    paleIce: '#DDF7FF', lightIce: '#A9E7FA', cyanIce: '#68C9EE',
    edge: '#2D82B5', deepEdge: '#1B5E8C',
    snow: '#F5FCFF',
    amber: '#F2A93B', frost: '#EAF9FF'
  },
  phases: [
    { key: 'bgDawn',         src: 'assets/sky/01-dawn.webp',          at: 0.00, label: 'Dawn',          light: [255, 216, 178], dim: 0.82 },
    { key: 'bgEarlyMorning', src: 'assets/sky/02-early-morning.webp', at: 0.10, label: 'Early morning', light: [255, 236, 208], dim: 0.94 },
    { key: 'bgMorning',      src: 'assets/sky/03-morning.webp',       at: 0.23, label: 'Morning',       light: [244, 252, 255], dim: 1.00 },
    { key: 'bgMidday',       src: 'assets/sky/04-midday.webp',        at: 0.38, label: 'Midday',        light: [255, 255, 255], dim: 1.00 },
    { key: 'bgAfternoon',    src: 'assets/sky/05-afternoon.webp',     at: 0.52, label: 'Afternoon',     light: [255, 246, 228], dim: 0.96 },
    { key: 'bgSunset',       src: 'assets/sky/06-sunset.webp',        at: 0.65, label: 'Sunset',        light: [255, 198, 154], dim: 0.80 },
    { key: 'bgDusk',         src: 'assets/sky/07-dusk.webp',          at: 0.78, label: 'Dusk',          light: [201, 203, 238], dim: 0.58 },
    { key: 'bgNight',        src: 'assets/sky/08-night.webp',         at: 0.90, label: 'Night',         light: [143, 166, 200], dim: 0.34 }
  ],
};
if (VO_TAKE) CFG.vo = VO_TAKE;

const T = CFG.timing;
const C = CFG.colors;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeBackOut = t => { const c = 1.4; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
const rand = (a, b) => a + Math.random() * (b - a);

/* ---------------- geometry helpers ---------------- */
function iceHash(x, salt) {
  const v = Math.sin(x * 0.0173 + salt * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

function centroid(pts) {
  let x = 0, y = 0; for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}
export const PolygonFactory = {
  sides: { triangle: 3, square: 4, rectangle: 4, quadrilateral: 4, trapezoid: 4, pentagon: 5, hexagon: 6 },

  verified(kind) {
    const art = optionShapes[kind];
    if (art && art.points && art.points.length >= 3) return art.points;
    const pts = verifiedPoints(kind);
    return pts && pts.length >= 3 ? pts : null;
  },

  /** The delivered block for a name: its texture and the box the ring fills. */
  art(kind) { return optionShapes[kind] || null; },

  sidesOf(kind) {
    const art = optionShapes[kind];
    if (art) return art.sides;
    return verifiedSides(kind) || this.sides[kind] || 0;
  },

  /** Regular-ish ring for an n-gon, flat side up, inscribed in w x h. */
  ring(n, w, h, flatTop) {
    const pts = [];
    // start angle puts a flat edge along the top when asked
    const a0 = flatTop ? -Math.PI / 2 - Math.PI / n : -Math.PI / 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i * 2 * Math.PI) / n;
      pts.push({ x: Math.cos(a), y: Math.sin(a) });
    }
    return this.fit(pts, w, h);
  },

  /** Scale a unit-ish ring so its bounds exactly fill w x h, centred on origin. */
  fit(pts, w, h) {
    const b = polyBounds(pts);
    const sx = b.w > 0 ? w / b.w : 1;
    const sy = b.h > 0 ? h / b.h : 1;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    return pts.map(p => ({ x: (p.x - cx) * sx, y: (p.y - cy) * sy }));
  },

  /** Rotate a ring by degrees about the origin. */
  turn(pts, deg) {
    const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    return pts.map(p => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
  },

  fitInside(pts, w, h) {
    const b = polyBounds(pts);
    const k = Math.min(b.w > 0 ? w / b.w : 1, b.h > 0 ? h / b.h : 1);
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    return pts.map(p => ({ x: (p.x - cx) * k, y: (p.y - cy) * k }));
  },

  /** Build a named polygon. opt: { rotate (deg), irregular (0..0.16) } */
  make(kind, w, h, opt) {
    const o = opt || {};
    const ver = this.verified(kind);
    if (ver) {
      const pts = this.fitInside(ver, w, h);
      return o.rotate ? this.turn(pts, o.rotate) : pts;
    }
    let pts;
    switch (kind) {
      case 'triangle': pts = [{ x: 0, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }]; break;
      case 'square': { const s = Math.min(w, h) / 2; pts = [{ x: -s, y: -s }, { x: s, y: -s }, { x: s, y: s }, { x: -s, y: s }]; break; }
      case 'rectangle':
      case 'quadrilateral': pts = [{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }]; break;
      case 'trapezoid': pts = [{ x: -w * 0.29, y: -h / 2 }, { x: w * 0.29, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }]; break;
      // shoulders high so the apex lands near a regular pentagon's 108 degrees
      case 'pentagon': pts = [{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: -h * 0.1 }, { x: 0, y: h / 2 }, { x: -w / 2, y: -h * 0.1 }]; break;
      case 'hexagon': pts = [{ x: -w * 0.27, y: -h / 2 }, { x: w * 0.27, y: -h / 2 }, { x: w / 2, y: 0 },
                             { x: w * 0.27, y: h / 2 }, { x: -w * 0.27, y: h / 2 }, { x: -w / 2, y: 0 }]; break;
      default: pts = this.ring(5, w, h, true);
    }

    const jit = clamp(o.irregular || 0, 0, 0.16);
    if (jit > 0) {
      let seed = (o.seed || 1) * 9277 + 1;
      const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
      pts = pts.map(p => {
        const k = 1 + (rnd() * 2 - 1) * jit;
        return { x: p.x * k, y: p.y * k };
      });
    }

    if (o.rotate) pts = this.turn(pts, o.rotate);
    return pts;
  },

  center(pts) {
    const b = polyBounds(pts);
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    return pts.map(p => ({ x: p.x - cx, y: p.y - cy }));
  },

  chunk(kind, w, h, opt) {
    return this.center(this.make(kind, w, h, Object.assign({}, opt, { rotate: 0 })));
  },

  seat(pts, span) {
    const n = pts.length;
    const turn = (r) => pts.map(q => ({
      x: q.x * Math.cos(r) - q.y * Math.sin(r),
      y: q.x * Math.sin(r) + q.y * Math.cos(r)
    }));
    const cross = i => {
      const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
      const ux = b.x - a.x, uy = b.y - a.y, vx = c.x - b.x, vy = c.y - b.y;
      const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
      if (lu < 1e-6 || lv < 1e-6) return 0;
      return (ux * vy - uy * vx) / (lu * lv);           // sin of the turn, -1..1
    };
    const turns = pts.map((_, i) => cross(i));
    let area2 = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      area2 += a.x * b.y - b.x * a.y;
    }
    const wind = area2 >= 0 ? 1 : -1;
    const TURN = 0.12;                                  // ~7 degrees
    const reflex = pts.map((_, i) => i).filter(i => turns[i] * wind < -TURN);

    let bi = 0, bestScore = -Infinity, bestLen = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len <= 0) continue;
      let rot = -Math.atan2(b.y - a.y, b.x - a.x);
      let out = turn(rot);
      const bb = polyBounds(out);
      const mid = bb.y0 + bb.h / 2;
      if ((out[i].y + out[(i + 1) % n].y) / 2 > mid) { rot += Math.PI; out = turn(rot); }
      const b2 = polyBounds(out);
      /* 0 = the notch is at the very top, 1 = at the very bottom. */
      const low = reflex.length && b2.h > 0
        ? reflex.reduce((s, k) => s + (out[k].y - b2.y0) / b2.h, 0) / reflex.length
        : 1;
      const score = len * (1 + low * 1.6);
      if (score > bestScore) { bestScore = score; bi = i; bestLen = len; }
    }

    const a = pts[bi], b = pts[(bi + 1) % n];
    let rot = -Math.atan2(b.y - a.y, b.x - a.x);
    let out = turn(rot);
    // ...and make sure it ends up at the top, not the bottom
    const edgeY = (out[bi].y + out[(bi + 1) % out.length].y) / 2;
    const cy = polyBounds(out).y0 + polyBounds(out).h / 2;
    if (edgeY > cy) { rot += Math.PI; out = turn(rot); }
    return { rot, scale: bestLen > 0 ? span / bestLen : 1, pts: this.center(out) };
  }
};

function regularHexagon(R) {
  const pts = [];
  for (let i = 0; i < 6; i++) { const a = (i * 60) * Math.PI / 180; pts.push({ x: R * Math.cos(a), y: R * Math.sin(a) }); }
  return pts;
}
function traceRing(ctx, pts, ox = 0, oy = 0) {
  ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(p.x + ox, p.y + oy) : ctx.moveTo(p.x + ox, p.y + oy));
  ctx.closePath();
}
function polyBounds(pts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}
function segIntersect(a, b, c, d) {
  const d1 = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d2 = (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x);
  const d3 = (d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x);
  const d4 = (d.x - c.x) * (b.y - c.y) - (d.y - c.y) * (b.x - c.x);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

function measureContent(img) {
  if (!img || !img.width) return null;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  let d;
  try {
    d = g.getImageData(0, 0, c.width, c.height).data;
  } catch (e) {
    return {
      x0: 0, x1: c.width - 1, y0: 0, y1: c.height - 1,
      w: c.width, h: c.height, bottom: 1, approx: true
    };
  }
  let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (d[i + 3] > 40) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, bottom: (y1 + 1) / c.height };
}

/* ---------------- ice material painter ---------------- */
const ICE_PIECE = { top: '#FFFFFF', mid: '#BFE7FA', bot: '#5FBEE6', edge: '#2A6E9E', lw: 5, lift: true };
function paintIce(ctx, pts, opt = {}) {
  const b = polyBounds(pts);
  const g = ctx.createLinearGradient(0, b.y0, 0, b.y1);
  g.addColorStop(0, opt.top || C.paleIce);
  g.addColorStop(0.55, opt.mid || C.lightIce);
  g.addColorStop(1, opt.bot || C.cyanIce);
  ctx.save();
  const lift = opt.lift ? 1.7 : 1;
  ctx.shadowColor = `rgba(9,42,80,${0.35 * lift})`;
  ctx.shadowBlur = 18 * lift; ctx.shadowOffsetY = 8 * lift;
  traceRing(ctx, pts); ctx.fillStyle = g; ctx.fill();
  ctx.restore();
  // internal facet
  ctx.save();
  traceRing(ctx, pts); ctx.clip();
  ctx.beginPath();
  ctx.moveTo(b.x0 + b.w * 0.18, b.y0 - 10);
  ctx.lineTo(b.x0 + b.w * 0.52, b.y1 + 10);
  ctx.lineTo(b.x0 + b.w * 0.30, b.y1 + 10);
  ctx.lineTo(b.x0 - 10, b.y0 + b.h * 0.42);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.34)'; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(b.x1 - b.w * 0.10, b.y0 - 10);
  ctx.lineTo(b.x1 + 10, b.y0 + b.h * 0.30);
  ctx.lineTo(b.x1 + 10, b.y1 + 10);
  ctx.lineTo(b.x1 - b.w * 0.34, b.y1 + 10);
  ctx.closePath();
  ctx.fillStyle = 'rgba(45,130,181,0.16)'; ctx.fill();
  ctx.restore();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  traceRing(ctx, pts);
  ctx.strokeStyle = opt.edge || C.edge; ctx.lineWidth = opt.lw || 4; ctx.stroke();
  // frost highlight along top edge
  ctx.save();
  traceRing(ctx, pts); ctx.clip();
  ctx.beginPath();
  ctx.moveTo(b.x0, b.y0 + 6); ctx.lineTo(b.x1, b.y0 + 6);
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 5; ctx.stroke();
  ctx.restore();
}

/* BAKED-ONSETS-START */
export const SFX_HITS = {
  step: [0.12, 1.28, 2.67, 3.97],
  jump: [0.2],
  land: [0.32],
  wedge: [0.32, 0.74],
  rumble: [0],
  ui: [0.01],
  tremble: [0.04],
  knockout: [0.12],
};
/* BAKED-ONSETS-END */

class AudioManager {
  constructor() { this.ctx = null; this.master = null; this.duck = 1; this.enabled = true; this.streak = 0; }

  kitBoot() {
    const K = window.SFX;
    if (this._kitReady || !K || typeof K.play !== 'function') return;
    try {
      if (typeof K.unlock === 'function') K.unlock();
      if (typeof K.key === 'function') K.key('C pentatonic');
      if (typeof K.configure === 'function') K.configure({ maxVoices: 3 });
      if (typeof K.volume === 'function') K.volume(0.85);
      if (typeof K.mute === 'function') K.mute(!this.enabled);
      if (!this.enabled) this.stopSay();
      this._kitReady = true;
    } catch (e) { /* the local palette below still plays */ }
  }
  /** Play a kit cue; false when the kit is absent, so the caller falls through. */
  kit(name, opts) {
    const K = window.SFX;
    if (!this.enabled || !K || typeof K.play !== 'function') return false;
    if (!this._kitReady) this.kitBoot();
    try { K.play(name, opts); return true; } catch (e) { return false; }
  }
  kitMute(m) {
    const K = window.SFX;
    if (K && typeof K.mute === 'function') { try { K.mute(!!m); } catch (e) { /* no kit */ } }
  }
  /** A speech bubble arriving. */
  popIn() { if (this.kit('pop')) return; this.bloop(); }
  /** The trample's splat, under the landing thud land() already plays. */
  trample() { this.kit('splat', { volume: 0.55, vary: 0 }); }
  tremble() { if (this._play('tremble')) return; this.kit('doink', { volume: 0.5, vary: 0 }); }
  knockout() { if (this._play('knockout')) return; this.crashComedy(); }
  crashComedy() {
    if (this.kit('cuckoo', { delay: 0.09, volume: 0.62, vary: 0 })) {
      this.kit('sparkle', { delay: 0.22, volume: 0.32, vary: 0 });
      return;
    }
    this._slide(880, 660, 0.16, 0.05, 0.09);
    this._slide(740, 540, 0.2, 0.05, 0.3);
  }
  start() {
    if (this.ctx || !this.enabled) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.held ? 0 : 0.7;
    setTimeout(() => this.loadVo(), 0);

    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 22;
    comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.16;
    this.master.connect(comp); comp.connect(this.ctx.destination);

    // noise buffer, reused by every body
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;

    this.kitBoot();
    this.startMusic();
    this.loadSfx();

    this.windGain = this.ctx.createGain(); this.windGain.gain.value = 0.034;
    const wf = this.ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 520; wf.Q.value = 0.6;
    const ws = this.ctx.createBufferSource(); ws.buffer = buf; ws.loop = true;
    ws.connect(wf); wf.connect(this.windGain); this.windGain.connect(this.master); ws.start();
    this.wind = ws;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.09;
    const lg = this.ctx.createGain(); lg.gain.value = 0.03;
    lfo.connect(lg); lg.connect(this.windGain.gain); lfo.start();
  }
  /** The looping bed. Safe to call twice; does nothing without an AudioContext. */
  startMusic() {
    if (!this.ctx || this.music) return;
    const M = CFG.music;
    if (!M || !M.src) return;

    const direct = typeof location !== 'undefined' && location.protocol === 'file:';
    try {
      const url = assetUrl(M.src);
      const el = new Audio();
      el.loop = true;
      el.preload = 'none';
      const play = () => { const q = el.play(); if (q && q.catch) q.catch(() => {}); };
      NET.get(url).then(blob => {
        const chain = (blob ? [URL.createObjectURL(blob)] : []).concat([url]);
        let k = 0;
        const next = () => {
          if (k > 0 && chain[k - 1].startsWith('blob:')) { try { URL.revokeObjectURL(chain[k - 1]); } catch (e) { /* gone */ } }
          if (k >= chain.length) { el.removeEventListener('error', next); return; }
          el.src = chain[k++]; el.preload = 'auto';
          if (this.enabled && !this.held) play();   // refused until a gesture, as before; resume() retries
        };
        el.addEventListener('error', next);
        next();
      });
      if (direct) {
        el.volume = 0;                        // faded in below
        this.music = { el, gain: null };
      } else {
        el.crossOrigin = 'anonymous';
        const src = this.ctx.createMediaElementSource(el);
        const g = this.ctx.createGain();
        g.gain.value = 0;                     // faded in below
        src.connect(g); g.connect(this.master);
        this.music = { el, gain: g };
      }
      this._musicTo(M.gain, M.fadeMs);
    } catch (e) {
      this.music = null;                      // never let the bed break the game
    }
  }
  async loadSfx() {
    if (!this.ctx || this.sfxLoading) return;
    if (typeof location !== 'undefined' && location.protocol === 'file:') {
      this.sfxLoading = true;
      this.sfxEl = {};
      this.loadVo();
      const queue = Object.entries(CFG.sfx || {});
      const loadNext = () => {
        if (!queue.length) return;
        const [name, cue] = queue.shift();
        const el = new Audio(assetUrl(cue.src));
        el.preload = 'auto';
        el.volume = Math.min(1, cue.gain || 0.5);
        this.sfxEl[name] = { cue, hits: SFX_HITS[name] || [cue.at || 0], el, next: 0 };
        if (queue.length) setTimeout(loadNext, 400);
      };
      loadNext();
      return;
    }
    this.loadVo();
    this.sfxLoading = true;
    this.sfx = this.sfx || {};
    const byUrl = new Map();
    for (const [name, cue] of Object.entries(CFG.sfx || {})) {
      try {
        if (!byUrl.has(cue.src)) {
          byUrl.set(cue.src, (async () => {
            const get = async (u) => {
              const res = await fetch(u);
              if (!res.ok) throw new Error(res.status + ' ' + cue.src);
              return this.ctx.decodeAudioData(await res.arrayBuffer());
            };
            // the bytes the loading bar already fetched (NET), else the file itself
            const fromNet = async () => {
              const blob = await NET.get(assetUrl(cue.src));
              return blob ? this.ctx.decodeAudioData(await blob.arrayBuffer()) : get(assetUrl(cue.src));
            };
            return fromNet();
          })());
        }
        const buf = await byUrl.get(cue.src);
        this.sfx[name] = { cue, buf, hits: cue.mode === 'onset' ? this._onsets(buf) : [cue.at || 0], next: 0 };
      } catch (e) {
        /* left undefined on purpose — the synthesised cue takes over */
      }
    }
  }

  _onsets(buf) {
    const d = buf.getChannelData(0);
    const sr = buf.sampleRate;
    const win = Math.max(1, Math.round(sr * 0.01));
    const n = Math.floor(d.length / win);
    const env = new Float32Array(n);
    let peak = 0;
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = 0; k < win; k++) { const v = d[i * win + k]; s += v * v; }
      env[i] = Math.sqrt(s / win);
      if (env[i] > peak) peak = env[i];
    }
    if (peak <= 0) return [0];
    const open = peak * 0.24, shut = peak * 0.10;
    const hits = [];
    let armed = true, lastAt = -1;
    for (let i = 1; i < n; i++) {
      if (armed && env[i] > open) {
        const t = (i * win) / sr;
        // never two hits inside 90ms: that is one attack, not two
        if (lastAt < 0 || t - lastAt > 0.09) { hits.push(Math.max(0, t - 0.01)); lastAt = t; }
        armed = false;
      } else if (!armed && env[i] < shut) armed = true;
    }
    return hits.length ? hits : [0];
  }

  /** Play a cue from its file. Returns false if there is no sample for it. */
  _play(name) {
    if (this.sfxEl && this.sfxEl[name]) return this._playEl(name);
    const s = this.sfx && this.sfx[name];
    if (!s || !this.ctx) return false;
    const { cue, buf, hits } = s;
    const at = hits[s.next % hits.length];
    s.next++;
    const dur = Math.min(cue.dur, Math.max(0.02, buf.duration - at));
    if (dur <= 0.02) return false;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 1 + (Math.random() * 2 - 1) * (cue.rate || 0);
    const g = this.ctx.createGain();
    // a short ramp at each end, or slicing mid-waveform clicks
    const ramp = Math.min(0.012, dur / 4);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(cue.gain, t + ramp);
    g.gain.setValueAtTime(cue.gain, t + dur - ramp);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(g); g.connect(this.master);
    src.start(t, at, dur);
    src.stop(t + dur + 0.02);
    return true;
  }

  _playEl(name) {
    const s = this.sfxEl[name];
    if (!s || !this.enabled) return false;
    const el = s.el;
    const at = s.hits[s.next % s.hits.length];
    s.next++;
    try {
      el.currentTime = at;
      el.volume = Math.min(1, s.cue.gain || 0.5);   // effects are never ducked; only the bed is
      const p = el.play();
      if (p && p.catch) p.catch(() => {});
      clearTimeout(el.__stop);
      el.__stop = setTimeout(() => { try { el.pause(); } catch (e) { /* detached */ } },
                             Math.max(40, s.cue.dur * 1000));
    } catch (e) {
      return false;                            // a cue that will not play is not fatal
    }
    return true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    if (this.music && this.music.el.paused && this.enabled && !this.held) {
      const p = this.music.el.play();
      if (p && p.catch) p.catch(() => {});
    }
  }
  _musicTo(target, ms) {
    const m = this.music;
    if (!m) return;
    if (m.gain) {
      m.gain.gain.setTargetAtTime(target, this.ctx.currentTime, Math.max(0.02, ms / 3000));
      return;
    }
    clearInterval(this._musicFade);
    const from = m.el.volume, steps = 20, dt = Math.max(16, ms / steps);
    let i = 0;
    this._musicFade = setInterval(() => {
      i++;
      const u = i / steps;
      try { m.el.volume = Math.max(0, Math.min(1, from + (target - from) * u)); } catch (e) { /* detached */ }
      if (i >= steps) clearInterval(this._musicFade);
    }, dt);
  }

  fetchVo() {
    const V = CFG.vo;
    if (!V || !V.src || this.voBytes || SILENT_VO) return Promise.resolve();
    if (typeof location !== 'undefined' && location.protocol === 'file:') return Promise.resolve();
    if (this._voFetch) return this._voFetch;
    this._voFetch = (async () => {
      try {
        // the loading bar's transfer (NET); the file itself if that could not be had
        const blob = await NET.get(assetUrl(V.src));
        if (blob) this.voBytes = await blob.arrayBuffer();
        else {
          const res = await fetch(assetUrl(V.src));
          if (!res.ok) throw new Error(res.status + ' ' + V.src);
          this.voBytes = await res.arrayBuffer();
        }
      } catch (e) { this.voErr = 'fetch: ' + String((e && e.message) || e); }
    })();
    return this._voFetch;
  }
  async loadVo() {
    const V = CFG.vo;
    if (!V || !V.src || this.voLoading || SILENT_VO) return;
    this.voLoading = true;
    const direct = typeof location !== 'undefined' && location.protocol === 'file:';
    try {
      if (direct) {
        const el = new Audio(assetUrl(V.src));
        el.preload = 'auto';
        el.volume = Math.min(1, V.gain || 1);
        this.voEl = el;
        this._sayPending();
        return;
      }
      if (!this.ctx) { this.voLoading = false; return; }     // try again when the context opens
      if (!this.voBytes) await this.fetchVo();
      if (!this.voBytes) throw new Error('no voice bytes');
      this.vo = await this.ctx.decodeAudioData(this.voBytes.slice(0));
      this._sayPending();
    } catch (e) {
      // let a later attempt try again: a decode that failed once is not fatal
      this.voLoading = false;
      this.voErr = String((e && e.message) || e);
    }
  }
  _sayPending() {
    const p = this.pending;
    this.pending = null;
    if (!p) return;
    if (Date.now() - p.at > 4000) { (this.saidLog = this.saidLog || []).push(p.id + ':too-late'); return; }
    this.say(p.id);
  }
  voLine(id) {
    if (SILENT_VO) return null;
    const L = CFG.vo && CFG.vo.lines && CFG.vo.lines[id];
    return L ? { at: L[0], dur: L[1], words: L[2] || null } : null;
  }
  say(id) {
    const L = this.voLine(id);
    this.saidLog = this.saidLog || [];
    if (!L) { this.saidLog.push(id + ':no-window'); return 0; }
    if (!this.enabled) { this.saidLog.push(id + ':muted'); return 0; }
    if (!this.vo && !this.voEl) {
      this.pending = { id, at: Date.now() };
      this.saidLog.push(id + ':queued');
      this.loadVo();
      return L.dur;
    }
    if (this.saying) {
      this.next = { id, at: Date.now() };
      this.saidLog.push(id + ':after');
      return L.dur;
    }
    this.saidLog.push(id + (this.ctx && this.ctx.state !== 'running' ? ':ctx-' + this.ctx.state : ''));
    const done = () => { this.saying = null; this.setDuck(1); this._drain(); };
    if (this.voEl) {
      try {
        const el = this.voEl;
        el.currentTime = L.at;
        const p = el.play(); if (p && p.catch) p.catch(() => {});
        this.setDuck(0.35);
        this.saying = { id, at: L.at, el, timer: setTimeout(() => { try { el.pause(); } catch (e) { /* gone */ } done(); }, L.dur * 1000) };
        return L.dur;
      } catch (e) { return 0; }
    }
    if (!this.vo || !this.ctx) return 0;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.vo;
      const g = this.ctx.createGain();
      g.gain.value = Math.min(1, (CFG.vo.gain || 1)) * this.duck;
      src.connect(g); g.connect(this.master);
      src.start(this.ctx.currentTime, L.at, L.dur);
      src.onended = () => { if (this.saying && this.saying.src === src) { clearTimeout(this.saying.timer); done(); } };
      this.setDuck(0.35);
      const watch = () => {
        if (!this.saying || this.saying.src !== src) return;
        if (this.ctx.state === 'running' && this.ctx.currentTime >= this.saying.startedAt + L.dur + 1.5) { done(); return; }
        this.saying.timer = setTimeout(watch, 1000);
      };
      this.saying = { id, at: L.at, src, gain: g, startedAt: this.ctx.currentTime, timer: setTimeout(watch, (L.dur + 1.5) * 1000) };
      return L.dur;
    } catch (e) { return 0; }
  }
  sayingAt(id) {
    const s = this.saying;
    if (!s || s.id !== id) return -1;
    if (s.el) return s.el.paused ? -1 : Math.max(0, s.el.currentTime - s.at);
    if (s.startedAt != null && this.ctx) {
      if (this.ctx.state !== 'running') return -1;
      return Math.max(0, this.ctx.currentTime - s.startedAt);
    }
    return -1;
  }
  voComing(id) {
    if (!id) return false;
    if (this.saying && this.saying.id === id) return true;
    if (this.next && this.next.id === id && Date.now() - this.next.at <= 5000) return true;
    if (this.pending && this.pending.id === id && Date.now() - this.pending.at <= 4000) return true;
    return false;
  }
  _drain() {
    const n = this.next;
    this.next = null;
    if (!n) return;
    if (Date.now() - n.at > 5000) { (this.saidLog = this.saidLog || []).push(n.id + ':stale'); return; }
    this.say(n.id);
  }
  stopSay() {
    const s = this.saying;
    this.saying = null;
    this.next = null;                  // an explicit stop means silence, not the next line

    if (!s) return;
    if (s.timer) clearTimeout(s.timer);
    try { if (s.el) s.el.pause(); } catch (e) { /* gone */ }
    try { if (s.src) { s.src.onended = null; s.src.stop(); } } catch (e) { /* already stopped */ }
    this.setDuck(1);
  }
  setDuck(v) {
    if (!this.master) return;
    if (this.music) {
      const M = CFG.music;
      const want = v >= 1 ? M.gain : M.gain * (M.duck + (1 - M.duck) * v);
      this._musicTo(want, 200);
    }
    this.duck = v;
  }

  /* ---- primitives ---- */

  /** C major pentatonic, indexable in both directions from C5. */
  _hz(step) {
    const P = [0, 2, 4, 7, 9];
    const oct = Math.floor(step / 5), i = ((step % 5) + 5) % 5;
    return 523.25 * Math.pow(2, oct + P[i] / 12);
  }

  /** A noise body: the physical part of a hit. */
  _noise(dur, freq, type, gain, q, delay, sweepTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (delay || 0);
    const s = this.ctx.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;      // never twice the same
    const f = this.ctx.createBiquadFilter();
    f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1.2;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.05);
  }

  /** A pitched voice: the character of a hit. */
  _tone(freq, dur, gain, type, slide, delay) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (delay || 0);
    const o = this.ctx.createOscillator(); o.type = type || 'sine';
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  _warble(freq, dur, gain, type, slide, depth, rate, delay) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (delay || 0);
    const o = this.ctx.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    // the shake, decaying with the note so it does not buzz on the tail
    const lfo = this.ctx.createOscillator(); lfo.type = 'sine';
    lfo.frequency.setValueAtTime(rate || 14, t);
    const lg = this.ctx.createGain();
    lg.gain.setValueAtTime(depth || 40, t);
    lg.gain.exponentialRampToValueAtTime(0.5, t + dur);
    lfo.connect(lg); lg.connect(o.frequency);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
    lfo.start(t); lfo.stop(t + dur + 0.05);
  }

  _slide(from, to, dur, gain, delay) {
    this._tone(from, dur, gain, 'sine', to, delay);
    this._tone(from * 2, dur, gain * 0.18, 'sine', to * 2, delay);   // a little air on top
    this._noise(dur, from * 1.4, 'bandpass', gain * 0.30, 6, delay, to * 1.4);
  }

  /** A note on the scale, optionally after a delay. Used for every reward. */
  _note(step, dur, gain, type, delay) {
    this._tone(this._hz(step), dur, gain, type || 'triangle', 0, delay);
    // a quiet octave above gives the blip some sparkle without raising the level
    this._tone(this._hz(step + 5), dur * 0.7, gain * 0.32, 'sine', 0, delay);
  }

  /* ---- world ---- */
  step() {
    if (this._play('step')) return;
    // snow crunch, alternating so a run cycle has a left/right feel
    this._alt = !this._alt;
    this._noise(0.075, this._alt ? 1250 : 880, 'bandpass', 0.055, 2.4);
  }
  jump() {
    this.boing();
    if (this._play('jump')) return;
    this._noise(0.22, 700, 'bandpass', 0.075, 0.9, 0, 2600);   // whoosh up
    this._tone(330, 0.17, 0.05, 'triangle', 700);              // the little "hup"
  }
  land() {
    this.boingDown();
    if (this._play('land')) return;
    if (this.kit('land')) return;
    this._noise(0.2, 420, 'lowpass', 0.13, 0.7, 0, 150);
    this._tone(150, 0.13, 0.05, 'sine', 90);
  }
  crystal() {
    if (this.kit('anticipate')) return;
    this._note(7, 0.16, 0.028, 'sine');
    this._note(4, 0.2, 0.022, 'sine', 0.1);
  }
  bonk() {
    if (this.kit('bonk')) return;
    this._tone(190, 0.24, 0.11, 'sine', 84);
    this._tone(96, 0.3, 0.07, 'square', 60);
    this._noise(0.14, 520, 'bandpass', 0.06, 1.1);
    this.sproing();                       // and it bounces off, because it is a cartoon
  }
  rumble() {
    if (this._play('rumble')) return;
    this._tone(52, 1.6, 0.17, 'sine', 32);
    this._tone(78, 1.2, 0.06, 'triangle', 40);
    this._noise(1.5, 190, 'lowpass', 0.1, 0.5, 0, 70);
  }
  crack() {
    this._noise(0.09, 5200, 'highpass', 0.16, 1.0);            // the snap
    this._noise(0.34, 2100, 'bandpass', 0.11, 3.2, 0.03);      // the tail
    this._tone(760, 0.11, 0.04, 'triangle', 240);
  }

  /* ---- the puzzle ---- */
  slice() {
    if (this.kit('slice', { pitch: 1.15, vary: 0 })) { this.kit('zip', { delay: 0.06, volume: 0.7, vary: 0 }); return; }
    // cutting the icicle stem: a bright shing, then the stem giving way
    this._noise(0.1, 6200, 'highpass', 0.11, 0.9);
    this._tone(1560, 0.09, 0.04, 'triangle', 2400);
    this._noise(0.2, 1500, 'bandpass', 0.06, 2.2, 0.05, 480);
  }
  wedge() {
    this.kit('land', { pitch: 0.72, volume: 0.9, vary: 0 });   // vary 0: identical every time
    this._play('wedge');
  }
  /** The ice bridging out and closing over: a rising frost shimmer. */
  seal() {
    this._noise(0.55, 3200, 'bandpass', 0.05, 1.0, 0, 7200);
    [0, 2, 4, 5].forEach((s, i) => this._note(s + 5, 0.22, 0.03, 'sine', i * 0.075));
  }
  /** A wrong chunk hitting the melt water. */
  splash() {
    if (this.kit('splat')) return;
    // the impact, then the water closing over it, then bubbles
    this._noise(0.13, 2600, 'bandpass', 0.15, 0.8, 0, 420);
    this._noise(0.42, 900, 'lowpass', 0.11, 0.6, 0.04, 260);
    this._tone(420, 0.22, 0.05, 'sine', 130);
    this._tone(190, 0.4, 0.04, 'sine', 70, 0.06);
    for (let i = 0; i < 4; i++) {
      this._tone(300 + Math.random() * 500, 0.1, 0.022, 'sine', 900, 0.18 + i * 0.075);
    }
  }
  clunk() { this.wedge(); }
  /** A chunk arriving on its stem. */
  pop() { this.bloop(); }

  /* ---- rewards and refusals ---- */
  /** Phase cleared. Climbs the scale on a streak, so getting further sounds better. */
  fit() {
    if (this.kit('correct', { pitch: 1, vary: 0 })) return;
    this._note(0, 0.2, 0.05); this._note(4, 0.24, 0.045, 'triangle', 0.09);
  }
  /** The whole phase mended: a level-up, distinct from the per-fit chord. */
  success(streak = 0) {
    if (this.kit('levelUp', { vary: 0 })) return;
    const s = clamp(streak === undefined ? this.streak : streak, 0, 5);
    this.streak = s + 1;
    const base = s;
    [0, 2, 4, 7].forEach((iv, i) => this._note(base + iv, 0.34, 0.052, 'triangle', i * 0.085));
    this._noise(0.5, 4800, 'bandpass', 0.035, 1.2, 0.05);
  }
  /** Wrong answer. Soft and short: a nudge, never a buzzer. */
  reject() {
    if (this.kit('wrong')) return;
    this.streak = 0;
    this._note(2, 0.13, 0.05);
    this._note(0, 0.2, 0.042, 'triangle', 0.1);
    this._noise(0.12, 900, 'bandpass', 0.035, 1.4);
  }

  /* ---- interface ---- */
  ui() {
    if (this._play('ui')) return;
    if (this.kit('click')) return;
    this._tone(1050, 0.05, 0.05, 'triangle', 1500);
    this._noise(0.05, 3000, 'bandpass', 0.03, 2);
  }
  fanfare() { if (this.kit('powerUp', { vary: 0 })) return; [0, 4, 7, 9, 12].forEach((iv, i) => this._note(iv, 0.4, 0.05, 'triangle', i * 0.08)); }

  gasp() {
    if (this.kit('squeak')) return;   // the fright, as a cartoon squeak
    this.wobble();                                         // the knees going
    this.knees();                                          // and knocking together
    this.doubleTake();                                     // he looks, then looks again
    this._tone(880, 0.1, 0.05, 'triangle', 300);           // the squeak, sliding down
    this._noise(0.14, 1600, 'bandpass', 0.05, 3.4);         // the intake of breath
    this._tone(196, 0.16, 0.05, 'sine', 130, 0.05);
  }
  /** A swallow. Two short blips a semitone apart, low and soft — the classic gulp. */
  gulp() {
    this._tone(150, 0.07, 0.055, 'sine', 92);
    this._tone(122, 0.1, 0.045, 'sine', 78, 0.075);
  }
  whiff() {
    if (this.kit('swoosh')) return;
    this._noise(0.16, 1400, 'bandpass', 0.055, 0.7, 0, 420);
  }
  /** The mammoth, tapped. Its own voice — a little trumpet, up then up again. */
  toot() {
    if (this.kit('honk')) return;   // a trunk toot IS a honk
    this._tone(392, 0.14, 0.055, 'sawtooth', 523);
    this._tone(523, 0.2, 0.05, 'sawtooth', 587, 0.1);
    this._noise(0.1, 900, 'bandpass', 0.03, 1.2, 0.02);
  }
  prize() {
    if (this.kit('gem')) return;
    [0, 4, 7, 12].forEach((iv, i) => {
      this._tone(this._hz(iv + 12), 0.14, 0.038, 'square', 0, i * 0.062);
    });
    this._tone(this._hz(19), 0.42, 0.03, 'triangle', 0, 0.25);
  }

  /** The spring in a cartoon jump: pitch shooting up while it shakes. */
  boing() {
    if (this.kit('boing')) return;
    this._warble(210, 0.26, 0.055, 'triangle', 660, 90, 17);
  }
  boingDown() {
    if (this.kit('boing', { pitch: 0.8 })) return;
    this._warble(540, 0.2, 0.04, 'triangle', 170, 70, 19);
  }
  /** Bouncing off the rock. A springier, sillier bonk than the thud alone. */
  sproing() {
    if (this.kit('boing', { pitch: 1.25 })) return;
    this._warble(330, 0.42, 0.06, 'triangle', 118, 130, 13);
    this._warble(660, 0.3, 0.022, 'sine', 240, 80, 21, 0.04);
  }
  /** Something on its way down to a comic landing. */
  slideDown() {
    if (this.kit('fallingWhistle')) return;
    this._slide(1250, 250, 0.42, 0.05);
  }
  /** A bubble surfacing: the chunk arriving on its rope. */
  bloop() {
    if (this.kit('bubble')) return;
    this._tone(320, 0.13, 0.05, 'sine', 900);
    this._noise(0.05, 1800, 'bandpass', 0.025, 3, 0.01);
  }
  /** Rubbery: the character wobbling on the spot when the ground scares it. */
  wobble() {
    this._warble(150, 0.5, 0.038, 'sine', 128, 26, 8);
  }
  skid() {
    this._noise(2.0, 1750, 'bandpass', 0.055, 9, 0, 480);    // the feet, all the way down
    this._warble(820, 1.9, 0.028, 'sawtooth', 240, 60, 22);  // the comic squeal, sliding
    this._noise(0.3, 420, 'lowpass', 0.05, 0.8, 1.9, 160);   // the thump of coming to rest
  }
  knees() {
    if (this.kit('ratchet')) return;   // knees knocking: a rattle
    for (let i = 0; i < 6; i++) {
      const t = i * 0.17;
      this._tone(96 + (i % 2) * 26, 0.06, 0.035, 'square', 62, t);
      this._noise(0.05, 340, 'bandpass', 0.02, 2.4, t);
    }
  }

  doubleTake() {
    if (this.kit('cuckoo')) return;   // the classic double-take
    this._tone(420, 0.09, 0.04, 'triangle', 700);
    this._tone(560, 0.12, 0.045, 'triangle', 980, 0.16);
    this._noise(0.06, 2200, 'bandpass', 0.02, 3, 0.16);
  }

  /** A glint of light, for the sparkle burst. */
  twinkle() {
    if (this.kit('sparkle')) return;
    [12, 16, 19].forEach((s, i) => this._note(s, 0.16, 0.026, 'sine', i * 0.055));
  }
}
/* ---------------- ParticleManager ---------------- */
class ParticleManager {
  constructor() { this.list = []; }
  spawn(n, fn) { for (let i = 0; i < n; i++) { const p = this._free() || (this.list.push({ dead: true }), this.list[this.list.length - 1]); Object.assign(p, { dead: false, life: 1, t: 0 }, fn(i)); } }
  poof(x, y, n = 5, size = 1) {
    this.spawn(n, i => {
      const a = -Math.PI / 2 + (i / Math.max(1, n - 1) - 0.5) * 2.4 + rand(-0.25, 0.25);
      const v = rand(70, 160) * size;
      return {
        x: x + rand(-16, 16) * size, y: y + rand(-6, 2),
        vx: Math.cos(a) * v * 1.5, vy: Math.sin(a) * v * 0.5 - 24,
        r: rand(10, 19) * size, dur: rand(0.5, 0.9), kind: 'puff', swell: rand(1.5, 2.2)
      };
    });
  }
  snowPuff(x, y, n = 6, spread = 1) {
    this.spawn(n, () => ({ x: x + rand(-16, 16), y: y + rand(-8, 4), vx: rand(-90, 90) * spread, vy: rand(-160, -50) * spread, r: rand(5, 13), dur: rand(0.45, 0.8), kind: 'snow' }));
  }
  skid(x, y, n = 10) {
    this.spawn(n, () => ({ x: x + rand(-10, 40), y: y + rand(-6, 2), vx: rand(60, 300), vy: rand(-140, -30), r: rand(4, 10), dur: rand(0.4, 0.7), kind: 'snow' }));
  }
  chips(x, y, n = 8, vy0 = -60) {
    this.spawn(n, () => ({ x: x + rand(-70, 70), y: y + rand(-10, 20), vx: rand(-70, 70), vy: rand(vy0, vy0 + 90), r: rand(4, 10), dur: rand(0.7, 1.2), kind: 'ice', rot: rand(0, 6.28), vr: rand(-4, 4) }));
  }
  splash(x, y, n = 20) {
    const crown = Math.max(3, Math.round(n * 0.45));
    const sheet = Math.max(3, Math.round(n * 0.35));
    const foam = Math.max(2, n - crown - sheet);

    // the crown: up and slightly out, tall and thin, the tallest part of the splash
    this.spawn(crown, i => {
      const a = -Math.PI / 2 + (i / crown - 0.5) * 0.9;
      const v = 300 + Math.random() * 640;
      return {
        x: x + rand(-22, 22), y: y + rand(-4, 6),
        vx: Math.cos(a) * v * 0.5, vy: Math.sin(a) * v,
        r: rand(5, 12), dur: rand(0.55, 0.95), kind: 'water', foam: 0
      };
    });
    // the sheet: low and wide, thrown out along the surface both ways
    this.spawn(sheet, i => {
      const side = i % 2 ? 1 : -1;
      const a = -Math.PI / 2 + side * (0.75 + Math.random() * 0.55);
      const v = 340 + Math.random() * 520;
      return {
        x: x + side * rand(6, 34), y: y + rand(-2, 8),
        vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.72,
        r: rand(3, 8), dur: rand(0.45, 0.8), kind: 'water', foam: 0
      };
    });
    // the foam: slow, round, and it stays near the break in the surface
    this.spawn(foam, () => ({
      x: x + rand(-46, 46), y: y + rand(-2, 12),
      vx: rand(-70, 70), vy: rand(-190, -60),
      r: rand(7, 16), dur: rand(0.6, 1.1), kind: 'water', foam: 1
    }));
  }
  confetti(stageW, n = 80, big = false) {
    const hue = ['#FFC93C', '#FF7BAC', '#5AD2F4', '#8CE07A', '#FFF2B8', '#C58CFF'];
    this.spawn(n, i => ({
      x: Math.random() * stageW,
      y: -40 - Math.random() * 260,
      vx: rand(-70, 70),
      vy: rand(150, 330),
      r: big ? rand(14, 28) : rand(7, 15),      // big: the ending's pieces have to read from the sofa
      dur: big ? rand(3.2, 5.2) : rand(2.4, 4.2),
      kind: 'confetti',
      rot: rand(0, 6.28), vr: rand(-5, 5),
      sp: rand(1.6, 3.4),
      col: hue[i % hue.length],
      delay: Math.random() * 1.9
    }));
  }
  ring(x, y, r0 = 26, r1 = 190) {
    this.spawn(1, () => ({ x, y, vx: 0, vy: 0, r: r0, r1, dur: 0.42, kind: 'ring' }));
  }
  slashMark(x, y, ang = 0, len = 250) {
    this.spawn(1, () => ({ x, y, vx: 0, vy: 0, r: len, ang, dur: 0.32, kind: 'slash', delay: 0 }));
    this.spawn(1, () => ({ x: x + Math.sin(ang) * 14, y: y - Math.cos(ang) * 14, vx: 0, vy: 0, r: len * 0.55, ang, dur: 0.26, kind: 'slash', delay: 0.04 }));
  }
  frost(x, y, n = 4) {
    this.spawn(n, () => ({ x: x + rand(-24, 24), y: y + rand(-24, 24), vx: rand(-30, 30), vy: rand(-40, -8), r: rand(2.5, 5.5), dur: rand(0.5, 0.9), kind: 'frost' }));
  }
  stars(x, y, n = 6, spread = 170) {
    this.spawn(n, i => {
      const a = -Math.PI * 0.5 + (i / n - 0.5) * 2.6 + rand(-0.2, 0.2);   // a fan, mostly upward
      const v = spread * rand(0.7, 1.3);
      return {
        x: x + rand(-10, 10), y: y + rand(-10, 10),
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        r: rand(13, 24), dur: rand(0.45, 0.8), kind: 'star',
        rot: rand(0, 6.28), vr: rand(-5, 5)
      };
    });
  }
  sparkle(x, y, n = 8, spread = 150) {
    this.spawn(n, i => {
      const a = (i / n) * 6.2832 + rand(-0.3, 0.3);
      const v = spread * rand(0.55, 1.35);
      return {
        x: x + rand(-14, 14), y: y + rand(-14, 14),
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90,
        r: rand(7, 15), dur: rand(0.5, 0.95), kind: 'sparkle',
        rot: rand(0, 6.28), vr: rand(-2.4, 2.4)
      };
    });
  }
  _free() {
    const L = this.list, n = L.length;
    if (!n) return null;
    let i = this._cursor || 0;
    for (let k = 0; k < n; k++) { const p = L[(i + k) % n]; if (p.dead) { this._cursor = (i + k + 1) % n; return p; } }
    return null;
  }
  _shrink(dt) {
    const alive = this.list.reduce((a, p) => a + (p.dead ? 0 : 1), 0);
    if (alive) { this._idle = 0; return; }
    this._idle = (this._idle || 0) + dt;
    if (this._idle > 2 && this.list.length > 64) { this.list.length = 64; this._cursor = 0; this._idle = 0; }
  }
  update(dt) {
    this._shrink(dt);
    for (const p of this.list) {
      if (p.dead) continue;
      p.t += dt;
      if (p.t >= p.dur) { p.dead = true; continue; }
      // a sparkle is a glint of light, so it drifts rather than falls
      if (p.kind === 'ring') { p.life = 1 - p.t / p.dur; continue; }
      if (p.kind === 'slash') { if (p.delay > 0) { p.delay -= dt; p.life = 1; continue; } p.life = 1 - p.t / p.dur; continue; }
      if (p.kind === 'puff') {
        // a poof slows, drifts up and swells as it thins; it never falls
        p.vx *= (1 - 2.6 * dt); p.vy = p.vy * (1 - 2.6 * dt) - 34 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.life = 1 - p.t / p.dur;
        continue;
      }
      if (p.kind === 'confetti') {
        if (p.delay > 0) { p.delay -= dt; p.life = 1; continue; }
        p.vy += 190 * dt;                    // light: it drifts down, it does not drop
        p.vx *= (1 - 0.6 * dt);              // and air resistance takes the sideways off
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.life = 1 - p.t / p.dur;
        continue;
      }
      p.vy += (p.kind === 'ice' ? 900 : p.kind === 'water' ? 1500
             : p.kind === 'sparkle' ? 90 : p.kind === 'star' ? 260 : 520) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
      p.life = 1 - p.t / p.dur;
    }
  }
  draw(ctx) {
    for (const p of this.list) {
      if (p.dead) continue;
      ctx.globalAlpha = clamp(p.life * 1.2, 0, 1);
      if (p.kind === 'ice') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
        ctx.fillStyle = C.lightIce; ctx.beginPath();
        ctx.moveTo(0, -p.r); ctx.lineTo(p.r * 0.8, 0); ctx.lineTo(0, p.r); ctx.lineTo(-p.r * 0.8, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (p.kind === 'puff') {
        const k = 1 + (1 - p.life) * (p.swell || 1.6), R = p.r * k;
        ctx.globalAlpha = clamp(p.life * 1.15, 0, 1) * 0.94;
        ctx.save(); ctx.translate(p.x, p.y);
        const lobes = [[0, 0, 1], [-0.74, 0.2, 0.74], [0.76, 0.16, 0.7], [0.06, -0.52, 0.66]];
        ctx.fillStyle = 'rgba(112,168,218,0.7)'; ctx.beginPath();
        for (const [ox, oy, rr] of lobes) { ctx.moveTo(ox * R + rr * R + 2.4, oy * R); ctx.arc(ox * R, oy * R, rr * R + 2.4, 0, 6.2832); }
        ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath();
        for (const [ox, oy, rr] of lobes) { ctx.moveTo(ox * R + rr * R, oy * R); ctx.arc(ox * R, oy * R, rr * R, 0, 6.2832); }
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'water') {
        const sp = Math.hypot(p.vx, p.vy) || 1;
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.foam) {
          const gg = ctx.createRadialGradient(-p.r * 0.3, -p.r * 0.3, 0, 0, 0, p.r);
          gg.addColorStop(0, 'rgba(255,255,255,0.98)');
          gg.addColorStop(0.6, 'rgba(233,249,255,0.85)');
          gg.addColorStop(1, 'rgba(168,222,247,0.35)');
          ctx.fillStyle = gg;
          ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 6.2832); ctx.fill();
        } else {
          ctx.rotate(Math.atan2(p.vy, p.vx));
          const g = ctx.createLinearGradient(-p.r, 0, p.r, 0);
          g.addColorStop(0, 'rgba(255,255,255,0.96)');
          g.addColorStop(0.55, 'rgba(214,241,253,0.92)');
          g.addColorStop(1, 'rgba(104,201,238,0.8)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r * (1 + Math.min(0.55, sp / 1600)), p.r * 0.78, 0, 0, 6.2832);
          ctx.fill();
        }
        ctx.restore();
      } else if (p.kind === 'slash') {
        if (p.delay > 0) continue;
        const e = 1 - p.life, grow = Math.min(1, e / 0.3), L = p.r * (0.5 + 0.5 * grow), w = 30 * (1 - e * 0.8);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang);
        ctx.globalAlpha = Math.max(0, 1 - e * e) * 0.98;
        const lens = (hw) => { ctx.beginPath(); ctx.moveTo(-L / 2, 0); ctx.quadraticCurveTo(0, -hw, L / 2, 0); ctx.quadraticCurveTo(0, hw, -L / 2, 0); ctx.closePath(); };
        // gold body with a glow, a fine cocoa edge so it reads on pale sky, a white core
        lens(w); ctx.shadowColor = 'rgba(255,190,50,1)'; ctx.shadowBlur = 28; ctx.fillStyle = 'rgba(255,200,70,0.95)'; ctx.fill();
        ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(90,46,10,0.45)'; ctx.stroke();
        lens(w * 0.5); ctx.fillStyle = '#FFFFFF'; ctx.fill();
        ctx.restore();
      } else if (p.kind === 'confetti') {
        if (p.delay > 0) continue;           // not released yet
        const face = Math.cos(p.t * (p.sp || 2) * 6.2832);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.col || '#FFC93C';
        ctx.globalAlpha = clamp(p.life * 1.6, 0, 1);
        ctx.fillRect(-p.r * 0.5, -p.r * 0.34 * Math.abs(face) - 0.5,
                     p.r, Math.max(1.2, p.r * 0.68 * Math.abs(face)));
        ctx.restore();
      } else if (p.kind === 'ring') {
        const e = 1 - p.life;
        const r = lerp(p.r, p.r1 || 190, easeOut(e));
        ctx.save();
        ctx.globalAlpha = (1 - e) * 0.7;
        ctx.strokeStyle = '#FFE9A8';
        ctx.lineWidth = lerp(14, 1.5, e);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.stroke();
        ctx.restore();
      } else if (p.kind === 'star') {
        const pop = p.t < 0.1 ? p.t / 0.1 : 1;
        const R = p.r * (0.6 + 0.4 * pop) * (0.55 + 0.45 * p.life), r2 = R * 0.46;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
        ctx.beginPath();
        for (let k = 0; k < 10; k++) { const rr = k % 2 ? r2 : R, an = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
        ctx.closePath();
        ctx.fillStyle = '#FFD84A'; ctx.fill();
        ctx.lineWidth = Math.max(1.5, R * 0.14); ctx.lineJoin = 'round'; ctx.strokeStyle = '#C4631B'; ctx.stroke();
        ctx.restore();
      } else if (p.kind === 'sparkle') {
        // a four-pointed glint, brightest at birth and shrinking as it fades
        const s = p.r * (0.45 + p.life * 0.85);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
        gg.addColorStop(0, 'rgba(255,255,255,0.95)');
        gg.addColorStop(1, 'rgba(255,236,170,0)');
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(0, 0, s, 0, 6.2832); ctx.fill();
        ctx.fillStyle = 'rgba(255,252,232,0.95)';
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.7); ctx.lineTo(s * 0.28, -s * 0.28);
        ctx.lineTo(s * 1.7, 0); ctx.lineTo(s * 0.28, s * 0.28);
        ctx.lineTo(0, s * 1.7); ctx.lineTo(-s * 0.28, s * 0.28);
        ctx.lineTo(-s * 1.7, 0); ctx.lineTo(-s * 0.28, -s * 0.28);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = p.kind === 'frost' ? C.frost : C.snow;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  clear() { this.list.length = 0; }
}

/* ---------------- BackgroundTimeManager ---------------- */
class BackgroundTimeManager {
  constructor(images) {
    this.images = images; this.index = 0;
    this.a = CFG.phases[0].key; this.b = null; this.fade = 0;
  }
  phaseFor(p) {
    let idx = 0;
    for (let i = 0; i < CFG.phases.length; i++) if (p >= CFG.phases[i].at) idx = i;
    return idx;
  }
  update(dt, progress) {
    const want = this.phaseFor(progress);
    if (want !== this.index && !this.b) {
      this.index = want; this.b = CFG.phases[want].key; this.fade = 0;
    }
    if (this.b) {
      this.fade += dt * 1000 / T.crossfade;
      if (this.fade >= 1) { this.a = this.b; this.b = null; this.fade = 0; }
    }
  }
  get label() { return CFG.phases[this.index].label; }

  light() {
    const A = CFG.phases.find(q => q.key === this.a) || CFG.phases[this.index];
    const B = this.b ? CFG.phases.find(q => q.key === this.b) : null;
    const la = A.light || [255, 255, 255], da = A.dim === undefined ? 1 : A.dim;
    if (!B) return { c: la, dim: da };
    const f = easeInOut(clamp(this.fade, 0, 1));
    const lb = B.light || [255, 255, 255], db = B.dim === undefined ? 1 : B.dim;
    return { c: [lerp(la[0], lb[0], f), lerp(la[1], lb[1], f), lerp(la[2], lb[2], f)],
             dim: lerp(da, db, f) };
  }
  _scaled(key) {
    const img = this.images[key];
    if (!img) return null;
    this._cache = this._cache || {};
    if (this._cache[key]) return this._cache[key];
    const w = Math.round(CFG.W * 1.05), h = Math.round(CFG.H * 1.05);
    let c = null;
    try {
      c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, w, h);
    } catch (e) { return img; }
    for (const k of Object.keys(this._cache)) if (k !== this.a && k !== this.b) delete this._cache[k];
    this._cache[key] = c;
    return c;
  }
  draw(ctx, worldX, reduced) {
    const drift = reduced ? 0 : -46 - 46 * Math.sin(worldX * 0.00008);
    const w = CFG.W * 1.05, h = CFG.H * 1.05;
    const x = drift, y = -(h - CFG.H) / 2;
    const ia = this._scaled(this.a);
    if (ia) ctx.drawImage(ia, x, y, w, h);
    if (this.b && this.images[this.b]) {
      ctx.globalAlpha = easeInOut(clamp(this.fade, 0, 1));
      const ib = this._scaled(this.b);
      if (ib) ctx.drawImage(ib, x, y, w, h);
      ctx.globalAlpha = 1;
    }
  }
  reset() { this.index = 0; this.a = CFG.phases[0].key; this.b = null; this.fade = 0; }
}

/* ---------------- Atmosphere (aurora / snowfall) ---------------- */
class Atmosphere {
  static FLAKE_K = 5.2;
  constructor() {
    const mk = (n, cfg) => Array.from({ length: n }, (_, i) => ({
      x: rand(0, 1920), y: rand(-80, 1080),
      r: rand(cfg.r0, cfg.r1), fall: rand(cfg.f0, cfg.f1),
      sway: rand(cfg.s0, cfg.s1), ph: rand(0, 6.283), a: rand(cfg.a0, cfg.a1), par: cfg.par,
      spin: rand(0.12, 0.5) * (i % 2 ? -1 : 1)
    }));
    this.far = mk(26, { r0: 0.9, r1: 1.7, f0: 16, f1: 26, s0: 5, s1: 12, a0: 0.14, a1: 0.26, par: 0.12 });
    this.mid = mk(9, { r0: 1.8, r1: 2.8, f0: 30, f1: 46, s0: 9, s1: 18, a0: 0.34, a1: 0.5, par: 0.26 });
    this.near = mk(4, { r0: 3.2, r1: 4.6, f0: 62, f1: 92, s0: 16, s1: 30, a0: 0.42, a1: 0.6, par: 0.5 });
    this.aur = [
      { y: 330, amp: 26, freq: 0.0019, sp: 0.22, h: 250, c: [116, 255, 190], a: 0.15 },
      { y: 286, amp: 20, freq: 0.0027, sp: -0.18, h: 210, c: [108, 214, 255], a: 0.10 },
      { y: 246, amp: 15, freq: 0.0035, sp: 0.29, h: 170, c: [200, 152, 255], a: 0.07 }
    ];
    this.clouds = Array.from({ length: 4 }, (_, i) => {
      let seed = i * 977 + 41;
      const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
      return {
        x: rand(-200, 2100), y: 96 + rnd() * 210,
        s: 0.5 + rnd() * 0.42,
        sp: 5 + rnd() * 7,                       // its own drift, px/s
        par: 0.05 + rnd() * 0.05,                // and a little world parallax
        a: 0.09 + rnd() * 0.08,
        lobes: Array.from({ length: 5 }, (_, j) => ({
          dx: (j - 2) * (44 + rnd() * 22),
          dy: (rnd() - 0.5) * 22,
          r: 36 + rnd() * 36 - Math.abs(j - 2) * 8
        }))
      };
    });
    this.wind = Array.from({ length: 16 }, (_, i) => ({
      y: rand(120, 980), len: rand(80, 260), sp: rand(560, 1180),
      a: rand(0.05, 0.15), ph: rand(0, 6.283), bow: rand(4, 16)
    }));
    this.gust = 0;
    this.intensity = 0; this.flash = 0; this.px = 960;
  }
  // only x is used — the aurora bulges toward the pointer's column (see drawAurora)
  pointer(x) { this.px = x; }
  pulse() { this.flash = 1; }
  update(dt, progress) {
    const target = (clamp((progress - 0.66) / 0.12, 0, 1) * 0.5 + clamp((progress - 0.84) / 0.06, 0, 1) * 0.5) * 0.8;
    this.intensity = lerp(this.intensity, target, clamp(dt * 1.4, 0, 1));
    this.flash = Math.max(0, this.flash - dt * 1.5);
    // one gust roughly every nine seconds, building and dying rather than switching
    this.gustT = (this.gustT || 0) + dt;
    const cyc = (this.gustT % 9) / 9;
    this.gust = Math.max(0, Math.sin(cyc * Math.PI * 2)) * 0.85 + 0.15;
    for (const c of this.clouds) {
      c.x -= c.sp * dt;
      if (c.x < -420) c.x += 2740;
    }
  }

  drawFrost(ctx, light) {
    const [r, gg, b] = light.c;
    const y0 = CFG.surfaceY - 150, h = 110;
    const key = (r | 0) + ',' + (gg | 0) + ',' + (b | 0);
    if (this._frostKey !== key) {
      const gr = ctx.createLinearGradient(0, y0, 0, y0 + h);
      gr.addColorStop(0, 'rgba(' + key + ',0)');
      gr.addColorStop(0.72, 'rgba(' + key + ',1)');
      gr.addColorStop(1, 'rgba(' + key + ',0.5)');
      this._frost = gr; this._frostKey = key;
    }
    ctx.globalAlpha = 0.11 * light.dim;
    ctx.fillStyle = this._frost;
    ctx.fillRect(0, y0, CFG.W, h);
    ctx.globalAlpha = 1;
  }

  _cloudArt(c, key, rgb) {
    if (c.art && c.artKey === key) return c.art;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const l of c.lobes) {
      const rr = l.r * c.s;
      x0 = Math.min(x0, l.dx * c.s - rr); x1 = Math.max(x1, l.dx * c.s + rr);
      y0 = Math.min(y0, l.dy * c.s - rr); y1 = Math.max(y1, l.dy * c.s + rr);
    }
    const ox = x0 - 2, oy = y0 - 2;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(x1 - ox) + 2);
    cv.height = Math.max(1, Math.ceil(y1 - oy) + 2);
    const g = cv.getContext('2d');
    g.translate(-ox, -oy);
    const col = rgb.map(v => v | 0).join(',');
    for (const l of c.lobes) {
      const rr = l.r * c.s;
      if (rr <= 0) continue;
      const lx = l.dx * c.s, ly = l.dy * c.s;
      const gr = g.createRadialGradient(lx, ly - rr * 0.25, 0, lx, ly, rr);
      gr.addColorStop(0, 'rgba(' + col + ',1)');
      gr.addColorStop(0.55, 'rgba(' + col + ',0.5)');
      gr.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(lx, ly, rr, 0, 6.2832); g.fill();
    }
    c.art = { canvas: cv, ox, oy };
    c.artKey = key;
    return c.art;
  }
  drawClouds(ctx, worldX, light, reduced) {
    if (light.dim < 0.4) return;              // at night there is nothing to light them
    const rgb = light.c;
    // quantised to 16 levels: enough to follow a crossfade, coarse enough to cache
    const key = rgb.map(v => (v | 0) >> 4).join('.');
    ctx.save();
    for (const c of this.clouds) {
      const x = c.x - (reduced ? 0 : worldX * c.par) % 2740;
      if (x < -420 || x > CFG.W + 420) continue;
      const art = this._cloudArt(c, key, rgb);
      ctx.globalAlpha = c.a * light.dim;
      ctx.drawImage(art.canvas, Math.round(x + art.ox), Math.round(c.y + art.oy));
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawWind(ctx, worldX, t, light, reduced) {
    if (reduced) return;
    const g = this.gust;
    if (g < 0.06) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#FFFFFF';
    for (const w of this.wind) {
      const x = CFG.W + 200 - ((t * w.sp + w.ph * 900) % (CFG.W + 520));
      const a = w.a * g * light.dim;
      if (a < 0.012) continue;
      const len = w.len * (0.6 + g * 0.6);
      ctx.lineWidth = 1.5 + g * 1.1;
      ctx.globalAlpha = a * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, w.y);
      ctx.quadraticCurveTo(x + len * 0.5, w.y + w.bow * 0.5, x + len, w.y + w.bow);
      ctx.stroke();
      // a shorter, brighter core, which is what gives a streak its direction
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(x + len * 0.26, w.y + w.bow * 0.26);
      ctx.lineTo(x + len * 0.7, w.y + w.bow * 0.7);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  drawAurora(ctx, t, reduced) {
    const I = this.intensity;
    if (I < 0.02) return;
    const boost = 1 + this.flash * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = `blur(${reduced ? 9 : 15}px)`;
    for (let bi = 0; bi < this.aur.length; bi++) {
      const b = this.aur[bi];
      const yAt = (x) => {
        const bulge = Math.exp(-Math.pow((x - this.px) / 300, 2)) * 30;
        const wob = reduced ? 0
          : Math.sin(x * b.freq + t * b.sp * 2.0) * b.amp + Math.sin(x * b.freq * 2.6 - t * b.sp * 1.3) * b.amp * 0.42;
        return b.y + wob - bulge;
      };
      const step = 44;
      const path = new Path2D();
      path.moveTo(-80, yAt(-80));
      for (let x = -80; x <= CFG.W + 80; x += step) path.lineTo(x, yAt(x));
      for (let x = CFG.W + 80; x >= -80; x -= step) path.lineTo(x, yAt(x) - b.h);
      path.closePath();
      const [r, g, bl] = b.c;
      const shimmer = 0.68 + 0.32 * Math.sin(t * (0.55 + bi * 0.22) + bi * 2.1);
      const a = b.a * I * boost * shimmer;
      const gr = ctx.createLinearGradient(0, b.y - b.h - b.amp, 0, b.y + b.amp + 10);
      gr.addColorStop(0, `rgba(${r},${g},${bl},0)`);
      gr.addColorStop(0.4, `rgba(${r},${g},${bl},${(a * 0.42).toFixed(3)})`);
      gr.addColorStop(0.82, `rgba(${r},${g},${bl},${a.toFixed(3)})`);
      gr.addColorStop(1, `rgba(${r},${g},${bl},0)`);
      ctx.fillStyle = gr;
      ctx.fill(path);
    }
    // soft light shafts (kept very low so the sky stays the background)
    for (let i = 0; i < 3; i++) {
      const sx = (i * 421 + 140 + (reduced ? 0 : Math.sin(t * 0.18 + i * 1.7) * 90)) % (CFG.W + 200) - 100;
      const sa = 0.035 * I * boost * (0.4 + 0.6 * Math.abs(Math.sin(t * 0.5 + i * 2.3)));
      const cy = 250 + (i % 3) * 34;
      const rg = ctx.createRadialGradient(sx, cy, 0, sx, cy, 190);
      rg.addColorStop(0, `rgba(200,255,235,${sa.toFixed(3)})`);
      rg.addColorStop(1, 'rgba(200,255,235,0)');
      ctx.fillStyle = rg;
      ctx.save(); ctx.translate(sx, cy); ctx.scale(0.34, 1.25);
      ctx.beginPath(); ctx.arc(0, 0, 190, 0, 6.2832); ctx.fill(); ctx.restore();
    }
    ctx.filter = 'none';
    ctx.restore();
  }
  static flake() {
    if (Atmosphere._flake) return Atmosphere._flake;
    const S = 96, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.translate(S / 2, S / 2);
    g.strokeStyle = '#FFFFFF'; g.lineCap = 'round'; g.lineJoin = 'round';
    g.shadowColor = 'rgba(198, 234, 255, 0.95)'; g.shadowBlur = S * 0.1;
    const R = S * 0.42;
    for (let i = 0; i < 6; i++) {
      g.save();
      g.rotate(i * Math.PI / 3);
      g.lineWidth = S * 0.075;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -R); g.stroke();          // the arm
      g.lineWidth = S * 0.058;
      for (const [at, len] of [[0.46, 0.30], [0.74, 0.20]]) {
        g.beginPath();
        g.moveTo(0, -R * at); g.lineTo(-R * len * 0.9, -R * (at + len * 0.55));
        g.moveTo(0, -R * at); g.lineTo(R * len * 0.9, -R * (at + len * 0.55));
        g.stroke();
      }
      g.restore();
    }
    g.fillStyle = '#FFFFFF';
    g.beginPath(); g.arc(0, 0, S * 0.08, 0, 6.2832); g.fill();             // the hub
    return (Atmosphere._flake = c);
  }

  drawSnow(ctx, worldX, t, reduced, layers, flakes) {
    const damp = reduced ? 0.35 : 1;
    const spr = flakes ? Atmosphere.flake() : null;
    ctx.save();
    for (const layer of layers) {
      for (const f of layer) {
        const y = ((f.y + t * f.fall * damp) % 1180 + 1180) % 1180 - 100;
        const drift = Math.sin(t * 0.6 + f.ph) * f.sway;
        const x = ((f.x - worldX * f.par * 0.35 + drift) % 2000 + 2000) % 2000 - 40;
        ctx.globalAlpha = f.a * (0.75 + 0.25 * Math.sin(t * 1.6 + f.ph));
        if (spr) {
          const d = f.r * Atmosphere.FLAKE_K;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(f.ph + (reduced ? 0 : t * f.spin));
          ctx.drawImage(spr, -d / 2, -d / 2, d, d);
          ctx.restore();
        } else {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath(); ctx.arc(x, y, f.r, 0, 6.2832); ctx.fill();
        }
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  drawBack(ctx, worldX, t, reduced, light) {
    const L = light || { c: [255, 255, 255], dim: 1 };
    this.drawFrost(ctx, L);
    this.drawClouds(ctx, worldX, L, reduced);
    this.drawSnow(ctx, worldX, t, reduced, [this.far]);
    this.drawSnow(ctx, worldX, t, reduced, [this.mid], true);
    this.drawWind(ctx, worldX, t, L, reduced);
  }
  drawFront(ctx, worldX, t, reduced, quiet) {
    if (quiet) return;
    this.drawSnow(ctx, worldX, t, reduced, [this.near], true);
  }
}

const CM_KNOCK = 34;

const KO_CLASH = 18;
const KO_LAST = 35;
const KO_KNOCK = 150;

/* ---------------- PlayerController ---------------- */
class PlayerController {
  constructor(audio, particles, character, images) {
    this.audio = audio; this.particles = particles;
    this.setCharacter(character, images);
    this.reset();
  }
  setCharacter(character, images) {
    this.char = character;
    const img = k => images[character.id + ':' + k] || null;
    this.sheet = img('run'); this.jumpSheet = img('jump');
    this.skidSheet = img('skid'); this.shakeSheet = img('shake');
    this.idleSheet = img('idle');          // the standing loop for LOOK_DOWN
    this.trembleSheet = img('tremble');    // the 12-frame reaction at the edge, see CFG.sprite.tremble
    this.hurtSheet = img('hurt');          // optional; falls back to reversed shake
    this.footline = null;
    this.F = Object.assign({ run: 0, jump: 0, skid: 0, shake: 0, hurt: 0, idle: 0, tremble: 0 }, character.frames);
    this.J = character.jumpMap;
    this.scale = character.scale || CFG.sprite.scale;
    // world distance one full run cycle covers, which also sets the cycle's cadence
    this.stride = character.stride || 520;
    this.contacts = character.contacts && character.contacts.length
      ? character.contacts.slice()
      : [0, Math.floor((character.frames.run || 12) / 2)];
    this.koStars = !!character.koStars;
  }
  reset() {
    this.state = 'RUN'; this.t = 0; this.y = 0; this.vy = 0;
    this.dx = 0; this.dxFrom = 0; this.dxT = 0; this.jumpStartDx = 0;
    this.airborne = false; this.lastGround = 0; this.bufferedJump = -1;
    this.squash = 1; this.tilt = 0; this.hop = 0; this.airSq = 1;
    this.runDist = 0; this.lastStepFrame = -1;
    this.skidP = 0; this.sprayClock = 0; this.breath = 0;
    this.fromSheet = null; this.fromFrame = -1;     // the pose a hand-over dissolves from
    this.hopBeat = '';
    this.scare = 0; this.tremorT = 0; this.lean = 0; this.leanWant = 0;
    this.gulp = 0; this.gulpClock = 0;
    this.wobX = 0; this.wobRot = 0; this.wobSq = 0;
    this.knock = 0;                  // backward recoil from an impact, in px
    this.trembleStep = 0; this.trembleClock = 0; this.trembleFired = false; this.shakeY = 0; this.marksDrawn = 0;
  }
  /** 0..1 through the slide — drives which skid frame is showing. */
  setSkidProgress(p) { this.skidP = clamp(p, 0, 1); }
  setState(s) {
    if (this.state === s) return;
    // a startle lifts him: a small stretch on entry that the squash lerp eases back
    if (s === 'SURPRISED') this.squash = 1.07;
    // remember the pose being left, so the new state can dissolve from it (see draw)
    this.fromSheet = this.lastSheetRef || null; this.fromFrame = this.lastFrame;
    this.state = s; this.t = 0;
  }
  hopPhase(t) {
    const H = CFG.sprite.hop;
    if (!H) return { seg: 'idle', hop: 0, since: t };
    const arcs = this.hopShort ? H.arcs.slice(0, 1) : H.arcs;
    let c = H.crouch;
    if (t < c) return { seg: 'crouch', hop: 0, u: t / c };
    for (let k = 0; k < arcs.length; k++) {
      const dur = arcs[k][0], height = arcs[k][1];
      if (t < c + dur) { const u = (t - c) / dur; return { seg: 'arc', k, u, hop: height * 4 * u * (1 - u) }; }
      c += dur;
      if (t < c + H.land) return { seg: 'land', k, hop: 0, u: (t - c) / H.land };
      c += H.land;
    }
    if (t < c + H.absorb) return { seg: 'absorb', hop: 0, u: (t - c) / H.absorb };
    if (this.hopShort) return { seg: 'absorb', hop: 0, u: 1, held: true };
    return { seg: 'idle', hop: 0, since: t - c - H.absorb };
  }

  jolt(power = 1) {
    const p = clamp(power, 0, 1.4);
    this.scare = Math.max(this.scare, p);
    this.knock = Math.max(this.knock || 0, p * CM_KNOCK);
  }

  startle(power = 1) {
    this.jolt(power);
    this.lean = 0;
    this.gulpClock = CFG.comedy.gulpEvery * 0.45;   // the first gulp lands during the shake
    this.trembleStep = 0; this.trembleClock = 0; this.trembleFired = false;   // the plan starts over
    this.setState('SHAKE');
    this.audio.gasp();
  }
  canJump(now) {
    return !this.airborne || (now - this.lastGround) < CFG.coyoteMs;
  }
  requestJump(now) {
    if (this.state !== 'RUN' && this.state !== 'JUMP_START' && this.state !== 'JUMP_AIR' && this.state !== 'LAND') return false;
    if (this.canJump(now) && !this.airborne) { this.doJump(); return true; }
    this.bufferedJump = now; return false;
  }
  doJump() {
    this.jumpStartDx = this.dx || 0;
    this.vy = CFG.jumpVel; this.airborne = true; this.setState('JUMP_START');
    if (this.onJump) this.onJump();
    this.squash = 1.13; this.audio.jump();
    this.particles.poof(this.drawX - 10, CFG.surfaceY, 4, 0.8);
  }
  update(dt, now, moving, speed) {
    this.t += dt;
    if (this.state === 'RUN' && moving) {
      const v = CFG.runSpeed * (speed === undefined ? 1 : speed);
      this.runDist += v * dt;

    }
    if (this.airborne) {
      const oldVy = this.vy;
      this.vy += CFG.gravity * dt;
      this.y += (oldVy + this.vy) * 0.5 * dt;
      const u = clamp((this.vy - CFG.jumpVel) / Math.max(1, -2 * CFG.jumpVel), 0, 1);
      this.dx = this.jumpStartDx + ((CFG.jumpLead || 0) - this.jumpStartDx) * u;
      if (this.state === 'JUMP_START' && this.t > 0.08) this.setState('JUMP_AIR');
      if (this.y >= 0) {
        // he has landed AHEAD; the frame eases back to him over the next stride
        this.dxFrom = this.dx; this.dxT = 0;
        this.y = 0; this.vy = 0; this.airborne = false; this.lastGround = now;
        if (this.state !== 'KNOCKOUT') {
          // a real squash on arrival: with volume preserved on X this is the weight
          this.setState('LAND'); this.squash = 0.82;
        } else {
          this.dx = 0; this.dxFrom = 0; this.dxT = 0;
        }
        this.audio.land(); this.particles.poof(this.drawX, CFG.surfaceY, 6, 1.15);
      }
    } else {
      if (this.dx !== 0) {
        this.dxT += dt;
        const back = Math.abs(this.dxFrom);
        const capped = back > 0
          ? (1.875 * back) / Math.max(1, CFG.runSpeed * (CFG.leadBackMax || 0.3))
          : 0;
        const dur = Math.max(CFG.jumpLeadBackS || 0.75, capped);
        const p = clamp(this.dxT / Math.max(0.01, dur), 0, 1);
        // smootherstep: zero slope at both ends, and a gentler middle than easeInOut
        const s = p * p * p * (p * (p * 6 - 15) + 10);
        this.dx = p >= 1 ? 0 : this.dxFrom * (1 - s);
      }
      if (this.bufferedJump > 0 && now - this.bufferedJump < CFG.bufferMs &&
        (this.state === 'RUN' || this.state === 'LAND')) { this.bufferedJump = -1; this.doJump(); }
      if (this.state === 'LAND' && this.t > 0.12) {
        if (moving && this.F.run) {
          const stride = this.stride;
          const cycle = Math.floor(this.runDist / stride);
          const target = 24 / this.F.run;
          const phase = this.runDist / stride - cycle;
          this.runDist = (cycle + (phase > target ? 1 : 0) + target) * stride + 0.001;
        }
        this.setState(moving ? 'RUN' : 'IDLE_LOOK');
      }
    }
    if (this.state === 'RUN' && moving) {
      const f = Math.floor((this.runDist / this.stride) * this.F.run) % this.F.run;
      if (this.contacts.includes(f)) {
        if (f !== this.lastStepFrame) {
          this.lastStepFrame = f;
          this.audio.step();
          this.particles.skid(this.drawX - 40, CFG.surfaceY, 1);
        }
      } else {
        this.lastStepFrame = -1;
      }
    }
    if (this.state === 'SKID_STOP') {
      this.sprayClock += dt;
      while (this.sprayClock > 0.06) {
        this.sprayClock -= 0.06;
        this.particles.skid(this.drawX - 60, CFG.surfaceY, 1);
        this.particles.poof(this.drawX - 74, CFG.surfaceY, 1, 0.75);   // a trail of little clouds behind the skidding feet
      }
    } else this.sprayClock = 0;
    if (this.state === 'SHAKE') {
      const TP = CFG.sprite.tremble;
      if (this.trembleSheet && this.F.tremble && TP && TP.plan) {
        this.trembleClock += dt * 1000;
        while (this.trembleStep < TP.plan.length && this.trembleClock >= TP.plan[this.trembleStep][1]) {
          this.trembleClock -= TP.plan[this.trembleStep][1];
          this.trembleStep++;
        }
        const strong = TP.strong && this.trembleStep >= TP.strong[0] && this.trembleStep <= TP.strong[1];
        if (strong && !this.trembleFired) { this.trembleFired = true; this.audio.tremble(); }
        if (this.trembleStep >= TP.plan.length) this.setState('LOOK_DOWN');
      } else if (this.t > (this.F.shake ? this.F.shake / CFG.sprite.tremorFps : CFG.comedy.shakeHoldMs / 1000)) {
        this.setState('LOOK_DOWN');
      }
    }

    const CM = CFG.comedy;
    this.tremorT += dt;
    this.scare = Math.max(0, this.scare - dt / CM.scareDecay);
    const peering = this.state === 'SHAKE' || this.state === 'LOOK_DOWN';
    this.wobX = 0; this.wobRot = 0; this.wobSq = 0; this.shakeY = 0;
    if (this.state === 'SHAKE' && this.trembleSheet && CFG.sprite.tremble && CFG.sprite.tremble.strong) {
      const TP = CFG.sprite.tremble, s0 = TP.strong[0], s1 = TP.strong[1];
      const k = this.trembleStep - s0, n = s1 - s0 + 1;
      const reducedMotion = this.reducedMotion && this.reducedMotion();
      if (k >= 0 && k < n && !reducedMotion) {
        const within = this.trembleClock / TP.plan[this.trembleStep][1];
        const env = Math.sin(Math.PI * (k + within) / n);
        const PAT = [0, -0.66, 1, -0.66, 0.66, 0];
        const beat = PAT[k % PAT.length];
        this.wobX = beat * (TP.shakeX || 3) * env;
        this.wobRot = beat * (TP.shakeRot || 0.014) * env;
        this.shakeY = Math.abs(beat) * (TP.shakeY || 1.4) * env * (k % 2 ? -1 : 1);
        this.wobSq = Math.abs(beat) * (TP.squash || 0) * env;      // the jelly: squashes on each knock
      }
    }
    if ((this.state === 'KNOCKOUT' || this.state === 'HURT') && !(this.reducedMotion && this.reducedMotion())) {
      if (this.t < 0.28) {
        const e = 1 - this.t / 0.28;
        this.wobX += Math.sin(this.t * 62) * 9 * e;
        this.wobRot += Math.sin(this.t * 62) * 0.05 * e;
      } else if (this.state === 'KNOCKOUT' && this.t > 1.2) {
        this.wobX += Math.sin(this.t * 34) * 1.6;
        this.wobRot += Math.sin(this.t * 34 + 1) * 0.008;
      }
    }
    const down = this.state === 'KNOCKOUT' || this.state === 'HURT';
    if (this.knock > 0 && !down) this.knock = Math.max(0, this.knock - dt * CM_KNOCK * 3.1);

    this.leanWant = (this.state === 'SURPRISED' && this.t < CFG.sprite.startle) ? -CM.recoilPx * 0.7 : 0;
    this.lean = lerp(this.lean, this.leanWant, clamp(dt * 4, 0, 1));

    if (peering) {
      this.gulpClock += dt;
      if (this.gulpClock > CM.gulpEvery) { this.gulpClock = 0; this.gulp = 1; this.audio.gulp(); }
    } else this.gulpClock = 0;
    this.gulp = Math.max(0, this.gulp - dt * 2.6);

    // a mid-run wince recovers by itself, so the run is never left stuck in HURT
    if (this.state === 'HURT' && moving && this.t > 0.55) this.setState('RUN');
    if (this.state === 'CELEBRATE') {
      const P = this.hopPhase(this.t);
      this.hop = P.hop;
      const beat = P.seg + (P.k === undefined ? '' : P.k);
      if (beat !== this.hopBeat) {
        if (P.seg === 'land' || P.seg === 'absorb') this.squash = 0.86;
        if (P.seg === 'arc') this.squash = 1.08;
        this.hopBeat = beat;
      }
    } else if (this.state === 'SURPRISED') {
      this.hop = 0;
    } else {
      this.hop = lerp(this.hop, 0, dt * 10);
    }
    const held = this.state === 'LOOK_DOWN' || this.state === 'IDLE_LOOK' ||
                 this.state === 'SURPRISED' || this.state === 'KNOCKOUT';
    this.breath = held ? lerp(this.breath || 0, Math.sin(this.t * 1.75), clamp(dt * 6, 0, 1))
                       : lerp(this.breath || 0, 0, clamp(dt * 8, 0, 1));
    // snappier recovery: a squash that eases back slowly reads as a wobble in the art
    this.squash = lerp(this.squash, 1, clamp(dt * 12, 0, 1));
    if (this.airborne) {
      const u = clamp((this.vy - CFG.jumpVel) / Math.max(1, -2 * CFG.jumpVel), 0, 1);
      const spd = clamp(Math.abs(this.vy) / Math.max(1, Math.abs(CFG.jumpVel)), 0, 1);
      this.tilt = lerp(this.tilt, lerp(-0.16, 0.14, u), clamp(dt * 16, 0, 1));
      this.airSq = lerp(this.airSq || 1, 1 + 0.13 * spd * spd, clamp(dt * 18, 0, 1));
    } else {
      // the skid sheet already carries the backward lean, so don't rotate on top of it
      this.tilt = lerp(this.tilt, 0, clamp(dt * 9, 0, 1));
      this.airSq = lerp(this.airSq || 1, 1, clamp(dt * 12, 0, 1));
    }
  }
  get feetY() { return CFG.surfaceY + this.y - this.hop; }
  get drawX() { return CFG.mammothX + (this.dx || 0); }
  draw(ctx, t, bare) {
    const img = this.sheet;
    const x = this.drawX, y = this.feetY;
    const kc = CFG.sprite.cellK || 1, COLS = CFG.sprite.cols || 6;
    const CW = CFG.sprite.cw * kc, CH = CFG.sprite.ch * kc, S = this.scale / kc;

    if (!bare) {
    const shA = clamp(1 + this.y / 260, 0.15, 1);
    const sx0 = x + 4, sy0 = CFG.surfaceY + 2;
    const rx = 92 * shA, ry = 15 * shA;
    ctx.save();
    ctx.translate(sx0, sy0);
    ctx.scale(1, ry / rx);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    rg.addColorStop(0, `rgba(18,59,104,${(0.34 * shA).toFixed(3)})`);
    rg.addColorStop(0.5, `rgba(18,59,104,${(0.19 * shA).toFixed(3)})`);
    rg.addColorStop(0.8, `rgba(18,59,104,${(0.06 * shA).toFixed(3)})`);
    rg.addColorStop(1, 'rgba(18,59,104,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, 6.2832); ctx.fill();
    ctx.restore();
    }
    if (!img) return;

    const J = this.J, SP = CFG.sprite, F = this.F;
    let sheet = this.jumpSheet || img, f = J.idle;
    let blendF = -1, blendU = 0;                 // a second pose dissolved over the first (idle, slow tremble steps)
    let blendSheet = null;                       // ...from another sheet, when a performance hands over
    let idleT = -1;                              // the idle sheet's own clock, when it is the sheet playing
    switch (this.state) {
      case 'RUN':
        sheet = img;
        f = Math.floor((this.runDist / this.stride) * F.run) % F.run;
        break;
      case 'JUMP_START':
        // Source GIF frame 16: push-off. One opaque drawing, with no dissolve.
        f = 12;
        break;
      case 'JUMP_AIR': {
        const u = clamp((this.vy - CFG.jumpVel) / Math.max(1, -2 * CFG.jumpVel), 0, 1);
        f = 12 + Math.min(8, Math.floor(u * 9));
        break;
      }
      case 'LAND':
        // Source GIF frames 25-27: impact, compression, recovery.
        f = 21 + Math.min(2, Math.floor(this.t / 0.04));
        break;
      case 'SKID_STOP':
        if (this.skidSheet) { sheet = this.skidSheet; f = Math.min(F.skid - 1, Math.floor(this.skidP * F.skid)); }
        else f = J.crouch;
        break;
      case 'SHAKE':
        if (this.trembleSheet && F.tremble && SP.tremble && SP.tremble.plan) {
          sheet = this.trembleSheet;
          const plan = SP.tremble.plan, si = Math.min(this.trembleStep, plan.length - 1), step = plan[si];
          f = Math.max(0, Math.min(F.tremble - 1, step[0]));
          const next = plan[Math.min(si + 1, plan.length - 1)];
          if (step[1] >= 150 && next[0] !== step[0]) {
            blendF = Math.max(0, Math.min(F.tremble - 1, next[0]));
            blendU = Math.max(0, (this.trembleClock / step[1] - 0.6) / 0.4);
          }
        }
        else if (this.shakeSheet && F.shake) { sheet = this.shakeSheet; f = Math.min(F.shake - 1, Math.floor(this.t * SP.tremorFps)); }
        else f = J.alert;
        break;
      case 'LOOK_DOWN':
        if (this.trembleSheet && F.tremble) { sheet = this.trembleSheet; f = F.tremble - 1; }
        else if (this.idleSheet && F.idle) { sheet = this.idleSheet; f = 0; }
        else if (this.shakeSheet && F.shake) { sheet = this.shakeSheet; f = F.shake - 1; }
        else f = J.idle;
        break;
      case 'KNOCKOUT': {
        const src = this.hurtSheet || this.shakeSheet;
        const nf = this.hurtSheet ? F.hurt : F.shake;
        if (src && nf) {
          sheet = src;
          if (this.hurtSheet) {
            const last = Math.min(nf - 1, KO_LAST);
            f = Math.min(last, KO_CLASH + Math.floor(this.t * SP.koFps));
          } else {
            // no dedicated hurt art: read the tremble backwards so it reads as a recoil
            f = nf - 1 - Math.min(nf - 1, Math.floor(this.t * SP.koFps));
          }
        } else f = J.alert;
        break;
      }
      case 'HURT':
        if (this.hurtSheet && F.hurt) {
          sheet = this.hurtSheet;
          const stop = Math.min(F.hurt - 1, KO_CLASH + 8);
          f = Math.min(stop, KO_CLASH + Math.floor(this.t * SP.tremorFps));
        }
        else if (this.shakeSheet && F.shake) {
          sheet = this.shakeSheet;
          const k = Math.min(F.shake - 1, Math.floor(this.t * SP.tremorFps));
          f = F.shake - 1 - k;
        } else f = J.alert;
        break;
      case 'SURPRISED':
        if (this.trembleSheet && F.tremble && this.t > SP.startle) {
          sheet = this.trembleSheet; f = F.tremble - 1;
          if (this.t < SP.startle + SP.handover && this.jumpSheet) {
            const ur = clamp((this.t - SP.startle) / SP.handover, 0, 1);
            blendSheet = this.jumpSheet; blendF = J.alert; blendU = (1 - ur) * (1 - ur) * (1 - ur);
          }
        } else f = J.alert;
        break;
      case 'IDLE_LOOK':
        if (this.idleSheet && F.idle) {
          sheet = this.idleSheet; idleT = this.t;
          f = Math.floor(idleT * SP.idleFps) % F.idle;
        } else f = J.idle;
        break;
      case 'CELEBRATE': {
        const P = this.hopPhase(this.t);
        if (P.seg === 'idle' && this.idleSheet && F.idle) {
          sheet = this.idleSheet; idleT = P.since;
          f = Math.floor(idleT * SP.idleFps) % F.idle;
          if (SP.hop && P.since < SP.hop.toIdle && this.jumpSheet) {
            // the settle leaves over the moving idle on the same fast-out curve as a hand-over
            const uu = clamp(P.since / SP.hop.toIdle, 0, 1);
            blendSheet = this.jumpSheet; blendF = J.absorb; blendU = (1 - uu) * (1 - uu) * (1 - uu);
          }
          break;
        }
        const into = (frame, next, u) => { f = frame; if (u > 0.6 && next >= 0) { blendF = next; blendU = (u - 0.6) / 0.4; } };
        if (P.seg === 'crouch') { into(J.crouch, J.launch, P.u); break; }
        if (P.seg === 'land') { into(J.land, P.k < (this.hopShort ? 1 : SP.hop.arcs.length) - 1 ? J.launch : J.absorb, P.u); break; }
        if (P.seg === 'absorb') { into(J.absorb, -1, P.u); break; }
        // an arc: the pose by how far through the flight he is
        const SEG = [[0.10, J.launch], [0.38, J.rise], [0.62, J.apex], [0.90, J.fall], [1.001, J.preLand]];
        let a = 0, i = 0;
        while (i < SEG.length - 1 && P.u >= SEG[i][0]) { a = SEG[i][0]; i++; }
        f = SEG[i][1];
        const frac = (P.u - a) / (SEG[i][0] - a);
        if (frac > 0.6) { blendF = i < SEG.length - 1 ? SEG[i + 1][1] : J.land; blendU = (frac - 0.6) / 0.4; }
        break;
      }
    }

    if (SP.idleBlend && idleT >= 0 && sheet === this.idleSheet && F.idle > 1 && blendF < 0) {
      const p = idleT * SP.idleFps, frac = p - Math.floor(p);
      blendU = Math.max(0, (frac - 0.5) / 0.5); blendF = (f + 1) % F.idle;
    }
    let underSheet = null, underF = -1, underA = 0;
    const FAST = this.state === 'JUMP_START' || this.state === 'JUMP_AIR' || this.state === 'LAND' ||
                 this.state === 'SKID_STOP' ||
                 // the run picked up off a jump pose is a quick change, not a settle
                 (this.state === 'RUN' && this.fromSheet === this.jumpSheet);
    const SOFT = this.state === 'LOOK_DOWN' || this.state === 'IDLE_LOOK' ||
                 this.state === 'SHAKE' || this.state === 'SURPRISED' || FAST ||
                 (this.state === 'RUN' && this.fromSheet !== this.sheet) ||
                 this.state === 'CELEBRATE';
    if (SOFT && !FAST &&
        SP.handover && this.fromSheet && this.t < SP.handover &&
        (this.fromSheet !== sheet || this.fromFrame !== f)) {
      underSheet = this.fromSheet; underF = this.fromFrame;
      // the crouch is short and has its own dissolve out, so the way in is quicker
      const span = FAST ? (SP.handoverFast || 0.08)
                 : this.state === 'CELEBRATE' && SP.hop ? Math.min(SP.handover, SP.hop.crouch * 0.55) : SP.handover;
      const u = clamp(this.t / span, 0, 1);
      underA = (1 - u) * (1 - u) * (1 - u);
    }
    this.lastFrame = f; this.lastSheetRef = sheet;
    this.lastBlend = blendF >= 0 ? blendU : 0;
    this.lastCross = blendSheet && blendF >= 0 ? blendU : 0;
    this.lastUnder = underA;
    this.lastSheet = sheet === this.sheet ? 'run' : sheet === this.jumpSheet ? 'jump'
      : sheet === this.skidSheet ? 'skid' : sheet === this.shakeSheet ? 'shake'
      : sheet === this.hurtSheet ? 'hurt' : sheet === this.idleSheet ? 'idle' : sheet === this.trembleSheet ? 'tremble' : '?';
    const GROUNDED = this.state === 'SKID_STOP' || this.state === 'SHAKE' ||
                     this.state === 'LOOK_DOWN' || this.state === 'KNOCKOUT' ||
                     this.state === 'SURPRISED' || this.state === 'IDLE_LOOK' ||
                     this.state === 'CELEBRATE';
    // the art is aligned on its own foot line, so nothing needs lifting
    const lift = 0;

    const br = this.breath || 0;
    const sq = this.squash * (this.airSq || 1) * (1 + br * 0.006) * (1 - this.wobSq) * (1 - this.gulp * 0.05);
    const sqX = (1 - br * 0.008) * (1 + this.wobSq * 0.85) / Math.sqrt(Math.max(0.35, sq));
    ctx.save();
    // knock is subtracted: a recoil is backward, which is left on this stage
    ctx.translate(x + this.wobX + this.lean - this.knock, y - br * 3 + this.gulp * 3 + (this.shakeY || 0));
    ctx.rotate(this.tilt + this.wobRot);
    // the breath narrows as it lifts, the way a chest does
    ctx.scale(sqX, sq);
    if (!sheet) sheet = this.sheet || this.jumpSheet || this.idleSheet || null;
    if (sheet) {
      const alpha = ctx.globalAlpha;
      ctx.drawImage(sheet, (f % COLS) * CW, Math.floor(f / COLS) * CH, CW, CH,
                    -CW * S / 2, -CH * S + CFG.sprite.baseGap * kc * S + lift, CW * S, CH * S);
      ctx.globalAlpha = alpha;
      if (blendF >= 0 && blendU > 0.01) {
        const base = ctx.globalAlpha;
        ctx.globalAlpha = base * blendU;
        ctx.drawImage(blendSheet || sheet, (blendF % COLS) * CW, Math.floor(blendF / COLS) * CH, CW, CH,
                      -CW * S / 2, -CH * S + CFG.sprite.baseGap * kc * S + lift, CW * S, CH * S);
        ctx.globalAlpha = base;
      }
      if (underSheet && underF >= 0 && underA > 0.01) {
        const base = ctx.globalAlpha;
        ctx.globalAlpha = base * underA;
        ctx.drawImage(underSheet, (underF % COLS) * CW, Math.floor(underF / COLS) * CH, CW, CH,
                      -CW * S / 2, -CH * S + CFG.sprite.baseGap * kc * S + lift, CW * S, CH * S);
        ctx.globalAlpha = base;
      }
    }
    this.marksDrawn = 0;
    if (this.state === 'SHAKE' && this.trembleSheet && SP.tremble && SP.tremble.plan) {
      const TP = SP.tremble, n = TP.plan.length, si = Math.min(this.trembleStep, n - 1);
      const strong = TP.strong && si >= TP.strong[0] && si <= TP.strong[1];
      const warm = si >= 4 && !strong && si < (TP.strong ? TP.strong[0] : n);
      if (strong || warm) {
        const base = ctx.globalAlpha, a = strong ? 0.92 : 0.5, beat = si % 2;
        const within = this.trembleClock / TP.plan[si][1];
        const jit = (strong ? 6 : 2) * Math.sin(within * Math.PI * 2);
        ctx.save();
        ctx.strokeStyle = '#6E3410'; ctx.lineWidth = 5.5; ctx.lineCap = 'round';
        const HTS = [-318, -238, -158], L = -168, R = 178;
        for (let i = 0; i < 3; i++) {
          const y = HTS[i] + (i % 2 ? jit : -jit);
          for (const [sx, dir] of [[L - i * 7, -1], [R + i * 7, 1]]) {
            ctx.globalAlpha = base * a * ((dir < 0) === (beat === 0) ? 1 : 0.5);
            ctx.beginPath();
            ctx.moveTo(sx, y - 15); ctx.quadraticCurveTo(sx + dir * 10, y, sx, y + 15);
            ctx.stroke();
          }
        }
        ctx.restore();
        this.marksDrawn = strong ? 2 : 1;
      }
      if (si <= 3) {
        const done = TP.plan.slice(0, si).reduce((s, q) => s + q[1], 0) + this.trembleClock;   // ms into the notice
        const total = TP.plan.slice(0, 4).reduce((s, q) => s + q[1], 0);
        const inK = Math.min(1, done / 220), outK = Math.max(0, (done - (total - 220)) / 220);
        const over = 1 + Math.sin(Math.min(1, inK) * Math.PI) * 0.35;                        // overshoot on the way in
        const sc = (inK < 1 ? inK * over : 1) * (1 - outK);
        if (sc > 0.02) {
          const base = ctx.globalAlpha;
          ctx.save();
          ctx.translate(96, -458 + Math.sin(this.t * 9) * 3);
          ctx.rotate(0.14);
          ctx.scale(sc, sc);
          ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = '#FFF6E0'; ctx.fillStyle = '#6E3410';
          ctx.globalAlpha = base;
          // the bar, tapered, then the dot
          ctx.beginPath(); ctx.moveTo(-13, -54); ctx.lineTo(13, -54); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath();
          ctx.stroke(); ctx.fill();
          ctx.beginPath(); ctx.arc(0, 26, 11, 0, 6.2832); ctx.stroke(); ctx.fill();
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }
}

/* ---------------- GroundManager (path tiles + gaps) ---------------- */
class GroundManager {
  constructor(img) {
    this.img = img;
    const p = CFG.path;
    this.src = { x: p.tileX, w: p.tileW, h: p.srcH };
    this.tw = Math.round(p.tileW * p.scale);   // tile width of the CROPPED span
    this.th = Math.round(p.srcH * p.scale);
    this.ty = CFG.surfaceY - p.surfaceRatio * this.th;
    this.contentY = this.ty + p.contentBottom * this.th;
    this.gaps = [];
  }
  reset() {
    this.gaps = [];
    this._wallCache = {};
  }
  addGap(g) { this.gaps.push(g); return g; }

  openGaps(worldX) {
    const out = [];
    for (const g of this.gaps) {
      if (g.open <= 0.01) continue;
      const x0 = g.x0 - worldX, x1 = g.x1 - worldX;
      if (x1 < -420 || x0 > CFG.W + 420) continue;
      out.push({ x0, x1, g });
    }
    return out;
  }

  _profile(g) {
    if (g.prof) return g.prof;
    let seed = Math.abs(Math.round(g.x0)) % 9973 + 17;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const N = 22;
    const top = Array.from({ length: N + 1 }, (_, i) => {
      const u = i / N;
      const edge = Math.min(u, 1 - u);
      return { u, dy: edge < 0.05 ? -3 - rnd() * 4 : -9 + rnd() * 7 };
    });
    const wall = () => Array.from({ length: 13 }, (_, i) => {
      const v = i / 12;
      if (v < 0.02 || v > 0.98) return { v, f: 0 };
      return { v, f: Math.sin(v * Math.PI) * (0.05 + rnd() * 0.06) + (rnd() - 0.5) * 0.07 };
    });
    g.prof = { top, L: wall(), R: wall() };
    return g.prof;
  }

  _ditchPath(x0, x1, g) {
    const pr = this._profile(g);
    const w = x1 - x0, y0 = CFG.surfaceY, yB = CFG.H + 80, span = yB - y0;
    const p = new Path2D();
    const mk = g && g.throat ? (g.x1 - g.x0) / g.throat : 1;
    const ins = mk > 1 ? w * (1 - 1 / mk) / 2 : 0;          // half the overhang, each side
    const T = CFG.levelOne.throatDepth || 0, tv = span > 0 ? (T + 60) / span : 0;
    const nx0 = x0 + ins, nx1 = x1 - ins, nw = nx1 - nx0;     // the neck
    p.moveTo(nx0, y0 + pr.top[0].dy);
    for (let i = 0; i < pr.top.length - 1; i++) {
      const a = pr.top[i], b = pr.top[i + 1];
      const ax = nx0 + nw * a.u, bx = nx0 + nw * b.u;
      p.quadraticCurveTo(ax, y0 + a.dy, (ax + bx) / 2, y0 + (a.dy + b.dy) / 2);
    }
    { const last = pr.top[pr.top.length - 1]; p.lineTo(nx0 + nw * last.u, y0 + last.dy); }
    p.lineTo(nx1, y0);
    const env = this._notchEnvelope(x0, g, nx0, nx1, y0);
    let yR = y0 + T, yL = y0 + T;
    if (env) {
      let imR = 0, imL = 0;
      for (let i = 0; i < env.length; i++) { if (env[i].y > env[imR].y) imR = i; }
      for (let i = env.length - 1; i >= 0; i--) { if (env[i].y > env[imL].y) imL = i; }
      // the flat run at the deepest level, if there is one, is left open to the chasm
      let a = imR; while (a + 1 < env.length && env[a + 1].y >= env[imR].y - 0.5) a++;
      let b = imL; while (b - 1 >= 0 && env[b - 1].y >= env[imL].y - 0.5) b--;
      for (let i = env.length - 1; i >= a; i--) p.lineTo(env[i].x, env[i].y);
      yR = Math.max(env[a].y + 40, y0 + T + 60);
      p.quadraticCurveTo(env[a].x + (x1 - env[a].x) * 0.35, env[a].y + 46, x1, yR);
      const tvR = (yR - y0) / span;
      for (const q of pr.R) if (q.v > tvR) p.lineTo(x1 - w * q.f, y0 + span * q.v);
      p.lineTo(x1, yB);
      p.lineTo(x0, yB);
      yL = Math.max(env[b].y + 40, y0 + T + 60);
      const tvL = (yL - y0) / span;
      for (let i = pr.L.length - 1; i >= 0; i--) { const q = pr.L[i]; if (q.v > tvL) p.lineTo(x0 + w * q.f, y0 + span * q.v); }
      p.quadraticCurveTo(env[b].x - (env[b].x - x0) * 0.35, env[b].y + 46, env[b].x, env[b].y);
      for (let i = b - 1; i >= 0; i--) p.lineTo(env[i].x, env[i].y);
      p.lineTo(nx0, y0);
      p.closePath();
      return p;
    }
    p.lineTo(nx1, y0 + T);
    if (ins > 0) p.quadraticCurveTo(nx1 + ins * 0.15, y0 + T + 52, x1, y0 + T + 60);
    for (const q of pr.R) if (q.v > tv) p.lineTo(x1 - w * q.f, y0 + span * q.v);
    p.lineTo(x1, yB);
    p.lineTo(x0, yB);
    for (let i = pr.L.length - 1; i >= 0; i--) { const q = pr.L[i]; if (q.v > tv) p.lineTo(x0 + w * q.f, y0 + span * q.v); }
    if (ins > 0) p.quadraticCurveTo(nx0 - ins * 0.15, y0 + T + 52, nx0, y0 + T);
    else p.lineTo(nx0, y0 + T);
    p.lineTo(nx0, y0);
    p.closePath();
    return p;
  }
  notchWidthAt(g, depth) {
    const y0 = CFG.surfaceY, gw = g.x1 - g.x0;
    const mk = g.throat ? gw / g.throat : 1, ins = mk > 1 ? gw * (1 - 1 / mk) / 2 : 0;
    const env = this._notchEnvelope(0, g, ins, gw - ins, y0);
    if (!env) return 0;
    const open = env.filter(q => q.y >= y0 + depth);
    return open.length ? open[open.length - 1].x - open[0].x : 0;
  }
  _genericBreak(nx0, nx1, depth, seed) {
    let sd = (Math.abs(Math.round(seed)) | 0) || 1;
    const r = () => { sd = (sd * 1103515245 + 12345) & 0x7fffffff; return sd / 0x7fffffff; };
    const n = 9, L = 0.18, w = nx1 - nx0;
    const seatFrom = 0.30 + r() * 0.10, seatTo = seatFrom + 0.24 + r() * 0.12;
    const pts = [{ x: nx0, y: 0 }];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      let y;
      if (t >= seatFrom && t <= seatTo) y = depth * (0.93 + r() * 0.07);
      else { const edge = Math.min(t, 1 - t) / seatFrom; y = depth * (L + (0.95 - L) * edge + (r() - 0.5) * 0.18); }
      pts.push({ x: nx0 + w * t, y: Math.max(0, Math.min(depth, y)) });
    }
    pts.push({ x: nx1, y: 0 });
    return x => {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        if (x >= a.x - 0.01 && x <= b.x + 0.01) { const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x); return a.y + (b.y - a.y) * t; }
      }
      return 0;
    };
  }
  _notchEnvelope(x0, g, nx0, nx1, y0, revealOverride) {
    const mode = CFG.levelOne.notch || 'off';
    if (mode === 'off') return null;
    const polys = [];
    for (const s of (g && g.slots) || []) {
      const n = s.notch; if (!n || !n.pts || n.pts.length < 3) continue;
      const cx = x0 + ((s.x0 + s.x1) / 2 - g.x0), top = y0 + n.dy0;
      polys.push(n.pts.map(q => ({ x: cx + q.x * n.fit, y: top + q.y * n.fit })));
    }
    if (!polys.length) return null;
    const xs = new Set();
    const N = 40;
    for (let i = 0; i <= N; i++) xs.add(nx0 + (nx1 - nx0) * i / N);
    for (const P of polys) for (const q of P) if (q.x > nx0 && q.x < nx1) xs.add(q.x);
    const out = [];
    const maxDepth = CFG.H - y0 - 40;
    for (const x of [...xs].sort((a, b) => a - b)) {
      let deep = y0;
      for (const P of polys) {
        for (let i = 0; i < P.length; i++) {
          const a = P[i], b = P[(i + 1) % P.length];
          if (a.x === b.x) continue;
          if ((x >= Math.min(a.x, b.x) - 0.01) && (x <= Math.max(a.x, b.x) + 0.01)) {
            const t = (x - a.x) / (b.x - a.x), y = a.y + (b.y - a.y) * t;
            if (y > deep) deep = y;
          }
        }
      }
      out.push({ x, y: Math.min(y0 + maxDepth, Math.max(y0 + 2, deep)) });
    }
    const reveal = revealOverride !== undefined ? revealOverride : (mode === 'exact' ? 1 : (g.reveal || 0));
    if (reveal >= 1) return out;
    let deepest = 0; for (const q of out) deepest = Math.max(deepest, q.y - y0);
    const gen = this._genericBreak(nx0, nx1, Math.max(60, Math.min(130, deepest * 0.5)), g.x0);
    return out.map(q => ({ x: q.x, y: y0 + Math.max(2, gen(q.x) + ((q.y - y0) - gen(q.x)) * reveal) }));
  }
  notchLeak(g) {
    const y0 = CFG.surfaceY, gw = g.x1 - g.x0;
    const mk = g.throat ? gw / g.throat : 1, ins = mk > 1 ? gw * (1 - 1 / mk) / 2 : 0;
    const now = this._notchEnvelope(0, g, ins, gw - ins, y0), exact = this._notchEnvelope(0, g, ins, gw - ins, y0, 1);
    if (!now || !exact) return 1;
    let sum = 0, deep = 1; for (let i = 0; i < now.length; i++) { sum += Math.abs(now[i].y - exact[i].y); deep = Math.max(deep, exact[i].y - y0); }
    return Math.min(1, (sum / now.length) / deep);
  }

  /** Water surface height at a screen x, so ripples and splashes agree on one line. */
  waterY(x, t) {
    const wy = CFG.surfaceY + CFG.levelOne.waterDepth;
    return wy + Math.sin(x * 0.028 + t * 1.7) * 2.4 + Math.sin(x * 0.0105 - t * 1.05) * 1.7;
  }

  /** A chunk went in: ring out from the entry point and throw a crown of droplets. */
  addSplash(g, x, t) {
    if (!g.splashes) g.splashes = [];
    g.splashes.push({ x, t0: t, drops: Array.from({ length: 14 }, (_, i) => ({
      a: -Math.PI / 2 + (i / 13 - 0.5) * 2.1,
      v: 130 + (i % 5) * 46,
      r: 3 + (i % 4)
    })) });
    if (g.splashes.length > 4) g.splashes.shift();
  }

  drawDitch(ctx, worldX, t) {
    const L1 = CFG.levelOne;
    for (const s of this.openGaps(worldX)) {
      const w = (s.x1 - s.x0) * s.g.open;
      if (!(w > 1)) continue;
      const cx = (s.x0 + s.x1) / 2;
      const x0 = cx - w / 2, x1 = cx + w / 2;
      const wy = CFG.surfaceY + L1.waterDepth;
      ctx.save();
      ctx.clip(this._ditchPath(x0, x1, s.g));

      // the body of the crack — brighter at depth, because the water bounces light up
      const g1 = ctx.createLinearGradient(0, CFG.surfaceY - 20, 0, wy);
      g1.addColorStop(0, '#0E3358');
      g1.addColorStop(0.40, '#123F69');
      g1.addColorStop(0.82, '#1C5F8E');
      g1.addColorStop(1, '#2A7BA8');
      ctx.fillStyle = g1; ctx.fillRect(x0 - 6, CFG.surfaceY - 40, w + 12, wy - CFG.surfaceY + 60);
      const back = this._backArt(Math.round(w / 24) * 24);
      if (back) {
        ctx.drawImage(back.canvas, 0, 0, back.w, back.h, Math.round(x0 - 8), CFG.surfaceY - 24, Math.round(w + 16), back.h);
        const sh = ctx.createLinearGradient(0, CFG.surfaceY - 24, 0, CFG.surfaceY + 70);
        sh.addColorStop(0, 'rgba(3,16,38,0.72)'); sh.addColorStop(1, 'rgba(3,16,38,0)');
        ctx.fillStyle = sh; ctx.fillRect(x0 - 8, CFG.surfaceY - 24, w + 16, 94);
      }
      const wallW = Math.round(Math.min(150, Math.max(56, w * 0.38)));
      const wl = this._wallArt('l', wallW), wr = this._wallArt('r', wallW);
      if (wl && wr) {
        const top = CFG.surfaceY - 14;
        ctx.drawImage(wl.canvas, Math.round(x0 - 10), top);
        ctx.save();
        ctx.translate(Math.round(x1 + 10), 0);
        ctx.scale(-1, 1);
        ctx.drawImage(wr.canvas, 0, top);
        ctx.restore();
      }
      const mist = ctx.createLinearGradient(0, wy - 150, 0, wy + 10);
      mist.addColorStop(0, 'rgba(176,222,246,0)'); mist.addColorStop(0.7, 'rgba(176,222,246,0.28)'); mist.addColorStop(1, 'rgba(196,232,250,0.5)');
      ctx.fillStyle = mist; ctx.fillRect(x0 - 8, wy - 150, w + 16, 160);

      // wet glacier walls, wide and soft, meeting in the middle
      const lightW = Math.max(120, w * 0.42);
      for (const side of [0, 1]) {
        const ex = side ? x1 : x0, dir = side ? -1 : 1;
        const wg = ctx.createLinearGradient(ex, 0, ex + dir * lightW, 0);
        wg.addColorStop(0, 'rgba(176,230,251,0.60)');
        wg.addColorStop(0.45, 'rgba(150,216,246,0.22)');
        wg.addColorStop(1, 'rgba(126,200,238,0)');
        ctx.fillStyle = wg;
        ctx.fillRect(side ? x1 - lightW : x0, CFG.surfaceY - 20, lightW, wy - CFG.surfaceY + 40);
      }

      // --- the melt pool ---
      const body = ctx.createLinearGradient(0, wy, 0, CFG.H + 40);
      body.addColorStop(0, '#2E9FC9');
      body.addColorStop(0.30, '#1B7BA8');
      body.addColorStop(1, '#0C4A70');
      ctx.save();
      // the surface is a wave, so the water never reads as a flat rectangle
      const surf = new Path2D();
      surf.moveTo(x0 - 6, this.waterY(x0 - 6, t));
      for (let px = x0 - 6; px <= x1 + 6; px += 10) surf.lineTo(px, this.waterY(px, t));
      surf.lineTo(x1 + 6, CFG.H + 40);
      surf.lineTo(x0 - 6, CFG.H + 40);
      surf.closePath();
      ctx.clip(surf);
      ctx.fillStyle = body;
      ctx.fillRect(x0 - 8, wy - 10, w + 16, CFG.H + 60 - wy);
      // wall colour bleeding into the water as a reflection
      const refl = ctx.createLinearGradient(0, wy, 0, wy + 46);
      refl.addColorStop(0, 'rgba(196,236,252,0.46)');
      refl.addColorStop(1, 'rgba(174,224,248,0)');
      ctx.fillStyle = refl; ctx.fillRect(x0 - 8, wy, w + 16, 46);
      // drifting highlight streaks
      ctx.fillStyle = 'rgba(226,248,255,0.20)';
      for (let i = 0; i < 4; i++) {
        const sx = x0 + ((i * 0.3129 + t * 0.05) % 1) * w;
        const sy = wy + 14 + i * 13;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 34 - i * 5, 2.2, 0, 0, 6.2832);
        ctx.fill();
      }
      ctx.restore();

      ctx.restore();
    }
  }

  drawWaterFront(ctx, worldX, t) {
    const L1 = CFG.levelOne;
    for (const s of this.openGaps(worldX)) {
      const w = (s.x1 - s.x0) * s.g.open;
      if (!(w > 1)) continue;
      const cx = (s.x0 + s.x1) / 2;
      const x0 = cx - w / 2, x1 = cx + w / 2;
      ctx.save();
      ctx.clip(this._ditchPath(x0, x1, s.g));

      // the bright meniscus along the wave itself
      ctx.save();
      ctx.strokeStyle = 'rgba(240,253,255,0.98)';
      ctx.lineWidth = 4.5; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x0 - 6, this.waterY(x0 - 6, t));
      for (let px = x0 - 6; px <= x1 + 6; px += 10) ctx.lineTo(px, this.waterY(px, t));
      ctx.stroke();
      ctx.restore();

      // floating ice flecks bobbing on the surface
      ctx.fillStyle = 'rgba(240,252,255,0.85)';
      for (let i = 0; i < 5; i++) {
        const fx = x0 + ((i * 0.417 + t * 0.028) % 1) * w;
        const fy = this.waterY(fx, t) - 2;
        ctx.beginPath();
        ctx.ellipse(fx, fy, 9 - i, 3.2, Math.sin(t + i) * 0.15, 0, 6.2832);
        ctx.fill();
      }

      // --- splashes ---
      if (s.g.splashes) {
        for (const sp of s.g.splashes) {
          const age = t - sp.t0;
          if (age < 0 || age > 1.5) continue;
          const sy = this.waterY(sp.x, t);
          const u = age / 1.5;
          // expanding rings
          ctx.save();
          ctx.strokeStyle = `rgba(236,252,255,${(0.75 * (1 - u)).toFixed(3)})`;
          ctx.lineWidth = 3 * (1 - u) + 0.6;
          for (let k = 0; k < 3; k++) {
            const ru = clamp(u * 1.6 - k * 0.18, 0, 1);
            if (ru <= 0) continue;
            ctx.beginPath();
            ctx.ellipse(sp.x, sy + 2, 24 + ru * 118, (24 + ru * 118) * 0.17, 0, 0, 6.2832);
            ctx.stroke();
          }
          ctx.restore();
          // the crown: a short-lived plume straight up out of the hole it punched
          if (age < 0.55) {
            const cu = age / 0.55;
            ctx.save();
            ctx.globalAlpha = 1 - cu;
            ctx.fillStyle = 'rgba(226,248,255,0.9)';
            const ch = 74 * Math.sin(cu * Math.PI);
            ctx.beginPath();
            ctx.moveTo(sp.x - 26, sy + 4);
            ctx.quadraticCurveTo(sp.x - 12, sy - ch, sp.x, sy - ch * 1.15);
            ctx.quadraticCurveTo(sp.x + 12, sy - ch, sp.x + 26, sy + 4);
            ctx.closePath(); ctx.fill();
            ctx.restore();
          }
          // droplets thrown clear of the surface
          ctx.fillStyle = 'rgba(232,250,255,0.92)';
          for (const d of sp.drops) {
            const dy = sy - (Math.sin(d.a) * -1) * 0;
            const px = sp.x + Math.cos(d.a) * d.v * age;
            const py = sy + Math.sin(d.a) * d.v * age + 620 * age * age;
            if (py > sy + 6) continue;
            ctx.globalAlpha = clamp(1 - age / 0.85, 0, 1);
            ctx.beginPath(); ctx.arc(px, py + dy * 0, d.r, 0, 6.2832); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    }
  }

  _tiles() {
    if (this._tileCache && this._tileCache.w === this.tw && this._tileCache.h === this.th) {
      return this._tileCache;
    }
    const make = mirror => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, this.tw); c.height = Math.max(1, this.th);
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      if (mirror) { g.translate(this.tw, 0); g.scale(-1, 1); }
      g.drawImage(this.img, this.src.x, 0, this.src.w, this.src.h, 0, 0, this.tw, this.th);
      return c;
    };
    this._tileCache = { w: this.tw, h: this.th, a: make(false), b: make(true) };
    return this._tileCache;
  }

  drawStrip(ctx, worldX) {
    if (!this.img) return;
    const t = this._tiles();
    const start = Math.floor(worldX / this.tw) - 1;
    const y = Math.round(this.ty);
    for (let k = start; k < start + 4; k++) {
      const sx = Math.round(k * this.tw - worldX);
      const x0 = Math.max(0, sx), x1 = Math.min(CFG.W, sx + this.tw);
      const w = x1 - x0;
      if (w <= 0) continue;
      ctx.drawImage((k & 1) ? t.b : t.a, x0 - sx, 0, w, this.th, x0, y, w, this.th);
    }
  }

  drawRiverLife(ctx, worldX, t) {
    const wy = CFG.surfaceY + CFG.levelOne.waterDepth;
    if (wy > CFG.H) return;
    const band = CFG.H - wy;
    ctx.save();
    const period = 9.5, u = (t % period) / period;
    if (u < 0.42) {
      const dir = Math.floor(t / period) % 2 ? -1 : 1;
      const fx = dir > 0 ? -60 + (u / 0.42) * (CFG.W + 120) : CFG.W + 60 - (u / 0.42) * (CFG.W + 120);
      const fy = wy + band * 0.58 + Math.sin(t * 6) * 3;
      ctx.save(); ctx.translate(fx, fy); ctx.scale(dir, 1);
      ctx.fillStyle = 'rgba(8,52,84,0.55)';
      ctx.beginPath(); ctx.ellipse(0, 0, 22, 8, 0, 0, 6.2832); ctx.fill();
      const flick = Math.sin(t * 14) * 4;
      ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-32, -8 + flick); ctx.lineTo(-32, 8 + flick); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(200,240,255,0.7)'; ctx.beginPath(); ctx.arc(10, -2, 1.8, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(226,248,255,0.55)';
    for (let i = 0; i < 5; i++) {
      const ph = (t * 0.35 + i * 0.23) % 1;
      const bx = ((i * 0.41 + 0.07) % 1) * CFG.W + Math.sin(t * 2 + i) * 6;
      const by = CFG.H - ph * band;
      ctx.beginPath(); ctx.arc(bx, by, 1.6 + (1 - ph) * 2.2, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }
  drawDeepWater(ctx, t) {
    const wy = CFG.surfaceY + CFG.levelOne.waterDepth;
    if (wy > CFG.H) return;

    ctx.save();
    // the same wave line the crevasse pool is drawn to
    const surf = new Path2D();
    surf.moveTo(-10, this.waterY(-10, t));
    for (let px = -10; px <= CFG.W + 10; px += 10) surf.lineTo(px, this.waterY(px, t));
    surf.lineTo(CFG.W + 10, CFG.H + 40);
    surf.lineTo(-10, CFG.H + 40);
    surf.closePath();
    ctx.clip(surf);

    // the same body gradient
    const body = ctx.createLinearGradient(0, wy, 0, CFG.H + 40);
    body.addColorStop(0, '#2E9FC9');
    body.addColorStop(0.30, '#1B7BA8');
    body.addColorStop(1, '#0C4A70');
    ctx.fillStyle = body;
    ctx.fillRect(-10, wy - 10, CFG.W + 20, CFG.H + 60 - wy);

    // the same reflection bleeding down from the surface
    const refl = ctx.createLinearGradient(0, wy, 0, wy + 46);
    refl.addColorStop(0, 'rgba(196,236,252,0.46)');
    refl.addColorStop(1, 'rgba(174,224,248,0)');
    ctx.fillStyle = refl;
    ctx.fillRect(-10, wy, CFG.W + 20, 46);

    // and the same drifting streaks, spread across the full width
    ctx.fillStyle = 'rgba(226,248,255,0.20)';
    for (let i = 0; i < 9; i++) {
      const sx = ((i * 0.3129 + t * 0.05) % 1) * CFG.W;
      const sy = wy + 14 + (i % 4) * 13;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 34 - (i % 4) * 5, 2.2, 0, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
  }

  draw(ctx, worldX, t) {
    const gaps = this.openGaps(worldX);
    ctx.save();
    if (gaps.length) {
      const path = new Path2D();
      path.rect(-200, this.ty - 40, CFG.W + 400, this.th + 80);
      for (const s of gaps) {
        const w = (s.x1 - s.x0) * s.g.open;
        const cx = (s.x0 + s.x1) / 2;
        path.addPath(this._ditchPath(cx - w / 2, cx + w / 2, s.g));
      }
      ctx.clip(path, 'evenodd');
    }
    this.drawDeepWater(ctx, t || 0);
    this.drawStrip(ctx, worldX);
    ctx.restore();
    this.drawLips(ctx, worldX);
  }

  drawLips(ctx, worldX) {
    for (const s of this.openGaps(worldX)) {
      const w = (s.x1 - s.x0) * s.g.open;
      if (w <= 1) continue;
      const cx = (s.x0 + s.x1) / 2;
      if (!this.caps || !this.caps.l || !this.caps.r) continue;
      const mk = s.g.throat ? (s.x1 - s.x0) / s.g.throat : 1;
      const ins = mk > 1 ? w * (1 - 1 / mk) / 2 : 0;
      this.drawCap(ctx, cx - w / 2 + ins, 1, s.g.open);
      this.drawCap(ctx, cx + w / 2 - ins, -1, s.g.open);
    }
  }

  static get CAP() { return { w: 150, h: 227, snowTop: 52, rockEnd: 226, overlap: 8, fade: 0.4 }; }
  _backArt(ww) {
    const band = this.rockBand;
    if (!band || ww < 8) return null;
    const H = Math.round(CFG.H + 60 - CFG.surfaceY);
    ww = Math.max(8, Math.round(ww / 48) * 48);
    const key = 'back:' + ww;
    this._wallCache = this._wallCache || {};
    if (this._wallCache[key]) return this._wallCache[key];
    const c = document.createElement('canvas');
    c.width = ww + 16; c.height = H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    let seed = 4241;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const C = GroundManager.CAP;
    const k = 0.72 * (this.contentY - CFG.surfaceY) / (C.rockEnd - C.snowTop);
    const rowH = Math.max(20, Math.round(band.height * k)), rowW = Math.round(band.width * k);
    for (let y = -Math.round(rnd() * rowH), row = 0; y < H; y += rowH - 4, row++) {
      for (let x = -Math.round(rnd() * rowW); x < c.width; x += rowW - 4) {
        g.save();
        if (row & 1) { g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(band, c.width - x - rowW, y, rowW, rowH); }
        else g.drawImage(band, x, y, rowW, rowH);
        g.restore();
      }
    }
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(12,44,80,0.78)'; g.fillRect(0, 0, c.width, H);      // pushed well back into the blue: it is the FAR wall
    const dk = g.createLinearGradient(0, 0, 0, H);
    dk.addColorStop(0, 'rgba(4,18,40,0.3)'); dk.addColorStop(0.55, 'rgba(4,18,40,0.6)'); dk.addColorStop(1, 'rgba(4,18,40,0.9)');
    g.fillStyle = dk; g.fillRect(0, 0, c.width, H);
    g.globalCompositeOperation = 'source-over';
    const art = { canvas: c, w: c.width, h: H };
    this._wallCache[key] = art;
    this._trimWalls();
    return art;
  }
  _wallArt(side, ww) {
    const band = this.rockBand;
    if (!band) return null;
    const H = Math.round(CFG.H + 100 - CFG.surfaceY);
    ww = Math.max(8, Math.round(ww / 24) * 24);      // see _backArt: a swept key mints canvases
    const key = side + ':' + ww;
    this._wallCache = this._wallCache || {};
    if (this._wallCache[key]) return this._wallCache[key];
    const c = document.createElement('canvas');
    c.width = ww + 12; c.height = H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    let seed = side === 'l' ? 1301 : 7727;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const C = GroundManager.CAP;
    const k = (this.contentY - CFG.surfaceY) / (C.rockEnd - C.snowTop);   // the caps' scale
    const rowH = Math.max(24, Math.round(band.height * k)), rowW = Math.round(band.width * k);
    for (let y = -Math.round(rnd() * rowH * 0.5), row = 0; y < H; y += rowH - 6, row++) {
      const sx = Math.round(rnd() * Math.max(0, rowW - c.width - 8));
      g.save();
      if (row & 1) { g.translate(c.width, 0); g.scale(-1, 1); }
      g.drawImage(band, -sx, y, rowW, rowH);
      g.restore();
    }
    g.globalCompositeOperation = 'destination-in';
    g.beginPath();
    g.moveTo(0, -60);
    let px = ww * (0.7 + 0.3 * rnd()), py = -60;
    g.lineTo(px, py);
    for (let y = 0; y <= H + 60; y += 56) {
      const nx = ww * (0.7 + 0.3 * rnd());
      g.quadraticCurveTo(px, (py + y) / 2, (px + nx) / 2, y);
      px = nx; py = y;
    }
    g.lineTo(px, H + 60);
    g.lineTo(0, H + 60);
    g.closePath();
    g.fill();
    // the deeper the darker: stone fading into the depth
    g.globalCompositeOperation = 'source-atop';
    const dk = g.createLinearGradient(0, 0, 0, H);
    dk.addColorStop(0, 'rgba(6,26,52,0.10)');
    dk.addColorStop(0.4, 'rgba(6,26,52,0.32)');
    dk.addColorStop(1, 'rgba(6,26,52,0.82)');
    g.fillStyle = dk; g.fillRect(0, 0, c.width, H);
    g.globalCompositeOperation = 'source-over';
    const art = { canvas: c, w: c.width, h: H };
    this._wallCache[key] = art;
    this._trimWalls();
    return art;
  }
  _trimWalls() {
    const keys = Object.keys(this._wallCache);
    for (let i = 0; i < keys.length - 12; i++) delete this._wallCache[keys[i]];
  }
  _capArt(side) {
    const C = GroundManager.CAP;
    const faceH = this.contentY - CFG.surfaceY;
    const k = faceH / (C.rockEnd - C.snowTop);
    const w = Math.round(C.w * k), h = Math.round(C.h * k);
    const key = side + ':' + w + ':' + h;
    this._capCache = this._capCache || {};
    if (this._capCache[key]) return this._capCache[key];
    const img = side === 'l' ? this.caps.l : this.caps.r;
    const c = document.createElement('canvas');
    c.width = Math.max(1, w); c.height = Math.max(1, h);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, w, h);
    // fade the inner edge: for the left lip the inner side is the LEFT of cap-l
    const fadeW = Math.round(w * C.fade);
    const grad = side === 'l'
      ? g.createLinearGradient(0, 0, fadeW, 0)
      : g.createLinearGradient(w, 0, w - fadeW, 0);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    const art = { canvas: c, w, h, k };
    this._capCache[key] = art;
    return art;
  }
  drawCap(ctx, x, dir, open) {
    const C = GroundManager.CAP;
    const art = this._capArt(dir === 1 ? 'l' : 'r');
    const top = CFG.surfaceY - 4 - C.snowTop * art.k;
    const reach = C.overlap * clamp(open === undefined ? 1 : open, 0, 1);
    const dx = dir === 1 ? Math.round(x + reach - art.w) : Math.round(x - reach);
    ctx.drawImage(art.canvas, dx, Math.round(top));
  }

}

const OBSTACLE_ART = [
  'log-fallen', 'log-arch', 'log-crossed', 'log-stump',
  'bone-ribs', 'bone-cage', 'bone-tusk', 'bone-arch'
];

/* ---------------- ObstacleController ---------------- */
class ObstacleController {
  constructor(imgs, audio, particles, families = []) {
    this.audio = audio; this.particles = particles; this.list = [];
    this.chimed = new Set();
    this.kinds = [];
    const list = Array.isArray(imgs) ? imgs : [imgs];
    for (let n = 0; n < list.length; n++) {
      const img = list[n];
      if (!img) continue;
      const m = measureContent(img);
      if (!m) continue;
      const s = (CFG.obstacle.drawHeight || CFG.obstacle.height) / m.h;
      this.kinds.push({
        img,
        family: families[n] || 'rock',            // 'rock' | 'log' | 'bone', for planned combinations
        sx: m.x0, sy: m.y0, sw: m.w, sh: m.h,      // source crop: content only
        dw: m.w * s, dh: m.h * s                    // destination size on stage
      });
    }
    // collision uses the normalised size, so all variants play the same
    this.w = this.kinds.length ? this.kinds[0].dw : 200;
    this.h = CFG.obstacle.height;
  }
  reset() { this.list = []; this.chimed.clear(); }

  get gap() {
    const air = 2 * Math.abs(CFG.jumpVel) / CFG.gravity;   // seconds off the ground
    const leap = CFG.runSpeed * air;                       // ground one jump covers
    const room = CFG.runSpeed * (CFG.obstacle.runRoomS || 1.2);
    return Math.round(leap + room);
  }

  get leap() { return CFG.runSpeed * (2 * Math.abs(CFG.jumpVel) / CFG.gravity); }
  spawn(worldX, screenX, count, plan) {
    const id = Math.random();
    const cc = CFG.obstacle;
    const leap = this.leap;
    const pick = (i, fam) => {
      if (!this.kinds.length) return 0;
      const pool = fam ? this.kinds.map((k, n) => k.family === fam ? n : -1).filter(n => n >= 0) : [];
      if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
      return (i + Math.floor(Math.random() * this.kinds.length)) % this.kinds.length;
    };
    let x = worldX + screenX;
    for (let i = 0; i < count; i++) {
      if (i > 0) {
        const asked = plan && plan.room ? plan.room[Math.min(i - 1, plan.room.length - 1)] : (cc.runRoomS || 1.2);
        const room = Math.max(asked, cc.roomMin || 0);
        x += leap + CFG.runSpeed * room;
      }
      this.list.push({
        id: id + i,
        x: Math.round(x),
        scale: cc.pairScale || 1,
        kind: pick(i, plan && plan.kinds ? plan.kinds[i] : null),
        passed: false, telegraph: 0, hits: 0, grace: 0
      });
    }
  }
  update(dt, worldX, mammoth, onHit, live = true) {
    for (const o of this.list) {
      const sx = o.x - worldX;
      if (o.grace > 0) o.grace -= dt;
      if (sx < 1180 && sx > CFG.mammothX && o.telegraph < 1) {
        o.telegraph += dt * 1.6;
        if (!this.chimed.has(o.id)) { this.chimed.add(o.id); this.audio.crystal(); }
      }
      if (sx < CFG.mammothX - 200) o.passed = true;
      // collision — driven by the normalised size, never by the chosen art
      const kw = (this.kinds[o.kind] || {}).dw || this.w;
      const ow = kw * o.scale, oh = this.h * o.scale;
      const ox0 = sx - ow * 0.28, ox1 = sx + ow * 0.28;
      const feet = mammoth.feetY;
      if (live && o.grace <= 0 && o.hits < 3 && ox0 < mammoth.drawX + 52 && ox1 > mammoth.drawX - 52 && feet > CFG.surfaceY - oh * 0.28) {
        o.hits++; o.grace = 1.1; onHit(o, sx);
        if (o.hits >= 3) o.crumble = 0;
      }
      if (o.crumble !== undefined && o.crumble < 1) o.crumble = Math.min(1, o.crumble + dt * 1.7);
    }
    this.list = this.list.filter(o => o.x - worldX > -400);
  }
  draw(ctx, worldX, t, only) {
    for (const o of this.list) {
      if (only && o !== only) continue;
      const sx = o.x - worldX;
      if (sx < -300 || sx > CFG.W + 300) continue;
      const ow = this.w * o.scale, oh = this.h * o.scale;
      const artW = (this.kinds[o.kind] || this.kinds[0] || { dw: ow }).dw * o.scale;
      if (!only) {
      ctx.save();
      ctx.translate(sx, CFG.surfaceY + 4);
      ctx.scale(1, 26 / (artW * 0.5));
      const crg = ctx.createRadialGradient(0, 0, 0, 0, 0, artW * 0.5);
      crg.addColorStop(0, 'rgba(22,64,108,0.30)');
      crg.addColorStop(0.45, 'rgba(22,64,108,0.15)');
      crg.addColorStop(1, 'rgba(24,72,120,0)');
      ctx.fillStyle = crg;
      ctx.beginPath(); ctx.arc(0, 0, artW * 0.5, 0, 6.2832); ctx.fill();
      ctx.restore();
      }
      const cr = o.crumble === undefined ? 0 : o.crumble;
      const lean = 0, swell = 1;
      ctx.save();
      // the sink is proportional to the drawn size — see the note on CFG.obstacle
      const sink = Math.round((CFG.obstacle.drawHeight || CFG.obstacle.height) *
                              (CFG.obstacle.sinkRatio || 0) * o.scale);
      ctx.translate(sx, CFG.surfaceY + sink);
      ctx.rotate(lean);
      ctx.scale(swell, swell);
      ctx.translate(-sx, -(CFG.surfaceY + sink));
      if (cr > 0) { ctx.save(); ctx.globalAlpha = 1 - cr; ctx.translate(sx, CFG.surfaceY); ctx.scale(1 + cr * 0.1, 1 - cr * 0.85); ctx.translate(-sx, -(CFG.surfaceY)); }
      const k = this.kinds[o.kind] || this.kinds[0];
      if (k) {
        const dw = k.dw * o.scale, dh = k.dh * o.scale;
        const dx = sx - dw / 2, dy = CFG.surfaceY + sink - dh;
        ctx.drawImage(k.img, k.sx, k.sy, k.sw, k.sh, dx, dy, dw, dh);
      }
      if (cr > 0) ctx.restore();
      ctx.restore();                      // the anticipation transform
      if (o.telegraph > 0 && o.telegraph < 1.6 && !o.passed) {
        const a = Math.sin(t * 9) * 0.5 + 0.5;
        ctx.save();
        ctx.globalAlpha = 0.55 * a * clamp(o.telegraph, 0, 1);
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          const ax = sx - 26 + i * 30, ay = CFG.surfaceY - oh - 18 - i * 14;
          ctx.beginPath();
          ctx.moveTo(ax - 9, ay); ctx.lineTo(ax + 9, ay);
          ctx.moveTo(ax, ay - 9); ctx.lineTo(ax, ay + 9);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
}

/* ---------------- PolygonCutManager ---------------- */
export const PolygonCutManager = {
  isDiagonal(n, i, j) {
    if (i === j) return false;
    const d = Math.abs(i - j);
    return d !== 1 && d !== n - 1;
  },
  split(pts, i, j) {
    const n = pts.length;
    const a = [], b = [];
    for (let k = i; ; k = (k + 1) % n) { a.push({ ...pts[k] }); if (k === j) break; }
    for (let k = j; ; k = (k + 1) % n) { b.push({ ...pts[k] }); if (k === i) break; }
    return [a, b];
  },
  toPiece(pts) {
    const c = centroid(pts);
    return { local: pts.map(p => ({ x: p.x - c.x, y: p.y - c.y })), x: c.x, y: c.y, rot: 0, scale: 1 };
  }
};

/* ================= main game ================= */
export function createGame(canvas, hooks = {}) {
  const ctx = canvas.getContext('2d');
  let rs = 1, rsCap = 2;
  let pausedAsking = false;             // see api.setPaused
  function setRenderScale(k) {
    k = clamp(Math.min(Number(k) || 1, rsCap), 0.5, 2);
    const w = Math.round(CFG.W * k), h = Math.round(CFG.H * k);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    rs = k;
  }
  setRenderScale(hooks.renderScale || 1);
  const scaleForced = !!hooks.renderScaleForced;
  let fpsMean = 60, fpsClock = 0;
  function guardScale(dtWall) {
    if (scaleForced || rs <= 0.5 || !(dtWall > 0) || dtWall > 0.5) return;
    fpsMean += (1 / dtWall - fpsMean) * 0.05;
    fpsClock += dtWall;
    if (fpsClock > 1.2 && fpsMean < 40) {
      const step = fpsMean < 22 ? rs / 2 : fpsMean < 30 ? 0.5 : 0.25;
      rsCap = Math.max(0.5, Math.round((rs - step) * 4) / 4);
      setRenderScale(rsCap);
      fpsClock = 0; fpsMean = 60;
    }
  }
  let hdArt = hooks.hdArt !== undefined ? !!hooks.hdArt : rs >= CFG.sprite.hd.minRenderScale;
  CFG.sprite.cellK = hdArt ? CFG.sprite.hd.k : 1;

  const audio = new AudioManager();
  const particles = new ParticleManager();
  const atmos = new Atmosphere();
  const images = {};
  let ground, obstacles, bgm, mammoth;
  let raf = 0, last = 0, destroyed = false, paused = false;
  let devTools = false;
  // simulation steps per rendered frame; 1 is normal play (see setOptions)
  let fastForward = 1;
  let reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mqReduced = reduced;

  const RUN_STATES = new Set(['AVALANCHE', 'RUN_SEGMENT_1', 'JUMP_CHALLENGE_1', 'POST_JUMP_RUN_1',
    'PHASE_RUN', 'RUN_SEGMENT_2', 'JUMP_CHALLENGE_2', 'POST_JUMP_RUN_2', 'FINAL_RUN']);

  const L2_RUN_STATES = ['RUN_SEGMENT_2', 'JUMP_CHALLENGE_2', 'POST_JUMP_RUN_2', 'GLACIER_BREAK_2'];
  const L2_PUZZLE_STATES = ['LEVEL_2_INTRO', 'LEVEL_2_OVERVIEW', 'LEVEL_2_FOCUS',
    'LEVEL_2_ACTIVE', 'LEVEL_2_WRONG_FEEDBACK', 'LEVEL_2_SUCCESS', 'BRIDGE_2_COMPLETE'];
  const L2_STATES = new Set([...L2_RUN_STATES, ...L2_PUZZLE_STATES]);

  const L2_ON = !!(CFG.levelTwo && CFG.levelTwo.enabled);
  const L1_SKY_END = L2_ON ? 0.72 : 0.82;
  const JOURNEY = {
    RUN_SEGMENT_1:     [0.00, 0.06, 1400],
    JUMP_CHALLENGE_1:  [0.06, 0.09, 3600],
    POST_JUMP_RUN_1:   [0.09, 0.12, 2000],
    RUN_SEGMENT_2:     [L1_SKY_END, L1_SKY_END + 0.04, 2600],
    JUMP_CHALLENGE_2:  [L1_SKY_END + 0.04, L1_SKY_END + 0.08, 3600],
    POST_JUMP_RUN_2:   [L1_SKY_END + 0.08, L1_SKY_END + 0.10, 1900],
    // the puzzle itself holds the sky still, exactly as Level 1's phases do
    BRIDGE_2_COMPLETE: [L1_SKY_END + 0.10, 0.92, 700],
    FINAL_RUN:         [L2_ON ? 0.92 : 0.82, 1.00, 6000]
  };

  const G = {
    state: 'BOOT', st: 0, worldX: 0, dist: 0, progress: 0, t: 0,
    speedFactor: 1, shake: 0, shakeT: 0, moving: true,
    dialogue: false,
    instruction: '', jumpEnabled: false,
    complete: false,
    l1: null,
    level: 1, l2: null, gapA: null, gapB: null, p2i: 0,
    attempts: 0, idle: 0, hintUntil: 0, hint: null,
    oops: false, hitFx: 0, hitObstacle: null, hitReturn: null,
    handHint: null, idleHand: 0, dropReady: false, introT: 0, stageBeat: 0, saidQuestion: '', l2Asked: false, voDur: 0,
    signSay: '',
    quakeT: 0, quakeAmp: 0, quakeLen: 0, quakeRoll: 0, quakePeak: 0, quakeAt: 0,
    quakeOx: 0, quakeOy: 0,
    freeze: 0,                                            // seconds of hit-stop left
    zoom: 1, zoomWant: 1, zoomVX: 960, zoomVY: 540,
    zoomFrom: 1, zoomTo: 1, zoomP: 1, zoomMs: 900,
    zoomMsWant: 0,
    punchAmp: 0, punchT: 0, punchLen: 0, punchAt: 0, punchX: 0, punchY: 0,
    instrHold: 0, instrLast: '',
    phase: 0, phasesDone: 0, gapsThisPhase: null, phaseLayout: null, phaseJumped: false
  };

  /* ---- HUD push ---- */
  function armInstruction(ms) { G.instrHold = ms === undefined ? T.instructionHold : ms; }
  function voIdFor(text) {
    const m = /\bthe\s+([a-z]+?)(s?)[.!]?$/i.exec(String(text || '').trim());
    return m ? 'sign-' + m[1].toLowerCase() + (m[2] ? 's' : '') : '';
  }
  /* THE QUESTION IS SPOKEN as the plank arrives (stage beat 1), once per phase. */
  function sayPhaseQuestion() {
    const p = phaseCfg();
    const id = (p && p.voId) || voIdFor(p && p.instruction);
    if (id && G.saidQuestion !== id) { G.saidQuestion = id; G.voDur = audio.say(id) || 0; }
  }
  function updateInstruction(dt) {
    if (G.instruction !== G.instrLast) { G.instrLast = G.instruction; armInstruction(); }
    if (G.instrHold > 0) G.instrHold = Math.max(0, G.instrHold - dt * 1000);
    if (!G.signSay && G.stageBeat >= 2 &&
        ['PHASE_INTRO', 'PHASE_ACTIVE', 'PHASE_WRONG', 'PHASE_SUCCESS'].includes(G.state)) sayPhaseQuestion();
  }

  function l2Plank(text) {
    if (!G.l2) return text;
    if (text && !G.signSay && text === G.instruction &&
        ['LEVEL_2_FOCUS', 'LEVEL_2_ACTIVE', 'LEVEL_2_WRONG_FEEDBACK'].includes(G.state)) G.l2Asked = true;
    if (G.state === 'LEVEL_2_SUCCESS' && !G.signSay && !G.l2Asked) return '';
    return text;
  }

  function signVoFor(text) {
    if (!text) return '';
    if (text === 'Use the right ice piece to fix the path.') return 'tut-6-use';
    if (text === 'Use the right piece to fix the path.') return 'tut-6b-piece';
    const ins = (CFG.levelTwo && CFG.levelTwo.instructions) || {}, hv = (CFG.levelTwo && CFG.levelTwo.hintVo) || {};
    for (const k in ins) if (ins[k] === text && hv[k]) return hv[k];
    return '';
  }

  let lastHud = '';
  function pushHud() {
    G.p2Focus = p2FocusOn();
    const h = {
      instruction: l2Plank(G.signSay || (((G.instrHold > 0 || (G.l1 && G.l1.unfilled && G.l1.unfilled.length > 0 &&
                    ['PHASE_INTRO', 'PHASE_ACTIVE', 'PHASE_WRONG', 'PHASE_SUCCESS'].includes(G.state))
                    || (G.l2 && L2_PUZZLE_STATES.includes(G.state) && G.state !== 'BRIDGE_2_COMPLETE'))
                    && !(G.state === 'PHASE_INTRO' && G.stageBeat < 2)) ? G.instruction : '')),
      signBanner: !!G.signSay,
      voId: G.signSay
        ? signVoFor(G.signSay)
        : G.l2 && L2_PUZZLE_STATES.includes(G.state) ? p2Cfg().voId
        : G.l1 && ['PHASE_INTRO', 'PHASE_ACTIVE', 'PHASE_WRONG', 'PHASE_SUCCESS'].includes(G.state)
          ? phaseCfg().voId : '',
      p2Focus: p2FocusOn(),
      signCentre: !!G.l2 && L2_PUZZLE_STATES.includes(G.state),
      voDur: G.voDur || 0,
      step: G.complete ? p2Count() + L1.phases.length
        : (G.p2i < p2Count()
            ? G.p2i
            : p2Count() + Math.min(G.phase, L1.phases.length)),
      steps: p2Count() + L1.phases.length,
      jumpEnabled: G.jumpEnabled, complete: G.complete,
      skippable: devTools && G.state !== 'BOOT' && G.state !== 'TITLE' && !G.complete,
      playing: G.state !== 'BOOT' && G.state !== 'TITLE' && !G.complete,

      oops: G.oops,
      // the hint control asks for attention once the learner has been stuck a while
      hintNudge: G.state === 'PHASE_ACTIVE' && (G.idle > CFG.hint.slotMs / 1000 || (G.l1 && G.l1.wrong >= 1)),
      // where to demonstrate the cut, once the learner has been idle a long while
      handHint: G.handHint || null,
      view: { k: G.zoom, x: G.zoomVX, y: G.zoomVY },
      soundOn: !!audio.enabled
    };
    h.voWords = h.voId ? (audio.voLine(h.voId)?.words || null) : null;
    const s = JSON.stringify(h);
    if (s !== lastHud) { lastHud = s; hooks.onHud && hooks.onHud(h); }
  }

  /* ---- who the player picked ---- */
  let characterId = CFG.characters[0].id;
  function currentCharacter() {
    return CFG.characters.find(c => c.id === characterId) || CFG.characters[0];
  }
  /** Swap the explorer. Kept out of the run states so it can only happen up front. */
  function setCharacter(id) {
    if (!CFG.characters.some(c => c.id === id)) return false;
    characterId = id;
    if (mammoth) { mammoth.setCharacter(currentCharacter(), images); mammoth.reset(); }
    return true;
  }

  /* ---- asset loading ---- */
  function loadImg(src) {
    return new Promise(res => {
      const i = new Image();
      const url = assetUrl(src);
      const mark = u => { try { i.dataset.asset = new URL(u, document.baseURI).href; } catch (e) { i.dataset.asset = u; } };
      mark(url);
      const free = () => { if (i.src.startsWith('blob:')) { try { URL.revokeObjectURL(i.src); } catch (e) { /* gone */ } } };
      i.onload = () => { if (i.decode) i.decode().then(() => res(i), () => res(i)); else res(i); };
      NET.get(url).then(blob => {
        const chain = (blob ? [URL.createObjectURL(blob)] : []).concat([url]);
        const webp = webpUrl(src);
        if (webp !== url) chain.push(webp);
        let k = 0;
        i.onerror = () => {
          free();
          if (k >= chain.length) { res(null); return; }
          if (chain[k] === webp) mark(webp);
          i.src = chain[k++];
        };
        i.onerror();
      });
    });
  }
  async function preload() {
    const imgFormat = typeof globalThis !== 'undefined' ? globalThis.ImgFormat : null;
    if (imgFormat && imgFormat.ready && !imgFormat.settled) await imgFormat.ready;
    if (audio.enabled && hooks.sound !== false) {
      for (const cue of Object.values(CFG.sfx || {})) if (cue && cue.src) NET.plan(assetUrl(cue.src));
      if (CFG.vo && CFG.vo.src && !SILENT_VO) NET.plan(assetUrl(CFG.vo.src));
      if (CFG.music && CFG.music.src) NET.plan(assetUrl(CFG.music.src));
    }
    const jobs = CFG.phases.map(p => loadImg(p.src).then(i => { images[p.key] = i; }));
    jobs.push(loadImg('assets/env/path.webp').then(i => { images.path = i; }));
    jobs.push(loadImg('assets/env/rock-wide.webp').then(i => { images.rockWide = i; }));
    jobs.push(loadImg('assets/env/rock-tall.webp').then(i => { images.rockTall = i; }));
    for (const k of OBSTACLE_ART) {
      jobs.push(loadImg('assets/env/obs-' + k + '.webp').then(i => { images['obs:' + k] = i; }));
    }
    jobs.push(loadImg(CFG.rope.src).then(i => { images.rope = i; }));
    audio.fetchVo();
    jobs.push(loadImg('assets/env/cap-l.webp').then(i => { images.capL = i; }));
    jobs.push(loadImg('assets/env/cap-r.webp').then(i => { images.capR = i; }));
    jobs.push(loadImg('assets/env/rock-band.webp').then(i => { images.rockBand = i; }));

    jobs.push(loadImg('assets/char/duo-celebrate.webp').then(i => { images.duo = i; }));
    // one painted block per shape the curriculum can name
    for (const [id, s] of Object.entries(optionShapes)) {
      jobs.push(loadImg(s.image).then(i => { images['shape:' + id] = i; }));
    }
    const loadCharacterArt = async useHd => {
      const pairs = [];
      for (const ch of CFG.characters) {
        for (const slot of Object.keys(ch.sheets)) {
          const src = useHd && ch.hd && ch.hd[slot] ? ch.hd[slot] : ch.sheets[slot];
          pairs.push(loadImg(src).then(i => { images[ch.id + ':' + slot] = i; return !!i; }));
        }
      }
      pairs.push(loadImg(useHd ? 'assets/char/hd/bear.webp' : 'assets/char/bear.webp').then(i => { images.bear = i; return !!i; }));
      return (await Promise.all(pairs)).every(Boolean);
    };
    jobs.push((async () => {
      if (hdArt && !(await loadCharacterArt(true))) {
        for (const ch of CFG.characters) for (const slot of Object.keys(ch.sheets)) {
          const img = images[ch.id + ':' + slot];
          if (img) { try { if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src); img.src = ''; } catch (e) { /* detached already */ } }
          images[ch.id + ':' + slot] = null;
        }
        if (images.bear) { try { if (images.bear.src.startsWith('blob:')) URL.revokeObjectURL(images.bear.src); images.bear.src = ''; } catch (e) { /* detached */ } images.bear = null; }
        hdArt = false; CFG.sprite.cellK = 1;
        await loadCharacterArt(false);
      } else if (!hdArt) await loadCharacterArt(false);
    })());
    await Promise.all(jobs);
    NET.seal();
  }

  /* ---- state machine ---- */
  function setState(s) {
    G.state = s; G.st = 0;
    onEnter(s);
    pushHud();
  }

  function onEnter(s) {
    switch (s) {
      case 'AVALANCHE':
        G.moving = true; G.jumpEnabled = false; G.speedFactor = 1;
        G.avT = 0; G.avX = -760;            // it starts off the left edge
        G.avRoared = false; G.avPuff = 0; G.avCracked = false; G.avSquealed = false;
        mammoth.setState('RUN');
        audio.kit('anticipate', { volume: 0.8, vary: 0 });
        audio.rumble();
        audio.setDuck(0.4);
        quake(reduced ? 5 : 13, T.avalancheRoar + T.avalancheSweep, T.avalancheRoar);
        G.avGap = -9999;                    // the first crevasse opens on the next tick
        G.avLead = 0;
        break;
      case 'RUN_SEGMENT_1':
        G.avT = 0;                          // the wall is gone; nothing left to draw
        G.avLead = 0; if (mammoth) mammoth.dx = 0;   // and he settles back to his mark
        ground.gaps = ground.gaps.filter(g => !g.avalanche);
        audio.setDuck(1);
        G.moving = true; G.jumpEnabled = true; mammoth.setState('RUN'); break;
      case 'JUMP_CHALLENGE_1':
        obstacles.spawn(G.worldX, 2150, 1); G.retryRun = false; break;
      case 'POST_JUMP_RUN_1':
        G.hitCount = 0; break;
      case 'TITLE':
        G.moving = false; G.jumpEnabled = false;
        mammoth.setState('IDLE_LOOK');
        break;
      case 'OBSTACLE_HIT':
        G.moving = false; G.jumpEnabled = false; G.oops = false;
        break;
      case 'GLACIER_BREAK_1': G.jumpEnabled = false; startBreak(1); break;

      case 'RUN_SEGMENT_2':
        G.level = 2; G.l1 = null; G.gapsThisPhase = null;
        G.moving = true; G.jumpEnabled = true; G.speedFactor = 1;
        mammoth.setState('RUN'); break;
      case 'JUMP_CHALLENGE_2':
        // two, not one: the jump is long learned by here, and this is the last of it
        obstacles.spawn(G.worldX, 2150, 2); G.retryRun = false; break;
      case 'POST_JUMP_RUN_2': G.hitCount = 0; break;
      case 'GLACIER_BREAK_2': G.jumpEnabled = false; startBreak(2); break;
      case 'LEVEL_2_INTRO':
        G.level = 2; G.jumpEnabled = false;
        G.instruction = ''; G.signSay = ''; G.l2Asked = false;
        // let the tremble that started at the stop play out into the head-down look
        if (mammoth.state !== 'SHAKE') mammoth.setState('LOOK_DOWN');
        buildLevel2(); break;
      case 'LEVEL_2_OVERVIEW':
        G.jumpEnabled = false;
        G.instruction = ''; G.signSay = '';
        if (!G.l2) buildLevel2();
        break;
      case 'LEVEL_2_FOCUS':
        audio.setDuck(0.75);
        G.instruction = p2Cfg().instruction || '';
        G.subline = p2Cfg().sub || '';
        armInstruction(T.instructionHold);
        { const vo = p2Cfg().voId; if (vo) G.voDur = audio.say(vo) || 0; }
        break;
      case 'LEVEL_2_ACTIVE': G.idle = 0; G.idleHand = 0; if (!G.l2) buildLevel2(); break;
      case 'LEVEL_2_WRONG_FEEDBACK': break;
      case 'LEVEL_2_SUCCESS': G.signSay = ''; break;
      case 'BRIDGE_2_COMPLETE':
        G.instruction = ''; G.signSay = '';
        audio.setDuck(1);
        mammoth.scare = 0;
        mammoth.hopShort = true; mammoth.setState('CELEBRATE');
        audio.success(L1.phases.length); atmos.pulse();
        if (!reduced) particles.confetti(CFG.W, 110);
        particles.poof(CFG.mammothX, CFG.surfaceY, reduced ? 3 : 6, 1.1);
        break;
      case 'PHASE_RUN': G.zoomWant = 1; G.zoomMsWant = 0;
        G.moving = true; G.jumpEnabled = true; G.speedFactor = 1;
        G.phaseJumped = false;
        G.runLeadMs = (G.retryRun ? (CFG.obstacle.retryLeadS || 0.7) : (CFG.obstacle.leadS || 2.4)) * 1000;
        G.retryRun = false;
        mammoth.setState('RUN'); break;
      case 'PHASE_INTRO':
        aimZoom();
        G.jumpEnabled = false;
        G.dropReady = false;                 // nothing moves until the panel leaves
        G.introT = 0; G.stageBeat = 0;        // see the beats in update: hole, sign, options
        G.instruction = phaseCfg().instruction;
        G.subline = phaseCfg().sub || '';
        // let the tremble that started at the stop play out into the head-down look
        if (mammoth.state !== 'SHAKE') mammoth.setState('LOOK_DOWN');
        buildPhase(); break;
      case 'PHASE_ACTIVE': G.idle = 0; G.idleHand = 0; if (!G.l1) buildPhase(); break;
      case 'PHASE_SUCCESS': break;
      case 'PHASE_DONE':
        // the whole phase is repaired: celebrate, then back to the adventure
        G.instruction = ''; G.subline = '';
        G.signSay = '';
        G.phasesDone = Math.max(G.phasesDone, G.phase + 1);
        mammoth.hopShort = true; mammoth.setState('CELEBRATE'); audio.success(G.phase); atmos.pulse();
        mammoth.scare = 0;
        if (!reduced) particles.confetti(CFG.W, 110);   // confetti, not stars: the whole phase is done
        particles.poof(CFG.mammothX, CFG.surfaceY, reduced ? 3 : 6, 1.1);
        break;
      case 'FINAL_RUN': G.zoomWant = 1; G.zoomMsWant = 0;
        G.bearAt = G.worldX + CFG.W + 1250;
        G.l1 = null; G.l2 = null; G.gapsThisPhase = null;
        G.instruction = '';
        G.moving = true; G.jumpEnabled = true; G.speedFactor = 1;
        audio.setDuck(1); mammoth.setState('RUN'); break;
      case 'COMPLETE':
        G.moving = false; G.complete = true; G.jumpEnabled = false; G.instruction = ''; G.drizzleAt = 0; G.duoFrame = -1;
        G.zoomWant = 1; G.zoomMsWant = 0;   // the push-in starts a beat later, in the update
        mammoth.hopShort = false; mammoth.setState('CELEBRATE'); particles.poof(CFG.mammothX, CFG.surfaceY, 6, 1.1);
        if (!reduced) particles.confetti(CFG.W, 130, true);
        // a proper shower for the end of the journey, thrown from over his head
        particles.sparkle(CFG.mammothX + 40, CFG.surfaceY - 320, reduced ? 8 : 26, 340);
        audio.fanfare();
        audio.say('win-yay');
        break;
    }
  }

  function drawBear(ctx) {
    const img = images.bear;
    if (!img || !G.bearAt) return;
    const sx = G.bearAt - G.worldX;
    if (sx < -300 || sx > CFG.W + 300) return;
    // a cub, so a little smaller; the hd bear is cellK bigger, so drawn cellK smaller
    const k = CFG.sprite.scale * 0.86 / (CFG.sprite.cellK || 1);
    const w = img.width * k, h = img.height * k;
    ctx.save();
    const bob = reduced ? 0 : Math.sin(G.t * 1.6) * 4;
    ctx.translate(sx, CFG.surfaceY + 6 + bob);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  /* ---- glacier break ---- */
  let brk = null;
  function makeCrack() {
    const p = []; let x = 0, y = 0;
    for (let i = 0; i < 6; i++) { x += (i % 2 ? 11 : -11) + rand(-6, 6); y += 22; p.push({ x, y }); }
    return p;
  }
  const BREAK_HOLD = 140;                        // ms at full speed (anticipation)
  const BREAK_SLIDE = T.breakSkid - BREAK_HOLD;  // ms of deceleration
  const BREAK_K = 1.4;                           // speed = (1-u)^k, so mean speed = 1/(k+1)
  const BREAK_CRACK = 300;                       // ms until the ice actually lets go

  function startBreak(level = 1) {
    ground.gaps = ground.gaps.filter(g => g.repaired);
    audio.rumble();
    audio.setDuck(0.8);
    quake(reduced ? 4 : 10, T.breakSkid, BREAK_CRACK);
    const dist = CFG.runSpeed * (BREAK_HOLD + BREAK_SLIDE / (BREAK_K + 1)) / 1000;
    const targetWorldX = G.worldX + dist;
    brk = { cracked: false, skidded: false, targetWorldX, level };
    G.phaseLayout = level === 2 ? layoutLevelTwo(targetWorldX) : layoutPhase(targetWorldX);
    G.gapsThisPhase = G.phaseLayout.gaps;
    // gapB is null for a one-hole crossing; everything downstream guards on it
    if (level === 2) { G.gapA = G.phaseLayout.gaps[0]; G.gapB = G.phaseLayout.gaps[1] || null; }
    mammoth.setState('RUN');
  }
  function updateBreak(dt) {
    const gaps = (G.gapsThisPhase || []).filter(Boolean);
    const cp = clamp(G.st / 340, 0, 1);
    gaps.forEach(g => { g.crack = cp; });
    if (G.st > 300) gaps.forEach(g => { g.open = clamp((G.st - 300) / 320, 0, 1); });

    if (G.st < BREAK_HOLD) {
      // still running — the ground is only just starting to give
      G.speedFactor = 1;
    } else {
      const u = clamp((G.st - BREAK_HOLD) / BREAK_SLIDE, 0, 1);
      G.speedFactor = Math.pow(1 - u, BREAK_K);
      if (!brk.skidded) { brk.skidded = true; audio.skid(); }
      mammoth.setState('SKID_STOP');
      mammoth.setSkidProgress(u);
    }

    if (!brk.cracked && G.st > BREAK_CRACK) {
      brk.cracked = true;
      audio.crack();
      hitStop(CFG.juice.stopBreak);
      punch(CFG.juice.punchBreak, 420, CFG.mammothX + 420, CFG.surfaceY);
      audio.rumble();
      atmos.pulse();                    // one flash, on the frame the ice gives
      gaps.forEach(g => particles.chips(g.x0 - G.worldX + (g.x1 - g.x0) / 2, CFG.surfaceY, 6, -180));
      shake(reduced ? 3 : 7, 260);
      mammoth.jolt(reduced ? 0.3 : 0.6);
    }

    if (G.st >= T.breakSkid) {
      G.speedFactor = 0; G.moving = false; G.worldX = brk.targetWorldX;
      audio.setDuck(1);
      mammoth.startle(reduced ? 0.55 : 1);
      setState(brk && brk.level === 2 ? 'LEVEL_2_INTRO' : 'PHASE_INTRO');
    }
  }

  /* ---- Level 1 ---- */
  const L1 = CFG.levelOne;
  const SHAPE_W = L1.slabW, SHAPE_H = L1.slabH;

  function phaseCfg() { return L1.phases[clamp(G.phase, 0, L1.phases.length - 1)]; }

  function phasePieceW(p) {
    const box = optionBox(p.options);
    const w0 = Math.min(box.w, SHAPE_W);
    const kinds = p.targets.concat(p.distractors).slice(0, p.options);
    let tallest = 0;
    for (let i = 0; i < kinds.length; i++) {
      const c = seatedChunk(kinds[i], { w: w0, h: 1e6 },
                            { irregular: p.irregular, seed: p.id * 97 + 7 * i + 3 });
      const bb = polyBounds(c.pts);
      if (bb.w > 0) tallest = Math.max(tallest, bb.h / bb.w);
    }
    if (!(tallest > 0)) return w0;
    return Math.max(80, Math.min(w0, L1.optionH / tallest));
  }

  function layoutPhase(originX) {
    const p = phaseCfg();
    const n = clamp(p.ditches || 1, 1, p.targets.length);

    const pieceW = phasePieceW(p);
    const throatW = Math.max(L1.ditchMin, Math.round(pieceW * (1 - L1.bearing * 2)));

    const share = new Array(n).fill(1);
    for (let extra = p.targets.length - n, i = n - 1; extra > 0; extra--, i = (i - 1 + n) % n) share[i]++;
    const mouthOf = k => Math.round(throatW * k * (L1.mouth || 1));
    const groupW = share.reduce((a, k) => a + mouthOf(k), 0) + (n - 1) * L1.ditchGap;
    const rowMid = (CFG.mammothX + L1.clearOfPlayer + (CFG.W - 60)) / 2;
    const lead = clamp(
      Math.max(Math.round(rowMid - groupW / 2), CFG.mammothX + L1.clearance),
      CFG.mammothX + L1.clearance * 0.5,
      CFG.W - 60 - groupW
    );

    ground.gaps = ground.gaps.filter(g => g.repaired);
    const gaps = [], slots = [];
    const ins0 = (mouthOf(share[0]) - throatW * share[0]) / 2;
    let x = originX + lead - ins0;
    for (let i = 0; i < n; i++) {
      const k = share[i];
      const th = throatW * k, gw = mouthOf(k), ins = (gw - th) / 2;
      const g = ground.addGap({
        x0: x, x1: x + gw, throat: th, open: 0, repaired: false,
        crack: 0, crackPts: makeCrack(),
        bridge: 0, splashes: null, slots: [], pieces: []
      });
      // the slots sit across the THROAT, each one plug wide, not across the mouth
      for (let j = 0; j < k; j++) {
        g.slots.push({
          gapIndex: i,
          x0: x + ins + j * throatW - (j > 0 ? throatW * L1.plugLap : 0),
          x1: x + ins + (j + 1) * throatW - (j > 0 ? throatW * L1.plugLap : 0),
          // a lone slot IS its crevasse, which is the one-answer case unchanged
          full: k === 1, filled: false, reserved: false, kind: null
        });
      }
      slots.push(...g.slots);
      gaps.push(g);
      x += gw + L1.ditchGap;
    }
    return { gaps, slots };
  }

  function buildPhase() {
    G.attempts = 0; G.idle = 0;
    const p = phaseCfg();
    const seedBase = p.id * 97;

    const layout = G.phaseLayout || layoutPhase(G.worldX);
    G.phaseLayout = null;
    G.gapsThisPhase = layout.gaps;

    // options: every target plus its distractors, shuffled, all the same material
    const kinds = p.targets.concat(p.distractors).slice(0, p.options);
    for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }

    const box = optionBox(kinds.length);
    box.w = Math.min(box.w, phasePieceW(p));

    G.l1 = {
      phase: p, slots: layout.slots,
      targets: p.targets.map(kind => ({ kind, filled: false })),
      wanted: p.targets.slice(),
      unfilled: p.targets.slice(),
      wrong: 0, sealT: 0, filled: null, hintCount: 0, pulsedOnce: false,
      slotPulse: 0, slotWobble: 0,
      demo: p.tutorial ? { t: 0, done: false } : null,
      shapes: kinds.map((k, i) => {
        const rot = p.rotate ? ((i % 2 ? -1 : 1) * p.rotate * (0.6 + 0.5 * ((i * 37) % 7) / 7)) : 0;
        const seated = seatedChunk(k, box, { irregular: p.irregular, seed: seedBase + 7 * i + 3 });
        const pts = seated.pts;
        const b = polyBounds(pts);
        const x = box.startX + i * box.step;
        return {
          kind: k, x, y: -260, targetY: L1.optionY,
          baseRot: rot * Math.PI / 180, w: b.w, h: b.h, pts, art: seated.art,
          slotX: x, anchorX: x, tail: 0,
          seed: seedBase + 7 * i + 3,
          // its place in the row, which is also the order it comes down in (see updateL1)
          order: i,
          dropT: 0, cut: false, state: 'hang', rot: rot * Math.PI / 180,
          alpha: 1, scale: 1, fallT: 0, vy: 0
        };
      })
    };
    for (const gp of G.gapsThisPhase || []) { gp.reveal = 0; gp.revealTarget = 0; }
    G.l1.slots.forEach((s, i) => {
      const kind = p.targets[Math.min(i, p.targets.length - 1)];
      const sh = G.l1.shapes.find(x => x.kind === kind);
      s.kind = kind;
      if (sh) {
        const sb = polyBounds(sh.pts);
        const fit = Math.min(1, sb.h > 0 ? (CFG.H - CFG.surfaceY - 6) / sb.h : 1);
        s.notch = { pts: sh.pts, fit, dy0: PLUG_SINK - sb.y0 * fit };
      }
    });
    for (const sh of G.l1.shapes) {
      sh.pivot = chunkPivot(sh);
      sh.anchorX = sh.slotX + sh.pivot.x;
    }
  }

  function optionBox(n, centreX) {
    const safeL = CFG.mammothX + L1.clearOfPlayer;
    const safeR = CFG.W - 60 - (L1.rowInset || 0);
    const mid = centreX === undefined ? (safeL + safeR) / 2 : centreX;
    const half = Math.min(mid - safeL, safeR - mid);
    const step = (half * 2) / n;
    return {
      step, startX: mid - half + step / 2,
      w: Math.max(80, Math.round(step - L1.optionMargin)),
      h: L1.optionH
    };
  }

  function seatedChunk(kind, box, opt) {
    const w = Math.min(box.w, SHAPE_W);
    const art = PolygonFactory.art(kind);
    const raw = PolygonFactory.chunk(kind, w, box.h, opt);
    const st = PolygonFactory.seat(raw, w);

    const cs = Math.cos(st.rot), sn = Math.sin(st.rot);
    const turned = raw.map(q => ({ x: q.x * cs - q.y * sn, y: q.x * sn + q.y * cs }));
    const tb = polyBounds(turned);
    const c1 = { x: (tb.x0 + tb.x1) / 2, y: (tb.y0 + tb.y1) / 2 };

    // the uniform re-fit, computed here so the picture can use the same number
    const k = Math.min(tb.w > 0 ? w / tb.w : 1, tb.h > 0 ? box.h / tb.h : 1);
    const pts = turned.map(q => ({ x: (q.x - c1.x) * k, y: (q.y - c1.y) * k }));
    const off = { x: c1.x * k, y: c1.y * k };

    const ab = polyBounds(raw);
    return {
      pts,
      art: art ? { id: kind, rot: st.rot, scale: k, off,
                   box: { x: ab.x0, y: ab.y0, w: ab.w, h: ab.h } } : null
    };
  }

  function targetFor(kind, atX) {
    const L = G.l1; if (!L) return null;
    const i = L.wanted.indexOf(kind);
    if (i < 0) return null;
    const open = L.slots.filter(s => !s.filled && !s.reserved);
    if (!open.length) return null;
    const x = atX === undefined ? CFG.mammothX : atX;
    let best = open[0], bd = Infinity;
    for (const s of open) {
      const d = Math.abs((s.x0 + s.x1) / 2 - G.worldX - x);
      if (d < bd) { bd = d; best = s; }
    }
    const mine = open.find(s => s.kind === kind && s.notch);
    if (mine) best = mine;
    L.wanted.splice(i, 1);
    L.unfilled = L.wanted.slice();
    // mark the required-set entry this cut answers, so `targets` reads as progress
    const t = L.targets.find(q => !q.filled && q.kind === kind);
    if (t) t.filled = true;
    best.reserved = true;
    best.kind = kind;               // the slot now expects what is on its way in
    return best;
  }

  const restOnPath = sh => CFG.surfaceY - (sh.h || SHAPE_H) / 2;
  const restWedged = sh => CFG.surfaceY + (L1.throatDepth || 30) + (sh.h || SHAPE_H) / 2;

  /** Screen-space centre of a repair slot, at the height a chunk wedges. */
  function slotCenter(s, sh) {
    return { x: (s.x0 + s.x1) / 2 - G.worldX, y: restWedged(sh) };
  }
  function nearestOpenWater(x, sh) {
    const L = G.l1;
    const open = (L ? L.slots : []).filter(s => !s.filled);
    if (open.length) {
      let best = open[0], bd = 1e9;
      for (const s of open) {
        const d = Math.abs((s.x0 + s.x1) / 2 - G.worldX - x);
        if (d < bd) { bd = d; best = s; }
      }
      return slotCenter(best, sh);
    }
    const gaps = G.gapsThisPhase || [];
    if (!gaps.length) return { x, y: restWedged(sh) };
    return { x: (gaps[0].x0 + gaps[0].x1) / 2 - G.worldX, y: restWedged(sh) };
  }
  /** The crevasse a screen x is currently over, repaired or not. */
  function gapUnder(x) {
    return (G.gapsThisPhase || []).find(g => x > g.x0 - G.worldX && x < g.x1 - G.worldX) || null;
  }
  function chunkOcclusionY() { return CFG.surfaceY - SHAPE_H * 0.4; }

  function cutShape(sh, hit) {
    const L = G.l1;
    if (L.demo) L.demo.done = true;   // retire the gesture hint on a real cut, not on any tap
    sh.cut = true; sh.state = 'falling'; sh.fallT = 0; sh.vy = 0;
    L.filled = null; L.sealT = 0;
    const span = ropeSpan(sh);
    sh.pivot = sh.pivot || chunkPivot(sh);
    const hx = hit ? hit.x : span.x0, hy = hit ? hit.y : (ROPE_TOP + span.y1) / 2, ha = hit ? hit.ang : 0;
    sh.tail = clamp(span.y1 - hy, 22, Math.max(22, span.y1 - ROPE_TOP));
    (L.stubs = L.stubs || []).push({
      x: span.x0, w: sh.w || SHAPE_W, len: Math.max(16, hy - L1.rigY), t: 0
    });
    particles.frost(span.x0, span.y0 + 30, 5);
    /* the sweep-slash: on the crossing point, along the finger's direction */
    particles.slashMark(hx, hy, ha);
    if (!reduced) particles.sparkle(hx, hy, 5, 70);
    audio.slice();
    particles.frost(sh.x, sh.y - (sh.h || SHAPE_H) / 2 - 20, 4);

    // correct if this kind is still wanted; it goes into the nearest free repair slot
    const target = targetFor(sh.kind, sh.x);
    sh.correct = !!target;
    sh.target = target;
    if (!sh.correct) {
      L.wrong++; audio.reject();
      G.wrongFx = 1;
      mammoth.setState('SURPRISED');
      mammoth.scare = 0;
      shake(reduced ? 1.2 : 3, 260);
      hitStop(CFG.juice.stopHit * 0.45);
      punch(CFG.juice.punchHit * 0.5, 240, sh.x, sh.y);
      particles.chips(sh.x, sh.y, reduced ? 4 : 9, -170);
      audio.kit('doink', { volume: 0.55, vary: 0.2 });   // the comic "nope"
    }
    else {
      if (!reduced) particles.confetti(CFG.W, 64);        // a shower across the stage, as asked
      mammoth.hop = Math.max(mammoth.hop, 15);
      mammoth.squash = 1.05;
    }
    sh.from = { x: sh.x, y: sh.y };
    sh.rest = { y: restOnPath(sh), wedge: restWedged(sh) };
    sh.socket = target ? slotCenter(target, sh) : nearestOpenWater(sh.x, sh);
    const drop = Math.max(60, (sh.correct ? sh.rest.wedge : chunkOcclusionY()) - sh.y);
    sh.vx = clamp((sh.socket.x - sh.x) / Math.sqrt(2 * drop / L1_GRAV), -1400, 1400);
    // correct: fall -> wedge.  wrong: fall -> splash -> gone
    sh.phaseName = 'fall';
    if (!sh.correct) audio.slideDown();
    G.attempts++;
    if (sh.correct) setState('PHASE_SUCCESS');
    else setState('PHASE_WRONG');
  }

  const L1_GRAV = L1.dropGravity;

  function lockIn(L, sh) {
    // the tilt it was cut at, kept before the wedge squares it up
    const cutRot = sh.rot;
    sh.rot = 0;
    sh.phaseName = 'settle'; sh.impact = 1;
    audio.wedge();
    audio.fit();                        // the same chord for every right answer, in every level
    L.filled = sh; L.sealT = 0;
    particles.frost(sh.x, CFG.surfaceY, 6);
    particles.poof(sh.x, CFG.surfaceY, 6, 1.25);
    particles.chips(sh.x, CFG.surfaceY + 10, 6, -150);
    particles.sparkle(sh.x, CFG.surfaceY - 30, reduced ? 5 : 11, 210);
    audio.twinkle();
    shake(reduced ? 1 : 2.6, 180);
    hitStop(CFG.juice.stopWedge);
    punch(CFG.juice.punchWedge, CFG.juice.punchMs, sh.x, CFG.surfaceY);
    if (!reduced) particles.ring(sh.x, CFG.surfaceY - 20, 30, 210);

    const gapOf = s => s ? (G.gapsThisPhase || [])[s.gapIndex] : null;
    if (sh.target && gapOf(sh.target)) {
      const slot = sh.target;
      slot.filled = true;
      const g = gapOf(slot);
      g.revealTarget = 1;
      const sb = polyBounds(sh.pts);
      const slotSpan = (slot.x1 - slot.x0);
      const availH = CFG.H - CFG.surfaceY - 6;
      const fitWhole = Math.min(1, sb.h > 0 ? availH / sb.h : 1);
      (g.pieces = g.pieces || []).push({
        kind: sh.kind, pts: sh.pts, seed: sh.seed, art: sh.art,
        topLocal: polyBounds(sh.pts).y0,
        // the only roll: from the tilt it was cut at, back to square
        rot0: cutRot, rot: 0,
        grow: 0, fit: fitWhole,
        cx: (slot.x0 + slot.x1) / 2, cy: restWedged(sh), impact: 1,
        // its own span, so several plugs in one crevasse stay in their own lanes
        x0: slot.x0, x1: slot.x1, full: slot.full
      });
      if (g.slots.every(s => s.filled)) { g.repaired = true; g.bridge = 0; }
      L.shapes = L.shapes.filter(s => s !== sh);
      L.unfilled = L.wanted.slice();
    }

    if (L.unfilled.length) {
      G.instruction = phaseCfg().instruction;
      G.subline = phaseCfg().sub || '';
      G.instrLast = '';                 // force the card to re-enter rather than sit
      armInstruction(T.instructionRemind);
      mammoth.setState('LOOK_DOWN');
      if (L.slots.some(s => !s.filled)) L.slotPulse = 1;
    } else {
      mammoth.hopShort = true; mammoth.setState('CELEBRATE');
    }
  }

  function updateL1Piece(L, sh, dt) {
    if (sh.phaseName === 'fall') {
      sh.vy += L1_GRAV * dt;
      sh.y += sh.vy * dt;
      // a chunk on its way home turns itself square, so it wedges flat
      if (sh.correct) sh.rot = lerp(sh.rot, 0, dt * 7);

      if (!sh.correct) {
        if (!sh.splashed) {
          const reached = sh.socket && ((sh.vx > 0 && sh.x >= sh.socket.x) ||
                                        (sh.vx < 0 && sh.x <= sh.socket.x));
          if (!reached) sh.x += sh.vx * dt;
          const halfW = (sh.w || SHAPE_W) / 2;
          const floorX = CFG.mammothX + 300 + halfW;
          if (sh.x < floorX) { sh.x = floorX; sh.vx = 0; }
        }
        const mouthY = CFG.surfaceY - (sh.h || SHAPE_H) * 0.16;
        if (!sh.teetered && !sh.splashed && gapUnder(sh.x) && sh.y >= mouthY) {
          sh.teetered = true; sh.teeterT = 0; sh.teeterRot = sh.rot;
          audio.clunk();
          particles.chips(sh.x, CFG.surfaceY, reduced ? 3 : 7, -140);
          shake(reduced ? 0.5 : 1.6, 170);
        }
        if (sh.teetered && !sh.splashed) {
          sh.teeterT += dt;
          const T_ = (L1.teeterMs || 420) / 1000;
          if (sh.teeterT < T_) {
            const t = sh.teeterT / T_;
            sh.y = mouthY + t * t * 30;            // barely sinking, then it goes
            sh.vy = 0;
            sh.rot = sh.teeterRot + Math.sin(t * 30) * 0.19 * (1 - t);
            if (!sh.gaveWay && t > 0.7) {
              sh.gaveWay = true;
              mammoth.startle(reduced ? 0.5 : 1);
              audio.crack();
            }
            return;
          }
        }
        sh.rot += dt * 1.9;
        sh.scale = lerp(sh.scale, 0.62, dt * 1.6);
        const g = gapUnder(sh.x);
        const wy = g ? ground.waterY(sh.x, G.t) : CFG.H + 200;
        if (!sh.splashed && sh.y >= wy) {
          sh.splashed = true;
          if (g) ground.addSplash(g, sh.x, G.t);
          particles.splash(sh.x, wy - 4, reduced ? 12 : 26);
          audio.splash();
          hitStop(CFG.juice.stopSplash);
          shake(reduced ? 0.9 : 2.6, 240);
          mammoth.jolt(reduced ? 0.4 : 0.85);   // and recoils off the lip
          sh.sinkFrom = sh.y;
        }
        if (sh.splashed) {
          // under the surface it darkens and fades rather than dropping forever
          sh.sinkT = (sh.sinkT || 0) + dt;
          sh.y = sh.sinkFrom + sh.sinkT * 150;
          sh.submerged = clamp(sh.sinkT / 0.5, 0, 1);
          sh.alpha = clamp(1 - sh.sinkT / 0.72, 0, 1);
          if (sh.sinkT > 0.8) sh.phaseName = 'gone';
        }
        return;
      }

      if (Math.abs(sh.x - sh.socket.x) > (sh.w || SHAPE_W) * 0.35) sh.x += sh.vx * dt;
      else { sh.vx = 0; sh.x = lerp(sh.x, sh.socket.x, clamp(dt * 7, 0, 1)); }

      if (!sh.entered && sh.y >= sh.rest.y - 30) {
        sh.entered = true;
        particles.frost(sh.x, CFG.surfaceY - 10, 5);
      }
      if (sh.y >= sh.rest.wedge) { sh.y = sh.rest.wedge; sh.impact = 1; lockIn(L, sh); }
    }
    if (sh.impact) sh.impact = Math.max(0, sh.impact - dt * 4);
  }
  function updateL1(dt) {
    const L = G.l1; if (!L) return;
    L.guideY = rowGuideY();
    for (const sh of L.shapes) {
      if (sh.state === 'hang') {
        // held above the screen until the instruction has had the stage to itself
        if (!G.dropReady) continue;
        sh.dropT += dt;
        // one after another, left to right: the row arrives as three moments, not one
        const delay = 0.06 + (sh.order || 0) * (T.dropStagger / 1000);
        const dp = clamp((sh.dropT - delay) / (T.shapeDrop / 1000), 0, 1);
        sh.y = lerp(-220, sh.targetY, easeBackOut(dp));
        if (!sh.arrived && dp >= 1) { sh.arrived = true; audio.pop(); }
        if (sh.jiggle) sh.jiggle = 0;
        // the tap's flare on the halo, gone in under half a second
        if (sh.flash) sh.flash = Math.max(0, sh.flash - dt * 2.2);
        const swing = lerp(reduced ? 0.012 : 0.05, reduced ? 0.003 : 0.007,
                           clamp((sh.dropT - 0.6) / 2.6, 0, 1));
        const piv = sh.pivot || chunkPivot(sh);
        const a = rigSwing();
        const len = (sh.y + piv.y) - ROPE_TOP;
        sh.rot = sh.baseRot + a;
        // -sin: the canvas matrix takes (0, len) to (-len·sin a, len·cos a) — see ropeSpan
        sh.x = sh.anchorX - Math.sin(a) * len - (piv.x * Math.cos(a) - piv.y * Math.sin(a));
        sh.guide = cutGuide(sh);
      } else if (sh.state === 'falling') {
        sh.fallT += dt;
        updateL1Piece(L, sh, dt);
      }
    }
    if (L.demo && !L.demo.done && G.state === 'PHASE_ACTIVE' && G.attempts === 0) {
      L.demo.t += dt;
      if (L.demo.t > 1.9) L.demo.done = true;
    }
    if (L.stubs) {
      for (const st of L.stubs) st.t += dt;
      L.stubs = L.stubs.filter(st => st.t < 30);   // a cut rope stays cut
    }
    L.slotWobble = lerp(L.slotWobble, 0, dt * 5);
    L.slotPulse = Math.max(0, L.slotPulse - dt * 1.1);
    if (L.filled) L.sealT = Math.min(1, L.sealT + dt * 1.6);

    const step = dt * 1000 / L1.bridgeMs;
    for (const g of (G.gapsThisPhase || [])) {
      if (g.repaired && g.bridge < 1) {
        g.bridge = Math.min(1, g.bridge + step);
        if (g.bridge >= 1 && !g.bridgeDone) {
          g.bridgeDone = true; audio.seal();
          const cx = (g.x0 + g.x1) / 2 - G.worldX;
          if (!reduced) particles.confetti(CFG.W, 40);   // confetti, not star glints
          punch(CFG.juice.punchWin, 380, clamp(cx, 200, CFG.W - 200), CFG.surfaceY - 40);
          audio.prize();
        }
      }
    }
  }

  const PLUG_SINK = -9;

  const PIECE_GROW = 3.3, PIECE_IMPACT = 2.7;
  const PIECE_FREEZE = 1.15;
  function updateWrongFx(dt) { if (G.wrongFx > 0) G.wrongFx = Math.max(0, G.wrongFx - dt * 1.1); }

  function updatePieces(dt) {
    for (const g of ground.gaps) {
      if (!(g.pieces && g.pieces.length)) continue;
      for (const p of g.pieces) {
        if (p.grow === undefined) p.grow = 0;
        if (p.grow < 1) p.grow = clamp(p.grow + dt * PIECE_GROW, 0, 1);
        if (p.impact) p.impact = Math.max(0, p.impact - dt * PIECE_IMPACT);
        if (p.frz === undefined) p.frz = 0;
        if (p.frz < 1) {
          p.frz = clamp(p.frz + dt * PIECE_FREEZE, 0, 1);
          if (p.frz >= 0.66 && !p.frzPop) {
            p.frzPop = true;
            if (!reduced) {
              particles.sparkle(p.cx - G.worldX, CFG.surfaceY - 8, 7, 120);
              particles.frost(p.cx - G.worldX, CFG.surfaceY - 4, 5);
            }
          }
        }
      }
    }
  }

  function viewFocus(k) {
    const M = 8;                                  // px of slack at each edge
    const rightMost = CFG.levelOne.rowRight || (CFG.W - 60);          // the option row's glow reaches here
    const leftMost = CFG.mammothX - (CFG.levelOne.charBack || 120);   // his back stays in shot, at the edge
    const bottomMost = CFG.surfaceY + 120;
    const topMost = CFG.levelOne.skyTop || 60;
    const fx = {
      min: (CFG.W - M - rightMost * k) / (1 - k),
      max: (M - leftMost * k) / (1 - k)
    };
    const fy = {
      min: (CFG.H - M - bottomMost * k) / (1 - k),
      max: (M - topMost * k) / (1 - k)
    };
    return { fx, fy };
  }

  /** Aim the view at the crossing, as far as the frame allows. */
  function aimZoom() {
    const gaps = (G.gapsThisPhase || []).filter(Boolean);
    if (!gaps.length) { G.zoomWant = 1; return; }
    const k = CFG.levelOne.zoomK;
    const cx = (gaps[0].x0 + gaps[gaps.length - 1].x1) / 2 - G.worldX;
    const { fx, fy } = viewFocus(k);
    G.zoomVX = clamp(cx, Math.min(fx.min, fx.max), Math.max(fx.min, fx.max));
    const mid = (CFG.levelOne.optionY + CFG.surfaceY) / 2;
    G.zoomVY = clamp(mid, Math.min(fy.min, fy.max), Math.max(fy.min, fy.max));
    G.zoomWant = k;
  }

  /* ---- shake: amplitude decays over its life instead of cutting off flat ---- */
  function shake(amp, ms) {
    if (reduced) amp *= 0.4;
    G.shake = amp; G.shakeAmp = amp; G.shakeT = ms / 1000; G.shakeLen = ms / 1000;
  }

  function hitStop(ms) {
    if (reduced) return;                                  // motion sensitivity: no holds
    G.freeze = Math.min(CFG.juice.stopMax / 1000, Math.max(G.freeze || 0, ms / 1000));
  }

  function punch(amp, ms, x, y) {
    if (reduced) return;
    G.punchAmp = amp; G.punchT = 0;
    G.punchLen = (ms || CFG.juice.punchMs) / 1000;
    G.punchX = x === undefined ? CFG.W / 2 : x;
    G.punchY = y === undefined ? CFG.surfaceY : y;
  }

  function quake(amp, ms, peakMs) {
    if (reduced) amp *= 0.35;
    G.quakeAmp = amp;
    G.quakeT = 0;
    G.quakeLen = ms / 1000;
    G.quakePeak = (peakMs === undefined ? ms * 0.3 : peakMs) / 1000;
  }

  /** 0..1 envelope: builds to the break, then rattles out. */
  function quakeEnv() {
    if (G.quakeLen <= 0 || G.quakeT >= G.quakeLen) return 0;
    const t = G.quakeT, p = Math.max(0.001, G.quakePeak);
    if (t < p) return 0.22 + 0.78 * Math.pow(t / p, 1.7);      // the ground starts to go
    const tail = Math.max(0.001, G.quakeLen - p);
    return Math.max(0, 1 - Math.pow((t - p) / tail, 0.85));    // aftershock
  }

  function drawDazeStars(ctx) {
    if (!mammoth.koStars || mammoth.state !== 'KNOCKOUT') return;
    const t = mammoth.t;
    const u = clamp((t - 0.55) * 2.6, 0, 1);            // from the tumble, so they are seen at once
    if (u <= 0.01) return;
    const pop = 1 + Math.sin(u * Math.PI) * 0.5;
    const cx = CFG.mammothX - (mammoth.knock || 0) - 60;
    const cy = CFG.surfaceY - 345 + Math.sin(t * 2.2) * 4;   // the loop hovers over his crown, clear of his eyes
    const RX = 112, RY = 30, STARS = 5, spin = t * 3.8;
    ctx.save();
    ctx.globalAlpha = u;
    // the loop itself, dashed and running, tilted a touch like a halo knocked askew
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-0.12);
    ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 140;
    ctx.shadowColor = 'rgba(255,204,84,1)'; ctx.shadowBlur = 22;
    ctx.lineCap = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,236,160,0.98)';
    ctx.beginPath(); ctx.ellipse(0, 0, RX, RY, 0, 0, 6.2832); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    ctx.restore();
    for (let i = 0; i < STARS; i++) {
      const a = spin + (i / STARS) * 6.2832;
      const x = cx + Math.cos(a) * RX, y = cy + Math.sin(a) * RY;
      const depth = (Math.sin(a) + 1) / 2;                 // 1 at the front of the loop
      const sc = (0.8 + 0.6 * depth) * pop;
      ctx.save();
      ctx.translate(x, y); ctx.scale(sc, sc); ctx.rotate(t * 2.6 + i);   // each star spins on its own
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const o = (k / 5) * 6.2832 - Math.PI / 2, i2 = o + 6.2832 / 10;
        ctx.lineTo(Math.cos(o) * 32, Math.sin(o) * 32);
        ctx.lineTo(Math.cos(i2) * 14, Math.sin(i2) * 14);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -32, 0, 32);
      g.addColorStop(0, '#FFF6C4'); g.addColorStop(1, '#F7B733');
      ctx.shadowColor = 'rgba(255,190,50,1)'; ctx.shadowBlur = 38; ctx.fillStyle = g; ctx.fill();
      ctx.shadowBlur = 9; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  /* ---- impact burst drawn at the point of collision ---- */
  function drawHitFx(ctx) {
    if (G.hitFx <= 0) return;
    const p = 1 - G.hitFx;                       // 0 at impact -> 1 at the end
    const x = CFG.mammothX + 74, y = CFG.surfaceY - 96;
    ctx.save();
    // radiating ice sparks
    const n = reduced ? 5 : 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832 + 0.4;
      const d = 26 + easeOut(p) * 76;
      const len = 20 * (1 - p);
      ctx.globalAlpha = clamp(1 - p * 1.15, 0, 1) * 0.9;
      ctx.strokeStyle = i % 2 ? C.frost : C.lightIce;
      ctx.lineWidth = 4 * (1 - p * 0.6);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.72);
      ctx.lineTo(x + Math.cos(a) * (d + len), y + Math.sin(a) * (d + len) * 0.72);
      ctx.stroke();
    }
    // one soft warm flash at the contact point — no strobe, single fade
    ctx.globalAlpha = clamp(1 - p * 1.6, 0, 1) * 0.5;
    const fg = ctx.createRadialGradient(x, y, 0, x, y, 130);
    fg.addColorStop(0, 'rgba(255,236,190,0.95)');
    fg.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(x, y, 130, 0, 6.2832); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* ---- input ---- */
  let canvasRect = null;
  const invalidateRect = () => { canvasRect = null; };
  window.addEventListener('resize', invalidateRect);
  window.addEventListener('orientationchange', invalidateRect);
  function rect() {
    if (!canvasRect || !canvasRect.width) canvasRect = canvas.getBoundingClientRect();
    return canvasRect;
  }
  function toLocal(e) {
    const r = rect();
    const sx = (e.clientX - r.left) * CFG.W / r.width, sy = (e.clientY - r.top) * CFG.H / r.height;
    const k = G.zoom || 1;
    if (k <= 1.0005) return { x: sx, y: sy };
    return { x: G.zoomVX + (sx - G.zoomVX) / k, y: G.zoomVY + (sy - G.zoomVY) / k };
  }
  let slash = null;

  function onMammoth(p) {
    return p.x > CFG.mammothX - 250 && p.x < CFG.mammothX + 250 &&
           p.y > CFG.surfaceY - 430 && p.y < CFG.surfaceY + 30;
  }

  let pokeAt = -1e9;
  function pokeMammoth() {
    if (performance.now() - pokeAt < 420) return false;      // no machine-gunning it
    if (mammoth.airborne || mammoth.state === 'KNOCKOUT' || G.complete) return false;
    pokeAt = performance.now();
    audio.toot();
    // a hop, a squash on the way down, and a puff off the snow
    mammoth.hop = Math.max(mammoth.hop, 16);
    mammoth.squash = 0.9;
    mammoth.jolt(0.34);
    particles.poof(CFG.mammothX - 10, CFG.surfaceY, reduced ? 2 : 5, 1.3);
    particles.sparkle(CFG.mammothX + 30, CFG.surfaceY - 300, reduced ? 2 : 5, 120);
    return true;
  }

  function skipPreRoll() {
    if (G.dialogue) return false;
    if (G.state === 'GLACIER_BREAK_1' && G.st < T.breakSkid - 1) {
      G.st = T.breakSkid - 1;         // one step short, so the final frame still runs
      return true;
    }
    if (G.state === 'PHASE_INTRO' && !G.dropReady && G.introT < T.gapBeat) {
      G.introT = T.gapBeat;                   // straight to the ice coming down
      return true;
    }
    if (G.state === 'LEVEL_2_OVERVIEW' && G.st < (L2.overviewMs || 1350) - 1) {
      G.st = (L2.overviewMs || 1350) - 1;
      return true;
    }
    return false;
  }

  function onDown(e) {
    if (paused) { if (pausedAsking && G.jumpEnabled && RUN_STATES.has(G.state)) G.jumpArmed = true; return; }   // see api.setPaused
    audio.start(); audio.resume();
    const p = toLocal(e);
    G.idle = 0; G.idleHand = 0; G.handHint = null;
    addTap(p.x, p.y);                 // every touch gets an answer, in every state
    skipPreRoll();                    // a tap gets past the collapse and the card
    if (G.jumpEnabled && RUN_STATES.has(G.state)) {
      mammoth.requestJump(performance.now());
      if (hooks.onJumpInput) hooks.onJumpInput('tap');
      capturePointer(e);
      return;
    }
    if (G.state === 'PHASE_ACTIVE' || G.state === 'PHASE_SUCCESS' || G.state === 'PHASE_WRONG') {
      slash = { pts: [p], t: 0, dist: 0, id: e.pointerId };
    }
    if (G.l2 && !G.l2.fall && !(G.l2.respawn > 0) &&
        ['LEVEL_2_ACTIVE', 'LEVEL_2_WRONG_FEEDBACK'].includes(G.state)) {
      const L = G.l2;
      // a finger on the stage is a learner reaching for it: show them the corners
      L.wantReveal = true;
      const vi = nearestVertex(p.x, p.y);
      L.dragFrom = vi;
      L.dragStart = vi >= 0 ? hexScreenPts()[vi] : { x: p.x, y: p.y };
      L.dragPt = { x: p.x, y: p.y };
      L.dragId = e.pointerId;
      if (vi >= 0) { L.cornerPulse = Math.max(L.cornerPulse, 0.6); audio.whiff(); }
      capturePointer(e);
      return;
    }
    if (onMammoth(p)) pokeMammoth();
    capturePointer(e);
  }
  const CUT_MIN_TRAVEL = 36;

  function onMove(e) {
    if (paused) return;
    const p = toLocal(e);
    atmos.pointer(p.x);
    if (G.l2 && G.l2.dragPt) {
      if (G.l2.dragId !== undefined && e.pointerId !== undefined && e.pointerId !== G.l2.dragId) return;
      G.l2.dragPt = { x: p.x, y: p.y };
      return;
    }
    // only the finger that began the stroke may extend it; see the note on slash.id
    if (slash && slash.id !== undefined && e.pointerId !== undefined &&
        e.pointerId !== slash.id) return;
    if (slash) {
      const prev = slash.pts[slash.pts.length - 1];
      if (prev) slash.dist += Math.hypot(p.x - prev.x, p.y - prev.y);
      slash.pts.push(p);
      if (slash.pts.length > 26) slash.pts.shift();
      // hit test ropes — but only while the phase is actually playable
      const L = G.l1;
      if (L && G.state === 'PHASE_ACTIVE' && slash.pts.length > 1) {
        const a = slash.pts[slash.pts.length - 2], b = p;
        for (const sh of L.shapes) {
          if (sh.state !== 'hang') continue;
          const s2 = ropeSpan(sh);
          const top = { x: s2.x0, y: ROPE_TOP };
          const bot = { x: s2.x1, y: s2.y1 };
          const crossed = segIntersect(a, b, top, bot);
          const grazed = slash.dist >= CUT_MIN_TRAVEL && nearSeg(p, top, bot, 30);
          if (crossed || grazed) {
            // where and which way the finger crossed: the slash mark is drawn there
            const hit = { x: s2.x0 + (s2.x1 - s2.x0) * clamp((p.y - ROPE_TOP) / Math.max(1, s2.y1 - ROPE_TOP), 0, 1),
                          y: clamp(p.y, ROPE_TOP + 20, s2.y1), ang: Math.atan2(b.y - a.y, b.x - a.x) };
            slash = null; cutShape(sh, hit); return;
          }
        }
      }
    }
  }
  function nearSeg(p, a, b, tol) {
    const vx = b.x - a.x, vy = b.y - a.y;
    const l2 = vx * vx + vy * vy || 1;
    let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2;
    t = clamp(t, 0, 1);
    return Math.hypot(a.x + vx * t - p.x, a.y + vy * t - p.y) < tol;
  }
  function missedSwipe() {
    const L = G.l1;
    if (!L || !slash || slash.dist < 46 || slash.pts.length < 2) return;
    const CM = CFG.comedy;
    let any = false;
    for (const sh of L.shapes) {
      if (sh.state !== 'hang') continue;
      const s2 = ropeSpan(sh);
      // the same full span the cut test uses, so "near a rope" means the same thing
      const a = { x: s2.x0, y: ROPE_TOP }, b = { x: s2.x1, y: s2.y1 };
      // the closest the stroke came to this rope
      let d = Infinity;
      for (const q of slash.pts) {
        const vx = b.x - a.x, vy = b.y - a.y;
        const l2 = vx * vx + vy * vy || 1;
        const t = clamp(((q.x - a.x) * vx + (q.y - a.y) * vy) / l2, 0, 1);
        d = Math.min(d, Math.hypot(a.x + vx * t - q.x, a.y + vy * t - q.y));
      }
      if (d < CM.jiggleRadius) {
        sh.jiggle = Math.max(sh.jiggle || 0, 0.5 + (1 - d / CM.jiggleRadius) * 0.4);
        // it swings away from the stroke, so neighbours part rather than moving as one
        sh.jiggleDir = sh.anchorX < slash.pts[slash.pts.length - 1].x ? -1 : 1;
        any = true;
      }
    }
    if (any) audio.whiff();
  }

  function onUp(e) {
    if (paused) { slash = null; if (G.l2) G.l2.dragPt = null; return; }
    if (G.l2 && G.l2.dragPt) {
      const L = G.l2;
      if (L.dragId !== undefined && e && e.pointerId !== undefined && e.pointerId !== L.dragId) return;
      const end = { x: L.dragPt.x, y: L.dragPt.y };
      const from = L.dragFrom;
      const to = nearestVertex(end.x, end.y);
      const moved = Math.hypot(end.x - L.dragStart.x, end.y - L.dragStart.y) > 24;
      L.dragPt = null; L.dragId = undefined;
      // a press with no travel is someone touching a corner to see what it does
      if (!moved) { L.cornerPulse = 0.8; return; }
      if (G.state !== 'LEVEL_2_ACTIVE') return;    // armed early, committed only when live
      attemptCut(from, to, end);
      return;
    }
    if (slash && slash.id !== undefined && e && e.pointerId !== undefined &&
        e.pointerId !== slash.id) return;      // a different finger lifting
    if (slash) {
      if (slash.dist < 46) tappedBlock(slash.pts[slash.pts.length - 1]); else missedSwipe();
      slash = null;
    }
  }

  function tappedBlock(p) {
    const L = G.l1;
    if (!L || !p || G.state !== 'PHASE_ACTIVE') return;
    for (const sh of L.shapes) {
      if (sh.state !== 'hang') continue;
      const w = sh.w || 240, h = sh.h || SHAPE_H;
      if (Math.abs(p.x - sh.x) < w / 2 + 24 && Math.abs(p.y - sh.y) < h / 2 + 24) {
        sh.flash = 1;
        G.idleHand = Math.max(G.idleHand, CFG.hint.idleMs / 1000 + 0.01);
        audio.whiff();
        return;
      }
    }
  }

  function onCancel() { slash = null; if (G.l2) { G.l2.dragPt = null; G.l2.dragId = undefined; } }

  function onKey(e) {
    if (paused) return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      const el = document.activeElement;
      const onButton = el && el !== document.body &&
                       (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button');
      if (e.code === 'Space' && onButton) return;
      e.preventDefault();
      // the same keys that jump also get past the collapse and the card
      if (skipPreRoll()) return;
      api.jump();
    }
  }
  function capturePointer(e) { try { if (canvas.setPointerCapture && e && e.pointerId !== undefined) canvas.setPointerCapture(e.pointerId); } catch (err) { /* nothing to capture */ } }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('lostpointercapture', onCancel);
  window.addEventListener('keydown', onKey);

  /* ---- hints ---- */
  function updateHints(dt) {
    if (G.dialogue) { G.idle = 0; G.idleHand = 0; G.handHint = null; return; }
    if (G.state === 'PHASE_ACTIVE') {
      G.idle += dt;
      const L = G.l1; if (!L) return;
      // one pulse of the notch itself, so a stuck learner looks at the hole
      G.idleHand += dt;
      if ((L.wrong >= 1 || G.idle > CFG.hint.slotMs / 1000) && L.slotPulse <= 0 && !L.pulsedOnce) {
        L.pulsedOnce = true; L.slotPulse = 1; G.idle = 0;
      }
      if (G.idleHand > CFG.hint.idleMs / 1000 && L.shapes.length) {
        const mid = L.shapes.find(s => s.state === 'hang' && L.unfilled && L.unfilled.includes(s.kind))
                 || L.shapes[Math.floor(L.shapes.length / 2)];
        const gd = mid.guide || cutGuide(mid);
        G.handHint = gd ? { x: gd.x, y: gd.y } : null;
      } else {
        G.handHint = null;
      }
    }
  }

  /* ---- update ---- */
  function update(dt) {
    if (G.freeze > 0) { G.freeze -= dt; return; }
    G.t += dt; G.st += dt * 1000;
    {
      const L1z = CFG.levelOne;
      if (G.zoomWant !== G.zoomTo) {
        G.zoomTo = G.zoomWant;
        G.zoomFrom = G.zoom;
        G.zoomP = 0;
        G.zoomMs = Math.max(1, G.zoomMsWant || (G.zoomWant > G.zoom ? L1z.zoomInMs : L1z.zoomOutMs));
        G.zoomMsWant = 0;
      }
      if (G.zoom !== G.zoomWant) {
        G.zoomP = clamp((G.zoomP || 0) + dt * 1000 / G.zoomMs, 0, 1);
        G.zoom = G.zoomFrom + (G.zoomWant - G.zoomFrom) * easeInOut(G.zoomP);
        if (G.zoomP >= 1) G.zoom = G.zoomWant;
      }
    }
    if (G.punchLen > 0) {
      G.punchT += dt;
      if (G.punchT >= G.punchLen) { G.punchLen = 0; G.punchAt = 0; }
      // snaps to full on the impact frame, then eases out
      else G.punchAt = G.punchAmp * Math.pow(1 - G.punchT / G.punchLen, 2.2);
    }
    if (G.shakeT > 0) {
      G.shakeT -= dt;
      // ease the amplitude down instead of holding full strength then cutting to zero
      G.shake = G.shakeT <= 0 ? 0 : G.shakeAmp * Math.pow(clamp(G.shakeT / G.shakeLen, 0, 1), 1.6);
    }
    if (G.quakeLen > 0 && G.quakeT < G.quakeLen) {
      G.quakeT += dt;
      G.quakeAt = G.quakeAmp * quakeEnv();
      G.quakeRoll = (G.quakeRoll || 0) + dt;
      if (G.quakeRoll > 0.09 && G.quakeAt > 1) {
        G.quakeRoll = 0;
        particles.chips(rand(60, CFG.W - 60), CFG.surfaceY - 4, 1, -120 - G.quakeAt * 14);
        particles.poof(CFG.mammothX - 34, CFG.surfaceY, 1, 0.42);   // a little puff behind each footfall
      }
    } else {
      G.quakeAt = 0;
    }
    if (G.hitFx > 0) G.hitFx = Math.max(0, G.hitFx - dt * 1.5);
    if (RUN_STATES.has(G.state) && G.speedFactor !== 1) G.speedFactor = 1;

    if (G.moving) {
      const v = CFG.runSpeed * G.speedFactor;
      G.worldX += v * dt; G.dist += v * dt;
    }
    const band = JOURNEY[G.state];
    if (band) {
      const u = clamp(G.st / band[2], 0, 1);
      G.progress = Math.max(G.progress, lerp(band[0], band[1], easeInOut(u)));
    }
    if (G.phasesDone > 0 && G.phasesDone <= L1.phases.length) {
      G.progress = Math.max(G.progress, lerp(0.12, L1_SKY_END, G.phasesDone / L1.phases.length));
    }
    if (G.l2) updateL2(dt);
    bgm.update(dt, G.progress);
    atmos.update(dt, G.progress);
    mammoth.update(dt, performance.now(), G.moving && G.speedFactor > 0.2, G.speedFactor);
    if (mammoth.state === 'LAND') {
      if (!G.trampled) {
        G.trampled = true;
        shake(reduced ? 1 : 2.4, 150);
        hitStop(CFG.juice.stopLand);
        punch(CFG.juice.punchLand, 220, CFG.mammothX, CFG.surfaceY);
        audio.trample();
      }
    } else G.trampled = false;
    if (mammoth.state === 'SHAKE' && mammoth.trembleFired) {
      const TP = CFG.sprite.tremble, st = mammoth.trembleStep;
      if (!G.trembleDust) { G.trembleDust = true; G.trembleBeat = -1; if (!reduced) particles.poof(CFG.mammothX + 24, CFG.surfaceY, 3, 0.6); }
      if (TP && TP.strong && st >= TP.strong[0] && st <= TP.strong[1] && st !== G.trembleBeat) {
        G.trembleBeat = st;
        if (!reduced) particles.poof(CFG.mammothX + (st % 2 ? 62 : -34), CFG.surfaceY, 1, 0.42);
        // and snow shakes off his back: he is trembling hard enough to shed it
        if (!reduced) particles.snowPuff(CFG.mammothX - 30 + (st % 3) * 30, CFG.surfaceY - 330, 3, 1.3);
        if (st === TP.strong[0] + 4) audio.knees();
      }
    } else G.trembleDust = false;
    particles.update(dt);
    if (G.invincibleT > 0) G.invincibleT = Math.max(0, G.invincibleT - dt);
    if (G.jumpArmed) {
      if (!RUN_STATES.has(G.state) || !G.jumpEnabled) G.jumpArmed = false;
      else {
        let near = null;
        for (const o of obstacles.list) { const sx = o.x - G.worldX; if (!o.passed && (near === null || sx < near)) near = sx; }
        if (near !== null && near < 700) { G.jumpArmed = false; mammoth.requestJump(performance.now()); if (hooks.onJumpInput) hooks.onJumpInput('armed'); }
      }
    }
    obstacles.update(dt, G.worldX, mammoth, onCrystalHit, G.moving && G.invincibleT <= 0);
    updateInstruction(dt);
    updateTaps(dt);
    updateHints(dt);
    for (const gp of G.gapsThisPhase || []) {
      if (gp.revealTarget && (gp.reveal || 0) < 1) gp.reveal = Math.min(1, (gp.reveal || 0) + dt / 0.45);
    }
    if (G.l1) updateL1(dt);
    updatePieces(dt);
    updateWrongFx(dt);
    if (ground.gaps.length > 1) {
      const cutoff = G.worldX - 600;
      ground.gaps = ground.gaps.filter(gp => gp.x1 > cutoff || (G.gapsThisPhase || []).includes(gp));
    }

    switch (G.state) {
      case 'AVALANCHE': {
        const roar = T.avalancheRoar, sweep = T.avalancheSweep, settle = T.avalancheSettle;
        const total = roar + sweep + settle;
        G.avT = clamp(G.st / total, 0, 1);
        {
          const inK = easeOut(clamp(G.st / (roar + sweep * 0.5), 0, 1));
          const outK = easeInOut(clamp((G.st - (roar + sweep)) / settle, 0, 1));
          G.avLead = 300 * inK * (1 - outK);
          if (mammoth) mammoth.dx = G.avLead;
        }
        const q = clamp((G.st - roar) / sweep, 0, 1);
        if (!reduced && q > 0 && q < 1 && G.st - (G.avPuff || 0) > 55) {
          G.avPuff = G.st;
          const fx = rand(-60, 520) + q * 300;
          particles.poof(fx, CFG.surfaceY - rand(0, 90), 2, 1.7);
          particles.chips(fx, CFG.surfaceY - rand(10, 60), 1, -rand(140, 320));
        }
        if (G.st < roar + sweep && G.st - (G.avGap || 0) > 620) {
          G.avGap = G.st;
          const back = G.worldX + CFG.mammothX - 300;
          const w = 190 + rand(0, 120);
          ground.addGap({
            x0: back, x1: back + w, throat: Math.round(w / (L1.mouth || 1.6)),
            open: 0, repaired: false, crack: 0, crackPts: makeCrack(),
            bridge: 0, splashes: null, slots: [], pieces: [], avalanche: true, born: G.st
          });
          audio.crack();
        }
        for (const g of ground.gaps) {
          if (!g.avalanche) continue;
          const age = G.st - (g.born || 0);
          g.crack = clamp(age / 260, 0, 1);
          g.open = clamp((age - 180) / 320, 0, 1);
        }
        if (G.st > roar && !G.avRoared) {
          G.avRoared = true;
          audio.crack();
          audio.kit('swoosh', { volume: 0.9, vary: 0.1 });
          shake(reduced ? 2 : 6, 400);
        }
        if (G.st > roar * 0.55 && !G.avSquealed) {
          G.avSquealed = true;
          // he has just worked out what that noise was
          audio.kit('squeak', { volume: 0.85, vary: 0.15 });
          mammoth.jolt(reduced ? 0.3 : 0.65);
        }
        if (G.st > roar + sweep * 0.45 && !G.avCracked) {
          G.avCracked = true;
          audio.crack();
          audio.kit('boing', { volume: 0.5, vary: 0.2 });   // the cartoon punctuation
        }
        if (G.st > total) setState('RUN_SEGMENT_1');
        break;
      }
      case 'RUN_SEGMENT_1': if (G.st > T.run1) setState('JUMP_CHALLENGE_1'); break;
      case 'JUMP_CHALLENGE_1':
        if (obstacles.list.length && obstacles.list.every(o => o.passed)) setState('POST_JUMP_RUN_1');
        break;
      case 'POST_JUMP_RUN_1':
        if (G.st > T.postJump1) setState(L2_ON ? 'GLACIER_BREAK_2' : 'GLACIER_BREAK_1');
        break;
      case 'OBSTACLE_HIT':
        if (G.st > T.recover) retryObstacle();
        break;
      case 'GLACIER_BREAK_1': updateBreak(dt); break;

      /* ---- LEVEL 2 ---- */
      case 'RUN_SEGMENT_2': if (G.st > T.run2) setState('JUMP_CHALLENGE_2'); break;
      case 'JUMP_CHALLENGE_2':
        if (obstacles.list.length && obstacles.list.every(o => o.passed)) setState('POST_JUMP_RUN_2');
        break;
      case 'POST_JUMP_RUN_2': if (G.st > T.postJump2) setState('GLACIER_BREAK_2'); break;
      case 'GLACIER_BREAK_2': updateBreak(dt); break;
      case 'LEVEL_2_INTRO':
        if (mammoth.state === 'SHAKE') break;
        if (G.st > T.levelIntro) setState('LEVEL_2_OVERVIEW');
        break;
      case 'LEVEL_2_OVERVIEW':
        if (G.st > (L2.overviewMs || 1350)) setState('LEVEL_2_FOCUS');
        break;
      case 'LEVEL_2_FOCUS': if (G.st > (p2Cfg().focusMs || T.focus)) setState('LEVEL_2_ACTIVE'); break;
      case 'LEVEL_2_ACTIVE': break;
      case 'LEVEL_2_WRONG_FEEDBACK': {
        const L = G.l2;
        const busy = !!(L && (L.fall || L.respawn > 0));
        if (!busy && G.st > (L2.wrongMs || 700)) { G.signSay = ''; setState('LEVEL_2_ACTIVE'); }
        break;
      }
      case 'LEVEL_2_SUCCESS': updateL2Success(dt); break;
      case 'BRIDGE_2_COMPLETE':
        if (G.st > T.celebrate) {
          G.l2 = null; G.gapsThisPhase = null; G.gapA = null; G.gapB = null;
          G.p2i = (G.p2i || 0) + 1;
          G.phasesDone = Math.max(G.phasesDone, G.p2i);
          if (G.p2i < p2Count()) {
            // another Part 2 crossing: run to it exactly as the journey runs to any other
            G.moving = true; G.jumpEnabled = true; G.speedFactor = 1;
            mammoth.setState('RUN');
            setState('RUN_SEGMENT_2');
          } else {
            G.phase = 0;
            setState(L1.phases.length ? 'PHASE_RUN' : 'FINAL_RUN');
          }
        }
        break;
      case 'PHASE_INTRO':
        if (mammoth.state !== 'SHAKE') G.introT += dt * 1000;
        if (!G.dropReady && G.introT > T.gapBeat) {
          G.stageBeat = 1;
          G.dropReady = true;
          audio.pop();
        }

        const nOpt = (G.l1 && G.l1.shapes && G.l1.shapes.length) || 3;
        const allDown = T.gapBeat + T.shapeDrop + (nOpt - 1) * T.dropStagger;
        if (G.stageBeat < 2 && G.introT > allDown) {
          G.stageBeat = 2;
          G.instrHold = 0;
        }
        // and the phase is playable a beat after the question is up
        if (G.stageBeat >= 2 && G.introT > allDown + T.signBeat) setState('PHASE_ACTIVE');
        break;

      case 'PHASE_WRONG': {
        if (!G.l1) { setState('PHASE_RUN'); break; }
        const gone = !G.l1.shapes.some(s => s.state === 'falling' && !s.correct && s.alpha > 0.02);
        if (gone || G.st > 2200) {
          G.l1.shapes = G.l1.shapes.filter(s => !(s.state === 'falling' && !s.correct));
          mammoth.setState('LOOK_DOWN');
          // the instruction comes back so the learner is reminded what they are after
          G.instruction = phaseCfg().instruction;
          G.subline = phaseCfg().sub || '';
          G.instrLast = '';             // re-enter, so the chips re-pop with what is left
          armInstruction(T.instructionRemind);
          setState('PHASE_ACTIVE');
        }
        break;
      }

      case 'PHASE_SUCCESS': {
        if (!G.l1) { setState('PHASE_RUN'); break; }
        const bridged = G.l1.filled &&
          (G.gapsThisPhase || []).every(g => !g.repaired || g.bridge >= 1);
        if ((bridged && G.st > 250) || G.st > 6000) {
          setState(G.l1.unfilled.length ? 'PHASE_ACTIVE' : 'PHASE_DONE');
        }
        break;
      }

      case 'PHASE_DONE':
        if (G.st > T.celebrate) {
          G.l1 = null; G.gapsThisPhase = null;
          G.phase++;
          G.hitCount = 0; G.phaseJumped = false;    // a fresh phase, a fresh slate
          if (G.phase >= L1.phases.length) setState('FINAL_RUN');
          else setState('PHASE_RUN');
        }
        break;

      case 'PHASE_RUN': G.zoomWant = 1; {
        const p = L1.phases[G.phase];
        const dur = L1.runMs[G.phase] || 3000;
        if (L1.jumpBefore.includes(p.id) && !G.phaseJumped && G.st > (G.runLeadMs || 700)) {
          G.phaseJumped = true;
          const stretch = L1.jumpBefore.indexOf(p.id);
          const runs = CFG.obstacle.runs || [];
          const plan = runs.length ? runs[Math.min(Math.max(0, stretch), runs.length - 1)] : null;
          const count = plan ? plan.room.length + 1 : clamp(2 + Math.max(0, stretch), 2, L1.maxRocks || 4);
          obstacles.spawn(G.worldX, 2150, count, plan);
        }
        const clear = !obstacles.list.length || obstacles.list.every(o => o.passed);
        if (G.st > dur && clear) { setState('GLACIER_BREAK_1'); }
        break;
      }
      case 'COMPLETE': {
        if (G.st > 500 && G.zoomWant === 1) {
          const k = DUO.scale;
          G.zoomVX = CFG.W / 2;
          G.zoomVY = CFG.surfaceY - DUO.feet * k / 2;
          G.zoomWant = CFG.ending.zoomK;
          G.zoomMsWant = CFG.ending.zoomMs;
        }
        if (!reduced && G.st - (G.drizzleAt || 0) > 2200) { G.drizzleAt = G.st; particles.confetti(CFG.W, 34, true); }
        break;
      }
      case 'FINAL_RUN':
        G.zoomWant = 1;
        if (G.bearAt) { if (G.bearAt - G.worldX <= CFG.mammothX + 520) setState('COMPLETE'); }
        else if (G.progress >= 0.999) setState('COMPLETE');
        break;
    }
    pushHud();
  }

  function onCrystalHit(o, sx) {
    G.hitCount = (G.hitCount || 0) + 1;
    if (G.hitCount >= 3) {
      audio.bonk(); audio.crashComedy();
      particles.poof(CFG.mammothX + 50, CFG.surfaceY - 16, 8, 1.7);   // the crash: a big cloud
      particles.chips(sx, CFG.surfaceY - 20, 8, -240);
      particles.stars(CFG.mammothX + 70, CFG.surfaceY - 230, 5, 150);   // "that hurt", at the point of contact
      shake(reduced ? 1.5 : 3, 220);
      hitStop(CFG.juice.stopHit * 0.7);
      punch(CFG.juice.punchHit * 0.8, 300, sx, CFG.surfaceY - 60);
      G.hitFx = 1;
      o.hits = 3; o.crumble = 0;          // stops colliding and crumbles away
      mammoth.setState('HURT');            // auto-returns to RUN while moving
      mammoth.knock = Math.max(mammoth.knock || 0, KO_KNOCK);
      return;                              // no panel, no stop: progress is guaranteed
    }
    audio.bonk(); audio.knockout();
    particles.poof(CFG.mammothX + 50, CFG.surfaceY - 16, 8, 1.7);   // the crash: a big cloud
    particles.chips(CFG.mammothX + 60, CFG.surfaceY - 40, 5, -200);
    particles.stars(CFG.mammothX + 74, CFG.surfaceY - 240, 7, 190);
    shake(reduced ? 2 : 4, 260);
    hitStop(CFG.juice.stopHit);
    punch(CFG.juice.punchHit, 340, CFG.mammothX + 60, CFG.surfaceY - 60);
    if (!reduced) particles.ring(CFG.mammothX + 60, CFG.surfaceY - 70, 22, 170);
    mammoth.setState('KNOCKOUT');
    mammoth.knock = Math.max(mammoth.knock || 0, KO_KNOCK);
    mammoth.squash = 0.86;
    mammoth.jolt(reduced ? 0.45 : 1);      // the wince carries on shaking after the hit
    G.hitFx = 1;                      // drives the impact spark burst + warm vignette
    G.hitObstacle = o;
    G.hitReturn = RUN_STATES.has(G.state) ? G.state : 'RUN_SEGMENT_1';
    setState('OBSTACLE_HIT');
  }

  /** Hand control back with the obstacle on a fresh approach. Nothing is lost. */
  function retryObstacle() {
    obstacles.reset();
    G.oops = false; G.hitFx = 0; G.hitObstacle = null;
    G.moving = true; G.jumpEnabled = true; G.speedFactor = 1;
    G.invincibleT = CFG.juice.respawnBlinkS || 1.0;   // blink, and no hit, for the first moment back
    mammoth.setState('RUN');
    G.retryRun = true;                // the stretch is retried at once: PHASE_RUN keeps the short lead
    setState(G.hitReturn || 'RUN_SEGMENT_1');
  }

  function paintGlacierChunk(ctx, sh, installed, rimMul) {
    const pts = sh.pts;
    const b = polyBounds(pts);
    const scale = Math.max(1, b.w / 320);          // outline weight tracks the size
    const img = sh.art ? images['shape:' + sh.art.id] : null;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (img) {
      const a = sh.art;
      ctx.save();
      if (!installed) {
        ctx.shadowColor = 'rgba(9,42,80,0.4)';
        ctx.shadowBlur = 20 * scale;
        ctx.shadowOffsetY = 9 * scale;
      }
      traceRing(ctx, pts);
      ctx.clip();
      ctx.translate(-a.off.x, -a.off.y);
      ctx.scale(a.scale, a.scale);
      ctx.rotate(a.rot);
      const F = 1.02;
      ctx.drawImage(img, a.box.x * F, a.box.y * F, a.box.w * F, a.box.h * F);
      ctx.restore();
    } else {
      const g = ctx.createLinearGradient(0, b.y0, 0, b.y1);
      g.addColorStop(0, '#FBFEFF');
      g.addColorStop(0.20, '#DFF5FE');
      g.addColorStop(0.48, '#9BDCF6');
      g.addColorStop(0.78, '#41B0E4');
      g.addColorStop(1, '#1C6E9C');
      ctx.save();
      ctx.shadowColor = installed ? 'transparent' : 'rgba(9,42,80,0.4)';
      ctx.shadowBlur = installed ? 0 : 20 * scale;
      ctx.shadowOffsetY = installed ? 0 : 9 * scale;
      traceRing(ctx, pts);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    }

    const rim = (rimMul === undefined ? 1 : rimMul);
    ctx.save();
    ctx.strokeStyle = img ? (installed ? 'rgba(10,140,240,0.85)' : 'rgba(12,86,150,0.95)') : '#14496F';
    ctx.lineWidth = (img ? (installed ? 3.2 : 4.6) : 5.6) * scale * rim;
    if (!installed) {
      traceRing(ctx, pts);
      ctx.stroke();
    } else {
      for (let i = 0; i < pts.length; i++) {
        const a2 = pts[i], c2 = pts[(i + 1) % pts.length];
        if ((a2.y + c2.y) / 2 <= b.y0 + b.h * 0.34) continue;   // an upper edge: skip
        ctx.beginPath();
        ctx.moveTo(a2.x, a2.y); ctx.lineTo(c2.x, c2.y);
        ctx.stroke();
      }
    }
    ctx.restore();

    if (!img) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 3 * scale * rim;
      for (let i = 0; i < pts.length; i++) {
        const a2 = pts[i], c2 = pts[(i + 1) % pts.length];
        if ((a2.y + c2.y) / 2 > b.y0 + b.h * 0.34) continue;      // not an upper edge
        ctx.beginPath();
        ctx.moveTo(a2.x * 0.94, a2.y * 0.94);
        ctx.lineTo(c2.x * 0.94, c2.y * 0.94);
        ctx.stroke();
      }
    }
    ctx.restore();

  }

  function drawChunkVapour(ctx, sh) {
    if (reduced || !sh.art) return;
    const b = polyBounds(sh.pts);
    const n = 5;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const ph = ((sh.seed || 1) * 0.37 + i * 0.71) % 1;
      // each wisp runs its own slow cycle: born at the block, sinks and fades
      const t = ((G.t * 0.22 + ph) % 1);
      const ease = t * t * (3 - 2 * t);
      const x = b.x0 + b.w * (0.14 + ((i * 0.29 + ph) % 1) * 0.72);
      const y = b.y1 - b.h * 0.1 + ease * b.h * 0.55;
      const r = b.w * (0.10 + 0.12 * ease);
      const a = Math.sin(t * Math.PI) * 0.16;
      if (a < 0.012) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(238,251,255,' + a.toFixed(3) + ')');
      g.addColorStop(0.55, 'rgba(224,246,255,' + (a * 0.4).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(224,246,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.52, 0, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
  }

  function rigSwing() {
    if (reduced) return 0;
    const CM = CFG.comedy;
    return Math.sin(G.t * CM.swayHz * 6.2832) * CM.swayRad;
  }

  function ropeBow(sh) {
    if (reduced) return 0;
    const CM = CFG.comedy, R = CFG.rope || {};
    const own = ((R.bow || 7) * 0.55) * (iceHash(sh.seed || sh.anchorX || 1, 91) * 2 - 1);
    const lean = CM.swayRad > 0 ? (rigSwing() / CM.swayRad) : 0;
    return own + (R.bowSwing || 9) * lean;
  }
  /** Where that bend has pushed the cord sideways, `d` px up from the attachment. */
  function ropeBowAt(sh, d, vis) {
    return ropeBow(sh) * Math.sin(Math.PI * clamp(d / Math.max(1, vis), 0, 1));
  }
  function ropeVis(span) { return Math.max(200, span.y1 + 40); }

  function chunkPivot(sh) {
    const c = Math.cos(sh.baseRot), s = Math.sin(sh.baseRot);
    let m = null, best = Infinity;
    const pts = sh.pts || [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const my = (a.y + b.y) / 2;
      if (my < best) { best = my; m = { x: (a.x + b.x) / 2, y: my }; }
    }
    if (!m) return { x: 0, y: -SHAPE_H / 2 };
    return { x: m.x * c - m.y * s, y: m.x * s + m.y * c };
  }

  /** Where the rope leaves the anchor and where it meets the chunk. */
  function ropeSpan(sh) {
    const piv = sh.pivot || chunkPivot(sh);
    const a = rigSwing();
    const len = (sh.y + piv.y) - ROPE_TOP;
    return {
      x0: sh.anchorX, y0: ROPE_TOP,
      x1: sh.anchorX - Math.sin(a) * len,
      y1: ROPE_TOP + Math.cos(a) * len
    };
  }

  function rowGuideY() {
    const L = G.l1;
    if (!L) return null;
    let low = -1e9;                       // the LOWEST top edge: the shortest rope in the row
    for (const sh of L.shapes) if (sh.state === 'hang') low = Math.max(low, sh.y - (sh.h || SHAPE_H) / 2);
    if (low < 120) return null;           // nothing has arrived yet
    const k = G.zoom || 1;
    const viewTop = k > 1.0005 ? G.zoomVY * (1 - 1 / k) : 0;
    const top = Math.max(ROPE_TOP, viewTop);
    return clamp((top + low) / 2, top + 60, low - 40);
  }

  function cutGuide(sh) {
    const y = G.l1 ? G.l1.guideY : null;
    if (!(y > 0)) return null;
    const s = ropeSpan(sh);
    const tt = (y - ROPE_TOP) / Math.max(1, s.y1 - ROPE_TOP);
    const a = rigSwing();
    const d = (s.y1 - y) / Math.max(0.2, Math.cos(a));
    return {
      x: s.x0 + (s.x1 - s.x0) * tt + Math.cos(a) * ropeBowAt(sh, d, ropeVis(s)), y,
      ang: Math.atan2(s.y1 - ROPE_TOP, s.x1 - s.x0) + Math.PI / 2,   // across the rope
      half: Math.max(64, (sh.w || SHAPE_W) * 0.36)                   // half the dash line's length
    };
  }

  let fogArt = null;

  /** Tileable fractal value noise as an alpha field, in the sky's own colour. */
  function paintFogLayer(H, salt, cols, gain) {
    const W2 = CFG.W * 2;
    const SS = 6;
    const w = Math.max(16, Math.round(W2 / SS)), h = Math.max(6, Math.round(H / SS));
    const src = offscreen(w, h);
    const g = src.getContext('2d');
    const img = g.createImageData(w, h);

    const hash = (ix, iy, o) => {
      let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) +
              Math.imul(o + 1, 2246822519) + Math.imul(salt, 3266489917);
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    };
    const smooth = t => t * t * (3 - 2 * t);
    const octave = (u, v, c, r, o) => {
      const x = u * c, y = v * r;
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const fx = smooth(x - x0), fy = smooth(y - y0);
      const wrap = i => ((i % c) + c) % c;      // wraps in x, so the strip tiles
      const a = hash(wrap(x0), y0, o), b = hash(wrap(x0 + 1), y0, o);
      const d = hash(wrap(x0), y0 + 1, o), e = hash(wrap(x0 + 1), y0 + 1, o);
      return (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
    };

    for (let y = 0; y < h; y++) {
      const v = y / h;
      // thickest along the top, gone before the chunks, with a soft shoulder
      const fall = clamp(1 - Math.pow(clamp(v / 0.94, 0, 1), 1.6), 0, 1);
      for (let x = 0; x < w; x++) {
        const u = x / w;
        let n = 0, amp = 1, tot = 0, c = cols, r = 2;
        for (let o = 0; o < 4; o++) {
          n += octave(u, v, c, r, o) * amp;
          tot += amp; amp *= 0.52; c *= 2; r *= 2;
        }
        n /= tot;
        // contrast: fog is patchy, not a uniform veil
        n = clamp((n - 0.30) * 2.1, 0, 1);
        const i = (y * w + x) * 4;
        img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(clamp(n * fall * gain, 0, 1) * 255);
      }
    }
    g.putImageData(img, 0, 0);

    const out = offscreen(W2, H);
    const g2 = out.getContext('2d');
    g2.imageSmoothingEnabled = true;
    g2.imageSmoothingQuality = 'high';
    g2.drawImage(src, 0, 0, W2, H);
    return out;
  }

  let fogNoise = null;
  function fogMasks(H) {
    if (fogNoise && fogNoise.H === H) return fogNoise.masks;
    fogNoise = {
      H,
      // coarse and thick, then finer and fainter over the top of it
      masks: [
        { art: paintFogLayer(H, 1, 5, 0.95), sp: 4 },
        { art: paintFogLayer(H, 2, 9, 0.70), sp: 9 },
        { art: paintFogLayer(H, 3, 17, 0.45), sp: 17 }
      ]
    };
    return fogNoise.masks;
  }
  /** One mask, washed in the sky's own colour. */
  function tintFogLayer(mask, H, rgb) {
    const W2 = CFG.W * 2;
    const out = offscreen(W2, H);
    const g = out.getContext('2d');
    g.drawImage(mask, 0, 0);
    g.globalCompositeOperation = 'source-in';
    // the same wash the per-pixel version applied: most of the way to white
    const col = rgb.map(v => Math.round(v + (255 - v) * 0.72));
    g.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
    g.fillRect(0, 0, W2, H);
    return out;
  }

  function drawFog(ctx) {
    const H = Math.round(L1.rigY * 1.3);
    const L = bgm ? bgm.light() : { c: [255, 255, 255], dim: 1 };
    const key = L.c.map(v => (v | 0) >> 4).join('.') + '/' + H;
    if (!fogArt || fogArt.key !== key) {
      const masks = fogMasks(H);
      fogArt = {
        key,
        layers: masks.map(m => ({ art: tintFogLayer(m.art, H, L.c), sp: m.sp }))
      };
    }
    const W2 = CFG.W * 2;
    ctx.save();
    ctx.globalAlpha = clamp(0.5 + L.dim * 0.5, 0, 1);
    for (const l of fogArt.layers) {
      const ox = -(((reduced ? 0 : G.t) * l.sp) % W2);
      ctx.drawImage(l.art, Math.round(ox), 0);
      ctx.drawImage(l.art, Math.round(ox + W2), 0);
    }
    ctx.restore();
  }

  const ROPE_TOP = -24;

  function ropeK(w) { return w / ((CFG.rope && CFG.rope.cordW) || 35); }
  function drawRopeCord(ctx, img, w, from, to, bowAt) {
    const R = CFG.rope, k = ropeK(w), aw = R.artW || img.naturalWidth || 96;
    const L = R.cord[1] - R.cord[0], SEG = R.seg || 280, segS = SEG * k, dw = aw * k;
    for (let d = from, i = 0; d < to && i < 200; d += segS, i++) {
      const row1 = R.cord[1] - (i * SEG) % L;            // the slice's lower row (nearer the knot)
      const h = Math.min(segS, to - d), rows = h / k;
      const dm = d + h / 2;
      const x = bowAt ? bowAt(dm) : 0, slope = bowAt ? (bowAt(dm + 8) - bowAt(dm - 8)) / 16 : 0;
      ctx.save();
      ctx.translate(x, -dm);
      if (slope) ctx.rotate(Math.atan(slope));
      ctx.drawImage(img, 0, row1 - rows, aw, rows, -dw / 2, -h / 2 - 1, dw, h + 2);
      ctx.restore();
    }
  }
  function ropeKnot(ctx, img, w) {
    const R = CFG.rope, k = ropeK(w), aw = R.artW || img.naturalWidth || 96, dw = aw * k;
    const rows = R.knot[1] - R.knot[0], kh = rows * k;
    const top = -(19 + 6) * k;
    ctx.drawImage(img, 0, R.knot[0], aw, rows, -dw / 2, top, dw, kh);
    return -top;
  }
  function drawRope(ctx, sh) {
    const img = images.rope;
    const s = ropeSpan(sh);
    const w = Math.max(11, (sh.w || SHAPE_W) * 0.055);
    const UP = 1400;                       // always past the top of the frame
    const overlap = Math.max(30, (sh.h || SHAPE_H) * 0.3);
    ctx.save();
    ctx.translate(s.x1, s.y1);             // the attachment point on the block
    ctx.rotate(rigSwing());
    if (img && CFG.rope) {
      const k = ropeK(w);
      const d0 = ropeKnot(ctx, img, w);                                  // the cord starts above the knot
      const VIS = ropeVis(s);                                            // attachment up to the frame top
      drawRopeCord(ctx, img, w, d0, UP, d => ropeBowAt(sh, d, VIS));
      void overlap; void k;
    }
    else if (img) ctx.drawImage(img, Math.round(-w / 2), Math.round(-UP), Math.round(w), Math.round(UP + overlap));
    else { ctx.fillStyle = 'rgba(228,246,255,0.95)'; ctx.fillRect(-w / 2, -UP, w, UP + overlap); }
    ctx.restore();
  }

  function drawRopeStub(ctx, st) {
    const img = images.rope;
    const e = clamp(st.t / 0.9, 0, 1);
    const len = lerp(st.len, st.len * 0.78, easeOut(clamp(st.t / 0.22, 0, 1)));
    const swing = Math.sin(st.t * 13) * 0.22 * (1 - e);
    const w = Math.max(11, st.w * 0.055);
    const over = L1.rigY - ROPE_TOP;
    ctx.save();
    ctx.translate(st.x, L1.rigY);
    ctx.rotate(swing);
    if (img && CFG.rope) {
      const R = CFG.rope, k = ropeK(w), aw = R.artW || img.naturalWidth || 96, dw = aw * k;
      const frows = R.fray[1] - R.fray[0], fh = frows * k;
      ctx.drawImage(img, 0, R.fray[0], aw, frows, -dw / 2, len - fh, dw, fh);
      ctx.save(); ctx.translate(0, len - fh);
      drawRopeCord(ctx, img, w, 0, len - fh + over, null);
      ctx.restore();
    }
    else if (img) ctx.drawImage(img, -w / 2, -over, w, len + over);
    else { ctx.fillStyle = 'rgba(228,246,255,0.95)'; ctx.fillRect(-w / 2, -over, w, len + over); }
    ctx.restore();
  }

  function drawChunkHalo(ctx, sh) {
    const b = polyBounds(sh.pts);
    const r = Math.max(b.w, b.h) * 1.05;
    const flash = sh.flash || 0;
    const pulse = (0.86 + 0.14 * Math.sin(G.t * 1.9)) * (1 + flash * 0.35);
    ctx.save();
    if (flash > 0) ctx.globalAlpha = Math.min(1, ctx.globalAlpha * (1 + flash * 0.6));
    const wide = ctx.createRadialGradient(0, 0, r * 0.28, 0, 0, r * pulse);
    wide.addColorStop(0, 'rgba(255,238,186,0.62)');
    wide.addColorStop(0.42, 'rgba(255,206,104,0.36)');
    wide.addColorStop(0.72, 'rgba(255,186,72,0.14)');
    wide.addColorStop(1, 'rgba(255,176,48,0)');
    ctx.fillStyle = wide;
    ctx.beginPath(); ctx.arc(0, 0, r * pulse, 0, 6.2832); ctx.fill();

    const core = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 0.62);
    core.addColorStop(0, 'rgba(255,252,238,0.72)');
    core.addColorStop(1, 'rgba(255,244,206,0)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  /** A specular band sweeping down the ice, clipped to the block's own outline. */
  function drawChunkSheen(ctx, sh) {
    if (reduced) return;
    const b = polyBounds(sh.pts);
    // 0..1 down the face, with a long pause between passes so it reads as a glint
    const cycle = 3.4;
    const u = (G.t % cycle) / cycle;
    if (u > 0.42) return;
    const p = u / 0.42;
    const band = b.h * 0.42;
    const y = lerp(b.y0 - band, b.y1 + band, p);
    ctx.save();
    traceRing(ctx, sh.pts);
    ctx.clip();
    const g = ctx.createLinearGradient(0, y - band / 2, 0, y + band / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(b.x0 - 10, y - band / 2, b.w + 20, band);
    ctx.restore();
  }

  function drawHangingShapes(ctx, belowSurface, bare) {
    const L = G.l1; if (!L) return;
    if (!belowSurface) {
      for (const st of (L.stubs || [])) drawRopeStub(ctx, st);
      for (const sh of L.shapes) if (sh.state === 'hang') drawRope(ctx, sh);
      if (!bare) drawFog(ctx);
    }
    for (const sh of L.shapes) {
      const isBelow = sh.y > chunkOcclusionY() &&
                      (sh.state !== 'falling' || !!gapUnder(sh.x));
      if (isBelow !== belowSurface) continue;
      const piv = sh.pivot || chunkPivot(sh);
      ctx.save();
      ctx.globalAlpha = sh.alpha;
      if (isBelow) ctx.filter = `brightness(${(0.84 - (sh.submerged || 0) * 0.42).toFixed(2)})`;
      if (sh.state === 'hang') {
        const len = (sh.y + piv.y) - ROPE_TOP;
        ctx.translate(sh.anchorX, ROPE_TOP);
        ctx.rotate(rigSwing());
        ctx.translate(0, len);
        ctx.translate(-piv.x, -piv.y);
      } else {
        ctx.translate(sh.x, sh.y);
        ctx.rotate(sh.rot);
        ctx.scale(sh.scale, sh.scale);
      }
      // the halo goes BEHIND the block, so it reads as light coming off it
      if (sh.state === 'hang' && !bare) drawChunkHalo(ctx, sh);
      paintGlacierChunk(ctx, sh, false);
      if (sh.state === 'hang') { drawChunkSheen(ctx, sh); if (!bare) drawChunkVapour(ctx, sh); }
      // the short tail of rope a cut chunk carries down with it
      if (sh.tail > 0 && sh.state !== 'hang') {
        const img = images.rope;
        const w = Math.max(11, (sh.w || SHAPE_W) * 0.055);
        ctx.save();
        ctx.translate(piv.x, piv.y);
        // the knot stays tied to the block, with the cut length of cord above it
        if (img && CFG.rope) { const d0 = ropeKnot(ctx, img, w); drawRopeCord(ctx, img, w, d0, d0 + sh.tail, null); }
        else if (img) ctx.drawImage(img, -w / 2, -sh.tail, w, sh.tail + 10);
        ctx.restore();
      }
      ctx.restore();
      ctx.filter = 'none';
    }
    ctx.globalAlpha = 1;
  }
  function drawCutGuide(ctx) {
    const L = G.l1;
    if (!L || G.state !== 'PHASE_ACTIVE') return;
    const DASH = [14, 11];
    const march = -(G.t * 84) % (DASH[0] + DASH[1]);
    const breathe = 0.5 + 0.28 * Math.sin(G.t * 3.6);
    for (const sh of L.shapes) {
      if (sh.state !== 'hang') continue;
      const gd = sh.guide || cutGuide(sh);
      if (!gd) continue;                     // rope still off the top: nothing to mark
      const half = gd.half;
      ctx.save();
      ctx.translate(gd.x, gd.y);
      ctx.rotate(gd.ang);
      ctx.globalAlpha = breathe;
      ctx.lineCap = 'butt';
      ctx.setLineDash(DASH);
      ctx.lineDashOffset = march;
      ctx.shadowColor = 'rgba(210,240,255,1)';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-half, 0); ctx.lineTo(half, 0); ctx.stroke();
      // a second pass with no blur so the dash itself stays crisp inside its glow
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-half, 0); ctx.lineTo(half, 0); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
  function drawCutDemo(ctx) {
    const L = G.l1;
    if (!L || !L.demo || L.demo.done || G.attempts > 0 || G.state !== 'PHASE_ACTIVE') return;
    if (L.shapes.length < 2) return;
    const want = L.shapes.find(s => s.state === 'hang' && L.unfilled && L.unfilled.includes(s.kind));
    const mid = want || L.shapes[Math.floor(L.shapes.length / 2)];
    const gd = mid.guide || cutGuide(mid);
    const cx = gd ? gd.x : mid.anchorX;
    const cy = gd ? gd.y : (L1.rigY + L1.optionY - (mid.h || SHAPE_H) / 2) / 2;
    const cycle = 0.95, u = (L.demo.t % cycle) / cycle;
    const fade = clamp(Math.sin(Math.min(u, 1) * Math.PI) * 1.6, 0, 1) * clamp(2 - L.demo.t / 1.1, 0, 1);
    if (fade <= 0.01) return;
    // long enough to start clear of the rope and finish clear the other side
    const x0 = cx - 132, x1 = cx + 132;
    const head = lerp(x0, x1, clamp(u * 1.25, 0, 1));
    ctx.save();
    ctx.globalAlpha = fade * 0.95;
    ctx.lineCap = 'round';
    const tr = ctx.createLinearGradient(x0, cy - 18, head, cy + 18);
    tr.addColorStop(0, 'rgba(255,255,255,0)');
    tr.addColorStop(1, 'rgba(255,255,255,0.95)');
    ctx.strokeStyle = tr; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(x0, cy - 18); ctx.lineTo(head, cy + 18); ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(head, cy - 18 + (head - x0) / (x1 - x0) * 36, 11, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(45,130,181,0.65)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(head, cy - 18 + (head - x0) / (x1 - x0) * 36, 11, 0, 6.2832); ctx.stroke();
    ctx.restore();
  }

  function drawSlash(ctx) {
    if (!slash || slash.pts.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 9;
    ctx.beginPath();
    slash.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(104,201,238,0.8)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }

  const taps = [];
  function addTap(x, y) {
    taps.push({ x, y, t: 0 });
    const wy = CFG.surfaceY + CFG.levelOne.waterDepth;
    if (y > wy - 8 && !reduced) { particles.splash(x, Math.max(y, wy), 14); particles.ring(x, wy + 6, 10, 70); audio.splash(); }
    const R = G.duoRect;
    if (G.state === 'COMPLETE' && R && x > R.x && x < R.x + R.w && y > R.y && y < R.y + R.h) {
      if (!reduced) particles.poof(x, CFG.surfaceY, 4, 1);
      audio.toot();
    }
    if (taps.length > 6) taps.shift();
  }
  function updateTaps(dt) {
    for (const t of taps) t.t += dt;
    for (let i = taps.length - 1; i >= 0; i--) if (taps[i].t > 0.5) taps.splice(i, 1);
  }
  function drawTaps(ctx) {
    for (const t of taps) {
      const e = clamp(t.t / 0.5, 0, 1);
      const r = lerp(14, 74, easeOut(e));
      ctx.save();
      ctx.globalAlpha = (1 - e) * 0.55;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = lerp(7, 1.5, e);
      ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, 6.2832); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function pieceOutline(p, cx, cy, k, roll) {
    const c = Math.cos(roll), sn = Math.sin(roll);
    return p.pts.map(q => ({
      x: cx + (q.x * c - q.y * sn) * k,
      y: cy + (q.x * sn + q.y * c) * k
    }));
  }

  function pieceSilhouette(p, cx, cy, k, roll) {
    const path = new Path2D();
    pieceOutline(p, cx, cy, k, roll).forEach((q, i) => {
      if (i === 0) path.moveTo(q.x, q.y); else path.lineTo(q.x, q.y);
    });
    path.closePath();
    return path;
  }

  function drawFreezeIn(ctx, p, sil, pts, f) {
    if (f >= 1 || pts.length < 3) return;

    const seed = ((p.seed || 7) % 997) * 0.618;
    const rnd = n => { const s = Math.sin(seed + n * 78.233) * 43758.5453; return s - Math.floor(s); };

    let mx = 0, my = 0;
    for (const q of pts) { mx += q.x; my += q.y; }
    mx /= pts.length; my /= pts.length;

    const xs = pts.map(q => q.x), ys = pts.map(q => q.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);

    const hi = pts.slice().sort((a, b) => a.y - b.y);
    const roots = [hi[0], hi[1]];
    const bell = Math.sin(clamp(f, 0, 1) * Math.PI);

    ctx.save();
    ctx.clip(sil);
    ctx.fillStyle = `rgba(228,247,255,${(0.36 * bell).toFixed(3)})`;
    ctx.fill(sil);

    const span = (y1 - y0) + 140;
    const front = y0 - 70 + span * clamp(f * 1.22, 0, 1);
    const sweep = ctx.createLinearGradient(0, front - 78, 0, front + 30);
    sweep.addColorStop(0, 'rgba(255,255,255,0)');
    sweep.addColorStop(0.74, `rgba(244,253,255,${(0.52 * (1 - f)).toFixed(3)})`);
    sweep.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sweep;
    ctx.fillRect(x0 - 12, y0 - 12, (x1 - x0) + 24, (y1 - y0) + 24);

    if (!reduced) {
      let per = 0;
      const rim = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const L = Math.hypot(b.x - a.x, b.y - a.y);
        per += L;
        const n = Math.max(1, Math.round(L / 24));
        for (let j = 0; j < n; j++) {
          const t = (j + 0.5) / n;
          const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
          const ix = mx - x, iy = my - y, il = Math.hypot(ix, iy) || 1;
          rim.push({ x, y, nx: ix / il, ny: iy / il });
        }
      }
      const half = Math.max(1, per * 0.5);
      const gone = clamp((f - 0.70) / 0.30, 0, 1);
      rim.forEach((s, i) => {
        const d = Math.min(Math.hypot(s.x - roots[0].x, s.y - roots[0].y),
                           Math.hypot(s.x - roots[1].x, s.y - roots[1].y));
        const cg = easeOut(clamp((f - clamp(d / half, 0, 1) * 0.60) / 0.34, 0, 1));
        if (cg <= 0) return;
        const a = 0.92 * cg * (1 - gone);
        if (a < 0.025) return;
        const len = (12 + rnd(i) * 30) * cg;
        const w = 2.4 + rnd(i + 31) * 3.2;
        const lean = rnd(i + 57) * 0.7 - 0.35;
        const dx = s.nx * Math.cos(lean) - s.ny * Math.sin(lean);
        const dy = s.nx * Math.sin(lean) + s.ny * Math.cos(lean);
        const px = -dy, py = dx;
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(s.x + px * w, s.y + py * w);
        ctx.lineTo(s.x + dx * len, s.y + dy * len);
        ctx.lineTo(s.x - px * w, s.y - py * w);
        ctx.closePath();
        ctx.fill();
        // one barb on the long ones, which is the difference between a crystal and a shard
        if (len > 25) {
          const side = rnd(i + 91) > 0.5 ? 1 : -1;
          const bx = s.x + dx * len * 0.55, by = s.y + dy * len * 0.55;
          ctx.strokeStyle = `rgba(255,255,255,${(a * 0.75).toFixed(3)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + (dx * 0.5 + px * side) * len * 0.34,
                     by + (dy * 0.5 + py * side) * len * 0.34);
          ctx.stroke();
        }
      });
    }
    ctx.restore();

    const weld = 0.62 * bell;
    if (weld > 0.02) {
      for (const r of roots) {
        const gr = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, 34);
        gr.addColorStop(0, `rgba(255,255,255,${weld.toFixed(3)})`);
        gr.addColorStop(0.55, `rgba(232,249,255,${(weld * 0.45).toFixed(3)})`);
        gr.addColorStop(1, 'rgba(226,246,255,0)');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(r.x, r.y, 34, 0, 6.2832); ctx.fill();
      }
    }

    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${(0.92 * (1 - f)).toFixed(3)})`;
    ctx.lineWidth = 3 + 9 * (1 - f);
    ctx.stroke(sil);
    ctx.restore();
  }

  /* The mend itself. */
  function drawKeystone(ctx, g, p) {
    if (!p) return;
    if (p.grow === undefined) p.grow = 0;
    const e = easeOut(p.grow);
    const k = (p.fit || 1) * (1 + Math.sin(e * Math.PI) * 0.035);
    const sq = p.impact ? p.impact : 0;
    // it rolls from the angle it was cut at into the angle it seats at
    const roll = lerp(p.rot0 || 0, 0, e);
    const SEAT_INSET = PLUG_SINK;
    const kk = Math.max(k, 0.001);
    const cx = p.cx - G.worldX;
    const cy = p.topLocal !== undefined
      ? CFG.surfaceY + SEAT_INSET - p.topLocal * kk
      : p.cy;

    const gx0 = g.x0 - G.worldX, gx1 = g.x1 - G.worldX;
    const waterY = CFG.surfaceY + CFG.levelOne.waterDepth;
    const outline = pieceOutline(p, cx, cy, kk, roll);
    const sil = pieceSilhouette(p, cx, cy, kk, roll);

    ctx.save();
    ctx.beginPath();
    ctx.rect(gx0 - 80, CFG.surfaceY - 90, (gx1 - gx0) + 160, CFG.H - CFG.surfaceY + 92);
    ctx.clip();

    ctx.translate(cx, cy);
    ctx.rotate(roll);
    ctx.scale(kk * (1 + sq * 0.03), kk * (1 - sq * 0.05));
    // rim divided by the seating scale, so it matches a hanging chunk on screen
    paintGlacierChunk(ctx, p, true, 1 / kk);
    if (p.marks) {
      ctx.save();
      ctx.lineCap = 'round';
      for (const [a, b] of p.marks) {
        ctx.strokeStyle = 'rgba(20,70,120,0.6)'; ctx.lineWidth = 7 / kk;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2.5 / kk;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();

    drawFreezeIn(ctx, p, sil, outline, p.frz === undefined ? 1 : p.frz);

  }

  /** An offscreen canvas, for anything that is redrawn identically every frame. */
  function offscreen(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const DECK_MAX = 28;

  function deckProfile(g) {
    const n = (g.pieces || []).length;
    if (g._deck && g._deckN === n) return g._deck;
    const x0 = g.x0 + ((g.x1 - g.x0) - g.throat) / 2;      // the throat, inside the mouth
    const x1 = x0 + g.throat;
    const floor = CFG.surfaceY + DECK_MAX;
    const out = [];
    for (let x = x0; x <= x1 + 0.01; x += 5) {
      let top = floor;
      for (const p of (g.pieces || [])) {
        const kk = Math.max(p.fit || 1, 0.001);
        const pcy = CFG.surfaceY + PLUG_SINK - (p.topLocal || 0) * kk;
        const lx = (x - p.cx) / kk;
        const pts = p.pts;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          const dx = b.x - a.x;
          if (Math.abs(dx) < 1e-6) continue;
          if ((a.x - lx) * (b.x - lx) > 0) continue;        // this edge does not span lx
          const y = pcy + (a.y + (b.y - a.y) * ((lx - a.x) / dx)) * kk;
          if (y < top) top = y;
        }
      }
      out.push({ x, y: Math.min(top, floor) });
    }
    const sm = out.map((q, i) => {
      let s = 0, c = 0;
      for (let k = -2; k <= 2; k++) {
        const o = out[i + k];
        if (o) { s += o.y; c++; }
      }
      return { x: q.x, y: s / c };
    });
    g._deck = sm; g._deckN = n;
    return sm;
  }

  function drawDeck(ctx, g) {
    if (!g.repaired || !(g.pieces && g.pieces.length)) return;
    const grow = clamp(g.bridge === undefined ? 1 : g.bridge, 0, 1);
    if (grow <= 0.002) return;
    const prof = deckProfile(g);
    if (prof.length < 2) return;
    const y0 = CFG.surfaceY - 5;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(prof[0].x - G.worldX, y0);
    for (const q of prof) ctx.lineTo(q.x - G.worldX, y0 + (q.y - y0) * grow);
    ctx.lineTo(prof[prof.length - 1].x - G.worldX, y0);
    ctx.closePath();
    const gr = ctx.createLinearGradient(0, y0, 0, y0 + DECK_MAX);
    gr.addColorStop(0, '#FFFFFF');
    gr.addColorStop(0.40, '#EFF9FF');
    gr.addColorStop(1, '#B9E1F6');
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.beginPath();
    prof.forEach((q, i) => {
      const x = q.x - G.worldX, y = y0 + (q.y - y0) * grow;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function drawWrongFlash(ctx) {
    const k = G.wrongFx || 0;
    if (k <= 0.01) return;
    const a = Math.sin(Math.min(1, k) * Math.PI * 0.5) * (reduced ? 0.24 : 0.42);
    const g = ctx.createRadialGradient(CFG.W / 2, CFG.H / 2, CFG.H * 0.30,
                                       CFG.W / 2, CFG.H / 2, CFG.W * 0.62);
    g.addColorStop(0, 'rgba(210,40,40,0)');
    g.addColorStop(1, 'rgba(198,32,32,' + a.toFixed(3) + ')');
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    ctx.restore();
  }
  function drawRepairedPieces(ctx) {
    for (const g of ground.gaps) {
      if (!(g.pieces && g.pieces.length)) continue;
      for (const p of g.pieces) drawKeystone(ctx, g, p);
      drawDeck(ctx, g);
    }
  }
  function drawCracks(ctx) {
    for (const g of ground.gaps) {
      if (g.repaired || g.crack <= 0 || g.open > 0.9) continue;
      const cx = (g.x0 + g.x1) / 2 - G.worldX;
      ctx.save();
      ctx.strokeStyle = 'rgba(20,70,120,0.85)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, CFG.surfaceY - 4);
      for (let i = 0; i < g.crackPts.length; i++) {
        if ((i + 1) / g.crackPts.length > g.crack) break;
        ctx.lineTo(cx + g.crackPts[i].x, CFG.surfaceY - 4 + g.crackPts[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function rockAhead() {
    let best = null, bx = Infinity;
    for (const o of obstacles.list) {
      if (o.passed || o.hits >= 3) continue;
      const sx = o.x - G.worldX;
      if (sx > 620 && sx < 1050 && sx < bx) { best = o; bx = sx; }
    }
    return best;
  }

  function renderFocus(target, kind) {
    if (!target || !target.getContext) return;
    const fx = target.getContext('2d');
    fx.clearRect(0, 0, CFG.W, CFG.H);
    if (!kind) return;
    fx.save();
    if (G.zoom > 1.0005) {
      fx.translate(G.zoomVX, G.zoomVY);
      fx.scale(G.zoom, G.zoom);
      fx.translate(-G.zoomVX, -G.zoomVY);
    }
    switch (kind) {
      case 'mammoth': mammoth.draw(fx, G.t, true); break;
      case 'rock': { const o = rockAhead(); if (o) obstacles.draw(fx, G.worldX, G.t, o); break; }
      case 'gap':
        ground.drawDitch(fx, G.worldX, G.t);
        ground.drawWaterFront(fx, G.worldX, G.t);
        ground.drawLips(fx, G.worldX);
        break;
      case 'blocks': if (G.l1) drawHangingShapes(fx, false, true); break;
      case 'slab': if (G.l2) drawL2(fx); break;
    }
    fx.restore();
  }

  function p2FocusOn() {
    const L = G.l2;
    if (!L || L.seated) return false;
    if (L.fall || L.respawn > 0 || (L.form !== undefined && L.form < 1)) return false;
    return ['LEVEL_2_FOCUS', 'LEVEL_2_ACTIVE', 'LEVEL_2_WRONG_FEEDBACK'].includes(G.state);
  }

  const DUO = { cw: 717, ch: 376, cols: 6, n: 36, fps: 10, feet: 373, mammothCx: 148, bearCx: 574, scale: 1.22 };   // cells trimmed to the art's bounds; 1.22 leaves air under the banner
  function drawDuo(ctx, a) {
    const img = images.duo;
    if (!img) return;
    const f = Math.floor(G.st / (1000 / DUO.fps)) % DUO.n;
    const sx = (f % DUO.cols) * DUO.cw, sy = Math.floor(f / DUO.cols) * DUO.ch;
    const k = DUO.scale, w = DUO.cw * k, h = DUO.ch * k;
    const x0 = CFG.mammothX - DUO.mammothCx * k, xc = CFG.W / 2 - w / 2;
    const glide = easeInOut(clamp((G.st - 300) / 900, 0, 1));
    const x = x0 + (xc - x0) * glide, y = CFG.surfaceY - DUO.feet * k;
    G.duoRect = { x, y, w, h };
    if (f !== G.duoFrame) {
      G.duoFrame = f;
      if (!reduced && f % 9 === 0) {
        const cx = x + (f % 18 === 0 ? DUO.mammothCx : DUO.bearCx) * k;
        particles.poof(cx, CFG.surfaceY, 3, 0.8);
      }
    }
    ctx.save();
    ctx.globalAlpha = a;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, DUO.cw, DUO.ch, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    ctx.restore();
  }

  function render() {
    ctx.setTransform(rs, 0, 0, rs, 0, 0);   // the backbuffer scale; see setRenderScale
    ctx.clearRect(0, 0, CFG.W, CFG.H);
    const sh = G.shake > 0 ? G.shake : 0;
    let ox = sh ? rand(-sh, sh) : 0, oy = sh ? rand(-sh, sh) : 0;
    const qa = G.quakeAt || 0;
    if (qa > 0.01) {
      const w = G.t * 6.2832;
      const jitter = reduced ? 0 : 0.1;
      const qx = qa * (0.62 * Math.sin(w * 7.4) + 0.28 * Math.sin(w * 13.1 + 1.7) + jitter * rand(-1, 1));
      const qy = qa * 0.52 * (0.58 * Math.sin(w * 9.3 + 0.6) + 0.30 * Math.sin(w * 17.9 + 2.2) + jitter * rand(-1, 1));
      ox += qx; oy += qy;
      G.quakeOx = qx; G.quakeOy = qy;    // readable, so the waveform can be checked
    }
    ctx.save();
    ctx.translate(ox, oy);
    if (G.zoom > 1.0005) {
      ctx.translate(G.zoomVX, G.zoomVY);
      ctx.scale(G.zoom, G.zoom);
      ctx.translate(-G.zoomVX, -G.zoomVY);
    }
    if (G.punchAt > 0.0005) {
      const k = 1 + G.punchAt;
      ctx.translate(G.punchX, G.punchY);
      ctx.scale(k, k);
      ctx.translate(-G.punchX, -G.punchY);
    }

    bgm.draw(ctx, G.worldX, reduced);
    atmos.drawAurora(ctx, G.t, reduced);
    atmos.drawBack(ctx, G.worldX, G.t, reduced, bgm.light());
    ground.drawDitch(ctx, G.worldX, G.t);
    drawHangingShapes(ctx, true);
    const l2Debris = !!(G.l2 && G.l2.fall && G.l2.debris && G.l2.debris.length);
    const l2Top = (() => {
      const L = G.l2;
      if (!L || !L.fall || !L.pts) return Infinity;
      return L.pos.y + polyBounds(L.pts).y0 * (L.scale || 1);
    })();
    const l2Sinking = !!(G.l2 && G.l2.fall && l2Top > CFG.surfaceY);
    if ((l2Sinking || l2Debris) && !p2FocusOn()) drawL2(ctx, l2Debris ? true : null);
    // the pool surface closes over anything that fell into it
    ground.drawWaterFront(ctx, G.worldX, G.t);
    ground.draw(ctx, G.worldX, G.t);
    ground.drawRiverLife(ctx, G.worldX, G.t);
    drawCracks(ctx);
    drawRepairedPieces(ctx);
    obstacles.draw(ctx, G.worldX, G.t);
    // behind the character, so the two never fight for the same pixels on arrival
    const duo = G.state === 'COMPLETE' && images.duo ? clamp(G.st / 300, 0, 1) : 0;
    if (duo < 1) {
      if (duo > 0) { ctx.save(); ctx.globalAlpha = 1 - duo; }
      drawBear(ctx);
      const blink = G.invincibleT > 0 && Math.floor(G.t * 10) % 2 === 1;
      if (blink) { ctx.save(); ctx.globalAlpha *= 0.35; }
      mammoth.draw(ctx, G.t);
      if (blink) ctx.restore();
      if (duo > 0) ctx.restore();
    }
    if (duo > 0) drawDuo(ctx, duo);
    drawAvalanche(ctx);
    drawDazeStars(ctx);
    atmos.drawFront(ctx, G.worldX, G.t, reduced, !!G.l1);   // no snow over an open question

    particles.draw(ctx);
    drawHitFx(ctx);
    if (G.l1) { drawHangingShapes(ctx, false); drawCutGuide(ctx); drawCutDemo(ctx); drawSlash(ctx); }
    if (G.l2 && (l2Debris || !l2Sinking) && !p2FocusOn()) drawL2(ctx, l2Debris ? false : null);
    drawWrongFlash(ctx);              // the 'that was wrong' wash, under the player's own mark
    drawTaps(ctx);                    // over everything: it is the player's own mark
    ctx.restore();
  }

  const L2 = CFG.levelTwo;

  function p2Cfg() {
    const list = L2.levels || [];
    const cur = list[clamp(G.p2i || 0, 0, Math.max(0, list.length - 1))] || {};
    return Object.assign({}, L2, cur);
  }
  /** How big the slab is drawn while it stands on the path, against its true size. */
  function restK() { return p2Cfg().restK || 1; }
  /** How many crossings Part 2 has replaced so far. */
  function p2Count() { return (L2.levels || []).length; }

  function cutShapeAndArt() {
    const C = p2Cfg();
    const rec = optionShapes[C.shape];
    const raw = rec ? rec.points : regularHexagon(1);
    const R = C.hexR;
    const b = polyBounds(raw);
    const c = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
    return {
      pts: raw.map(p => ({ x: (p.x - c.x) * R, y: (p.y - c.y) * R })),
      art: rec ? { id: C.shape, rot: 0, scale: R, off: { x: c.x * R, y: c.y * R },
                   box: { x: b.x0, y: b.y0, w: b.w, h: b.h } } : null
    };
  }
  function cutRing() { return cutShapeAndArt().pts; }

  function quarterDecks() { return quarterPieces().map(q => q.deck); }

  function pieceDecks() {
    const m = p2Cfg().mechanic;
    if (m === 'draw-all-diagonals') return quarterDecks();
    if (m === 'same-vertex-diagonals') return fanDecks();
    // cut-diagonal: two halves, each spanning the main diagonal it was cut along
    const d = minMainCut();
    return [d, d];
  }

  function shareOut(pieces, n) {
    const share = new Array(n).fill(1);
    for (let extra = pieces - n, i = n - 1; extra > 0; extra--, i = (i - 1 + n) % n) share[i]++;
    return share;
  }

  function fanPieces(origin) {
    const pts = cutRing();
    const n = pts.length;
    if (n < 4) return [];
    const v = ((origin || 0) % n + n) % n;
    const out = [];
    for (let k = 1; k < n - 1; k++) {
      const tri = [pts[v], pts[(v + k) % n], pts[(v + k + 1) % n]];
      let deck = 0;
      for (let i = 0; i < 3; i++) {
        const a = tri[i], b = tri[(i + 1) % 3];
        deck = Math.max(deck, Math.hypot(b.x - a.x, b.y - a.y));
      }
      out.push({ pts: tri, deck, cx: (tri[0].x + tri[1].x + tri[2].x) / 3 });
    }
    out.sort((a, b) => a.cx - b.cx);
    return out;
  }
  function fanDecks() { return fanPieces(0).map(q => q.deck); }

  function quarterPieces() {
    const pts = cutRing();
    const n = pts.length;
    if (n !== 4) return [];
    // where the diagonals cross
    const seg = (a, b, c, d) => {
      const A = b.x - a.x, B = b.y - a.y, C = d.x - c.x, D = d.y - c.y;
      const den = A * D - B * C;
      if (!den) return { x: 0, y: 0 };
      const t = ((c.x - a.x) * D - (c.y - a.y) * C) / den;
      return { x: a.x + A * t, y: a.y + B * t };
    };
    const X = seg(pts[0], pts[2], pts[1], pts[3]);
    const out = [];
    for (let i = 0; i < 4; i++) {
      const tri = [pts[i], pts[(i + 1) % 4], { x: X.x, y: X.y }];
      let deck = 0;
      for (let k = 0; k < 3; k++) {
        const a = tri[k], b = tri[(k + 1) % 3];
        deck = Math.max(deck, Math.hypot(b.x - a.x, b.y - a.y));
      }
      out.push({ pts: tri, deck, cx: (tri[0].x + tri[1].x + tri[2].x) / 3 });
    }
    out.sort((a, b) => a.cx - b.cx);
    return out;
  }

  function minMainCut() {
    const pts = cutRing();
    const n = pts.length;
    const mech = p2Cfg().mechanic;
    if (mech === 'draw-all-diagonals') return quarterDecks().reduce((a, d) => a + d, 0);
    if (mech === 'same-vertex-diagonals') return fanDecks().reduce((a, d) => a + d, 0);
    let m = Infinity;
    for (let i = 0; i < n; i++) {
      const j = i + n / 2;
      if (!Number.isInteger(j) || j >= n) continue;      // odd n has no "opposite" corner
      m = Math.min(m, Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y));
    }
    return Number.isFinite(m) ? m : 2 * p2Cfg().hexR;
  }

  function layoutLevelTwo(originX) {
    const C = p2Cfg();
    const n = Math.max(1, Math.min(2, C.ditches || 2));

    const decks = pieceDecks();
    const share = shareOut(decks.length, n);

    let k = 0;
    const plan = share.map(cnt => {
      let sum = 0;
      const mine = [];
      for (let j = 0; j < cnt; j++) { mine.push(decks[k]); sum += decks[k]; k++; }
      const throat = Math.round(sum * (1 - 2 * L2.bearing));
      return { decks: mine, throat, mouth: Math.round(throat * (L1.mouth || 1)) };
    });
    const groupW = plan.reduce((a, q) => a + q.mouth, 0) + L2.ditchGap * (n - 1);

    const rowMid = (CFG.mammothX + L1.clearOfPlayer + (CFG.W - 60)) / 2;
    const lead = clamp(
      Math.max(Math.round(rowMid - groupW / 2), CFG.mammothX + L1.clearance),
      CFG.mammothX + L1.clearance * 0.5,
      CFG.W - 60 - groupW
    );
    ground.gaps = ground.gaps.filter(g => g.repaired);
    const gaps = [];
    let x = originX + lead - (plan[0].mouth - plan[0].throat) / 2;
    plan.forEach((q, i) => {
      const g = ground.addGap({
        x0: x, x1: x + q.mouth, throat: q.throat, open: 0, repaired: false,
        crack: 0, crackPts: makeCrack(),
        bridge: 0, splashes: null, slots: [], pieces: []
      });
      const ins = (q.mouth - q.throat) / 2;
      const sum = q.decks.reduce((a, d) => a + d, 0) || 1;
      let sx = x + ins;
      q.decks.forEach(d => {
        const w = q.throat * (d / sum);
        g.slots.push({
          gapIndex: i, x0: sx, x1: sx + w, full: q.decks.length === 1,
          filled: false, reserved: false, kind: null
        });
        sx += w;
      });
      gaps.push(g);
      x += q.mouth + L2.ditchGap;
    });
    // every slot across every crevasse, in left-to-right order — one per piece
    return { gaps, slots: gaps.reduce((a, g) => a.concat(g.slots), []) };
  }

  function buildLevel2(keepScore) {
    if (!G.gapA) return;
    if (!keepScore) { G.attempts = 0; }
    G.idle = 0;
    const C = p2Cfg();
    const R = C.hexR;
    const { pts, art } = cutShapeAndArt();
    const b = polyBounds(pts);
    const rk = restK();
    const halfW = polyBounds(pts).w / 2 * rk;
    const cx = (G.gapB
      ? (G.gapA.x1 + G.gapB.x0) / 2 - G.worldX
      : G.gapA.x1 + halfW + 26 - G.worldX) + (C.restDX || 0);   // restDX: see crossing 3
    const cy = CFG.surfaceY - b.y1 * rk - L2.homeLift;
    G.l2 = {
      R, pts, art,
      home: { x: cx, y: cy }, pos: { x: cx, y: cy },
      seat: { x: cx, y: CFG.surfaceY - b.y1 - L2.homeLift },
      scale: rk, focusT: 0,
      dragFrom: -1, dragStart: null, dragPt: null, dragId: undefined,
      pieces: null, split: 0, planned: false, locked: false, chipped: false,
      badLine: null, cornerPulse: 0, wrong: G.l2 ? G.l2.wrong : 0, cut: null,
      pop: 0, glow: 0,
      drawn: [], need: (pts.length * (pts.length - 3)) / 2,
      origin: undefined, cands: null,
      mechanic: C.mechanic || 'cut-diagonal',
      fall: null, respawn: 0, debris: null,
      reveal: 0, wantReveal: false,
      form: 0
    };
  }

  /** The slab's corners in stage coordinates — where a finger actually has to land. */
  function hexScreenPts() {
    const L = G.l2;
    if (!L) return [];
    return L.pts.map(p => ({ x: L.pos.x + p.x * L.scale, y: L.pos.y + p.y * L.scale }));
  }

  function nearestVertex(x, y) {
    const L = G.l2;
    if (!L) return -1;
    const pts = hexScreenPts();
    let best = -1, bd = 1e9;
    pts.forEach((p, i) => { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } });
    const tol = CFG.cut.vertexSnap * (L2.dragSnap || 1.9) * (L.scale || 1);
    return bd <= tol ? best : -1;
  }

  function isMainDiagonal(i, j) { return Math.abs(i - j) === 3; }

  function rejectCut(kind, a, b, ci, cj) {
    const L = G.l2;
    L.wrong++;
    L.badLine = { a, b, t: 0, kind };
    G.signSay = L2.instructions[kind] || '';
    { const hv = (L2.hintVo || {})[kind]; if (hv) G.voDur = audio.say(hv) || 0; }
    audio.reject();
    if ((L2.wrongDrops || {})[kind]) loseSlab(a, b, ci, cj);
    else {
      // it holds: a shove and a shiver, so the miss is still felt
      L.shake = 1;
      mammoth.jolt(reduced ? 0.2 : 0.4);
    }
    setState('LEVEL_2_WRONG_FEEDBACK');
  }

  function splitUnfit(i, j) {
    const L = G.l2;
    if (i < 0 || j < 0 || i === j) return null;
    const n = L.pts.length;
    let pa, pb;
    if (Math.abs(i - j) === 1 || Math.abs(i - j) === n - 1) {
      const a = L.pts[i], b = L.pts[j];
      const c = centroid(L.pts);
      const bb = polyBounds(L.pts);
      const depth = Math.max(10, Math.min(bb.w, bb.h) * 0.13);
      const toward = (p) => {
        const dx = c.x - p.x, dy = c.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        return { x: p.x + dx / d * depth, y: p.y + dy / d * depth };
      };
      const a2 = toward(a), b2 = toward(b);
      pa = [a, b, b2, a2];
      pb = L.pts.map((p, k) => (k === i ? a2 : k === j ? b2 : p));
    } else {
      [pa, pb] = PolygonCutManager.split(L.pts, Math.min(i, j), Math.max(i, j));
    }
    if (pa.length < 3 || pb.length < 3) return null;
    const vi = L.pts[i], vj = L.pts[j];
    let nx = -(vj.y - vi.y), ny = (vj.x - vi.x);
    const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
    return [pa, pb].map(ring => {
      const pc = PolygonCutManager.toPiece(ring);
      pc.cx = pc.x; pc.cy = pc.y;
      pc.scale = L.scale; pc.rot = 0; pc.offset = 0;
      const side = Math.sign((pc.cx - vi.x) * nx + (pc.cy - vi.y) * ny) || 1;
      pc.sep = { x: nx * side, y: ny * side };
      pc.spin = side * rand(0.13, 0.24);
      pc.vx = side * rand(60, 150) + rand(-30, 30);
      pc.art = L.art ? Object.assign({}, L.art, {
        off: { x: L.art.off.x + pc.x, y: L.art.off.y + pc.y }
      }) : null;
      return pc;
    });
  }

  function loseSlab(a, b, i, j) {
    const L = G.l2;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const away = mid.x < L.pos.x ? 1 : -1;      // it tips away from where it was weakened
    L.debris = splitUnfit(i, j);
    if (L.debris && L.debris.length) {
      const holes = [G.gapA, G.gapB].filter(Boolean)
        .map(h => (h.x0 + h.x1) / 2 - G.worldX).sort((u, v) => u - v);
      if (holes.length) {
        const hFall = Math.max(60, (CFG.surfaceY - 34) - L.home.y);
        const tFall = Math.sqrt(2 * hFall / (0.55 * L1.dropGravity));
        const order = L.debris.slice().sort((u, v) => u.cx - v.cx);
        order.forEach((pc, k) => {
          const hole = holes[Math.min(holes.length - 1,
            Math.floor(k * holes.length / order.length))];
          const startX = L.home.x + pc.cx * restK();   // they drop from the resting size
          pc.vx = clamp((hole - startX) / Math.max(0.08, tFall), -1200, 1200);
        });
      }
    }
    L.fall = {
      phase: 'return', t: 0,
      spin: away * rand(0.14, 0.26),   // a lean, not a tumble — see pc.spin in splitUnfit
      vx: (() => {
        const holes = [G.gapA, G.gapB].filter(Boolean)
          .map(g => (g.x0 + g.x1) / 2 - G.worldX);
        if (!holes.length) return away * rand(40, 110);
        // prefer one on the side it is tipping towards; otherwise the nearer one
        const side = holes.filter(x => (x - L.home.x) * away > 0);
        const pick = (side.length ? side : holes)
          .reduce((best, x) => Math.abs(x - L.home.x) < Math.abs(best - L.home.x) ? x : best,
                  (side.length ? side : holes)[0]);
        const h = Math.max(60, (CFG.surfaceY + CFG.levelOne.waterDepth) - L.home.y);
        const t = Math.sqrt(2 * h / (0.55 * L1.dropGravity));
        return clamp((pick - L.home.x) / Math.max(0.08, t), -900, 900);
      })(),
      from: { x: L.pos.x, y: L.pos.y, scale: L.scale },
      splashed: false
    };
    L.dragPt = null; L.dragFrom = -1; L.dragId = undefined;
    L.shear = { a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, t: 0 };
    G.wrongFx = 1;
    audio.crack();
    audio.reject();
    particles.chips(mid.x, mid.y, 14, -170);
    shake(reduced ? 1.4 : 3.4, 260);
    hitStop(CFG.juice.stopHit * 0.5);
    punch(CFG.juice.punchHit * 0.6, 260, mid.x, mid.y);
  }

  function attemptCut(i, j, end) {
    const L = G.l2;
    if (!L || L.pieces) return;
    G.attempts++;
    // the stroke never reached a second corner — or never started at one
    if (i < 0 || j < 0 || i === j) {
      const e = end || L.dragStart;
      return rejectCut('corners', L.dragStart, { x: e.x, y: e.y });
    }
    const pts = hexScreenPts();
    const n = L.pts.length;
    if (!PolygonCutManager.isDiagonal(n, i, j)) return rejectCut('side', pts[i], pts[j], i, j);

    if (L.mechanic === 'draw-all-diagonals') {
      const key = Math.min(i, j) + '-' + Math.max(i, j);
      if (L.drawn.includes(key)) return rejectCut('already', pts[i], pts[j]);
      L.drawn.push(key);
      particles.chips((pts[i].x + pts[j].x) / 2, (pts[i].y + pts[j].y) / 2, 4, -120);
      L.cornerPulse = 0.8;
      if (L.drawn.length < L.need) {
        audio.ui();                 // one down, and the shape stays open
        return;
      }
      L.solved = true;
      const quarters = quarterPieces();
      L.pieces = quarters.map(q => {
        const pc = PolygonCutManager.toPiece(q.pts.map(p => ({ x: p.x, y: p.y })));
        pc.cx = pc.x; pc.cy = pc.y;
        pc.rotTarget = rand(-0.05, 0.05);
        pc.offset = 0; pc.rot = 0; pc.scale = L.scale;
        const len = Math.hypot(pc.cx, pc.cy) || 1;
        pc.sep = { x: pc.cx / len, y: pc.cy / len };
        pc.art = L.art ? Object.assign({}, L.art, {
          off: { x: L.art.off.x + pc.x, y: L.art.off.y + pc.y }
        }) : null;
        return pc;
      });
      audio.crack();
      hitStop(CFG.juice.stopHit * 0.6);
      punch(CFG.juice.punchHit * 0.7, 280, L.pos.x, L.pos.y);
      setState('LEVEL_2_SUCCESS');
      return;
    }

    if (L.mechanic === 'same-vertex-diagonals') {
      const key = Math.min(i, j) + '-' + Math.max(i, j);
      if (L.drawn.includes(key)) return rejectCut('already', pts[i], pts[j]);
      if (!L.cands) {
        L.origin = null; L.cands = [i, j];
      } else if (!L.cands.includes(i) && !L.cands.includes(j)) {
        return rejectCut('sameVertex', pts[i], pts[j]);
      }
      if (L.drawn.length === 1) {
        // the shared end of the two lines IS the origin
        const shared = L.cands.includes(i) ? i : j;
        L.origin = shared;
        L.cands = [shared];
      }
      L.drawn.push(key);
      particles.chips((pts[i].x + pts[j].x) / 2, (pts[i].y + pts[j].y) / 2, 4, -120);
      L.cornerPulse = 0.8;
      if (L.drawn.length < (p2Cfg().requiredCount || 2)) { audio.ui(); return; }

      L.solved = true;
      const fan = fanPieces(L.origin);
      L.pieces = fan.map(q => {
        const pc = PolygonCutManager.toPiece(q.pts.map(p => ({ x: p.x, y: p.y })));
        pc.cx = pc.x; pc.cy = pc.y;
        pc.rotTarget = rand(-0.05, 0.05);
        pc.offset = 0; pc.rot = 0; pc.scale = L.scale;
        const len = Math.hypot(pc.cx, pc.cy) || 1;
        pc.sep = { x: pc.cx / len, y: pc.cy / len };
        pc.art = L.art ? Object.assign({}, L.art, {
          off: { x: L.art.off.x + pc.x, y: L.art.off.y + pc.y }
        }) : null;
        return pc;
      });
      audio.crack();
      hitStop(CFG.juice.stopHit * 0.6);
      punch(CFG.juice.punchHit * 0.7, 280, L.pos.x, L.pos.y);
      setState('LEVEL_2_SUCCESS');
      return;
    }

    if (!isMainDiagonal(i, j)) return rejectCut('shortDiagonal', pts[i], pts[j], i, j);

    const lo = Math.min(i, j), hi = Math.max(i, j);
    const [pa, pb] = PolygonCutManager.split(L.pts, lo, hi);
    L.pieces = [PolygonCutManager.toPiece(pa), PolygonCutManager.toPiece(pb)];
    L.cut = [lo, hi];
    const vi = L.pts[lo], vj = L.pts[hi];
    let nx = -(vj.y - vi.y), ny = (vj.x - vi.x);
    const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
    L.pieces.forEach(pc => {
      pc.cx = pc.x; pc.cy = pc.y;
      pc.art = L.art ? Object.assign({}, L.art, {
        off: { x: L.art.off.x + pc.x, y: L.art.off.y + pc.y }
      }) : null;
      const side = Math.sign((pc.cx - vi.x) * nx + (pc.cy - vi.y) * ny) || 1;
      pc.sep = { x: nx * side, y: ny * side };
      pc.rotTarget = rand(-0.06, 0.06);
      pc.offset = 0; pc.rot = 0; pc.scale = L.scale;
    });
    audio.crack();
    hitStop(CFG.juice.stopHit * 0.6);
    punch(CFG.juice.punchHit * 0.7, 280, L.pos.x, L.pos.y);
    setState('LEVEL_2_SUCCESS');
  }

  function planFlight() {
    const L = G.l2;
    const gaps = [G.gapA, G.gapB].filter(Boolean);
    const slots = gaps.reduce((a, g) => a.concat((g.slots || []).map(s => ({ s, g }))), [])
                      .sort((a, b) => a.s.x0 - b.s.x0);
    const order = L.pieces.slice().sort((a, b) => a.x - b.x);
    order.forEach((pc, idx) => {
      const pair = slots[idx];
      if (!pair) return;
      const g = pair.g, slot = pair.s;
      let bi = 0, bl = -1;
      for (let k = 0; k < pc.local.length; k++) {
        const a = pc.local[k], b = pc.local[(k + 1) % pc.local.length];
        const l = Math.hypot(b.x - a.x, b.y - a.y);
        if (l > bl) { bl = l; bi = k; }
      }
      const a = pc.local[bi], b = pc.local[(bi + 1) % pc.local.length];
      let rot = -Math.atan2(b.y - a.y, b.x - a.x);
      // after the turn the body must be BELOW that edge, not hanging off the top of it
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const rotate = (p, r) => ({ x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) });
      if (rotate(mid, rot).y > 0) rot += Math.PI;
      pc.seatRot = rot;
      pc.seatPts = pc.local.map(p => rotate(p, rot));
      pc.cutLen = bl;
      pc.gap = g; pc.slot = slot;
      pc.flyFrom = { x: pc.x, y: pc.y, rot: pc.rot, scale: pc.scale };
      const sb = polyBounds(pc.seatPts);
      const fit = Math.min(1, sb.h > 0 ? (CFG.H - CFG.surfaceY - 6) / sb.h : 1);
      const gx = (slot.x0 + slot.x1) / 2 - G.worldX;
      pc.flyTo = {
        x: gx,
        y: CFG.surfaceY + PLUG_SINK - sb.y0 * fit,
        rot, scale: fit
      };
      pc.fit = fit;
    });
  }

  const L2_FALL_V0 = 130;

  function updateL2(dt) {
    const L = G.l2; if (!L) return;
    L.cornerPulse = Math.max(0, L.cornerPulse - dt * 1.4);
    L.shake = Math.max(0, (L.shake || 0) - dt * 3.4);
    if (!L.fall && L.form < 1) {
      const was = L.form;
      L.form = clamp(L.form + dt * 1000 / (L2.formMs || 900), 0, 1);
      // frost kicked up off the pillar as it starts, and the ice sealing as it closes
      if (was <= 0 && !reduced) particles.frost(L.pos.x, CFG.surfaceY - 6, 8);
      if (L.form >= 1) {
        audio.seal();
        if (!reduced) particles.sparkle(L.pos.x, L.pos.y, 6, 110);
      }
    }
    if (G.state === 'LEVEL_2_ACTIVE') L.wantReveal = true;
    L.reveal = clamp((L.reveal || 0) + (L.wantReveal ? dt * 3.2 : 0), 0, 1);
    if (L.shear) { L.shear.t += dt; if (L.shear.t > 0.9) L.shear = null; }
    if (L.badLine) { L.badLine.t += dt; if (L.badLine.t > 0.65) L.badLine = null; }

    if (G.state === 'LEVEL_2_OVERVIEW') {
      const p = clamp((G.st - (L2.overviewMs - (L2.glowMs || 620))) / (L2.glowMs || 620), 0, 1);
      L.glow = easeOut(p);
      L.pop = easeBackOut(clamp((G.st - (L2.overviewMs - (L2.popMs || 420))) / (L2.popMs || 420), 0, 1));
      L.scale = restK() * (1 + ((p2Cfg().popK || L2.popK) - 1) * L.pop);
      return;
    }

    if (L.fall) {
      const f = L.fall;
      f.t += dt;
      const wy = CFG.surfaceY + CFG.levelOne.waterDepth;

      if (f.phase === 'return') {
        const e = easeInOut(clamp(f.t / 0.26, 0, 1));
        L.pos.x = lerp(f.from.x, L.home.x, e);
        L.pos.y = lerp(f.from.y, L.home.y, e);
        L.scale = lerp(f.from.scale, restK(), e);
        L.spin = 0;
        if (L.debris) for (const pc of L.debris) {
          pc.x = L.pos.x + pc.cx * L.scale;
          pc.y = L.pos.y + pc.cy * L.scale;
          pc.scale = L.scale;
          pc.rot = 0;
          pc.offset = 10 * e;          // they part a little as it shears
        }
        // a shiver on the way back, so it plainly is not going to survive this
        L.shake = Math.max(L.shake || 0, 0.7);
        if (f.t >= 0.26) {
          f.phase = 'drop'; f.t = 0;
          f.from = { x: L.home.x, y: L.home.y, scale: restK() };
          audio.crack();
          particles.chips(L.home.x, L.home.y + 40, 8, -120);
        }
        return;
      }

      const mouthY = CFG.surfaceY - 34;
      if (!f.knocked && !f.splashed &&
          f.from.y + 0.5 * L1.dropGravity * 0.55 * f.t * f.t >= mouthY) {
        f.knocked = true;
        particles.chips(L.pos.x, CFG.surfaceY, reduced ? 3 : 6, -120);
      }
      const drop = L2_FALL_V0 * f.t + 0.5 * L1.dropGravity * 0.55 * f.t * f.t;
      L.pos.x = f.from.x + f.vx * f.t;
      L.pos.y = f.from.y + drop;
      L.spin = f.spin * f.t;
      if (L.debris) {
        for (const pc of L.debris) {
          pc.x = f.from.x + pc.cx * f.from.scale + pc.vx * f.t;
          pc.y = f.from.y + pc.cy * f.from.scale + drop;
          pc.rot = pc.spin * f.t;
          pc.scale = f.from.scale;
        }
      }
      if (!f.splashed && L.pos.y >= wy) {
        f.splashed = true;
        audio.splash();
        particles.splash(L.pos.x, wy, reduced ? 12 : 30);
        particles.frost(L.pos.x, wy - 20, reduced ? 3 : 7);
        shake(reduced ? 1 : 3, 240);
        punch(CFG.juice.punchHit * 0.5, 260, L.pos.x, wy);
        mammoth.scare = 0;
        mammoth.startle(reduced ? 0.55 : 1);
      }
      // once it is under the water it is gone; bring the next one down
      if (L.pos.y > wy + 200) {
        f.holdT = (f.holdT || 0) + dt;
        const done = mammoth.state !== 'SHAKE';
        if ((done && f.holdT * 1000 > 260) || f.holdT * 1000 > (L2.afterFallMs || 3000)) rebuildSlab();
      }
      return;
    }

    if (L.respawn > 0) {
      L.respawn = Math.max(0, L.respawn - dt * 1000 / (L2.respawnMs || 1100));
      const e = easeOut(1 - L.respawn);
      L.pos.x = L.home.x;
      L.pos.y = lerp(-260, L.home.y, e);
      L.scale = restK();
      if (L.respawn <= 0) {
        L.pos.y = L.home.y;
        audio.clunk();
        particles.poof(L.pos.x, CFG.surfaceY, reduced ? 2 : 4, 0.7);
      }
      return;
    }

    if (['LEVEL_2_FOCUS', 'LEVEL_2_ACTIVE', 'LEVEL_2_WRONG_FEEDBACK'].includes(G.state)) {
      const C = p2Cfg();
      const p = G.state === 'LEVEL_2_FOCUS' ? clamp(G.st / (C.focusMs || T.focus), 0, 1) : 1;
      const e = easeInOut(p);
      L.focusT = e;
      L.glow = Math.max(0, (L.glow || 0) - dt * 1.6);
      L.pos.x = lerp(L.home.x, CFG.W * C.focusX, e);
      L.pos.y = lerp(L.home.y, CFG.H * C.focusY, e);
      L.scale = lerp(C.popK * restK(), C.focusK, e);
    }
  }

  function rebuildSlab() {
    const wrong = G.l2 ? G.l2.wrong : 0;
    buildLevel2(true);
    if (!G.l2) return;
    G.l2.wrong = wrong;
    G.l2.respawn = 0;
    setState('LEVEL_2_OVERVIEW');
  }

  function updateL2Success(dt) {
    const L = G.l2; if (!L || !L.pieces) return;
    const splitEnd = T.split;
    const holdEnd = splitEnd + (L2.holdMs || 200);
    const unfocusEnd = holdEnd + (L2.unfocusMs || 320);
    const flyEnd = unfocusEnd + T.fly;
    const place = () => L.pieces.forEach(pc => {
      pc.x = L.pos.x + pc.cx * L.scale; pc.y = L.pos.y + pc.cy * L.scale; pc.scale = L.scale;
    });

    if (G.st <= splitEnd) {
      L.split = clamp(G.st / splitEnd, 0, 1);
      place();
      L.pieces.forEach(pc => { pc.offset = L.split * 15; pc.rot = pc.rotTarget * L.split; });
      if (G.st > splitEnd * 0.5 && !L.chipped) { L.chipped = true; particles.chips(L.pos.x, L.pos.y, 6, -140); }
      return;
    }
    L.split = 1;
    if (G.st <= unfocusEnd) {
      const q = clamp((G.st - holdEnd) / (unfocusEnd - holdEnd), 0, 1), e = easeInOut(q);
      const C = p2Cfg();
      const home = L.seat || L.home;
      L.scale = lerp(C.focusK, 1, e);
      L.pos.x = lerp(CFG.W * C.focusX, home.x, e);
      L.pos.y = lerp(CFG.H * C.focusY, home.y, e);
      L.focusT = 1 - e;
      place();
      return;
    }
    if (!L.planned) {
      L.planned = true; L.focusT = 0;
      const home = L.seat || L.home;
      L.scale = 1; L.pos.x = home.x; L.pos.y = home.y;
      place(); planFlight();
    }
    if (G.st <= flyEnd) {
      const q = clamp((G.st - unfocusEnd) / T.fly, 0, 1), e = easeInOut(q);
      L.pieces.forEach(pc => {
        if (!pc.flyFrom || !pc.flyTo) return;
        pc.x = lerp(pc.flyFrom.x, pc.flyTo.x, e);
        pc.y = lerp(pc.flyFrom.y, pc.flyTo.y, e);
        pc.rot = lerp(pc.flyFrom.rot, pc.flyTo.rot, e) + Math.sin(q * Math.PI) * 0.22;
        pc.scale = lerp(pc.flyFrom.scale, pc.flyTo.scale, e);
        pc.offset = (1 - e) * 15;
      });
      if (q > 0.94 && !L.locked) {
        L.locked = true;
        audio.clunk(); audio.seal(); atmos.pulse();
        L.pieces.forEach(pc => { if (pc.flyTo) particles.frost(pc.flyTo.x, CFG.surfaceY, 4); });
        shake(reduced ? 1 : 2.5, 170);
        hitStop(CFG.juice.stopHit * 0.5);
      }
      return;
    }
    if (!L.seated) {
      L.seated = true;
      L.pieces.forEach(pc => {
        const g = pc.gap; if (!g || !pc.seatPts) return;
        // the slot this piece was flown to, so several in one crevasse keep their lanes
        const sl = pc.slot || (g.slots && g.slots[0]) || { x0: g.x0, x1: g.x1 };
        const sb = polyBounds(pc.seatPts);
        const sr = pc.seatRot || 0, cs = Math.cos(sr), sn = Math.sin(sr);
        const art = pc.art ? Object.assign({}, pc.art, {
          rot: sr,
          off: { x: pc.art.off.x * cs - pc.art.off.y * sn,
                 y: pc.art.off.x * sn + pc.art.off.y * cs }
        }) : null;
        const marks = pc.marks ? pc.marks.map(([p, q]) => [
          { x: p.x * cs - p.y * sn, y: p.x * sn + p.y * cs },
          { x: q.x * cs - q.y * sn, y: q.x * sn + q.y * cs }
        ]) : null;
        g.pieces.push({
          kind: 'half', pts: pc.seatPts, seed: (pc.local.length * 131) | 0, art, marks,
          topLocal: sb.y0, rot0: 0, rot: 0,
          grow: 0, fit: pc.fit || 1, impact: 1,
          cx: (sl.x0 + sl.x1) / 2, cy: CFG.surfaceY,
          x0: sl.x0, x1: sl.x1, full: true
        });
        sl.filled = true;
        if (g.slots.every(s => s.filled)) { g.repaired = true; g.bridge = 0; }
      });
      L.pieces = null;                // the halves are the crossing now, not the slab
      setState('BRIDGE_2_COMPLETE');
    }
  }

  function drawL2Piece(ctx, pc) {
    ctx.save();
    ctx.translate(pc.x + (pc.offset || 0) * (pc.sep ? pc.sep.x : 0),
                  pc.y + (pc.offset || 0) * (pc.sep ? pc.sep.y : 0));
    ctx.rotate(pc.rot || 0);
    ctx.scale(pc.scale || 1, pc.scale || 1);
    if (pc.art) paintGlacierChunk(ctx, { pts: pc.local, art: pc.art, seed: 13 }, false, 1 / (pc.scale || 1));
    else paintIce(ctx, pc.local, ICE_PIECE);
    if (pc.marks) {
      const inv = 1 / (pc.scale || 1);
      ctx.save();
      ctx.lineCap = 'round';
      for (const [a, b] of pc.marks) {
        ctx.strokeStyle = 'rgba(20,70,120,0.75)'; ctx.lineWidth = 8 * inv;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3 * inv;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawSlabForming(ctx, L) {
    const b = polyBounds(L.pts);
    const e = easeOut(clamp(L.form, 0, 1));
    const inv = 1 / (L.scale || 1);
    const rnd = n => { const s = Math.sin(31.7 + n * 78.233) * 43758.5453; return s - Math.floor(s); };

    const y = b.y1 + 16 - (b.h + 32) * e;
    const teeth = clamp(Math.round(b.w / 26), 5, 26);
    const step = (b.w + 40) / teeth;
    const front = new Path2D();
    front.moveTo(b.x0 - 20, b.y1 + 40);
    front.lineTo(b.x0 - 20, y);
    for (let i = 0; i < teeth; i++) {
      const x = b.x0 - 20 + i * step;
      front.lineTo(x + step * 0.5, y - (7 + rnd(i) * 24));
      front.lineTo(x + step, y);
    }
    front.lineTo(b.x1 + 20, b.y1 + 40);
    front.closePath();

    // the block's own outline, so nothing the front draws escapes the shape
    const body = new Path2D();
    L.pts.forEach((q, i) => { if (i === 0) body.moveTo(q.x, q.y); else body.lineTo(q.x, q.y); });
    body.closePath();

    // THE BLOCK, up to the front and no further
    ctx.save();
    ctx.clip(front);
    paintGlacierChunk(ctx, { pts: L.pts, art: L.art, seed: 11 }, false, inv);
    ctx.restore();

    ctx.save();
    ctx.clip(body);

    const rime = ctx.createLinearGradient(0, y - 40, 0, y + 150);
    rime.addColorStop(0, `rgba(236,251,255,${(0.62 * (1 - e * 0.55)).toFixed(3)})`);
    rime.addColorStop(1, 'rgba(236,251,255,0)');
    ctx.save();
    ctx.clip(front);
    ctx.fillStyle = rime;
    ctx.fillRect(b.x0 - 24, y - 44, b.w + 48, 200);
    ctx.restore();

    if (!reduced) {
      for (let i = 0; i < teeth; i++) {
        const x = b.x0 - 20 + i * step + step * 0.5;
        const root = y - (7 + rnd(i) * 24);
        const len = (16 + rnd(i + 11) * 34);
        const lean = (rnd(i + 23) - 0.5) * 0.8;
        const tx = x + Math.sin(lean) * len, ty = root - Math.cos(lean) * len;
        const w = (2.6 + rnd(i + 37) * 3.4);
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.beginPath();
        ctx.moveTo(x - w, root + 4);
        ctx.lineTo(tx, ty);
        ctx.lineTo(x + w, root + 4);
        ctx.closePath();
        ctx.fill();
        // a barb, so it is a crystal and not a spike
        if (len > 30) {
          const side = rnd(i + 53) > 0.5 ? 1 : -1;
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 2 * inv;
          ctx.beginPath();
          ctx.moveTo(x + (tx - x) * 0.5, root + (ty - root) * 0.5);
          ctx.lineTo(x + (tx - x) * 0.5 + side * len * 0.3, root + (ty - root) * 0.5 - len * 0.16);
          ctx.stroke();
        }
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 4 * inv;
    ctx.stroke(front);
    ctx.restore();

    const seal = clamp((L.form - 0.76) / 0.24, 0, 1);
    if (seal > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${(0.85 * Math.sin(seal * Math.PI)).toFixed(3)})`;
      ctx.lineWidth = 7 * inv;
      ctx.stroke(body);
      ctx.restore();
    }
  }

  function drawL2(ctx, below = null) {
    const L = G.l2; if (!L) return;
    if (L.pieces) { L.pieces.forEach(pc => drawL2Piece(ctx, pc)); return; }
    if (L.seated) return;              // the halves belong to the crossing now

    if (L.debris && L.fall) {
      for (const pc of L.debris) {
        if (below !== null && (pc.y > CFG.surfaceY) !== below) continue;
        drawL2Piece(ctx, pc);
      }
      return;
    }
    // the slab is whole: it is one object, so its own centre decides, as before
    if (below === true) return;
    const shakeX = (L.shake || 0) ? Math.sin(G.t * 46) * 7 * L.shake : 0;
    ctx.save();
    ctx.translate(L.pos.x + shakeX, L.pos.y);
    if (L.spin) ctx.rotate(L.spin);
    ctx.scale(L.scale, L.scale);
    if (L.glow > 0.01) {
      ctx.shadowColor = `rgba(150,225,255,${(0.9 * L.glow).toFixed(3)})`;
      ctx.shadowBlur = 42 * L.glow;
    }
    if (L.form !== undefined && L.form < 1) drawSlabForming(ctx, L);
    else paintGlacierChunk(ctx, { pts: L.pts, art: L.art, seed: 11 }, false, 1 / (L.scale || 1));
    if (L.shear) {
      const k = clamp(L.shear.t / 0.18, 0, 1);
      const inv = 1 / (L.scale || 1);
      // the endpoints were captured in stage space; bring them into the slab's frame
      const toLocal = p => ({ x: (p.x - L.pos.x) * inv, y: (p.y - L.pos.y) * inv });
      const a = toLocal(L.shear.a), b = toLocal(L.shear.b);
      ctx.save();
      ctx.globalAlpha = clamp(1 - (L.shear.t - 0.3) / 0.6, 0, 1);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(20,70,120,0.85)';
      ctx.lineWidth = 7 * inv;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(lerp(a.x, b.x, k), lerp(a.y, b.y, k));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 3 * inv;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // nothing to take hold of while it is falling or arriving
    if (L.fall || L.respawn > 0) return;

    const pts = hexScreenPts();
    if (L.reveal > 0.01) {
      const a = Math.max(L.cornerPulse, 0.34) * L.reveal;
      const breath = 0.5 + 0.5 * Math.sin(G.t * 2.3);
      const k = 1 + (L.scale - 1) * 0.12;
      const R0 = 13 * k, R1 = 18 * k;
      pts.forEach((p, i) => {
        const held = L.dragFrom === i && !!L.dragPt;
        const r = (held ? R1 : R0) * (1 + (held ? 0 : 0.06 * breath));
        const alpha = held ? 1 : 0.62 * a + 0.3;
        ctx.save();
        ctx.globalAlpha = alpha;
        // the halo: what makes it read as lit rather than drawn on
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.9, 0, 6.2832);
        const halo = ctx.createRadialGradient(p.x, p.y, r * 0.5, p.x, p.y, r * 1.9);
        halo.addColorStop(0, `rgba(160,230,255,${(0.5 + 0.25 * breath).toFixed(3)})`);
        halo.addColorStop(1, 'rgba(160,230,255,0)');
        ctx.fillStyle = halo; ctx.fill();
        // the bead
        const g2 = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
        g2.addColorStop(0, '#FFFFFF');
        g2.addColorStop(0.55, '#E8F8FF');
        g2.addColorStop(1, '#9AD9F5');
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832);
        ctx.fillStyle = g2; ctx.fill();
        ctx.lineWidth = 3.5 * k;
        ctx.strokeStyle = held ? '#2D82B5' : 'rgba(45,130,181,0.85)';
        ctx.stroke();
        // the catchlight, which is what makes a circle read as a bead
        ctx.beginPath();
        ctx.arc(p.x - r * 0.33, p.y - r * 0.38, r * 0.26, 0, 6.2832);
        ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
        if (held && L.cornerPulse > 0.01) {
          const e = 1 - L.cornerPulse / 0.8;
          ctx.globalAlpha = alpha * (1 - e) * 0.8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * (1 + e * 1.6), 0, 6.2832);
          ctx.lineWidth = 3 * k;
          ctx.strokeStyle = 'rgba(190,240,255,0.95)';
          ctx.stroke();
        }
        ctx.restore();
      });
    }

    if (L.demo && !L.pieces && G.state === 'LEVEL_2_ACTIVE' && !G.attempts) {
      const n = L.pts.length, j = n / 2;
      if (Number.isInteger(j)) {
        const a = pts[0], b = pts[j];
        const t = (G.t % 1.6) / 1.6;
        ctx.save();
        ctx.lineCap = 'round';
        // the path, faint and marching
        ctx.setLineDash([16, 14]);
        ctx.lineDashOffset = -G.t * 90;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.setLineDash([]);
        // and a finger running it, so the direction is unambiguous
        const e = easeInOut(clamp(t * 1.35, 0, 1));
        const fx = lerp(a.x, b.x, e), fy = lerp(a.y, b.y, e);
        const fade = Math.sin(Math.min(1, t * 1.35) * Math.PI);
        ctx.globalAlpha = 0.85 * fade;
        ctx.beginPath(); ctx.arc(fx, fy, 15, 0, 6.2832);
        ctx.fillStyle = '#FFFFFF'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(45,130,181,0.9)'; ctx.stroke();
        ctx.restore();
      }
    }

    if (L.drawn && L.drawn.length) {
      ctx.save();
      ctx.lineCap = 'round';
      for (const key of L.drawn) {
        const [a, b] = key.split('-').map(Number);
        const p = pts[a], q = pts[b];
        if (!p || !q) continue;
        ctx.strokeStyle = 'rgba(20,70,120,0.8)';
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
      ctx.restore();
    }

    // the line being drawn, following the finger
    if (L.dragPt && L.dragStart) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(L.dragStart.x, L.dragStart.y); ctx.lineTo(L.dragPt.x, L.dragPt.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(140,220,250,0.9)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }

    if (L.badLine && Number.isFinite(L.badLine.b.x) && Number.isFinite(L.badLine.b.y)) {
      const a = clamp(1 - L.badLine.t / 0.65, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = 6 + Math.sin(L.badLine.t * 30) * 1.5;
      ctx.beginPath(); ctx.moveTo(L.badLine.a.x, L.badLine.a.y); ctx.lineTo(L.badLine.b.x, L.badLine.b.y); ctx.stroke();
      if (L.badLine.kind === 'side') {
        const mx = (L.badLine.a.x + L.badLine.b.x) / 2, my = (L.badLine.a.y + L.badLine.b.y) / 2;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(mx - 14, my - 14); ctx.lineTo(mx + 14, my + 14);
        ctx.moveTo(mx + 14, my - 14); ctx.lineTo(mx - 14, my + 14);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  const AV_N = 210;
  function drawAvalanche(ctx) {
    if (G.state !== 'AVALANCHE') return;
    const roar = T.avalancheRoar, sweep = T.avalancheSweep, settle = T.avalancheSettle;
    const total = roar + sweep + settle;
    const t = G.st;
    const rise = easeOut(clamp(t / (roar * 1.25), 0, 1));
    const fade = easeInOut(clamp((total - t) / settle, 0, 1));
    const amp = Math.min(rise, fade);
    if (amp <= 0.01) return;

    const sec = t / 1000;
    const q = clamp((t - roar) / (sweep + settle), 0, 1);
    const him = CFG.mammothX + (G.avLead || 0);
    const front = Math.min(lerp(-620, him + 420, Math.pow(q, 0.8)), him - 340);
    ctx.save();

    for (let i = 0; i < AV_N; i++) {
      const seed = i * 12.9898;
      const r1 = (Math.sin(seed) * 43758.5453) % 1;
      const r2 = (Math.sin(seed * 1.7 + 4.1) * 24634.6345) % 1;
      const r3 = (Math.sin(seed * 2.3 + 9.7) * 15731.743) % 1;
      const a1 = Math.abs(r1), a2 = Math.abs(r2), a3 = Math.abs(r3);

      const lane = a1;                                   // 0 = left of the pass, 1 = right
      const speed = 0.55 + a2 * 0.75;
      const phase = (sec * speed * 0.62 + a3) % 1;       // 0 at the ridge, 1 at the foot

      const yFrac = clamp((-220 + phase * (CFG.H + 300)) / CFG.H, 0, 1);
      const lean = (1 - yFrac) * 620;
      const back = lane;
      const x = front + lean - back * 920
              + Math.sin(sec * 1.6 + i) * 26;            // turbulence
      const y = -220 + phase * (CFG.H + 300)
              + Math.cos(sec * 1.9 + i * 0.7) * 18;

      // it fattens as it falls and thins again at the foot, so the mass has a shape
      const grow = Math.sin(clamp(phase, 0, 1) * Math.PI);
      const r = (58 + a2 * 74) * (0.45 + grow * 0.85);

      const body = clamp(back / 0.08, 0, 1) * clamp(1 - (back - 0.55) / 0.55, 0, 1);
      if (body <= 0.01) continue;

      const dens = amp * body * (0.52 + grow * 0.72) * (0.6 + a1 * 0.5);
      if (dens <= 0.01) continue;

      // the body: a cool grey-blue, so the mass has weight and does not blow out
      const sh = ctx.createRadialGradient(x, y, 0, x, y, r);
      sh.addColorStop(0, `rgba(196,219,238,${(0.78 * dens).toFixed(3)})`);
      sh.addColorStop(0.55, `rgba(206,228,244,${(0.46 * dens).toFixed(3)})`);
      sh.addColorStop(1, 'rgba(206,228,244,0)');
      ctx.fillStyle = sh;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();

      // the lit crown, up and to the left, where the sun is
      const lx = x - r * 0.26, ly = y - r * 0.3, lr = r * 0.78;
      const li = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      li.addColorStop(0, `rgba(255,255,255,${(0.92 * dens).toFixed(3)})`);
      li.addColorStop(0.6, `rgba(250,253,255,${(0.38 * dens).toFixed(3)})`);
      li.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = li;
      ctx.beginPath(); ctx.arc(lx, ly, lr, 0, 6.2832); ctx.fill();
    }

    ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const a1 = Math.abs((Math.sin(i * 7.13) * 43758.5453) % 1);
      const a2 = Math.abs((Math.sin(i * 3.71 + 2.2) * 24634.6345) % 1);
      const ph = (sec * (1.5 + a2 * 1.4) + a1) % 1;
      const sy = -140 + ph * (CFG.H + 220);
      // the same forward lean the billows have, so the snow stays inside the wall
      const sx = front + (1 - clamp(sy / CFG.H, 0, 1)) * 620 - a1 * 900;
      const len = 34 + a2 * 62;
      // hung off the front like the billows, so the snow is always inside the wall
      const al = amp * 0.62 * Math.sin(clamp(ph, 0, 1) * Math.PI) * clamp(1 - a1 / 0.85, 0, 1);
      if (al <= 0.02) continue;
      ctx.strokeStyle = `rgba(255,255,255,${al.toFixed(3)})`;
      ctx.lineWidth = 2 + a2 * 3;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + len * 0.55, sy + len);      // the lean, matching the billows
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = amp * 0.8 * clamp((t - roar * 0.4) / roar, 0, 1);
    const hx = clamp(front, -400, CFG.W + 400);
    const veil = ctx.createLinearGradient(hx - 1500, 0, hx + 60, 0);
    veil.addColorStop(0, 'rgba(238,248,255,0.88)');
    veil.addColorStop(0.62, 'rgba(238,248,255,0.42)');
    veil.addColorStop(1, 'rgba(238,248,255,0)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    ctx.restore();
  }

  /* ---- loop ---- */
  function frame(ts) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    if (!last) last = ts;
    let dt = (ts - last) / 1000; last = ts;
    if (paused) return;
    guardScale(dt);
    dt = Math.min(Math.max(dt, 0), 0.2);
    const steps = Math.max(1, Math.ceil(dt * 30));
    for (let i = 0; i < fastForward; i++)
      for (let step = 0; step < steps; step++) update(dt / steps);
    if (!(hooks.hidden && hooks.hidden())) render();
  }

  function resetAll() {
    G.state = 'BOOT'; G.st = 0; G.worldX = 0; G.dist = 0; G.progress = 0; G.t = 0;
    G.speedFactor = 1; G.shake = 0; G.shakeT = 0; G.moving = true;
    G.instruction = ''; G.jumpEnabled = false;
    G.complete = false; G.l1 = null; G.attempts = 0; G.idle = 0;
    G.level = 1; G.l2 = null; G.gapA = null; G.gapB = null; G.p2i = 0; G.subline = '';
    G.phase = 0; G.phasesDone = 0; G.gapsThisPhase = null; G.phaseLayout = null; G.phaseJumped = false;
    G.oops = false; G.hitFx = 0; G.hitObstacle = null; G.hitReturn = null; G.hitCount = 0;
    G.handHint = null; G.idleHand = 0; G.dropReady = false; G.introT = 0; G.stageBeat = 0; G.signSay = ''; G.saidQuestion = '';
    G.stompF = -1; G.stomps = 0; G.invincibleT = 0; G.jumpArmed = false;
    G.shakeAmp = 0; G.shakeLen = 0;
    G.quakeT = 0; G.quakeAmp = 0; G.quakeLen = 0; G.quakePeak = 0; G.quakeAt = 0;
    G.freeze = 0; G.punchAmp = 0; G.punchT = 0; G.punchLen = 0; G.punchAt = 0;
    G.bearAt = 0;                   // the friend is not placed until the run home
    G.avT = 0; G.avX = -760; G.avRoared = false; G.avPuff = 0;
    G.retryRun = false; G.runLeadMs = 0;
    slash = null; brk = null; taps.length = 0; audio.stopSay();
    ground.reset(); obstacles.reset(); particles.clear(); mammoth.reset(); bgm.reset();
    atmos.intensity = 0; atmos.flash = 0;
    audio.setDuck(1);
    setState('AVALANCHE');
  }

  const api = {
    jump() {
      audio.start(); audio.resume();
      if (!G.jumpEnabled) return;
      if (paused) { if (pausedAsking) G.jumpArmed = true; return; }
      mammoth.requestJump(performance.now());
    },
    restart() { resetAll(); },
    /** Hand over from the title/select screens into the run. */
    begin() { resetAll(); },
    /** Retry the obstacle just walked into. Never restarts the journey. */
    retryObstacle() { if (G.state === 'OBSTACLE_HIT') retryObstacle(); },
    /** The playable roster, for the selection screen. */
    roster: () => CFG.characters.map(c => ({
      id: c.id, name: c.name, tag: c.tag, blurb: c.blurb,
      theme: c.theme, theme2: c.theme2, stats: c.stats
    })),
    character: () => characterId,
    sfx(name) { audio.start(); audio.resume(); if (typeof audio[name] === 'function') audio[name](); },
    /** A character's sheet URL + frame count, for portraits and DOM panels. */
    sheetFor(id, slot) {
      const cid = id || characterId;
      const img = images[cid + ':' + slot];
      if (!img) return null;
      const ch = CFG.characters.find(c => c.id === cid);
      const kc = CFG.sprite.cellK || 1;
      return { src: (img.dataset && img.dataset.asset) || img.src, frames: ch ? (ch.frames[slot] || 1) : 1,
               cw: CFG.sprite.cw * kc, ch: CFG.sprite.ch * kc, cols: CFG.sprite.cols || 6 };
    },
    /** The backbuffer's pixel scale (1..2); see setRenderScale in createGame. */
    setRenderScale(k) { setRenderScale(k); },
    renderScale: () => rs,
    /** Which character art set was loaded: 'hd' (1.5x cells) or 'base'. */
    artSet: () => hdArt ? 'hd' : 'base',
    setDialogue(v) { G.dialogue = !!v; },
    setPaused(v, opts) { paused = v; pausedAsking = !!(v && opts && opts.asking); if (!v) last = 0; },
    isPaused: () => paused,
    suspendAudio() {
      if (audio.music) audio.music.el.pause();
      if (audio.ctx && audio.ctx.state === 'running' && audio.ctx.suspend) {
        const p = audio.ctx.suspend(); if (p && p.catch) p.catch(() => {});
      }
    },
    fadeMusic(ms = 900) { audio._musicTo(0, ms); },
    unlockAudio() {
      try {
        audio.start(); audio.resume();
        if (audio.ctx) {
          const b = audio.ctx.createBuffer(1, 1, 22050), src = audio.ctx.createBufferSource();
          src.buffer = b; src.connect(audio.ctx.destination); src.start(0);
        }
        if (audio.held && audio.music && audio.music.el.paused) {
          const el = audio.music.el; el.muted = true;
          const q = el.play();
          const back = () => { if (audio.held) el.pause(); el.muted = false; };
          if (q && q.then) q.then(back, back); else back();
        }
        return !!(audio.ctx && audio.ctx.state === 'running');
      } catch (e) { return false; }
    },
    holdAudio(on) {
      audio.held = !!on;
      try {
        if (audio.master && audio.ctx) audio.master.gain.setTargetAtTime(on ? 0 : (audio.enabled ? 0.7 : 0), audio.ctx.currentTime, on ? 0.01 : 0.12);
        if (on) { if (audio.music) audio.music.el.pause(); }
        else if (audio.enabled) {
          if (audio.ctx && !audio.music) audio.startMusic();
          if (audio.music && audio.music.el.paused) { const q = audio.music.el.play(); if (q && q.catch) q.catch(() => {}); }
        }
      } catch (e) { /* no audio here */ }
    },
    resumeAudio() {
      if (!audio.enabled) return;
      audio.resume();
      if (audio.music) { const p = audio.music.el.play(); if (p && p.catch) p.catch(() => {}); }
    },
    /** Sound on/off from the HUD. Returns the new state. */
    toggleSound() {
      audio.start(); audio.resume();
      audio.enabled = !audio.enabled;
      if (audio.master) audio.master.gain.setTargetAtTime(audio.enabled ? 0.7 : 0, audio.ctx.currentTime, 0.05);
      audio.kitMute(!audio.enabled);
      if (audio.music) {
        if (audio.enabled) { const p = audio.music.el.play(); if (p && p.catch) p.catch(() => {}); }
        else audio.music.el.pause();
      }
      if (audio.enabled) audio.ui();
      return audio.enabled;
    },
    soundOn: () => !!audio.enabled,
    /** Re-show the current instruction, for a learner who has forgotten it. */
    saySign(text, dur) { G.signSay = text || ''; if (text) G.voDur = dur || 0; },
    say(id) { audio.start(); audio.resume(); return audio.say(id); },
    voWords(id) { const L = audio.voLine(id); return (L && L.words) ? L.words.slice() : null; },
    voAt(id) { return audio.sayingAt(id); },
    voComing(id) { return audio.voComing(id); },
    replayInstruction() {
      if (!G.instruction) return false;
      armInstruction(T.instructionHold);
      G.instrLast = '';               // forces the banner to re-enter
      audio.ui();
      return true;
    },
    setOptions(o) {
      if (o.sound !== undefined) {
        audio.enabled = !!o.sound;
        if (audio.master) audio.master.gain.value = o.sound ? 0.7 : 0;
        audio.kitMute(!o.sound);
        if (audio.music && !o.sound) audio.music.el.pause();
      }
      if (o.reduced !== undefined) reduced = !!o.reduced || mqReduced;
      if (o.speed) CFG.runSpeed = o.speed;
      if (o.fast !== undefined) fastForward = clamp(Math.round(o.fast) || 1, 1, 8);
      if (o.dev !== undefined) devTools = !!o.dev;
    },
    get paused() { return paused; },
    destroy() {
      destroyed = true; cancelAnimationFrame(raf);
      if (audio.music) { audio.music.el.pause(); audio.music.el.src = ''; }
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('lostpointercapture', onCancel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', invalidateRect);
      window.removeEventListener('orientationchange', invalidateRect);
      if (audio.ctx) audio.ctx.close();
    },
    state: () => G.state,
    mammothState: () => mammoth && mammoth.state,
    mammothFrame: () => mammoth ? mammoth.lastSheet + ':' + mammoth.lastFrame : '-',
    debug: () => G,
    obstacleName(kind) { return kind < 2 ? 'rock' : ((OBSTACLE_ART[kind - 2] || 'rock').split('-')[0]); },
    warmAudio() { try { audio.start(); } catch (e) { /* no audio here */ } },
    loadProgress: fn => NET.onProgress(fn),
    /** Settles once every file on the list is in (or has failed, which counts as in). */
    loaded: NET.done,
    renderFocus(target, kind) { renderFocus(target, kind); },
    _rig: () => ({
      swing: rigSwing(), swayRad: CFG.comedy.swayRad,
      bows: ((G.l1 && G.l1.shapes) || []).filter(s => s.state === 'hang').map(s => ropeBow(s))
    }),
    _cutGuide: i => { const L = G.l1; const sh = L && L.shapes[i]; return sh ? cutGuide(sh) : null; },
    _snow: () => ({
      far: atmos.far.length, mid: atmos.mid.length, near: atmos.near.length,
      sprite: !!Atmosphere.flake(),
      drawnPx: atmos.near.map(f => +(f.r * Atmosphere.FLAKE_K).toFixed(1)),
      alpha: atmos.near.map(f => +f.a.toFixed(2)),
      spins: atmos.near.map(f => +f.spin.toFixed(3))
    }),
    _sfxTable: () => audio.sfx,
    _hitStop: ms => hitStop(ms),
    _punch: (amp, ms, x, y) => punch(amp, ms, x, y),
    _juice: () => CFG.juice,
    _ground: () => ground,
    _obstacles: () => obstacles,
    _particles: () => particles,
    _voBytes: () => !!audio.voBytes,
    _voErr: () => audio.voErr || '',
    _voice: () => ({ ready: !!(audio.vo || audio.voEl), saying: !!audio.saying, dur: G.voDur || 0,
                     ctx: audio.ctx ? audio.ctx.state : 'none', said: (audio.saidLog || []).slice(),
                     lines: Object.keys((CFG.vo && CFG.vo.lines) || {}).length }),
    _perf: () => ({
      voReady: !!(audio.vo || audio.voEl), saying: !!audio.saying,
      pool: particles.list.length, gaps: ground.gaps.length,
      walls: Object.keys(ground._wallCache || {}).length,
      skies: Object.keys(bgm._cache || {}).length,
      rs, rsCap, hd: hdArt, canvas: canvas.width + 'x' + canvas.height
    }),
    _notchWidth: (i, depth) => { const g = (G.gapsThisPhase || [])[i]; return g ? ground.notchWidthAt(g, depth) : -1; },
    _notchLeak: i => { const g = (G.gapsThisPhase || [])[i]; return g ? ground.notchLeak(g) : -1; },
    _notchReveal: i => { const g = (G.gapsThisPhase || [])[i]; return g ? (g.reveal || 0) : -1; },
    _runPlan: i => ({ plan: (CFG.obstacle.runs || [])[Math.min(i, (CFG.obstacle.runs || []).length - 1)] || null, leap: obstacles ? obstacles.leap : 0, speed: CFG.runSpeed }),
    _force(s) { obstacles.reset(); setState(s); },
    skipToPartTwo() {
      if (G.state === 'BOOT' || G.complete) return false;
      G.phase = L1.phases.length; G.phasesDone = L1.phases.length;
      G.l1 = null; G.gapsThisPhase = null; G.l2 = null;
      G.oops = false; G.hitObstacle = null; G.hitReturn = null; G.hitFx = 0;
      obstacles.reset();
      setState('GLACIER_BREAK_2');
      return true;
    },
    skipToCrossing(n) {
      if (G.state === 'BOOT' || G.complete) return false;
      const k = p2Count(), all = k + L1.phases.length;
      n = clamp(Math.floor(Number(n) || 0), 0, all - 1);
      G.l1 = null; G.gapsThisPhase = null; G.l2 = null; G.gapA = null; G.gapB = null;
      G.oops = false; G.hitObstacle = null; G.hitReturn = null; G.hitFx = 0;
      G.hitCount = 0; G.phaseJumped = false;
      obstacles.reset();
      if (n < k) {
        G.p2i = n; G.phase = 0; G.phasesDone = n;
        setState('GLACIER_BREAK_2');
      } else {
        G.p2i = k; G.phase = n - k; G.phasesDone = Math.max(k, n - k);
        G.moving = true; G.jumpEnabled = true; G.speedFactor = 1;
        setState('PHASE_RUN');
      }
      return true;
    },
    skipToEnd() {
      if (G.state === 'BOOT' || G.state === 'TITLE' || G.complete) return false;
      G.phase = L1.phases.length; G.phasesDone = L1.phases.length;
      G.l2 = null; G.gapA = null; G.gapB = null;
      G.oops = false; G.hitObstacle = null; G.hitReturn = null; G.hitFx = 0;
      obstacles.reset();                            // nothing in the way of the run home
      setState('FINAL_RUN');
      G.bearAt = G.worldX + CFG.mammothX + 520 + 900;   // about a second and a half of running
      return true;
    },
    _l2: () => {
      const L = G.l2;
      if (!L) return null;
      return {
        R: L.R, scale: +(L.scale || 1).toFixed(3), focusT: +(L.focusT || 0).toFixed(3),
        pos: { x: Math.round(L.pos.x), y: Math.round(L.pos.y) },
        corners: hexScreenPts().map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })),
        cut: L.cut || null, wrong: L.wrong || 0, attempts: G.attempts || 0,
        pieces: L.pieces ? L.pieces.length : 0, seated: !!L.seated,
        badLine: L.badLine ? L.badLine.kind : null,
        dragFrom: L.dragFrom,
        mechanic: L.mechanic, solved: !!L.solved,
        drawn: (L.drawn || []).slice(), need: L.need,
        origin: L.origin === undefined ? null : L.origin
      };
    },
    /** The two crevasses Level 2 opens, and what is bridging them. */
    _l2Gaps: () => [G.gapA, G.gapB].map(g => g ? ({
      x0: Math.round(g.x0), x1: Math.round(g.x1), w: Math.round(g.x1 - g.x0),
      open: +(g.open || 0).toFixed(2), repaired: !!g.repaired,
      pieces: (g.pieces || []).length,
      filled: (g.slots || []).every(s => s.filled)
    }) : null),
    _l2Demo(on) { if (G.l2) G.l2.demo = !!on; return !!G.l2; },
    _l2Cut(i, j) {
      if (!G.l2 || G.state !== 'LEVEL_2_ACTIVE' || G.l2.pieces) return false;
      const pts = hexScreenPts();
      G.l2.dragFrom = i;
      G.l2.dragStart = pts[i] || { x: 0, y: 0 };
      attemptCut(i, j, pts[j] || { x: 0, y: 0 });
      return true;
    },
    _l2Accepts: (i, j) => PolygonCutManager.isDiagonal(6, i, j) && isMainDiagonal(i, j),
    /** Slice a hanging option by shape name — lets a test drive a phase to the end. */
    _cut(kind) {
      if (!G.l1) return false;
      const sh = G.l1.shapes.find(s => s.state === 'hang' && s.kind === kind);
      if (!sh) return false;
      cutShape(sh); return true;
    },
    _player: () => mammoth,
    _renderOnce: () => render()
  };

  preload().then(() => {
    if (destroyed) return;
    ground = new GroundManager(images.path);
    ground.caps = { l: images.capL || null, r: images.capR || null };
    ground.rockBand = images.rockBand || null;
    obstacles = new ObstacleController(
      [images.rockWide, images.rockTall, ...OBSTACLE_ART.map(k => images['obs:' + k])],
      audio, particles,
      ['rock', 'rock', ...OBSTACLE_ART.map(k => k.split('-')[0])]);   // families, for planned combinations
    bgm = new BackgroundTimeManager(images);
    mammoth = new PlayerController(audio, particles, currentCharacter(), images);
    mammoth.reducedMotion = () => reduced;   // the tremble's secondary shake is off under prefers-reduced-motion
    mammoth.onJump = () => atmos.pulse();
    setState('TITLE');
    hooks.onReady && hooks.onReady();
    raf = requestAnimationFrame(frame);
  });

  return api;
}

/*!
 * story-data.js — the Momo and Popo story that opens the game, as data.
 *
 * Five scenes, in order, then the lesson. story.js plays them; nothing here runs.
 *
 * THE WORDS ARE THE SCRIPT, EXACTLY. Every `text` below is the approved script, letter for
 * letter — the curly apostrophes, the em dash in "route— through" — and is not to be tidied.
 *
 * EVERY COORDINATE IS A PIXEL OF THE PAINTING (1672 x 941, the size the art was supplied at;
 * see story-art.js). The story is drawn in that space and scaled whole to the lesson's 16:9
 * board, so a speech bubble or a hanging shape is placed once and lands on the same spot on
 * every screen. Read a coordinate off the painting and it is right here.
 *
 *   lines[]      who speaks, what, the voice clip it plays (assets/vo/<vo>.mp3; silent if
 *                there is none, paced as it is read), where it sits, and what moves as it
 *                begins (`start`) or on one of its words (`at`)
 *     parts      a long line shown in pieces one after another, split where its voice
 *                pauses; joined they must be the line word for word, or they are ignored.
 *                Never a scrap of a word or two ("Popo," alone looked like a mistake):
 *                Momo's and Popo's lines are short, and each is shown whole.
 *     key        its focus words, exactly as written in `text`, shown in colour
 *     box        { x | cx, top | bottom, w1 }: its left edge or its centre, its top or its
 *                bottom edge, and the widest its one line may run (the painting less its
 *                margins if not given). Bubbles hang by the bottom, over the speaker's head.
 *     tip        the point a speech bubble's tail reaches: the top of the speaker's head
 *   regions      parts of the painting that move: `poly` is the outline, `origin` the point
 *                it turns or stretches about, `feather` how softly its edge meets the still
 *                painting behind; `parent` nests one in another (the basket in the trunk)
 *   sway         a region that swings for as long as the scene is up (the hanging shapes)
 *   sheens       a soft light that crosses an outline once when asked (the sign, the ice);
 *                a cue's `twinkle` adds a star that flashes once at [x, y, delay]
 *   glints       small twinkles on the ice
 *   camera       a slow push, and the point it pushes toward
 *   enter        what happens once the scene has settled, before the first line
 *
 * WHY PARTS OF THE PAINTING MOVE AND NOT CUT-OUT CHARACTERS. The art is five flat
 * paintings; there are no separate layers of Momo or Popo to animate. So a character is
 * never moved off his own spot (that would uncover a second Momo painted underneath);
 * the painting itself flexes a few pixels there — a squash and stretch from the feet, a
 * basket swinging from the trunk that holds it, a rope turning about its knot — which is
 * the same picture, alive, with nothing added and nothing taken away.
 */
(function (global) {
  'use strict';

  global.StoryData = {
    scenes: [
      /* SCENE 1 — FRIENDS DISCUSS A PICNIC. They face each other; each speaks with a small
         happy bounce, Momo first (and his trunk lifts), Popo only once Momo has finished. */
      {
        id: 1,
        regions: {
          momo: { poly: [[300, 380], [420, 280], [540, 196], [680, 196], [730, 290], [744, 360], [800, 360], [872, 372], [880, 446], [862, 488], [842, 530], [806, 610], [764, 656], [700, 684], [664, 818], [240, 818], [218, 700], [246, 460]],
                  origin: [455, 806], feather: 26 },
          /* the trunk's end only: the tusk just under it must not move with it, so the
             outline runs out into the open sky above and beside the tip (where the tip
             goes, and where it was) and hugs the underside */
          trunk: { parent: 'momo', poly: [[748, 448], [754, 424], [772, 394], [804, 372], [846, 372], [874, 396], [878, 440], [860, 464], [828, 462], [804, 460], [786, 470], [764, 480]],
                   origin: [760, 452], feather: 16 },
          popo: { poly: [[1040, 330], [1105, 296], [1172, 312], [1210, 400], [1290, 490], [1298, 660], [1270, 822], [960, 822], [966, 700], [940, 620], [858, 560], [856, 478], [930, 462], [990, 410]],
                  origin: [1110, 808], feather: 26 },
          paw: { parent: 'popo', poly: [[866, 494], [896, 466], [944, 468], [966, 494], [990, 552], [1002, 604], [960, 626], [920, 590], [872, 560]],
                 origin: [962, 596], feather: 14 }
        },
        lines: [
          { who: 'narrator', vo: 'st1-narrator', box: { x: 110, top: 34 },
            parts: ['It was a great day,', 'and Momo and Popo were deciding what to do.'], key: ['great', 'day,', 'Momo', 'Popo'],
            text: 'It was a great day, and Momo and Popo were deciding what to do.' },
          { who: 'momo', vo: 'st1-momo', box: { cx: 548, bottom: 196 }, tip: [648, 240],
            start: [{ move: 'momo', as: 'hop' }, { move: 'trunk', as: 'lift', after: 120 }],
            key: ['picnic!'],
            text: 'Popo, let’s go for a picnic!' },
          { who: 'popo', vo: 'st1-popo', box: { cx: 1196, bottom: 296 }, tip: [1098, 338],
            start: [{ move: 'popo', as: 'hop' }, { move: 'paw', as: 'wave', after: 160 }],
            key: ['Great', 'idea,'],
            text: 'Great idea, Momo!' }
        ]
      },

      /* SCENE 2 — SPLIT THE JOBS. The basket is in Momo's TRUNK from here on: it only ever
         swings from the grip, so it can never come away from him. */
      {
        id: 2,
        regions: {
          momo: { poly: [[260, 440], [410, 320], [520, 210], [680, 210], [720, 320], [780, 410], [830, 430], [846, 470], [896, 560], [904, 620], [872, 724], [640, 730], [660, 800], [224, 808], [200, 620], [250, 470]],
                  origin: [430, 790], feather: 26 },
          basket: { parent: 'momo', poly: [[684, 488], [730, 464], [778, 466], [812, 494], [828, 556], [888, 568], [894, 616], [866, 720], [632, 722], [608, 616], [614, 566], [676, 552]],
                    origin: [752, 480], feather: 18 },
          popo: { poly: [[1060, 368], [1210, 370], [1236, 460], [1310, 488], [1372, 500], [1376, 596], [1280, 628], [1270, 700], [1276, 822], [968, 822], [940, 720], [942, 530], [1010, 460], [1026, 400]],
                  origin: [1120, 806], feather: 26 }
        },
        lines: [
          { who: 'momo', vo: 'st2-momo', box: { cx: 450, bottom: 212 }, tip: [575, 248],
            start: [{ move: 'momo', as: 'hop' }, { move: 'basket', as: 'swing', after: 180, sfx: 'wicker' }],
            key: ['snacks!'],
            text: 'I’ll bring the snacks!' },
          { who: 'popo', vo: 'st2-popo', box: { cx: 1290, bottom: 364 }, tip: [1150, 404],
            start: [{ move: 'popo', as: 'twostep' }],
            key: ['nice', 'spot.'],
            text: 'I’ll go ahead and find us a nice spot.' }
        ]
      },

      /* SCENE 3 — THE ROUTE CHOICE. The signs are the painting's own and are never written
         over. The camera leans in toward FROZEN PASS; on "shortest route—" the sign catches
         the light once, the sheen running the way its arrow points: toward the pass. */
      {
        id: 3,
        camera: { origin: [740, 360], to: 1.02, ms: 4600 },
        regions: {
          momo: { poly: [[300, 440], [440, 330], [590, 350], [640, 440], [690, 480], [748, 580], [746, 690], [640, 772], [580, 818], [180, 818], [170, 640], [226, 520]],
                  origin: [360, 808], feather: 24 }
        },
        sheens: {
          sign: { poly: [[594, 358], [648, 300], [720, 296], [882, 286], [884, 364], [846, 366], [846, 424], [672, 432], [668, 398], [656, 396], [650, 386]],
                  dir: 'rtl', ms: 1300, strength: 0.55 }
        },
        enter: [{ move: 'momo', as: 'bob', after: 500 }],
        lines: [
          { who: 'narrator', vo: 'st3-narrator', box: { cx: 900, top: 30 },
            at: [{ word: 'route—', sheen: 'sign', sfx: 'creak', sfx2: 'sparkle' }],
            parts: ['Momo wanted to get there quickly,', 'so he took the shortest route—', 'through Frozen Pass.'],
            key: ['quickly,', 'shortest', 'route—', 'Frozen', 'Pass.'],
            text: 'Momo wanted to get there quickly, so he took the shortest route— through Frozen Pass.' }
        ]
      },

      /* SCENE 4 — FROZEN PASS. The shapes hang on their brown ropes and swing, barely, each
         on its own clock; Momo pulls up short — surprised and curious, not frightened. */
      {
        id: 4,
        regions: {
          momo: { poly: [[120, 420], [290, 346], [410, 282], [530, 282], [580, 390], [680, 430], [764, 462], [766, 668], [626, 672], [604, 764], [566, 818], [66, 818], [60, 640], [84, 556]],
                  origin: [128, 800], feather: 24 },
          pentagon: { poly: [[781, -24], [819, -24], [822, 88], [918, 146], [880, 280], [720, 278], [684, 150], [778, 88]],
                      origin: [800, -12], feather: 16, sway: { deg: 0.9, ms: 3200, lag: 0 } },
          rhombus: { poly: [[1004, -24], [1040, -24], [1042, 100], [1120, 214], [1030, 354], [932, 214], [1002, 100]],
                     origin: [1022, -12], feather: 16, sway: { deg: 0.9, ms: 3600, lag: 1300 } },
          triangle: { poly: [[1208, -24], [1248, -24], [1252, 90], [1364, 236], [1350, 266], [1144, 294], [1118, 272], [1206, 90]],
                      origin: [1228, -12], feather: 16, sway: { deg: 0.9, ms: 3000, lag: 700 } },
          cube: { poly: [[1480, -24], [1518, -24], [1522, 124], [1614, 154], [1614, 330], [1400, 330], [1400, 162], [1476, 124]],
                  origin: [1499, -12], feather: 16, sway: { deg: 0.8, ms: 3800, lag: 2100 } }
        },
        glints: [[705, 692, 0], [962, 588, 1500], [1182, 694, 2900], [1398, 612, 900], [1290, 500, 2300]],
        // he pulls up short first, and speaks once he has taken it in
        enter: [{ move: 'momo', as: 'recoil', after: 350, sfx: 'creak', level: 0.5 }, { sfx: 'chime', after: 700, level: 0.6 }, { sfx: 'air', after: 150 }],
        enterHold: 1150,
        lines: [
          { who: 'momo', vo: 'st4-momo', box: { cx: 420, bottom: 276 }, tip: [492, 302],
            key: ['trickier'],
            text: 'This path looks trickier than last time!' }
        ]
      },

      /* SCENE 5 — OVER TO THE CHILD. Wide, the whole way ahead in view. On "polygons" the
         ice answers once — a light crossing the hanging shapes — and then the lesson. */
      {
        id: 5,
        camera: { origin: [900, 620], to: 1.012, ms: 8000 },
        regions: {
          momo: { poly: [[140, 600], [300, 480], [440, 466], [500, 540], [570, 580], [628, 630], [626, 770], [530, 776], [484, 824], [96, 824], [96, 690]],
                  origin: [300, 812], feather: 24 },
          triangle: { poly: [[1122, 226], [1150, 226], [1152, 330], [1214, 452], [1062, 452], [1120, 330]],
                      origin: [1136, 238], feather: 14, sway: { deg: 0.7, ms: 3400, lag: 400 } },
          hexagon: { poly: [[1266, 180], [1296, 180], [1298, 292], [1346, 312], [1346, 398], [1228, 398], [1228, 312], [1264, 292]],
                     origin: [1281, 192], feather: 14, sway: { deg: 0.7, ms: 3000, lag: 1600 } },
          rhombus: { poly: [[1526, -24], [1566, -24], [1570, 94], [1672, 212], [1554, 372], [1414, 250], [1524, 94]],
                     origin: [1546, -12], feather: 16, sway: { deg: 0.55, ms: 4000, lag: 900 } }
        },
        sheens: {
          triangle: { poly: [[1135, 340], [1198, 442], [1074, 442]], dir: 'ltr', ms: 900, strength: 0.75, lag: 0 },
          hexagon: { poly: [[1262, 304], [1314, 304], [1334, 346], [1314, 388], [1262, 388], [1240, 346]], dir: 'ltr', ms: 900, strength: 0.75, lag: 220 },
          crystal: { poly: [[1220, 458], [1256, 478], [1256, 520], [1220, 528], [1186, 512], [1188, 474]], dir: 'ltr', ms: 800, strength: 0.65, lag: 300 },
          rhombus: { poly: [[1545, 108], [1654, 212], [1548, 354], [1434, 248]], dir: 'ltr', ms: 1100, strength: 0.7, lag: 440 }
        },
        enter: [{ move: 'momo', as: 'bob', after: 600 }],
        lines: [
          // (it stops short of the rope the big rhombus hangs from, at x 1530)
          { who: 'narrator', vo: 'st5-narrator', box: { x: 66, top: 34, w1: 1440 },
            at: [{ word: 'polygons.', sheen: ['triangle', 'hexagon', 'crystal', 'rhombus'], sfx: 'sparkle', level: 0.45,
                   twinkle: [[1150, 380, 60], [1300, 330, 260], [1222, 486, 360], [1580, 196, 480]] }],
            parts: ['Momo needs your help to reach Popo.', 'But first, you’ll need to learn a little more about polygons.'],
            key: ['help', 'polygons.'],
            text: 'Momo needs your help to reach Popo. But first, you’ll need to learn a little more about polygons.' }
        ]
      }
    ]
  };
})(typeof window !== 'undefined' ? window : this);

# Voice-over script — Swiftee & the Polygons

_Generated from the storyboard by `node tools/vo-script.js`; do not edit by hand._

Every line the game says — the story’s three voices first, then Swiftee’s — **in the order a child hears it**, with the file the game plays. Save each clip as `assets/vo/<id>.ogg`, then run `npm run build:vo`: the game plays it as the words appear and paces the bubbles by the recording. A clip that is not there yet is silent, so they can be added a few at a time.

**Voice:** Swiftee, a small, warm, playful teal bird talking to a seven-year-old. Clear, unhurried and smiling, never shouty. Lines end with a smile, not a drop.

**Files:** mono MP3, 44.1 kHz, 128 kbps or better, about −16 LUFS, no more than 0.2 s of silence at either end. Aim for about 0.4 s per word plus 0.4 s.

**Breaths:** record every line as ONE clip, read naturally, with a short breath at each `/` in the Breaths column. On screen each sentence is one bubble; the breaths are where the words pause inside it.

## The story (0), before the lesson — in its own voices

Five painted scenes of Momo and Popo play between Start and Swiftee’s first screen. None of these lines is Swiftee’s; each speaker has a voice of their own:

- **narrator** — the storyteller: warm, clear and unhurried, a grown-up reading a picture book aloud
- **momo** — Momo the mammoth: a cute cartoon kid, big-hearted and eager
- **popo** — Popo the polar bear: a cute cartoon kid, bright and bouncy, plainly not the same child as Momo

| # | Scene | Speaker | File | Line | Recorded |
|---|-------|---------|------|------|----------|

## Lesson lines (65), in timeline order

| # | Screen | Screen id | File | Type | Line | Breaths | When | Delivery | Recorded |
|---|--------|-----------|------|------|------|---------|------|----------|----------|
| 1 | 1 | intro-hi | `assets/vo/p01.ogg` | say | Hi! I am Swiftee. |  | screen 1 | arriving, friendly | yes |
| 2 | 2 | intro-remember | `assets/vo/p02.ogg` | say | Remember we learned about polygons before. |  | screen 2 | wondering aloud, a little slower | yes |
| 3 | 3 | intro-define | `assets/vo/p03.ogg` | say | Polygons are closed shapes made from straight lines. | Polygons are closed shapes / made from straight lines. | screen 3 | explaining, warm and clear | yes |
| 4 | 4 | which-polygons | `assets/vo/p04.ogg` | say | Which of these are polygons? |  | screen 4 | asking: curious, open | yes |
| 5 | 5 | lets-play | `assets/vo/p05.ogg` | say | Let’s play with this one. |  | screen 5 | playful, inviting | yes |
| 6 | 6 | pick-vertex | `assets/vo/p06.ogg` | say | Select any vertex. |  | screen 6 | explaining, warm and clear | yes |
| 7 | 7 | connect | `assets/vo/p07i.ogg` | instruction | Let’s connect it to another vertex. |  | screen 7, the instruction | an instruction: plain, steady, every word clear | yes |
| 8 | 7 | connect | `assets/vo/p09.ogg` | say | This is a side of the polygon. |  | screen 7 | explaining, warm and clear | yes |
| 9 | 7 | connect | `assets/vo/p10i.ogg` | instruction | Let’s connect it to a different vertex. |  | screen 7, the instruction | an instruction: plain, steady, every word clear | yes |
| 10 | 7 | connect | `assets/vo/p12.ogg` | say | Yay! You made a diagonal! |  | screen 7, after the right answer | a cheer, delighted | yes |
| 11 | 8 | define-diagonal | `assets/vo/p13.ogg` | say | A line segment joining two non-adjacent vertices is a diagonal. | A line segment joining / two non-adjacent vertices / is a diagonal. | screen 8 | explaining, warm and clear | yes |
| 12 | 9 | another-diagonal | `assets/vo/p14i.ogg` | instruction | Let’s draw another diagonal from the same vertex. |  | screen 9, the instruction | an instruction: plain, steady, every word clear | yes |
| 13 | 9 | another-diagonal | `assets/vo/p14r.ogg` | reminder | A diagonal connects non-adjacent vertices. |  | screens 9 and 10, from the first wrong answer on | a gentle reminder: warm, clear, never disappointed | yes |
| 14 | 10 | hexagon-your-turn | `assets/vo/p15.ogg` | say | Your turn! Let’s draw all the diagonals from this vertex. | Your turn! / Let’s draw all the diagonals / from this vertex. | screen 10 | playful, inviting | yes |
| 15 | 10 | hexagon-your-turn | `assets/vo/p15i.ogg` | instruction | Let’s draw all the diagonals from this vertex. |  | screen 10, the instruction | an instruction: plain, steady, every word clear | yes |
| 16 | 11 | look-diagonals | `assets/vo/p16b.ogg` | say | Let’s look at the diagonals of this pentagon. | Let’s look at the diagonals / of this pentagon. | screen 11 | playful, inviting | yes |
| 17 | 12 | inside-or-outside | `assets/vo/p17i.ogg` | instruction | Are the diagonals inside or outside? |  | screen 12, the instruction | an instruction: plain, steady, every word clear | yes |
| 18 | 12 | inside-or-outside | `assets/vo/fb54.ogg` | say | The diagonals are inside. |  | screen 12, after a wrong answer | explaining, warm and clear | yes |
| 19 | 13 | lets-change | `assets/vo/p18.ogg` | say | Let’s make a change. |  | screen 13 | playful, inviting | yes |
| 20 | 14 | drag-inward | `assets/vo/p19i.ogg` | instruction | Help me pull this vertex inside. |  | screen 14, the instruction | an instruction: plain, steady, every word clear | yes |
| 21 | 15 | whoa | `assets/vo/p20.ogg` | say | Whoa! One of the diagonals went outside. | Whoa! One of the diagonals / went outside. | screen 15 | surprised, amazed | yes |
| 22 |  |  | `assets/vo/fb52.ogg` | say | Whoa! Some of the diagonals went outside. |  | screen undefined | surprised, amazed | yes |
| 23 | 16 | compare | `assets/vo/p21.ogg` | say | Let’s compare the diagonals in both the pentagons. |  | screen 16 | playful, inviting | yes |
| 24 | 17 | all-inside | `assets/vo/p22.ogg` | say | This one has all the diagonals inside. |  | screen 17 | explaining, warm and clear | yes |
| 25 | 18 | one-outside | `assets/vo/p23.ogg` | say | But this one has atleast one diagonal outside. |  | screen 18 | explaining, warm and clear | yes |
| 26 | 19 | convex | `assets/vo/p24.ogg` | say | All diagonals inside means convex polygon. |  | screen 19 | explaining, warm and clear | yes |
| 27 | 20 | concave | `assets/vo/p25.ogg` | say | Atleast one diagonal outside means concave polygon. | Atleast one diagonal outside / means concave polygon. | screen 20 | explaining, warm and clear | yes |
| 28 | 21 | make-concave | `assets/vo/p26i.ogg` | instruction | Drag any vertex to make this polygon concave. |  | screen 21, the instruction | an instruction: plain, steady, every word clear | yes |
| 29 | 21 | make-concave | `assets/vo/fb32.ogg` | say | Try again! |  | screen 21, after a wrong answer | explaining, warm and clear | yes |
| 30 | 21 | make-concave | `assets/vo/p26r1.ogg` | say | The diagonals are still inside the shape, so it is still convex. |  | screen 21, after a wrong answer | explaining, warm and clear | yes |
| 31 | 21 | make-concave | `assets/vo/fb53.ogg` | say | Let me show you. Watch this corner. |  | screen 21, after a wrong answer | explaining, warm and clear | yes |
| 32 | 21 | make-concave | `assets/vo/p26r2.ogg` | say | Now one diagonal goes outside, so the polygon is concave. |  | screen 21, after a wrong answer | explaining, warm and clear | yes |
| 33 | 21 | make-concave | `assets/vo/fb03.ogg` | say | Great job! |  | screen 21, after the right answer | a cheer, delighted | yes |
| 34 | 22 | sort-convex-concave | `assets/vo/p27.ogg` | say | Can you sort these polygons as convex or concave? |  | screen 22 | playful, inviting | yes |
| 35 |  |  | `assets/vo/p27c.ogg` | say | Look! This corner goes inward. |  | screen undefined | explaining, warm and clear | yes |
| 36 |  |  | `assets/vo/p27v.ogg` | say | Look! No corner goes inward. |  | screen undefined | explaining, warm and clear | yes |
| 37 | 23 | suspicious | `assets/vo/p28.ogg` | say | Hmm… The sides look suspiciously alike. | Hmm… / The sides look suspiciously alike. | screen 23 | wondering aloud, a little slower | yes |
| 38 | 24 | measure-sides | `assets/vo/p29s.ogg` | say | Let’s measure the sides. |  | screen 24 | playful, inviting | yes |
| 39 | 25 | sides-equal | `assets/vo/p30.ogg` | say | Every side is equal. But what about the angles? | Every side is equal. / But what about the angles? | screen 25 | asking: curious, open | yes |
| 40 | 26 | measure-angles | `assets/vo/p31m.ogg` | say | Let’s measure the angles. |  | screen 26 | playful, inviting | yes |
| 41 | 26 | measure-angles | `assets/vo/p31.ogg` | say | The angles match too! |  | screen 26 | explaining, warm and clear | yes |
| 42 | 27 | distort | `assets/vo/p32a.ogg` | say | Help me stretch this corner. Let’s see what happens to the sides and angles. | Help me stretch this corner. / Let’s see what happens / to the sides and angles. | screen 27 | playful, inviting | yes |
| 43 | 27 | distort | `assets/vo/p32ai.ogg` | instruction | Drag the highlighted vertex. |  | screen 27, the instruction | an instruction: plain, steady, every word clear | yes |
| 44 | 28 | stayed-changed | `assets/vo/p32b.ogg` | say | It’s still a pentagon. But are the sides and angles still equal? | It’s still a pentagon. / But are the sides / and angles still equal? | screen 28 | asking: curious, open | yes |
| 45 | 28 | stayed-changed | `assets/vo/p32bi.ogg` | instruction | Are the sides and angles still equal? |  | screen 28, the instruction | an instruction: plain, steady, every word clear | yes |
| 46 | 28 | stayed-changed | `assets/vo/p32r.ogg` | say | The sides and angles changed, so they are not equal. |  | screen 28, after a wrong answer | explaining, warm and clear | yes |
| 47 | 29 | regular-vs-irregular | `assets/vo/fb55.ogg` | say | Let’s compare these two pentagons. |  | screen 29 | playful, inviting | yes |
| 48 | 29 | regular-vs-irregular | `assets/vo/fb56.ogg` | say | All the sides and angles are equal in this pentagon. |  | screen 29 | explaining, warm and clear | yes |
| 49 | 29 | regular-vs-irregular | `assets/vo/fb57.ogg` | say | But this pentagon has unequal sides and unequal angles. |  | screen 29 | explaining, warm and clear | yes |
| 50 | 29 | regular-vs-irregular | `assets/vo/fb58.ogg` | say | All sides and angles equal means a regular polygon. Sides and angles unequal means an irregular polygon. | All sides and angles equal / means a regular polygon. / Sides and angles unequal / means an irregular polygon. | screen 29 | explaining, warm and clear | yes |
| 51 | 30 | sort-regular | `assets/vo/p33.ogg` | say | Where does this polygon belong? |  | screen 30 | asking: curious, open | yes |
| 52 |  |  | `assets/vo/fb48.ogg` | say | This one is regular. Every side is equal, and every angle is equal too. |  | screen undefined | explaining, warm and clear | yes |
| 53 |  |  | `assets/vo/fb49.ogg` | say | This one is irregular. Its sides are not all the same length. |  | screen undefined | explaining, warm and clear | yes |
| 54 |  |  | `assets/vo/fb50.ogg` | say | This one is irregular. Its sides match, but its angles are not all equal. |  | screen undefined | explaining, warm and clear | yes |
| 55 |  |  | `assets/vo/fb51.ogg` | say | This one is irregular. Its sides are not equal, and its angles are not equal either. |  | screen undefined | explaining, warm and clear | yes |
| 56 | 31 | summary | `assets/vo/p37o.ogg` | say | Let’s recall what we learned today. |  | screen 31 | playful, inviting | yes |
| 57 | 31 | summary | `assets/vo/p37a.ogg` | say | A vertex is a corner where two sides meet. |  | screen 31 | explaining, warm and clear | yes |
| 58 | 31 | summary | `assets/vo/p37b.ogg` | say | A side is a straight line joining two vertices. |  | screen 31 | explaining, warm and clear | yes |
| 59 | 31 | summary | `assets/vo/p37c.ogg` | say | An angle is formed where two sides meet. |  | screen 31 | explaining, warm and clear | yes |
| 60 | 31 | summary | `assets/vo/p37d.ogg` | say | A diagonal joins two non-adjacent vertices. |  | screen 31 | explaining, warm and clear | yes |
| 61 | 31 | summary | `assets/vo/p37e.ogg` | say | In a convex polygon, all diagonals stay inside. |  | screen 31 | explaining, warm and clear | yes |
| 62 | 31 | summary | `assets/vo/p37f.ogg` | say | In a concave polygon, atleast one diagonal goes outside. |  | screen 31 | explaining, warm and clear | yes |
| 63 | 31 | summary | `assets/vo/p37g.ogg` | say | A regular polygon has all sides and all angles equal. |  | screen 31 | explaining, warm and clear | yes |
| 64 | 31 | summary | `assets/vo/p37h.ogg` | say | If the sides or angles are not all equal, the polygon is irregular. |  | screen 31 | explaining, warm and clear | yes |
| 65 | 31 | summary | `assets/vo/p37i.ogg` | say | Amazing! You explored all these polygon ideas! |  | screen 31 | explaining, warm and clear | yes |

## Answers (17), said when the child answers

| File | Line | When | Delivery | Recorded |
|------|------|------|----------|----------|
| `assets/vo/fb46.ogg` | Keep going! | a try that falls short, with the reason | explaining, warm and clear | yes |
| `assets/vo/fb47.ogg` | Amazing! | a try that falls short, with the reason | explaining, warm and clear | yes |
| `assets/vo/fb44.ogg` | Not quite. A circle is curved. A polygon has only straight sides. | a try that falls short, with the reason | explaining, warm and clear | yes |
| `assets/vo/fb45.ogg` | Not quite. This shape is open. A polygon must be closed. | a try that falls short, with the reason | explaining, warm and clear | yes |
| `assets/vo/fb41.ogg` | Try again! Compare the sides and angles now. | a try that falls short, with the reason | explaining, warm and clear | yes |
| `assets/vo/p38b.ogg` | You are a polygon adventurer! | a try that falls short, with the reason | explaining, warm and clear | yes |
| `assets/vo/p39.ogg` | Now you know everything about polygons. You are ready to help Momo. | a try that falls short, with the reason | explaining, warm and clear | yes |
| `assets/vo/fb15.ogg` | Drop it on a corner! | a try that falls short, with the reason | gentle and encouraging, never disappointed | yes |
| `assets/vo/fb11.ogg` | Pull it in more! | a try that falls short, with the reason | gentle and encouraging, never disappointed | yes |
| `assets/vo/fb40.ogg` | Try again! Stretch the corner a little further. | a try that falls short, with the reason | explaining, warm and clear | yes |
| `assets/vo/fb35.ogg` | Try again! Every side and every angle is equal. | a try that falls short, with the reason | explaining, warm and clear | yes |
| `assets/vo/fb36.ogg` | Try again! The sides are not all equal. | a try that falls short, with the reason | explaining, warm and clear | yes |
| `assets/vo/fb37.ogg` | Try again! The angles are not all equal. | a try that falls short, with the reason | explaining, warm and clear | yes |
| `assets/vo/fb38.ogg` | Try again! The sides and the angles are not all equal. | a try that falls short, with the reason | explaining, warm and clear | yes |
| `assets/vo/sw1.ogg` | Momo needs your help. | a try that falls short, with the reason | explaining, warm and clear | yes |
| `assets/vo/sw2.ogg` | But to help Momo, you need to learn about polygons. | a try that falls short, with the reason | explaining, warm and clear | yes |
| `assets/vo/sw3.ogg` | Now let’s help Momo. | a try that falls short, with the reason | explaining, warm and clear | yes |

## Not recorded

The score between the two finale lines ("<XP> XP and <badges> badges.") is the child’s own, so it is shown and not voiced.

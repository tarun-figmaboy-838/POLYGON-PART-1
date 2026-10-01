# Frozen Rush — every word the learner hears or reads

For voice-over recording. One row per line, with the exact text as it ships, where it appears,
and the id to name the audio file by. Nothing here is generated at runtime: every string is a
literal in the source, so what is written is what is shown.

Delivery notes for the whole script: Momo is a small, brave mammoth and the speaker is the
game, warm and quick, never stern. The learner is 5 to 8 years old. Keep each line under two
seconds where possible; the game freezes for the tutorial lines and shows the instruction sign
for the whole question, so a line that runs long is not cut off but does hold the game.

## 1. The tutorial (speech bubble, in order)

These play once, on the first crossing. Lines 1, 2, 3 and 5 freeze the game while they are
read; 4 and 6 wait for the player to act; 7 runs over the celebration.

**A line is SHOWN one sentence at a time** — "This is Momo." lands, is read, and then "He
needs to find his friend." replaces it in the same box (`Tutorial.beats`). The recording is
still one continuous take per line, and the sentences share its length in proportion to
their own, so the words on screen are the words being said. That is why the lines are
written here whole: change the wording and the recording, this table and
`game/js/tutorial.js` all move together, and a test fails if they do not.

| id | line | moment |
|---|---|---|
| tut-1-meet | This is Momo. He needs to find his friend. | The run starts; Momo is lit. |
| tut-2-goal | Help Momo cross the Frozen Pass! | Still at the start. |
| tut-3-watch | Watch out! | A rock is right in his path. |
| tut-4-jump | Tap to jump over obstacles. | The box alone, in the middle of the stage; no hand — the whole stage is the control. |
| tut-5-broken | Oh no! The path is broken. | He has stopped and trembled; the hole is lit. |
| tut-6-use | Use the right ice piece to fix the path. | The hand sweeps across the answer's rope. |
| tut-7-fit | Perfect fit! Keep going! | The piece has landed and the run resumes. |

**Inside Swiftee's lesson it is played in two halves** (the game-lesson kit: the lesson's page
runs this game in a frame, `?lesson=intro` before the lesson and `?lesson=end` after it):

- **Before the lesson** the tutorial plays lines 1 to 5 and the game holds still at the broken
  path. Swiftee flies in over the frame and speaks in the lesson's own voice (those lines are the
  lesson's clips, in part1-swiftee-lesson/assets/vo — not in this take), and the lesson takes over.
- **After the lesson** the game starts by itself, the avalanche included, says nothing until the
  break, holds still there for Swiftee's "Now let's help Momo.", and then the plank speaks:

| id | line | moment |
|---|---|---|
| tut-6b-piece | Use the right piece to fix the path. | The plank, after Swiftee's visit at the ditch. **Recorded** — `tut-6-use` with "ice" cut out (the kit's wording). |

## 2. The instruction sign (one per crossing, in play order)

The ids are the ones the game derives from each sentence (`api.signVoId`), so the recording, the
config and this table cannot drift: change a sentence and the id changes with it.

The sign is on screen for the whole question. The polygon's name is shown in capitals and
coloured; say it with the same emphasis.

| id | line | crossing |
|---|---|---|
| sign-triangle | Cut the triangle. | 1 |
| sign-quadrilateral | Cut the quadrilateral. | 2 |
| sign-pentagon | Cut the pentagon. | 3 |
| sign-hexagon | Cut the hexagon. | 4 |
| sign-heptagon | Cut the heptagon. | 5 |
| sign-pentagons | Cut all the pentagons. | 6 (two answers) |
| sign-hexagons | Cut all the hexagons. | 7 (two answers) |

## 3. The ending — ONE CHEER, NO SENTENCES

| id | line | moment |
|---|---|---|
| win-yay | *(the cheer — wordless)* | Momo reaches his friend and the pair dance. |

The ending used to open with a banner too: **You did it!** over **Momo crossed the Frozen Pass!**,
both spoken (`win-title`, `win-sub`). Both were removed on request, panel and voice together.
The journey now finishes on the dance — the camera pushes in on Momo and his friend and no
words are drawn or said over the top.

`win-yay` was in the original take all along and went unused for a while: every other line ends
by 34.52 and the file runs to 36.13, with a single spoken burst at 34.763–35.658. It is a cheer,
not a sentence, so there is nothing to read — but it IS in `CFG.vo.lines` and it does play, which
is why it is listed here. Do not re-record it and do not add sentences to this section.

## 4. Interface and screens

Short, functional lines. Record only if the interface is to be voiced; the game does not
require them.

| id | line | where |
|---|---|---|
| ui-play | Play | The cover button |
| ui-loading | Loading… | The cover, while the art arrives |
| ui-paused | Paused | The pause panel's heading |
| ui-resume | Resume | The pause panel |
| ui-restart | Restart | The pause panel |
| ui-sound | Sound | The pause panel |
| ui-rotate | Rotate your device | Shown in portrait |
| ui-play-again | Play again | The ending |

(The tutorial's **Skip** and the **Skip to ending** review control were removed on request.)

## 5. If the lines are ever re-recorded or re-written

The tutorial script is fixed by the owner and is quoted verbatim in `game/js/tutorial.js`; the
instruction sentences live in `CFG.levelOne.phases[].instruction` in `game/js/engine.js` and
nowhere else, and a test holds that each one names the shape its slots are cut for. Change a
sentence in the config and the sign, the highlighted word and this script must all move
together.

## 6. Part 2 — generated lines

These ten lines follow the original take. See [VO-PART2.md](VO-PART2.md) for delivery and build details.

| # | id | say this |
|---|----|----------|
| 1 | `p2-1-diagonal` | Cut along a diagonal. |
| 2 | `p2-2-diagonals` | Draw all the diagonals. |
| 3 | `p2-3-samevertex` | Draw 2 diagonals from the same vertex. |
| 4 | `p2-4-concave` | Cut the concave polygon. |
| 5 | `p2-5-convex` | Cut the convex polygon. |
| 6 | `p2-6-concave-pentagon` | Cut the concave pentagon. |
| 7 | `p2-7-convex-hexagon` | Cut the convex hexagon. |
| 8 | `p2-8-all-concave` | Cut all the concave ones. |
| 9 | `p2-9-all-convex` | Cut all the convex ones. |
| 10 | `p2-tut-6-cut` | Cut this ice block to fix the path. |


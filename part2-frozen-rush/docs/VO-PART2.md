# Part 2 — generated voice lines

The nine crossing prompts and the rewritten tutorial line are appended to the original
voice take. The new lines use the local male English voice at a measured speaking pace.
They match the original's broad delivery style, though they are not the original speaker.
The game downloads one file and cuts it into windows.

The build inserts 0.65 seconds of silence between generated lines. Word starts come
from the synthesizer's SpeakProgress events and are stored in `CFG.vo.lines`.

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

Line 10 is no longer used (2026-10-01, the user's new sequence). The tutorial's "use" step
says the take's own recorded line again — `tut-6-use`, "Use the right ice piece to fix the
path." — so line 10's generated "Cut this ice block to fix the path." stays in the file but is
never asked for. Do not re-record `tut-1` … `tut-7`: they match their steps exactly.

## The return's plank line, recorded

| id | say this |
|----|----------|
| `tut-6b-piece` | Use the right piece to fix the path. |

Not generated: the take's own `tut-6-use`, "Use the right ice piece to fix the path.", with the
word "ice" cut out between the closure of "right"'s t (1.615 s into the line) and of "piece"'s p
(1.975 s), so the join is in silence. Appended last with `recorded: true`, so no other window
moved. It is said on the plank after the lesson (`?lesson=end`), the game-lesson kit's wording;
the game opened on its own still says the whole recorded line.

(`sw-help`, Swiftee's "But for that, first you need to learn about polygons." spoken inside this
game, is gone: Swiftee is drawn and voiced by the lesson's page now, over the game's frame.)

Read line 3 as **"draw two diagonals"** — the numeral is how it is written on the
board, not how it is spoken.

**Line 3 is a stopgap in a different voice.** It was reworded from "one corner" to "the
same corner", and then to "the same **vertex**" (2026-10-01, the user: the game says the
lesson's word), on a Mac, where the SAPI voice the other lines use does not exist. So it
is spoken by the macOS voice **Reed (English, US)**, lowered to 0.88 of its pitch with its
timing kept (median 98 Hz, against 93–102 Hz for the other lines), with a 0.142 s lead,
and cut to exactly the 3.228 s the line had before, so no later window moved. Its word
onsets are from a wav2vec2 forced alignment of the sentence (the aligner of Part 1's
`tools/align-vo.js`, run on this one file), which put the old take's words within 45 ms of
the onsets it had. Running `tools/generate-part2-vo.ps1` on Windows regenerates it in
the same voice as the rest, and the steps below then replace it.

## How to say them

The same voice and pace as the Part 1 take. These are questions put to a child who is
about to do something, not narration: the shape word carries the sentence, so let
**concave**, **convex**, **pentagon**, **hexagon** and **diagonal** land. The board
reveals each word as it is spoken, and a rushed line leaves the words chasing the
voice.

Lines 8 and 9 say **"all"** and mean it — the crossing wants every matching shape, so
that word is doing work.

## Regenerate

1. Run `tools/generate-part2-vo.ps1` on Windows. It writes ten source WAVs and
   `timings.json` to `art-source/audio-source/part2-vo/`.
2. Run `node tools/assemble-part2-vo.mjs`. It appends the WAVs to the original take,
   writes MP3 and Ogg, and reports the windows in `windows.json`.
3. Keep the reported windows in `CFG.vo.lines` and run `node tools/build-bundle.mjs`.

## Not needed any more

Part 1's seven question lines are dead — `sign-triangle`, `sign-quadrilateral`,
`sign-pentagon`, `sign-hexagon`, `sign-heptagon`, `sign-pentagons`, `sign-hexagons`.
Their crossings were replaced by Part 2's, so nothing asks for them. The seven
**tutorial** lines (`tut-1-meet` … `tut-7-fit`) are all still used and still correct —
do not re-record those.

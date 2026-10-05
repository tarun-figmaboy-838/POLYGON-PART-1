# Part 2 — the recorded lines

Part 2's lines are **recorded** (the owner, 2026-10-05): the nine crossing questions and Level 2's
five nudges, in one take (`vo/1 (1).mp3`, kept in `art-source/audio-source/part2-vo/` as one WAV
per line). They are appended to the original Frozen Rush take after its own lines, so every old
window stays where it was. Nothing in the game is generated speech any more.

| id | say this | where |
|----|----------|-------|
| `p2-1-diagonal` | Cut along a diagonal. | crossing 1 |
| `p2-2-diagonals` | Draw all the diagonals. | crossing 2 |
| `p2-3-samevertex` | Draw 2 diagonals from the same vertex. | crossing 3 (read "two") |
| `p2-4-concave` | Cut the concave polygon. | crossing 4 |
| `p2-5-convex` | Cut the convex polygon. | crossing 5 |
| `p2-6-concave-pentagon` | Cut the concave pentagon. | crossing 6 |
| `p2-7-convex-hexagon` | Cut the convex hexagon. | crossing 7 |
| `p2-8-all-concave` | Cut all the concave ones. | crossing 8 |
| `p2-9-all-convex` | Cut all the convex ones. | crossing 9 |
| `hint-corners` | Connect two vertices. | a stroke that reached no corner |
| `hint-side` | That's a side — try a diagonal. | a line between neighbours |
| `hint-short` | Cut right across, vertex to opposite vertex. | a short diagonal |
| `hint-already` | That one is done — find another. | a diagonal drawn twice |
| `hint-samevertex` | Start this one at the same vertex. | a diagonal from another corner |
| `tut-6b-piece` | Use the right piece to fix the path. | the plank after the lesson (`?lesson=end`) |

`tut-6b-piece` is the original take's own `tut-6-use` ("Use the right ice piece to fix the path.")
with the word "ice" cut out between two closures; it is marked `recorded: true` in `timings.json`
so it keeps the take's level. The fourteen new lines are matched to the original take's level by
the build (1.12x on this recording).

## Where each word lands

`timings.json` carries each line's word onsets, measured by forced alignment of the line against
its own words (wav2vec2 CTC, the aligner Part 1 uses in `tools/align-vo.js`). The plank reveals
each word on its onset against the audio clock. A nudge's em dash is shown as a word, so it is
given the onset of the word after it: the spans on the plank and the onsets stay one to one.

## To re-record

1. Record the lines in one file, each followed by a pause of about half a second.
2. Cut each line to its own WAV in `art-source/audio-source/part2-vo/` (44.1 kHz mono), named by
   its id, and write its row in `timings.json`: `id`, `text`, `file`, `duration`, `words` (each
   word's onset in seconds from the start of its WAV).
3. `node tools/assemble-part2-vo.mjs` appends them to the original take, writes
   `game/assets/audio/vo-lines.mp3` and `.ogg`, and prints the windows.
4. Copy the printed windows into `CFG.vo.lines` (`game/js/engine.js`) and run
   `node tools/build-bundle.mjs`. `tests/buffers.spec.mjs` holds the take's length.

The seven tutorial lines (`tut-1` … `tut-7`) and the cheer are the original take's and are not
re-recorded. Swiftee's lines over this game belong to the lesson (`part1-swiftee-lesson`).

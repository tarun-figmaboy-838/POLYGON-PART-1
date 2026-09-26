# Polygon Adventure

A two-part browser game about polygons, set in one frozen world.

| | Part | What the child does | Folder |
|---|---|---|---|
| **1** | **Swiftee & the Polygons** (learn) | A narrated story lesson. Swiftee introduces vertices, sides, angles and diagonals, then convex vs concave and regular vs irregular, and ends on a summary of every idea. | [`part1-swiftee-lesson/`](part1-swiftee-lesson/) |
| **2** | **Frozen Rush** (play) | An ice runner. Momo the mammoth is stopped by crevasses, nine in all. The first three are drawing crossings: cut the slab along a diagonal, draw all the diagonals, draw two from one corner. The last six are rope crossings: swipe a rope to drop the convex or concave block that fits. The ice path is mended with geometry. | [`part2-frozen-rush/`](part2-frozen-rush/) |

They play as one game, in order, with no menu in front:

```
open the game ─► Part 1: Swiftee's title ─► the lesson ─► finale
                                                             │  his last words, then a few seconds
                                                             ▼
                 Part 2: Frozen Rush title ◄── the snow closes in
                          │ PLAY
                          ▼
                 3 diagonal crossings ─► 6 convex/concave crossings ─► the ending
```

The root [`index.html`](index.html) sends the player straight into Part 1. At the lesson's
finale, 4 seconds after Swiftee's last word (`ONWARD_MS` in `game.js`), the lesson's own
snowfall covers the screen and Part 2 opens. A **Part 2 ▶** button stands in the corner
*Next* held all lesson, for a child who does not want to wait, and **Play again** calls the move
off. Part 2 opens on its title screen: its PLAY tap is also the gesture that lets the browser
start its music.

No framework and no build step. Everything is plain static files.

## Play it

**Windows, no installs:** double-click **`START GAME.bat`**. It starts a small local server
(`serve.ps1`) and opens the game in Edge.

**With Node:**

```
npm start            # http://localhost:8000
```

**Straight off the disk:** open `index.html`. Everything works, but the lesson uses the
browser's voice instead of the recorded one, and Frozen Rush plays without its music and
recorded sounds (browsers block those on `file://`).

| URL | Opens |
|---|---|
| `/` | the game, from the start (it opens Part 1) |
| `/part1-swiftee-lesson/` | Part 1 |
| `/part2-frozen-rush/game/` | Part 2 on its own, for testing it without playing the lesson |
| `/?dev=1` | the game in dev mode (below) |

## Dev mode: jump to any screen

Add `?dev=1` to the address (`http://localhost:8000/?dev=1`). A small **DEV** bar appears at the
top of both parts, and stays on as you move between them. Without `?dev=1` a player never sees it.

| Part | The DEV bar |
|---|---|
| Part 1 | **◀ / ▶** one screen back or on · a list of all 31 screens · **Part 2 ▶** |
| Part 2 | **◀ Part 1** · a list of the title screen, the nine crossings (by their instruction) and the ending |

A Part 1 jump restores the screen as it was left (`goTo()` in `game.js`). A Part 2 jump reloads the
page at `?dev=1&at=N`, so each one starts from a clean run. It enters the crossing the way the
journey reaches it (`skipToCrossing()` in `engine.js`). Part 2's own dev extras still work with it:
**Skip to ending** in the corner, `?p2=1`, `?skip=1`, `?fast=1-8`.

## Layout

```
index.html              the way in: opens Part 1
serve.js                local server for the whole thing (npm start)
serve.ps1               the same, for Windows with no Node (START GAME.bat)
vercel.json             one static deploy for everything; cache rules for both parts
.vercelignore           keeps tests, tools and source art off the CDN

part1-swiftee-lesson/   PART 1, as its own project: index.html + src/ + assets/ is the site
  README.md             how the lesson is built: director, storyboard, Swiftee rig, VO
  tests/ tools/ docs/

part2-frozen-rush/      PART 2, as its own project: game/ is the site
  README.md             the two levels and the layout
  RUNNER.md             the gameplay contract; read before changing gameplay
  game/ art-source/ tests/ tools/ docs/

.claude/skills/         the game-design skill used for both parts
```

Each part keeps its own README, tests, tools and `.gitignore`, and each can still be
developed on its own exactly as before.

## Where Part 1 hands over to Part 2

All of it is in Part 1; Part 2 is exactly the original game.

| Where | What it does |
|---|---|
| `part1-swiftee-lesson/index.html`, `#continue` | the Part 2 ▶ button; its `href` is the one place Part 2's address is written |
| `part1-swiftee-lesson/src/game/game.js`, `finish()` | shows the button, and once the finale's last line is spoken, waits `ONWARD_MS` and calls `goOn()` |
| same file, `goOn()` | `Transition.cover()` (the lesson's snowfall), then opens Part 2 |
| same file, `restart()` | Play again / restart cancel the move |

## Tests

```
npm run setup        # installs each part's dev tools (jsdom, Playwright, sharp)
npm test             # Part 1's logic + headless playthrough, and Part 2's build check
npm run test:part1:browser   # Part 1 played in a real Chrome
npm run test:part2           # Part 2's full Playwright suite (heavy: one worker)
```

Each part's suites run against that part's own server, rooted at its own folder, exactly as
they did in the original repositories. See each part's README for what the suites guard.

## Deploying

The repo root is the site. With Vercel: import the repo, leave **Root Directory** empty, no
build command. `vercel.json` sets the cache rules. Part 1's `src/` and every HTML page must
revalidate. Part 2's assets are immutable for a year, which is safe because its build stamps
every asset URL with a content hash (`?v=`). `trailingSlash: true` keeps each part's relative
URLs resolving from its own folder.

Any static host works the same way (GitHub Pages, Netlify, S3): serve the root, open `/`.

## Where it came from

Merged from two repositories, taking their files without their history:

- Part 1: [`tarun-figmaboy-838/polygone-learnig-game`](https://github.com/tarun-figmaboy-838/polygone-learnig-game)
- Part 2: [`tarun-figmaboy-838/frozen-rush-2`](https://github.com/tarun-figmaboy-838/frozen-rush-2)

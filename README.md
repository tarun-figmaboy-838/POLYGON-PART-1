# Polygon Adventure

A two-part browser game about polygons, set in one frozen world.

| | Part | What the child does | Folder |
|---|---|---|---|
| **1** | **Swiftee & the Polygons** (learn) | A narrated story lesson. Swiftee introduces vertices, sides, angles and diagonals, then convex vs concave and regular vs irregular, and ends on a summary of every idea. | [`part1-swiftee-lesson/`](part1-swiftee-lesson/) |
| **2** | **Frozen Rush** (play) | An ice runner. Momo the mammoth is stopped by crevasses. Level 1: swipe a rope to drop the block with the right number of sides. Level 2: cut a slab along its diagonal to bridge two gaps. | [`part2-frozen-rush/`](part2-frozen-rush/) |

The home page ([`index.html`](index.html)) joins them: Part 1 first, then Part 2. The lesson's
finale has a **Part 2 ▶** button in the corner where *Next* sat all lesson, and Frozen Rush's
ending has a **Home** button. The home page ticks off each part as it is finished.

No framework and no build step. Everything is plain static files.

## Play it

**Windows, no installs:** double-click **`START GAME.bat`**. It starts a small local server
(`serve.ps1`) and opens the home page in Edge.

**With Node:**

```
npm start            # http://localhost:8000
```

**Straight off the disk:** open `index.html`. Everything works, but the lesson uses the
browser's voice instead of the recorded one, and Frozen Rush plays without its music and
recorded sounds (browsers block those on `file://`).

| URL | Opens |
|---|---|
| `/` | the home page |
| `/part1-swiftee-lesson/` | Part 1 directly |
| `/part2-frozen-rush/game/` | Part 2 directly |

## Layout

```
index.html              the home page: both parts, progress, what they teach
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
developed on its own exactly as before. The merge added only the home page, the root tooling,
and the three small hooks listed below.

## How the parts talk to each other

There is one shared thing: a `localStorage` key, `polygon-adventure:v1`, holding
`{ lesson: <time finished>, rush: <time finished> }`.

| Where | What it does |
|---|---|
| `part1-swiftee-lesson/src/game/game.js`, `finish()` | writes `lesson`; shows `#continue` (Part 2 ▶) |
| `part2-frozen-rush/game/index.html`, inline script | watches `#complete` and writes `rush` when the ending opens |
| `index.html` (home) | reads the key: ticks finished parts, marks the next one, offers "Start the adventure over" |

It is only decoration. If a browser blocks storage (private window, locked-down school
machine), both games still play and the home page just points at Part 1. Part 2's own modules
and its generated `game.bundle.js` were not touched: the hook lives in its `index.html`.

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

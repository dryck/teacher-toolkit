# Teacher Toolkit

A shared home for our classroom instruments. One hub page links out to each
tool; every tool shares a common navbar and theme so it feels like one app.

## Live

https://dryck.github.io/teacher-toolkit/

## Documentation

| Doc | What it covers |
|-----|----------------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Setup, code standards, adding a tool, testing, release |
| [docs/CODEMAPS/INDEX.md](docs/CODEMAPS/INDEX.md) | How the repo fits together — start here |
| [docs/CODEMAPS/architecture.md](docs/CODEMAPS/architecture.md) | Monorepo layout and the shared shell contract |
| [docs/CODEMAPS/tool-pattern.md](docs/CODEMAPS/tool-pattern.md) | Templates and house rules for a new tool |
| [docs/CODEMAPS/firebase.md](docs/CODEMAPS/firebase.md) | Real-time tools: collections, rules, data flow |
| [docs/CODEMAPS/build-and-deploy.md](docs/CODEMAPS/build-and-deploy.md) | Build, test, ship, roll back |
| [extension/README.md](extension/README.md) | Chrome extension for embedding blocked sites |

## Structure

```
apps/
  hub/                   static landing page (cards linking to each tool)
  board/                 static — Lesson Board: pin several tools on one screen
  web-view/              static — Web Page tile: show a site without leaving the board
  noise-monitor/         React + Vite + TS — classroom noise level monitor
  quick-poll/            static — exit-ticket style instant polling
  random-picker/         static — spinning-wheel name picker
  visual-timer/          static — countdown timer with mascot
  research/              static — pedagogical foundation + citations for every tool
  zones/                 static — anonymous emotional check-in (Firebase-backed)
  exit-ticket/           static — 3-question end-of-lesson check (Firebase-backed)
  group-generator/       static — random/fair group generator
  behaviour-tracker/     static — per-student warning tracker (local only)
  restorative-circle/    static — guided turn-taking circle facilitator
  growth-mindset/        static — thought reframer + "Wall of Yet" (Firebase-backed)
  kagan-timer/           static — structured pair/team talk facilitator
  choice-board/          static — 3x3 task board with live progress (Firebase-backed)
  presentation-timer/    static — per-team presentation + Q&A timer
  assessment-checklist/  static — rubric-based team scoring (local only)
  snowball-wall/         static — 1-2-4-all idea-building wall (Firebase-backed)
  question-builder/      static — topic → Bloom's-leveled question bank (local only)
  challenge-deck/        static — draw-a-card task deck by category (Firebase-backed)
  think-time/            static — silent wait-time countdown + quick pick (local only)
  rotation-timer/        static — gallery-walk/carousel station timer (local only)
  chili-challenge/       static — self-chosen task-difficulty picker (Firebase-backed)
  help-ladder/           static — 5-step help hierarchy + "still stuck" signal (Firebase-backed)
  coin-flip/             static — random side-picker + creative-prompt combinator (local only)
  break-timer/           static — sensory/movement break menu + scheduled micro-breaks (local only)
  homework-menu/         static — shareable homework choice menu, no login (URL + localStorage only)
  behaviour-reflection/  static — 5-step guided post-incident reflection + private log (local only)
  brainstorm-timer/      static — random object + live class idea counter (Firebase-backed)
  behaviour-log/         static — ABC incident logging + per-student pattern view (local only)
  step-by-step/          static — projected instructions revealed one at a time (local only)
  hint-envelopes/        static — sequential hint reveal for a task (URL + localStorage only)
  jigsaw-coordinator/    static — auto-builds Jigsaw expert/home groups + phase timer (local only)
  peer-feedback/         static — anonymous "two stars and a wish" peer feedback (Firebase-backed)
  live-quiz/             static — live multiple-choice quiz with a running leaderboard (Firebase-backed)
  class-points/          static — tap-to-award points for students or teams (local only)
  kwl-chart/             static — shared Know/Want-to-know/Learned board (local only)
packages/
  shell/          shared navbar + theme (theme.css, navbar.css, navbar.js),
                  shared helpers (escape.js, toast.js, audio.js,
                  fullscreen.js), plus the shared Firebase config +
                  Firestore rules (firebase-config.js, firestore.rules)
                  used by every Firebase-backed tool — included by every
                  app so branding/nav/backend all stay in sync
extension/        Chrome extension that lets the Web Page tile embed sites
                  which normally refuse to be framed — install it per
                  teaching computer, see extension/README.md
scripts/          build.sh (assembles dist/) and serve.mjs (serves it)
tests/            Playwright smoke + behaviour tests, run against dist/
docs/CODEMAPS/    how the repo fits together — start here as a contributor
```

All but one tool is a plain single- or few-file HTML app with inline CSS and JS —
no bundler, no framework, no dependencies. `noise-monitor` is the one real npm
package in the monorepo (React/Vite/TS), because real-time microphone analysis
and eight animated themes earn it. Every tool loads `packages/shell`'s
navbar.js/theme.css via a relative `../shell/...` path, so the shared shell is a
single source of truth without forcing every tool onto the same framework.

## Develop

```bash
npm install
npm run build     # assembles the whole site into ./dist
npm run serve     # browse it at http://localhost:4173
npm test          # Playwright smoke + behaviour tests, run against ./dist
```

Build-and-serve is the reliable loop for the static tools. They reference the
shared shell as `../shell/...`, which only resolves once `scripts/build.sh` has
copied `packages/shell/` to `dist/shell/` — so opening `apps/<tool>/index.html`
straight from the file system shows the tool unstyled and without a navbar.
That's expected, not a bug. Editing a static tool is still a one-line loop:
re-run `npm run build` and refresh.

For the one framework app:

```bash
npm run dev:noise-monitor   # noise-monitor on http://localhost:3000
```

New contributor? Read [docs/CODEMAPS/INDEX.md](docs/CODEMAPS/INDEX.md) for how
the repo fits together, and [CONTRIBUTING.md](CONTRIBUTING.md) for the
step-by-step process for adding a tool.

## Build

```bash
npm run build
```

Produces a single deployable site in `./dist`:

```
dist/
  index.html          hub
  shell/               shared navbar/theme/Firebase assets
  noise-monitor/       built React app
  <every other tool>/  copied as-is from apps/<tool>/ (no build step)
```

## Firebase setup

Eleven tools need a live backend — student phones/devices write to it, a
teacher screen watches it update in real time — and they all share **one**
Firebase project via `packages/shell/firebase-config.js`:

- **Zones Check-In** — anonymous zone counters (`zonesSessions`)
- **Exit Ticket** — end-of-lesson responses (`exitTicketSessions`)
- **Choice Board** — per-student task progress (`choiceBoardSessions`)
- **Growth Mindset** — the moderated "Wall of Yet" (`growthWallSessions`)
- **Snowball Wall** — phase-tracked sticky notes (`snowballSessions`)
- **Challenge Deck** — per-student card progress (`challengeDeckSessions`)
- **Chili Challenge** — per-student difficulty choice (`chiliChallengeSessions`)
- **Help Ladder** — its "Ask 3 Before Me" mode only; anonymous "still stuck" signals (`helpLadderSessions`) — the ladder display itself is fully local
- **Brainstorm Timer** — anonymous live idea count (`brainstormSessions`)
- **Peer Feedback** — anonymous "two stars and a wish" submissions (`peerFeedbackSessions`)
- **Live Quiz** — live multiple-choice quiz + derived leaderboard (`liveQuizSessions`)

Every other tool is fully local (localStorage only), no backend needed.

One-time setup (do this once, it covers every tool above):

1. Create a free project at console.firebase.google.com, enable **Firestore
   Database** (production mode), and register a **Web app** to get a config
   object.
2. Paste that config into `packages/shell/firebase-config.js`, replacing the
   `REPLACE_ME` placeholders (the `apiKey` etc. are public identifiers, safe to
   commit — security comes from Firestore rules, not from hiding this).

   > The committed file is still placeholders, and `deploy.yml` doesn't inject
   > one at build time, so these eleven tools currently can't reach a backend on
   > the live site. Fix by committing a real config or adding a workflow step
   > that writes the file before `npm run build`.
3. Paste `packages/shell/firestore.rules` into Firebase Console -> Firestore
   Database -> Rules -> Publish. This scopes reads/writes to only each
   tool's own collection/subcollections (and, for Exit Ticket/Choice
   Board/Growth Mindset, only the fields each is expected to write) — no
   student identity is ever required or stored. See the comments at the
   top of that file for the exact schema each tool uses.

Each backend-dependent tool follows the same student-page/teacher-page
split: a bare, standalone student page with no toolkit navbar (joined via
`?session=CODE` from a link/QR code — students never see or can navigate
the rest of the toolkit) and a `teacher.html` (or `wall.html`) page with
the full navbar that generates the session code + QR and shows the live
dashboard.

## Deploy

Pushing to `main` builds `./dist`, runs the full Playwright suite against it,
and deploys to GitHub Pages via `.github/workflows/deploy.yml`. The tests are a
gate — a page that throws on load cannot reach production. Pull requests build
and test but do not deploy. There is no staging: `main` is production.

To roll back, `git revert` the bad commit and push; a fresh build redeploys in
two to four minutes. If the build itself fails, nothing deploys and the last
good version keeps serving. Full detail, including monitoring gaps, is in
[docs/CODEMAPS/build-and-deploy.md](docs/CODEMAPS/build-and-deploy.md).

## Troubleshooting

**A tool loads with no navbar and no styling.** You opened the file directly
from `apps/`. Run `npm run build && npm run serve` and browse via
`http://localhost:4173` instead. (Student pages for Firebase-backed tools have
no navbar by design — that one is intentional.)

**A Firebase-backed tool shows no data / the dashboard never updates.** Check,
in order: (1) `packages/shell/firebase-config.js` still contains `REPLACE_ME`
placeholders — it does on a fresh clone, and the deploy workflow does not inject
a real config, so these tools do not work on the live site until one is
committed; (2) `firestore.rules` has been pasted into the Firebase Console and
published — production-mode defaults deny everything; (3) your tool writes a
field that isn't in that collection's `hasOnly([...])` allowlist, which rejects
the write.

**I added a tool, it works locally, but 404s in production.** You missed the
hardcoded tool list in `scripts/build.sh`. Nothing fails loudly — the build
succeeds and the navbar links to a directory that was never copied into `dist/`.

**A tool goes silent after a few alarms.** Something is calling
`new AudioContext()` instead of `TKAudio.ctx()`. Browsers cap contexts at about
six per page, after which every sound in the tool dies for the rest of the
lesson.

**The Web Page tile or a Lesson Board pane is blank.** The site refuses to be
embedded via `X-Frame-Options` or CSP. Install the Chrome extension in
`extension/` (see its README), or use the tile's **↗ Tab** button.

**`npm test` can't find pages / everything passes suspiciously fast.** The tests
run against `./dist`. Run `npm run build` first.

## Adding a new tool

The complete checklist, templates and worked examples are in
[CONTRIBUTING.md](CONTRIBUTING.md) and
[docs/CODEMAPS/tool-pattern.md](docs/CODEMAPS/tool-pattern.md). In brief:

1. Static tool: add `apps/<name>/index.html`, link `../shell/theme.css` and
   `../shell/navbar.css` in `<head>`, and before `</body>` add:
   ```html
   <script>window.TK_CURRENT = '<name>';</script>
   <script src="../shell/navbar.js"></script>
   ```
2. Register it in `packages/shell/navbar.js`'s `TOOLS` list and add a card to
   `apps/hub/index.html`. The `TOOLS` entry also makes it appear in the Lesson
   Board's tool picker automatically.
3. **Add `<name>` to the `for tool in ...` list in `scripts/build.sh`.** That
   list is hardcoded; a tool missing from it is never copied into `dist/`, the
   build still succeeds, and the link 404s in production.
4. If it's a build-step app (React/Vite/etc.), add it to `workspaces` in the
   root `package.json` and give it a real build step in `scripts/build.sh`
   (see the noise-monitor block) rather than a plain copy.
5. Firebase-backed tools: split it into a bare student `index.html` and a
   `teacher.html`, and add a `match` block with an explicit field allowlist to
   `packages/shell/firestore.rules`, then publish it in the Firebase Console.
6. Verify with `npm run build && npm test`, then click through it at
   `npm run serve` — including inside `/board/`, where it must fit a pane.
7. **Every new tool needs a description — this is not optional:**
   - A one-sentence description on its hub card (`apps/hub/index.html`).
   - A section on `apps/research/index.html` explaining its pedagogical
     foundation: what learning theory or research it's grounded in, why
     that matters for the classroom, at least one pull-quote citation, and
     a "Key research" list of sources. Follow the structure of the
     existing sections (Noise Monitor / Quick Poll / Random Picker /
     Visual Timer) and add its anchor to the jump-link nav at the top of
     the page.

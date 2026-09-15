# Teacher Toolkit

A shared home for our classroom instruments. One hub page links out to each
tool; every tool shares a common navbar and theme so it feels like one app.

## Live

https://dryck.github.io/teacher-toolkit/

## Structure

```
apps/
  hub/                   static landing page (cards linking to each tool)
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
packages/
  shell/          shared navbar + theme (theme.css, navbar.css, navbar.js),
                  plus the shared Firebase config + Firestore rules
                  (firebase-config.js, firestore.rules) used by every
                  Firebase-backed tool — included by every app so
                  branding/nav/backend all stay in sync
```

The static tools (`quick-poll`, `random-picker`, `visual-timer`) are plain
single-file HTML apps. `noise-monitor` is the one real npm package in the
monorepo (React/Vite). All of them load `packages/shell`'s navbar.js/theme.css
via a relative `../shell/...` path, so the shared shell is a single source of
truth without forcing every tool onto the same framework.

## Develop

```bash
npm install
npm run dev:noise-monitor   # noise-monitor app on http://localhost:3000
```

The static tools (`hub`, `quick-poll`, `random-picker`, `visual-timer`) don't
need a dev server — open their `index.html` directly, or serve `apps/` with
any static file server.

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

Nine tools need a live backend — student phones/devices write to it, a
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

Every other tool is fully local (localStorage only), no backend needed.

One-time setup (do this once, it covers all four tools above):

1. Create a free project at console.firebase.google.com, enable **Firestore
   Database** (production mode), and register a **Web app** to get a config
   object.
2. Paste that config into `packages/shell/firebase-config.js` (the `apiKey`
   etc. are public identifiers, safe to commit — security comes from
   Firestore rules, not from hiding this).
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

Pushing to `main` builds and deploys `./dist` to GitHub Pages via
`.github/workflows/deploy.yml`.

## Adding a new tool

1. Static tool: add `apps/<name>/index.html`, link `../shell/theme.css` and
   `../shell/navbar.css` in `<head>`, and before `</body>` add:
   ```html
   <script>window.TK_CURRENT = '<name>';</script>
   <script src="../shell/navbar.js"></script>
   ```
2. Register it in `packages/shell/navbar.js`'s `TOOLS` list and add a card to
   `apps/hub/index.html`.
3. If it's a build-step app (React/Vite/etc.), add it to `workspaces` in the
   root `package.json` and wire it into `scripts/build.sh`.
4. **Every new tool needs a description — this is not optional:**
   - A one-sentence description on its hub card (`apps/hub/index.html`).
   - A section on `apps/research/index.html` explaining its pedagogical
     foundation: what learning theory or research it's grounded in, why
     that matters for the classroom, at least one pull-quote citation, and
     a "Key research" list of sources. Follow the structure of the
     existing sections (Noise Monitor / Quick Poll / Random Picker /
     Visual Timer) and add its anchor to the jump-link nav at the top of
     the page.

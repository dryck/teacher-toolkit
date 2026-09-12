# Teacher Toolkit

A shared home for our classroom instruments. One hub page links out to each
tool; every tool shares a common navbar and theme so it feels like one app.

## Live

https://dryck.github.io/teacher-toolkit/

## Structure

```
apps/
  hub/            static landing page (cards linking to each tool)
  noise-monitor/  React + Vite + TS — classroom noise level monitor
  quick-poll/     static — exit-ticket style instant polling
  random-picker/  static — spinning-wheel name picker
  visual-timer/   static — countdown timer with mascot
  research/       static — pedagogical foundation + citations for every tool
  zones/          static — anonymous emotional check-in (Firebase-backed)
packages/
  shell/          shared navbar + theme (theme.css, navbar.css, navbar.js)
                  included by every app so branding/nav stay in sync
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
  shell/               shared navbar/theme assets
  noise-monitor/       built React app
  quick-poll/
  random-picker/
  visual-timer/
  research/
  zones/
```

## Zones Check-In (Firebase setup)

Unlike the other tools, Zones Check-In needs a live backend — student
phones write to it, the teacher's screen watches it update in real time.
It uses Firebase (Firestore) via the CDN compat SDK, no build step needed.

One-time setup:

1. Create a free project at console.firebase.google.com, enable **Firestore
   Database** (production mode), and register a **Web app** to get a config
   object.
2. Paste that config into `apps/zones/firebase-config.js` (the `apiKey` etc.
   are public identifiers, safe to commit — security comes from Firestore
   rules, not from hiding this).
3. Paste `apps/zones/firestore.rules` into Firebase Console -> Firestore
   Database -> Rules -> Publish. This restricts reads/writes to only the
   `zonesSessions/{sessionId}` documents (just the 4 zone counts as
   numbers) — no student identity is ever stored.

`apps/zones/index.html` is the student check-in screen (join via
`?session=CODE`); `apps/zones/teacher.html` is the live dashboard (generates
a session code + QR on load, subscribes to live counts, has Reset/New
Session/Hide controls).

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

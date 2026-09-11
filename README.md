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
```

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

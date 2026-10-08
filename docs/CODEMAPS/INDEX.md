# Teacher Toolkit — Codemaps

**Last updated:** 2026-10-06
**Repo:** monorepo, 38 tools under `apps/`, one shared shell under `packages/shell/`
**Live:** https://dryck.github.io/teacher-toolkit/

These codemaps describe how the repository is actually wired, so you can find
the right file without reading 38 tools. Start with whichever matches your task.

| Codemap | Read it when you want to... |
|---------|-----------------------------|
| [architecture.md](architecture.md) | Understand the monorepo layout, the shared shell contract, and why most tools are single-file HTML |
| [tool-pattern.md](tool-pattern.md) | Add a new tool, or change an existing one, and match the house pattern |
| [firebase.md](firebase.md) | Work on a real-time tool: collections, session codes, security rules, student/teacher split |
| [build-and-deploy.md](build-and-deploy.md) | Build locally, run tests, ship to GitHub Pages, or roll back a bad deploy |

## The 30-second version

```
apps/<tool>/index.html   one self-contained HTML page per tool (inline CSS + JS)
      |
      +-- ../shell/theme.css    shared design tokens
      +-- ../shell/navbar.css   shared navbar styling
      +-- ../shell/navbar.js    injects the navbar, owns the TOOLS registry
      +-- ../shell/*.js         optional helpers: toast, audio, escape, fullscreen
      +-- ../shell/firebase-config.js   only the 11 real-time tools

scripts/build.sh  ->  dist/   (copy static tools as-is, npm-build noise-monitor)
      |
      +-- tests/*.spec.mjs runs against dist/  ->  GitHub Pages
```

Only `apps/noise-monitor` has a build step (React + Vite + TypeScript). Every
other tool is plain static files that work by opening `index.html` in a browser.

## Known documentation/code drift

Checked 2026-10-06. Fix these when you touch the relevant area:

1. **`packages/shell/firebase-config.js` ships `REPLACE_ME` placeholders.**
   The deploy workflow does not inject a real config, so all 11 Firebase-backed
   tools fail to connect on the live GitHub Pages site. Either commit a real
   web config (it is a public identifier, not a secret — see
   [firebase.md](firebase.md)) or inject it in the workflow.
2. **`apps/board` (Lesson Board) and `apps/web-view` (Web Page) have no section
   in `apps/research/index.html`**, which the contributing rules require for
   every tool.
3. **`apps/noise-monitor/README.md` and `CONTRIBUTING.md` still point at the
   pre-monorepo standalone repo** `github.com/dryck/sound-level-monitor`, with
   clone/install instructions that no longer apply here.
4. **`extension/` (the Chrome Embed Unblocker) is not mentioned in the root
   README**, even though the Web Page tile and Lesson Board depend on it for
   many sites.

## Related docs

- [`/CONTRIBUTING.md`](../../CONTRIBUTING.md) — how to add a tool, test it, ship it
- [`/README.md`](../../README.md) — project overview and setup
- [`/extension/README.md`](../../extension/README.md) — Chrome embed unblocker
- [`/apps/noise-monitor/README.md`](../../apps/noise-monitor/README.md) — the one framework app

# Contributing to Teacher Toolkit

Thanks for helping. This repo is a set of classroom instruments that run on a
projector in front of 30 children, so the bar is "works first time, every time,
with no login" rather than "architecturally impressive".

New here? Read [`docs/CODEMAPS/INDEX.md`](docs/CODEMAPS/INDEX.md) first — it is
four short maps of how the repo actually fits together.

## Setup

```bash
git clone https://github.com/dryck/teacher-toolkit.git
cd teacher-toolkit
npm install
npm run build          # assembles ./dist
npm run serve          # http://localhost:4173
```

**Build and serve, don't open files directly.** The shared navbar and theme live
at `packages/shell/` but tools reference them as `../shell/...`, which only
resolves in the built `dist/`. Opening `apps/<tool>/index.html` straight from the
file system gives you an unstyled page with no navbar — the tool is not broken.

Working on the one framework app:

```bash
npm run dev:noise-monitor     # Vite dev server on http://localhost:3000
```

## Code standards

There is no linter or formatter in CI, so these are conventions, enforced by
review. Match the surrounding file.

- **Plain static HTML by default.** One self-contained `index.html` per tool,
  inline `<style>` and `<script>`. Do not introduce a framework, bundler or npm
  dependency for a tool that does not need one. `noise-monitor` is the single
  exception and it earned it.
- **Use the shared shell, never a local copy:** `escapeHtml()` for any
  student-typed text rendered via `innerHTML`, `TKToast` instead of `alert()`,
  `TKAudio.ctx()` instead of `new AudioContext()`. Each of these replaced a
  copy-pasted version that caused a real classroom bug — see
  [`docs/CODEMAPS/architecture.md`](docs/CODEMAPS/architecture.md).
- **Theme with `--tk-*` tokens** from `shell/theme.css`; don't hardcode colours.
- **Keep logic in top-level named functions.** The behaviour tests drive the
  shipped functions inside the page rather than an extracted copy.
- **Comments explain *why*.** The existing comments in `scripts/serve.mjs`,
  `tests/smoke.spec.mjs` and `shell/audio.js` are the house style: they record
  the bug or constraint that forced the design.
- **No student identity, ever.** No logins, no device IDs, no names tied to
  stored data. This is a hard product constraint, not a preference.
- **Commit messages** are a sentence describing the user-visible effect, e.g.
  `Fix orphaned delay timer letting Noise Monitor commit early`.

## Adding a new tool

The full template, worked examples and house rules are in
[`docs/CODEMAPS/tool-pattern.md`](docs/CODEMAPS/tool-pattern.md). The checklist:

1. Create `apps/<name>/index.html` from the template, linking
   `../shell/theme.css` and `../shell/navbar.css`, and before `</body>`:
   ```html
   <script>window.TK_CURRENT = '<name>';</script>
   <script src="../shell/navbar.js"></script>
   ```
2. Register it in the `TOOLS` array in `packages/shell/navbar.js`. This also
   makes it appear in the Lesson Board picker automatically.
3. Add a card with a one-sentence description to `apps/hub/index.html`.
4. **Add `<name>` to the tool list in `scripts/build.sh`.** Miss this and the
   tool silently never deploys — the build still succeeds and the navbar link
   404s in production.
5. Add a `<section id="<name>">` to `apps/research/index.html`: the learning
   theory it rests on, why that matters in a classroom, at least one pull-quote
   citation, a "Key research" source list, and its anchor in the top jump-nav.
   **This is not optional** — the research page is what makes the toolkit
   defensible to a head of department.
6. Add it to the structure list in `README.md`, marked local or Firebase-backed.
7. Real-time tools only: add a `match` block with an explicit field allowlist to
   `packages/shell/firestore.rules` and publish it in the Firebase Console. See
   [`docs/CODEMAPS/firebase.md`](docs/CODEMAPS/firebase.md).
8. Build-step apps only: add to `workspaces` in the root `package.json` and wire
   a real build into `scripts/build.sh`.

## Testing requirements

```bash
npm run build && npm test
```

Tests run against the built `dist/`, not the sources, so the build is covered too.

| Suite | Scope |
|-------|-------|
| `tests/smoke.spec.mjs` | Every built page must load with no uncaught exception and no unexpected `console.error`; pages that load the navbar must render it. Automatic — a new tool is covered the moment it reaches `dist/`. |
| `tests/logic.spec.mjs` | Opt-in behaviour tests for logic that can be quietly wrong rather than crashing. |

**Write a logic test if your tool makes a promise a teacher cannot verify by
eye**: fairness ("everyone gets picked once"), group allocation ("nobody is
dropped"), or timing that must survive a backgrounded tab. Use Playwright's
clock API to fast-forward animations, as the existing tests do.

A smoke-test pass is the minimum bar, not proof it works. Before opening a PR,
also click through your tool at `npm run serve`, check its hub card, and open it
inside `/board/` to confirm it fits a pane. For real-time tools, test with two
devices on a real session code — CI has no Firebase credentials and cannot.

## Pull requests

- Branch off `main`; PRs build and run the full test suite but do not deploy.
- Describe the classroom problem the change solves, not just the diff.
- Include a screenshot for anything visual — these tools live on a projector.
- Note any new Firestore fields, because the rules must be updated and
  republished or the writes will be rejected in production.

## Releasing

There is no release process or version tagging. **Merging to `main` is the
release.** The workflow builds, runs the smoke and logic suites, and publishes
`./dist` to GitHub Pages only if the tests pass. Expect two to four minutes.

If something ships broken, see the rollback section of
[`docs/CODEMAPS/build-and-deploy.md`](docs/CODEMAPS/build-and-deploy.md). The
short version: `git revert` and push. A failing build does not deploy, so
production keeps serving the last good version.

## Reporting bugs

Open an issue with: what you expected, what happened, which tool, the browser
and device, and whether you were on a projector/fullscreen or a student phone.
Screenshots help more than stack traces for this codebase.

## Code of conduct

Be respectful and constructive. Focus on what actually helps teachers and
students in a real room. Welcome newcomers — most contributors here are
teachers first and programmers second.

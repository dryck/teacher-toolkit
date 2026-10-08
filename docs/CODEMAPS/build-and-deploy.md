# Build & Deploy Codemap

**Last updated:** 2026-10-06
**Build:** `scripts/build.sh` → `./dist`
**Deploy:** `.github/workflows/deploy.yml` → GitHub Pages
**Tests:** `playwright.config.mjs`, `tests/*.spec.mjs`, served by `scripts/serve.mjs`

## Build flow

```
npm run build  ->  bash scripts/build.sh   (set -euo pipefail, cd to repo root)
   │
   ├─ 1. rm -rf dist && mkdir dist           clean every time, no stale output
   │
   ├─ 2. cp -r packages/shell  dist/shell    shared navbar/theme/Firebase assets
   │
   ├─ 3. cp -r apps/hub/.      dist/         hub becomes dist/index.html
   │
   ├─ 4. for tool in <explicit list>:        36 static tools copied wholesale
   │        cp -r apps/$tool/. dist/$tool/   ⚠ HARDCODED LIST — see below
   │
   └─ 5. npm run build --workspace apps/noise-monitor
            cp -r apps/noise-monitor/dist/. dist/noise-monitor/

Result:
dist/
  index.html            hub landing page
  shell/                theme.css, navbar.js, firebase-config.js, firestore.rules, ...
  noise-monitor/        Vite output (hashed assets/)
  <tool>/               every other tool, verbatim
```

### The one footgun

Step 4 iterates a **hardcoded tool list** inside `scripts/build.sh`. A new
directory under `apps/` is not picked up automatically, and nothing fails — the
build succeeds, the navbar links to the tool, and the link 404s in production.
Adding a tool means editing that list. (The smoke test only loads pages that
exist in `dist/`, so it cannot catch an omission either.)

Note also that `dist/shell/firestore.rules` is published as a static file. That
is harmless — the rules are not secret — but it is a side effect of copying the
whole shell directory.

## Testing

```bash
npm run build     # tests run against dist/, so build first
npm test          # playwright; auto-starts scripts/serve.mjs on :4173
npm run serve     # serve dist/ manually at http://localhost:4173
```

Playwright's `webServer` block starts `node scripts/serve.mjs 4173` itself and
reuses an existing server locally (`reuseExistingServer: !process.env.CI`). Tests
run `fullyParallel`, chromium only, `retries: 0`, trace retained on failure.

| Suite | What it guards |
|-------|----------------|
| `tests/smoke.spec.mjs` | Walks every `.html` in `dist/` (skipping `assets/`, `icons/`), loads it in a real browser, fails on any uncaught exception or non-allowlisted `console.error`, and asserts that pages loading `shell/navbar.js` actually render `.tk-navbar`. Also asserts >20 pages were found, so a broken glob can't vacuously pass. |
| `tests/logic.spec.mjs` | Behaviour of the things that are "quietly wrong" rather than crashing: Random Picker equity mode picking everyone once per cycle, Group Generator not dropping a student, timers not drifting. Uses Playwright's clock API to fast-forward multi-second animations. |

The logic tests deliberately call the **shipped** functions inside the page
(`page.evaluate(() => window.spinWheel())`) rather than an extracted copy,
because the tools keep logic inline and read the DOM directly.

Smoke tests exist because of a real regression: `random-picker`'s init called
`createWheel()` with no argument, every page load threw a `TypeError`, the wheel
silently never rendered, and it sat in production unnoticed.

## Deploy pipeline

```
push / PR to main
   │
   ▼
job: build (ubuntu-latest)
   checkout → setup-node 20 (npm cache) → npm ci
   → npm run build
   → npx playwright install --with-deps chromium
   → npm test                      ⬅ GATE: a page that throws cannot ship
   → upload playwright-report/ if: failure() (7-day retention)
   → configure-pages → upload-pages-artifact (path: ./dist)
   │
   ▼
job: deploy   needs: build,  if: github.ref == 'refs/heads/main'
   actions/deploy-pages@v4 → environment github-pages → page_url
```

- **Pull requests build and test but do not deploy** (the `if` on the deploy
  job). A PR gives you the full green/red signal before merge.
- `concurrency: group: "pages", cancel-in-progress: false` — deploys queue
  rather than cancel, so a rapid second push cannot leave a half-published site.
- Permissions are minimal: `contents: read`, `pages: write`, `id-token: write`.
- There is no staging environment. `main` is production.

## Pre-deploy checklist

```bash
npm ci                 # match CI exactly, not npm install
npm run build          # confirm dist/<your-tool>/ exists
npm test               # same gate CI applies
npm run serve          # click through your tool at localhost:4173
```

Also check by hand, since nothing automated covers them:

- Your tool's hub card renders and links correctly (`http://localhost:4173/`).
- Your tool loads inside the Lesson Board (`/board/`) without overflowing its pane.
- Real-time tools: open `teacher.html` on one device and the `?session=CODE`
  student URL on another, and confirm the dashboard updates live. CI cannot test
  this — it has no Firebase credentials.

## Rollback

There is no deploy-artifact rollback button; Pages publishes whatever the latest
successful `main` build produced. So rolling back means making `main` correct again.

**Preferred — revert the commit:**

```bash
git revert <bad-sha>     # or: git revert -m 1 <bad-merge-sha>
git push origin main     # triggers a fresh build → test → deploy (~2-4 min)
```

**Faster, for a tool that is broken but isolated:** comment the tool out of the
`TOOLS` array in `packages/shell/navbar.js` and its hub card, and push. The tool
stops being reachable from the navbar, board and hub while you fix it properly.

**If the build itself is broken** the deploy job never runs, so production keeps
serving the last good build. That is the intended failure mode — fix forward
without urgency.

**Re-publishing a known-good commit without a revert:** re-run the workflow for
that commit from the Actions tab (`Re-run all jobs`). This rebuilds from that
commit's tree and republishes it.

## Monitoring

Current state, honestly: **there is none beyond CI.** Worth knowing:

- Failures surface only as a red check in the Actions tab and GitHub's
  notification email to the pusher. Nobody is paged.
- There is no uptime check on https://dryck.github.io/teacher-toolkit/, no error
  reporting from real browsers, and no analytics. A tool that breaks only at
  runtime on a teacher's machine is discovered by a teacher.
- Firestore usage is visible only in the Firebase Console; free-tier quota
  exhaustion would make the 11 real-time tools fail with no local signal.

Low-cost improvements if this matters: a scheduled workflow curling a handful of
key URLs, a Firebase budget alert, and downloading the `playwright-report`
artifact when a build fails (it is uploaded automatically on failure).

## Related codemaps

- [tool-pattern.md](tool-pattern.md) — the registration steps the build depends on
- [architecture.md](architecture.md) — what `dist/` is assembled from
- [firebase.md](firebase.md) — why the live config is currently a placeholder

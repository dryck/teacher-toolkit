# Tool Pattern Guide

**Last updated:** 2026-10-06
**Read this before adding a tool.** Every tool in `apps/` follows one of two
shapes; matching them is what keeps 38 tools feeling like one product.

## Decide which shape you need

```
Does a student device need to send data to the teacher's screen live?
├── No  → LOCAL TOOL      one index.html, localStorage. 27 of 38 tools.
└── Yes → REAL-TIME TOOL  index.html (student) + teacher.html, Firestore. 11 tools.

Does it genuinely need a framework?
└── Almost certainly not. Only noise-monitor (real-time audio analysis,
    themed SVG animations) earns a build step. Adding a second build app
    means touching package.json workspaces AND scripts/build.sh.
```

## Local tool template

`apps/<name>/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><Tool Name> — Teacher Toolkit</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;600;700&family=Ubuntu:wght@400;500;700&display=swap">
  <link rel="stylesheet" href="../shell/theme.css">
  <link rel="stylesheet" href="../shell/navbar.css">
  <style>
    /* Tool-specific CSS. Use --tk-* tokens from theme.css, don't hardcode colours. */
    body.tk-embed footer { display: none; }  /* hide chrome on the Lesson Board */
  </style>
</head>
<body>
  <main> <!-- your UI --> </main>

  <script src="../shell/escape.js"></script>   <!-- if you render user text -->
  <script src="../shell/toast.js"></script>    <!-- if you report errors -->
  <script src="../shell/audio.js"></script>    <!-- if you make sounds -->
  <script>
    // Tool logic. Top-level functions are fine and are what the logic tests drive.
  </script>
  <script>window.TK_CURRENT = '<name>';</script>
  <script src="../shell/navbar.js"></script>
  <script src="../shell/fullscreen.js"></script>
</body>
</html>
```

## House rules

| Rule | Why |
|------|-----|
| Never `alert()` / `confirm()` — use `TKToast` | A native dialog freezes the page and every automated test of it; a hung Firestore write then reads as a crash |
| Never `new AudioContext()` — use `TKAudio.ctx()` | Browsers cap contexts at ~6 per page; the tool goes permanently silent once exceeded. Check for `null` |
| Never interpolate user text into `innerHTML` raw — use `escapeHtml()` | Student-typed text lands on a projected screen. The shared helper is null-safe; local copies rendered literal `"undefined"` |
| Use `--tk-*` tokens, not hardcoded colours | Theme stays consistent and dark/projector modes keep working |
| Handle `?embed=1` | The Lesson Board iframes your tool; `body.tk-embed` should hide your footer |
| Keep logic in top-level named functions | `tests/logic.spec.mjs` calls shipped functions in the page (`window.spinWheel()`) rather than a copied implementation |
| Session codes use `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` | No ambiguous `0/O/1/I` for a student squinting at a projector |

## Real-time tool: the student/teacher split

```
apps/<name>/
├── index.html     STUDENT page — bare, NO navbar, joined via ?session=CODE
├── teacher.html   TEACHER page — full navbar, generates code + QR, live dashboard
└── <name>.js      shared: initialises Firebase, exposes window.TK<Name>
```

The student page deliberately omits `navbar.js` so students cannot navigate into
the rest of the toolkit from a shared classroom link. The navbar registry entry
points at `teacher.html`, never `index.html`. See
[firebase.md](firebase.md) for script order, collection naming and rules.

## Registration checklist

A tool is not "added" until all of these are done.

1. **`packages/shell/navbar.js`** — add to the `TOOLS` array:
   ```js
   { key: '<name>', label: '<Tool Name>', href: '<name>/' },
   // real-time tools: href: '<name>/teacher.html'
   ```
   This single entry also makes the tool appear in the Lesson Board picker.
2. **`apps/hub/index.html`** — add an `<a class="card" href="<name>/">` with an
   icon, `<h2>` title and a one-sentence description. Not optional.
3. **`scripts/build.sh`** — add `<name>` to the `for tool in ...` list. **Forget
   this and the tool silently never deploys**; the build will not fail.
4. **`apps/research/index.html`** — add a `<section id="<name>">` covering: the
   learning theory it is grounded in, why that matters in a classroom, at least
   one pull-quote citation, and a "Key research" source list. Add its anchor to
   the jump-link nav at the top. Follow the existing sections' structure.
5. **`packages/shell/firestore.rules`** (real-time only) — add a `match` block
   with an explicit field allowlist, then publish it in the Firebase Console.
6. **`README.md`** — add the tool to the structure list with its one-line
   description and its local/Firebase status.
7. **Build-step apps only** — add to `workspaces` in the root `package.json` and
   wire a real build into `scripts/build.sh` (see the noise-monitor block).

## Verify before you open a PR

```bash
npm run build          # does your tool appear in dist/<name>/ ?
npm test               # smoke test loads it; must produce zero uncaught errors
npm run serve          # eyeball it at http://localhost:4173/<name>/
```

The smoke test also asserts that any page loading `shell/navbar.js` actually
renders `.tk-navbar`, so a broken shell reference fails CI rather than shipping.

## Worked examples to copy from

| You are building | Copy |
|------------------|------|
| A simple local tool | `apps/coin-flip/`, `apps/think-time/` |
| A local tool with saved state | `apps/behaviour-log/`, `apps/class-points/` |
| A shareable-by-URL tool (no backend) | `apps/homework-menu/`, `apps/hint-envelopes/` |
| A real-time tool, simplest backend | `apps/zones/` — 4 counters, one doc |
| A real-time tool with submissions | `apps/exit-ticket/`, `apps/peer-feedback/` |
| A real-time tool with per-student state | `apps/choice-board/`, `apps/live-quiz/` |
| Fairness/randomness logic worth testing | `apps/random-picker/`, `apps/group-generator/` |

## Related codemaps

- [architecture.md](architecture.md) — the shared shell contract in full
- [firebase.md](firebase.md) — backend collections, rules and setup
- [build-and-deploy.md](build-and-deploy.md) — how your tool reaches production

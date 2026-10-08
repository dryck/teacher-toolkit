# Architecture Codemap

**Last updated:** 2026-10-06
**Entry points:** `apps/hub/index.html` (landing), `packages/shell/navbar.js` (tool registry), `scripts/build.sh` (build)

## Shape of the repo

```
teacher-toolkit/
├── apps/                     38 tools, one directory each
│   ├── hub/                  landing page — cards linking to every tool
│   ├── board/                Lesson Board — iframes other tools into panes
│   ├── web-view/             Web Page tile — embeds an arbitrary URL
│   ├── research/             pedagogical rationale + citations for every tool
│   ├── noise-monitor/        the ONLY npm workspace (React + Vite + TS)
│   └── <34 others>/          single- or few-file static HTML
├── packages/
│   └── shell/                shared navbar, theme, helpers, Firebase config
├── extension/                Chrome MV3 extension: unblocks framed sites
├── scripts/
│   ├── build.sh              assembles dist/
│   └── serve.mjs             dependency-free static server for dist/
├── tests/
│   ├── smoke.spec.mjs        loads every built page, asserts no crashes
│   └── logic.spec.mjs        behaviour tests for fairness/timing logic
└── .github/workflows/deploy.yml   build → test → GitHub Pages
```

## The central design decision

Most tools are **one self-contained HTML file** with inline `<style>` and
`<script>`. No bundler, no framework, no import graph. A contributor can open
`apps/coin-flip/index.html` in a browser and the tool works.

What keeps 38 independent files feeling like one product is `packages/shell/`,
which every tool links by **relative path** (`../shell/...`).

That path resolves in `dist/`, not in the source tree. The build copies the
shell to `dist/shell/` and each tool to `dist/<tool>/`, which makes
`../shell/theme.css` correct. In the source tree the shell is at
`packages/shell/` and there is no `apps/shell/`, so the same path resolves to
nothing.

**Consequence for contributors:** opening `apps/<tool>/index.html` from the file
system shows the tool unstyled, with no navbar. That is expected. Use
`npm run build && npm run serve` and browse `http://localhost:4173` to see a
tool as it actually ships.

## Shared shell contract

| File | Purpose | How a tool opts in |
|------|---------|--------------------|
| `theme.css` | Design tokens (`--tk-*` colours, spacing, fonts) | `<link rel="stylesheet" href="../shell/theme.css">` |
| `navbar.css` | Navbar styling | `<link rel="stylesheet" href="../shell/navbar.css">` |
| `navbar.js` | Owns the `TOOLS` registry; injects the navbar; publishes `window.TK_TOOLS`; handles `?embed=1` | Set `window.TK_CURRENT = '<key>'`, then load the script |
| `escape.js` | Null-safe `escapeHtml()` for any student-typed text rendered via `innerHTML` | Load before use; exposed under its plain name |
| `toast.js` | `TKToast` non-blocking status banner (replaces `alert()`, which freezes the page and tests) | Load before use |
| `audio.js` | `TKAudio.ctx()` — one shared, lazily created `AudioContext` reused forever | Load before use; returns `null` if unsupported |
| `fullscreen.js` | Injects a fullscreen toggle for projectors | Load the script, no config |
| `firebase-config.js` | `window.TK_FIREBASE_CONFIG` — one project shared by all real-time tools | Load after the Firebase compat SDK, before the tool's own JS |
| `firestore.rules` | Security rules to paste into the Firebase Console | Not loaded at runtime; deployed manually |

### Why `TKAudio` exists

Each tool used to call `new AudioContext()` per sound. A context holds an OS
audio thread and is not garbage-collected while running, and browsers cap how
many a page may create (~6 in Chrome). Visual Timer's alarm alone opened six in
a row, after which every sound in the tool went silent for the rest of the
lesson. One shared context fixes that; oscillators remain throwaway.

### Why `TKToast` exists

Firestore writes against a misconfigured or offline backend never reject — they
hang. A native `alert()` freezes the whole page (and any automated test of it)
until dismissed, which reads to a teacher as a crash. `TKToast` shows the same
message without blocking, and callers pair it with a client-side timeout.

## The tool registry

`packages/shell/navbar.js` holds a single `TOOLS` array — key, label, href — and
publishes it as `window.TK_TOOLS`. This is the **one** place a tool's navigation
identity is declared:

- The navbar builds itself from it.
- The Lesson Board (`apps/board/index.html`) builds its tool picker from it, so
  a tool added to the registry appears on the board automatically.

Note the href convention: Firebase-backed tools point at `<tool>/teacher.html`
(or `growth-mindset/wall.html`), never at the student page.

## Embed mode

Any tool loaded with `?embed=1` gets `tk-embed` on `<body>` and the navbar is
skipped entirely. The Lesson Board appends that flag when it builds an iframe
URL, because the board already provides navigation and a projector needs the
vertical space. Each tool's own CSS can use `.tk-embed` to hide its footer.

```
board/index.html
  └── iframe src="../<tool>/?embed=1"   (TOOLS entry → URL, see board line ~321)
        └── tool page: navbar.js early-returns, body.tk-embed set
```

The board scales each iframe to fit its pane, and covers iframes with an overlay
while dragging so the panes — not the embedded tool — receive mouse events.

## Chrome extension

`extension/` is a Manifest V3 extension that strips `X-Frame-Options` and
`Content-Security-Policy` headers so the Web Page tile can embed sites that
otherwise refuse to be framed. It is deliberately narrow:
`resourceTypes: ["sub_frame"]` plus `initiatorDomains` limited to the toolkit's
own origin. It is installed per-computer via `chrome://extensions` → Load
unpacked; it is not part of the build or deploy.

## Related codemaps

- [tool-pattern.md](tool-pattern.md) — the exact template for a new tool
- [firebase.md](firebase.md) — the real-time tools' backend
- [build-and-deploy.md](build-and-deploy.md) — how this becomes a live site

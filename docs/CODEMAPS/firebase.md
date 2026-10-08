# Firebase Codemap

**Last updated:** 2026-10-06
**Config:** `packages/shell/firebase-config.js`
**Rules:** `packages/shell/firestore.rules` (226 lines, commented per collection)
**SDK:** Firebase compat v12.19.0, loaded from `gstatic.com` via `<script>` tags

## Which tools need a backend

11 of 38 tools. Everything else is localStorage-only and needs no setup.

| Tool | Collection | Navbar entry point |
|------|-----------|--------------------|
| Zones Check-In | `zonesSessions` | `zones/teacher.html` |
| Exit Ticket | `exitTicketSessions` | `exit-ticket/teacher.html` |
| Choice Board | `choiceBoardSessions` | `choice-board/teacher.html` |
| Growth Mindset | `growthWallSessions` | `growth-mindset/wall.html` |
| Snowball Wall | `snowballSessions` | `snowball-wall/teacher.html` |
| Challenge Deck | `challengeDeckSessions` | `challenge-deck/teacher.html` |
| Chili Challenge | `chiliChallengeSessions` | `chili-challenge/teacher.html` |
| Help Ladder | `helpLadderSessions` | `help-ladder/teacher.html` |
| Brainstorm Timer | `brainstormSessions` | `brainstorm-timer/teacher.html` |
| Peer Feedback | `peerFeedbackSessions` | `peer-feedback/teacher.html` |
| Live Quiz | `liveQuizSessions` | `live-quiz/teacher.html` |

Help Ladder is partial: only its "Ask 3 Before Me" mode writes to Firestore
(anonymous "still stuck" signals). The ladder display itself is fully local.

Verify this list with:

```bash
grep -rl firebase-config apps | cut -d/ -f2 | sort -u
```

## Data flow

```
TEACHER SCREEN (projector)                 STUDENT DEVICES (phones)
──────────────────────────                 ────────────────────────
<tool>/teacher.html                        <tool>/index.html
  full toolkit navbar                        NO navbar — standalone
  |                                          |
  1. generate 5-char session code            joined via ?session=CODE
     (A-Z2-9, no ambiguous 0/O/1/I)          from a link or QR code
  2. render QR + link  ──────────────────▶   3. student submits
  |                                          |
  |                                          ▼
  |                            firestore: <tool>Sessions/{CODE}
  |                                       (+ a subcollection per
  |                                        submission, where needed)
  ▼                                          |
  4. onSnapshot() live listener  ◀───────────┘
     dashboard updates in real time
```

Students never see or can navigate the rest of the toolkit — the student page is
deliberately bare, with no navbar. No login, no student identity, no device ID.

## Script load order

Every Firebase-backed page loads these in exactly this order:

```html
<script src="https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore-compat.js"></script>
<script src="../shell/firebase-config.js"></script>   <!-- window.TK_FIREBASE_CONFIG -->
<script src="<tool>.js"></script>                     <!-- shared tool helpers -->
<script> /* page-specific logic */ </script>
<script>window.TK_CURRENT = '<tool>';</script>        <!-- teacher page only -->
<script src="../shell/navbar.js"></script>            <!-- teacher page only -->
<script src="../shell/fullscreen.js"></script>        <!-- teacher page only -->
```

## The per-tool shared module

Tools with a student/teacher split put everything both pages need in one
`apps/<tool>/<tool>.js`, which initialises Firebase once and exposes a single
namespaced object. `apps/zones/zones.js` is the canonical example:

```js
firebase.initializeApp(window.TK_FIREBASE_CONFIG);
const db = firebase.firestore();
// ... ZONES config, randomSessionCode(), sessionDocRef(), emptyCounts()
window.TKZones = { db, ZONES, randomSessionCode, sessionDocRef, emptyCounts };
```

Copy this shape for a new real-time tool: config constants, a `randomSessionCode`
(reuse the `CODE_CHARS` alphabet so codes stay unambiguous on a projector), a
`sessionDocRef(sessionId)`, and whatever shared shape helpers the two pages need.

## Security model

There is no authentication. Security comes entirely from
`packages/shell/firestore.rules`, which:

- Gives each tool its own top-level collection; a catch-all at the bottom denies
  everything else.
- Allows open reads. The teacher dashboard and a student are indistinguishable
  to the rules, so reads cannot be narrowed further without auth.
- Constrains writes with `request.resource.data.keys().hasOnly([...])` — an
  explicit field allowlist per collection — plus type and length checks
  (e.g. Choice Board nicknames must be a string ≤ 40 chars).
- Makes submission subcollections `allow create` only: `update, delete: if false`,
  so a student cannot edit or erase another's response.

Read the comments at the top of `firestore.rules`; they document the exact schema
each tool writes, including the three modes Exit Ticket multiplexes through one
collection (`ticket` | `clearCloudy` | `trafficLight`).

**Any new field a tool writes must be added to that collection's allowlist, or
the write is rejected silently-ish** — Firestore surfaces a permission error in
the console but the tool's UI may just appear to hang.

## Setup (once, covers all 11 tools)

1. Create a free project at console.firebase.google.com.
2. Enable **Firestore Database** in production mode.
3. Register a **Web app** to get the config object.
4. Paste it into `packages/shell/firebase-config.js`, replacing the `REPLACE_ME`
   placeholders. These values are **public identifiers, not secrets** — they are
   safe to commit and deploy; security comes from the rules file.
5. Paste `packages/shell/firestore.rules` into Firebase Console → Firestore
   Database → Rules → **Publish**. Without this step, production-mode defaults
   deny every read and write and all 11 tools appear broken.

### Current state: the committed config is a placeholder

`packages/shell/firebase-config.js` contains `REPLACE_ME` on `main`, and
`.github/workflows/deploy.yml` does not inject one at build time. The live
GitHub Pages site therefore ships 11 tools that cannot reach a backend. To fix,
either commit the real web config or add a step to the workflow that writes the
file before `npm run build`.

## Why the tests tolerate Firebase errors

`tests/smoke.spec.mjs` fails a page on any uncaught exception, but filters
console errors through an allowlist (`/firestore/i`, `/firebase/i`,
`/net::ERR_/i`, `/permission[- ]denied/i`, ...). CI has no network credentials,
so real-time tools legitimately log connection failures there. Keep that
allowlist narrow — it is the one place a genuine error can hide.

## Related codemaps

- [tool-pattern.md](tool-pattern.md) — full student/teacher page template
- [architecture.md](architecture.md) — the shared shell this plugs into

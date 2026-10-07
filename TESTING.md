# Testing

Two suites, deliberately separate: one runs anywhere, one needs a backend.

## `npm test` — 58 tests, no setup

```bash
npm run build   # the suite runs against dist/, so build first
npm test
```

- **`tests/smoke.spec.mjs`** loads every built page in Chromium and fails on an
  uncaught exception, an unexpected `console.error`, or a missing navbar. It
  exists because `random-picker` once shipped a `TypeError` on every page load
  and nobody noticed, since nothing loaded these pages except a human clicking.
- **`tests/logic.spec.mjs`** drives the real shipped functions for the places
  where "quietly wrong" costs something: the picker's fairness promise, group
  sizes, and timer drift in a throttled background tab.

## `npm run test:rules` — 29 tests, needs a JVM

```bash
npm run test:rules
```

It starts the Firestore emulator itself. The one prerequisite it cannot
install is a JDK, because `firebase-tools` 15 needs **Java 21 or newer**:

```bash
brew install openjdk@21
export PATH="/usr/local/opt/openjdk@21/bin:$PATH"   # or $(brew --prefix)/opt/...
```

`tests/rules.integration.mjs` asserts both directions of the security model:

- enumeration denied on all 11 collections, `get` on a known code still allowed
- a student cannot rewrite a teacher's session config, or claim one as owner
- growth-wall entries cannot be self-approved; a snowball wall cannot be wiped
- Zones counters move but nothing else on that document does
- student submissions stay inside their declared shape (length and range caps)
- sessions predating `ownerUid` degrade deliberately: still readable, still
  accept submissions, config no longer editable

Kept out of `npm test` on purpose. Without a JVM it cannot run, and a suite
that silently no-ops when its backend is absent is worse than one that is
honestly separate. CI runs it as its own job, and the deploy depends on it.

## What is and is not covered

| Area | Covered by | Status |
|---|---|---|
| Every page loads clean | smoke | ✅ CI |
| Picker fairness, group sizes, timer drift | logic | ✅ CI |
| Firestore rules, both directions | rules.integration | ✅ CI (29 tests) |
| Real-time teacher/student sync | — | ❌ none |
| `noise-monitor` (React, ~3.5k lines) | — | ❌ no test runner configured |
| `packages/shell/escape.js` | — | ❌ none, despite 17 call sites |

### The gap that matters most

The rules are verified. The **client write paths are not**.

`packages/shell/firebase-config.js` still contains `REPLACE_ME`, so no page has
ever reached a Firebase backend. Anonymous sign-in, `ownerUid` stamping by
`TKFirebase.createSession()`, and the join-code existence checks are all
exercised only by reading them. `smoke.spec.mjs` additionally allowlists
`/firebase/i` and `/firestore/i` console errors — correct while there is no
config, but it means a genuine Firestore bug passes CI today.

Before trusting the Firebase-backed tools in a classroom:

1. Put a real config in `firebase-config.js` (it is a public identifier, safe
   to commit; security comes from the rules, which are now tested).
2. Publish `packages/shell/firestore.rules` to the project, and set a TTL
   policy on `createdAt` for each collection.
3. Narrow `IGNORED_CONSOLE` in `smoke.spec.mjs` so Firebase errors fail again.
4. Open one teacher page and one student page and check a write lands. This is
   the step nothing automated covers yet.

## Troubleshooting

**`npm test` fails with `ENOENT` on a page** — `dist/` is stale, or a build was
running during the suite. Re-run `npm run build`, then `npm test`.

**`test:rules` fails with "no longer supports Java version before 21"** — a
JDK is installed but too old, or `/usr/bin/java` is macOS's stub. Put a real
JDK 21+ first on `PATH` (see above).

**`test:rules` says port 8080 is taken** — an emulator is already running. The
config reuses it (`reuseExistingServer: true`), so this usually means a stale
process: `pkill -f "firebase.*emulators"`.

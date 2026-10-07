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

## `npm run test:rules` — Firestore rules, needs the emulator

```bash
npm i -g firebase-tools
firebase emulators:start --only firestore   # terminal 1
npm run test:rules                          # terminal 2
```

`tests/rules.integration.mjs` asserts both directions of the security model:
enumeration is denied on all 11 collections, a student cannot rewrite a
teacher's session config, growth-wall entries cannot be self-approved, and
student submissions stay inside their declared shape.

It is kept out of `npm test` on purpose. A suite that silently no-ops when its
backend is absent is worse than one that is honestly not wired up.

## What is and is not covered

| Area | Covered by | Status |
|---|---|---|
| Every page loads clean | smoke | ✅ runs in CI |
| Picker fairness, group sizes, timer drift | logic | ✅ runs in CI |
| Firestore rules, both directions | rules.integration | ⚠️ written, needs emulator |
| Real-time teacher/student sync | — | ❌ none |
| `noise-monitor` (React, ~3.5k lines) | — | ❌ no test runner configured |
| `packages/shell/escape.js` | — | ❌ none, despite 17 call sites |

### The gap that matters most

`packages/shell/firebase-config.js` still contains `REPLACE_ME`, so **nothing
in CI has ever reached a Firebase backend**. Every write path — anonymous
sign-in, `ownerUid` stamping, the ownership rules — is unverified by execution.
`smoke.spec.mjs` additionally allowlists `/firebase/i` and `/firestore/i`
console errors, which is correct while there is no config but means a genuine
Firestore bug would pass CI today.

Before trusting the Firebase-backed tools in a classroom:

1. Put a real config in `firebase-config.js` (it is a public identifier).
2. Run `npm run test:rules` against the emulator.
3. Narrow `IGNORED_CONSOLE` in `smoke.spec.mjs` so Firebase errors fail again.
4. Open one teacher page and one student page and check a write lands.

## Troubleshooting

**`npm test` fails with `ENOENT` on a page** — `dist/` is stale or a build was
running during the suite. Re-run `npm run build`, then `npm test`.

**`test:rules` hangs or refuses to connect** — the emulator is not running, or
not on `localhost:8080`. Start it first; the suite does not spawn one.

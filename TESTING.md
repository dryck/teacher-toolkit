# Testing

Two suites, deliberately separate: one runs anywhere, one needs a backend.

## `npm test` — 126 tests, no setup

```bash
npm run build   # the suite runs against dist/, so build first
npm test
```

- **`tests/smoke.spec.mjs`** loads every built page in Chromium and fails on an
  uncaught exception, an unexpected `console.error`, or a missing navbar. It
  exists because `random-picker` once shipped a `TypeError` on every page load
  and nobody noticed, since nothing loaded these pages except a human clicking.
- **`tests/a11y.spec.mjs`** runs axe over every built page and fails on
  anything serious or critical. It was added because nothing checked this and
  the gap was not theoretical: 293 WCAG A/AA violations across the 50 pages,
  including twelve student-facing pages that shipped `user-scalable=no` so a
  child could not pinch-zoom their own phone.
- **`tests/logic.spec.mjs`** drives the real shipped functions for the places
  where "quietly wrong" costs something: the picker's fairness promise, group
  sizes, timer drift in a throttled background tab, the Jigsaw invariants
  (one expert per topic per home group, nobody dropped), and the rubric
  arithmetic in Assessment Checklist — the one tool whose output may become a
  grade.

## `npm run test:unit` — 104 tests, no setup

```bash
npm run test:unit
```

Vitest, in `apps/noise-monitor`. The app shipped with no test runner at all,
which is how three of its four configurable thresholds came to be ignored by
the engine while the Settings panel kept drawing them.

Covers `calculateNoiseLevel` (including that an empty bin array must not
return `NaN` — it would survive the moving average and stick the display on
"quiet" for the rest of the lesson), `smoothNoiseLevel`, and the band logic
against every configured bound rather than ratios of one of them.

Also covers the eight themes, under jsdom. Each is rendered at every band with
`intensity` and `isTooLoud` held fixed, so the band is the only thing that
varies and a theme that ignores it renders identically twice and fails. That
matters because four of the eight used to re-derive the bands themselves from
hardcoded ratios of the alarm point — the display and the alarm could
disagree, and nothing said so.

The first version of that test did not work: it moved `intensity` along with
the band, so a deliberately broken theme still passed. Worth knowing if you
extend it — vary one input.

Also covers `useSettings` (the stored config must be rejected rather than
loaded when a field is missing — the original bug left `alarmTrigger`
undefined, made every comparison false, and silenced the alarm with nothing in
the console), the Settings panel (no `dB` anywhere in its output, the band
source is reported, Test Alarm plays the real sound without opening an
AudioContext), and what NoiseMonitor asks of the browser — the three
microphone processors off, and the analyser's dB window pinned, since those
decide what the whole scale means and a wrong value there is invisible.

Also covers `calibration.ts`, which replaced the shipped threshold constants,
including the path with no guess left in it: the teacher presses "use the
current level as the too-loud point" and the bands are placed between the
room's measured floor and the level they pointed at.
The index is relative to the microphone's full scale, so no fixed set of
numbers can be right for two rooms; the monitor now measures its own quiet
floor for six seconds and places the bands above it. The tests pin the parts
that would fail silently: the floor is the 20th percentile so a dropout frame
cannot drag it to zero and talking cannot drag it up, and the bands stay
ordered, distinct and all reachable even from a floor of 99.

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

## `npm run test:e2e` — 5 tests, needs a JVM

```bash
npm run build && npm run test:e2e
```

A real teacher page and a real student page, as two browser contexts, talking
to the Firestore and Auth emulators. Both the emulators and the static server
are started for you; the same JDK 21+ requirement applies.

This is the only suite that exercises the client write paths, and it earned its
place immediately: it found that **nine of the eleven student pages issued their
write before anonymous sign-in had completed**. On a real deployment every
student submission would have been rejected — the rules require
`request.auth != null` — and the page would have shown a generic "check your
connection" toast eight seconds later. Neither the smoke suite (the page loads
fine) nor the rules suite (the rules are correct) can see that.

What it asserts:

- a Zones check-in reaches the projected dashboard
- a mistyped code is refused instead of silently starting a session
- a signed-in *non-owner* cannot delete someone's session — and the test
  checks both parties actually signed in, so it cannot pass for the wrong
  reason
- an Exit Ticket response reaches the teacher's dashboard, text and all
- a page signs in anonymously and stamps `ownerUid` + `createdAt`, which is
  the claim every ownership rule depends on

## What is and is not covered

| Area | Covered by | Status |
|---|---|---|
| Every page loads clean | smoke | ✅ CI |
| WCAG A/AA on every page | a11y | ✅ CI (50 pages) |
| noise-monitor: engine, calibration, themes, settings, mic setup | 6 vitest files | ✅ CI (104 tests) |
| Picker fairness, group sizes, timer drift | logic | ✅ CI |
| Firestore rules, both directions | rules.integration | ✅ CI (29 tests) |
| Sign-in, ownerUid, student → teacher sync | e2e.integration | ✅ CI (5 tests) |
| The other 9 Firebase tools' sync | — | ⚠️ same pattern, untested |
| `packages/shell/escape.js` | — | ❌ none, despite 17 call sites |

### Not covered by the a11y suite

axe checks what is machine-checkable. It does not check whether a live
dashboard announces its updates (no page has an `aria-live` region, despite
eleven of them updating in real time), nor whether the tab order makes sense,
nor whether a screen reader's description of a projected wheel is useful. The
shared theme now honours `prefers-reduced-motion` and draws a `:focus-visible`
ring, which axe also does not test.

### The gap that matters most

Zones and Exit Ticket are covered end to end. The **other nine Firebase tools
are not** — they follow the same teacher/student pattern and now carry the same
sign-in gate, but only by inspection. Extending `e2e.integration.mjs` to
Live Quiz (the most stateful) and Choice Board would close most of that.

`packages/shell/firebase-config.js` still contains `REPLACE_ME`, so the
*deployed* site has never reached a backend. `smoke.spec.mjs` also allowlists
`/firebase/i` and `/firestore/i` console errors — correct while there is no
config, but it means a genuine Firestore bug passes the smoke suite.

Before trusting the Firebase-backed tools in a classroom:

1. Put a real config in `firebase-config.js` (it is a public identifier, safe
   to commit; security comes from the rules, which are tested).
2. Publish `packages/shell/firestore.rules` to the project, and set a TTL
   policy on `createdAt` for each collection.
3. Narrow `IGNORED_CONSOLE` in `smoke.spec.mjs` so Firebase errors fail again.
4. Extend the e2e suite to the remaining nine tools, or walk them by hand
   once: open the teacher page, join from a phone, check the write lands.

## Troubleshooting

**`npm test` fails with `ENOENT` on a page** — this used to happen because the
suite re-read each page from disk while running. It now reads them once at
collection time, so if you see it, `dist/` is genuinely stale: re-run
`npm run build`.

**A page times out in `page.goto`** — the suite blocks fonts.googleapis.com for
exactly this reason, so if it recurs the cause is something else. It will not
be the webfonts.

**`test:rules` fails with "no longer supports Java version before 21"** — a
JDK is installed but too old, or `/usr/bin/java` is macOS's stub. Put a real
JDK 21+ first on `PATH` (see above).

**`test:rules` says port 8080 is taken** — an emulator is already running. The
config reuses it (`reuseExistingServer: true`), so this usually means a stale
process: `pkill -f "firebase.*emulators"`.

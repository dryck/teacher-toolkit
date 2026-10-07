# Testing Guide

## Quick Start

### Smoke Tests (No Setup Required)
```bash
npm test
```
Runs 62 tests: all HTML pages load clean, navbar renders, logic tests pass.

### Firestore Rules Tests (With Emulator)

**Prerequisites:**
```bash
npm install -g firebase-tools
firebase login
```

**Run tests:**

1. **Terminal 1 - Start emulator:**
```bash
firebase emulators:start --only firestore
# Outputs: Firestore Emulator running on http://localhost:8080
```

2. **Terminal 2 - Run rules tests:**
```bash
npm test -- rules.integration.mjs
```

## What's Tested

### smoke.spec.mjs (58 tests)
- ✅ All 57 HTML pages load without errors
- ✅ No uncaught exceptions
- ✅ Navbar renders on eligible pages
- ✅ Live Quiz, Zones, Choice Board, etc. all load clean

### rules.spec.mjs (3 structure tests)
- Documentation for C1, C2, H1 fixes
- Ready for emulator implementation

### rules.integration.mjs (12 real tests) ⭐
- **C1:** Enumeration blocked (list denied)
- **C2:** Ownership enforced (student can't write config)
- **H1:** Moderation protected (self-approve prevented)
- **Auth:** All writes require authentication

## Test Coverage

| Area | Tests | Status |
|---|---|---|
| Page loads | 57 | ✅ Pass |
| Logic (equity, timers, etc) | 7 | ✅ Pass |
| Firestore rules | 12 | ⭐ New! |
| **Total** | **76** | ⭐ Expanding |

## CI Integration

GitHub Actions runs on every push:
```yaml
- Build
- Smoke tests (no emulator needed)
- Rules tests (emulator required)
```

## Troubleshooting

**"Emulator not running" error:**
```bash
firebase emulators:start --only firestore
# Leave this running in a separate terminal
```

**"Port 8080 already in use":**
```bash
firebase emulators:start --only firestore --port 9000
# Then set FIRESTORE_EMULATOR_HOST=localhost:9000
```

**"Rules file not found":**
Make sure you're running tests from repo root:
```bash
cd ~/teacher-toolkit
npm test -- rules.integration.mjs
```

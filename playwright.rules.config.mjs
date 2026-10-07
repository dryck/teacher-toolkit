// Firestore rules tests. Separate config because, unlike the smoke suite,
// these need the Firestore emulator rather than a static file server:
//
//   npm i -g firebase-tools
//   firebase emulators:start --only firestore    # terminal 1
//   npm run test:rules                           # terminal 2
//
// Kept out of `npm test` on purpose: a suite that silently no-ops when its
// backend is absent is worse than one that isn't wired up yet.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /rules\.integration\.mjs$/,
  fullyParallel: false,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  projects: [{ name: 'rules', use: { ...devices['Desktop Chrome'] } }]
});

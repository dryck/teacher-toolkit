// Firestore rules tests.
//
// Separate config because these need the Firestore emulator rather than the
// static file server the smoke suite uses. The emulator is started for you --
// `npm run test:rules` is self-contained -- but it needs a JVM on PATH
// (`brew install openjdk@17`), which is the one prerequisite this cannot
// install itself.
//
// Kept out of `npm test` on purpose: these tests are the only thing asserting
// the security model, and a suite that silently no-ops when its backend is
// absent is worse than one that is honestly not wired up.
import { defineConfig, devices } from '@playwright/test';

const HOST = '127.0.0.1';
const PORT = 8080;

// @firebase/rules-unit-testing discovers the emulator through this.
process.env.FIRESTORE_EMULATOR_HOST ??= `${HOST}:${PORT}`;

export default defineConfig({
  testDir: './tests',
  testMatch: /rules\.integration\.mjs$/,
  // The suite shares one emulator and clears it between tests, so the cases
  // cannot run concurrently.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  projects: [{ name: 'rules', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `demo-` tells the emulator this project id is local-only, so it never
    // asks for credentials or touches a real Firebase project.
    command: 'npx firebase emulators:start --only firestore --project demo-teacher-toolkit',
    url: `http://${HOST}:${PORT}/`,
    reuseExistingServer: true,
    timeout: 90_000,
    stdout: 'pipe',
    stderr: 'pipe'
  }
});

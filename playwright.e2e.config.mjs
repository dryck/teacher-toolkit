// End-to-end tests for the Firebase-backed tools: a real teacher page and a
// real student page, in separate browser contexts, talking to the emulator.
//
// This is the suite that covers what the rules tests cannot -- that the client
// actually signs in, stamps ownerUid, and writes a shape its own rules accept.
// Everything else in the repo verified those paths by reading them.
//
//   npm run test:e2e
//
// Needs a JDK 21+ on PATH for the emulator (see TESTING.md); both servers are
// started for you.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;          // not 4173: the smoke suite may be running
const FIRESTORE = 8080;
const AUTH = 9099;

export default defineConfig({
  testDir: './tests',
  testMatch: /e2e\.integration\.mjs$/,
  // Each test creates its own session code, so they are independent -- but
  // they share one emulator, and a flaky sync failure is much easier to read
  // when the log is sequential.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'e2e', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx firebase emulators:start --only firestore,auth --project demo-teacher-toolkit',
      // Health-check the AUTH port, not Firestore. A Firestore-only emulator
      // left over from `test:rules` answers on 8080, so checking that port
      // made reuseExistingServer latch onto an emulator with no auth -- and
      // every sign-in then failed silently.
      url: `http://127.0.0.1:${AUTH}/`,
      reuseExistingServer: true,
      timeout: 90_000,
      stdout: 'pipe',
      stderr: 'pipe'
    },
    {
      // Against dist/, like the smoke suite: these test what ships.
      command: `node scripts/serve.mjs ${PORT}`,
      url: `http://127.0.0.1:${PORT}/index.html`,
      reuseExistingServer: true,
      timeout: 30_000
    }
  ]
});

export const EMULATOR = { firestore: `127.0.0.1:${FIRESTORE}`, auth: `http://127.0.0.1:${AUTH}` };

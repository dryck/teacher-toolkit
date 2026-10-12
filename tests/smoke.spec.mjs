/* Smoke tests: load every built page in a real browser and assert it comes
   up clean.

   Motivated by a real regression: random-picker's init called createWheel()
   with no argument while the function read entries.length, so every page
   load threw a TypeError and the wheel silently never rendered. It shipped
   to production and sat there unnoticed, because nothing ever loaded these
   pages except a human clicking around.

   The assertions are deliberately narrow:

   - Uncaught exceptions ('pageerror') are the signal that catches that
     class of bug, and they're essentially never a false positive.
   - console.error is noisier: the Firebase-backed tools legitimately log
     connection failures when there's no network/credentials in CI, so
     those are filtered to a known allowlist rather than failing the run.
   - Pages that load the shared navbar must actually render it, which
     catches a broken shell without hardcoding a page list (student-facing
     pages intentionally omit the navbar and are skipped automatically). */
import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');

async function htmlPages(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'assets' || entry.name === 'icons') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await htmlPages(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

// Network/credential noise that is expected when running without Firebase.
const IGNORED_CONSOLE = [
  /firestore/i,
  /firebase/i,
  /net::ERR_/i,
  /Failed to load resource/i,
  /permission[- ]denied/i,
  /Could not reach Cloud Firestore/i
];

/* Read each page's source once, here at collection time, rather than inside
   the test that needs it.

   The navbar assertion below only needs to know whether a page opts into the
   shared shell, which is a property of the file. Re-reading from disk once the
   tests are already running made the suite fail with an ENOENT naming a page
   that plainly exists -- any build touching dist/ while the run is in flight
   is enough, and the error points at the page rather than at the race. */
const pages = await Promise.all(
  (await htmlPages(DIST)).map(async (file) => ({
    file,
    urlPath: '/' + relative(DIST, file).split(/[/\\]/).join('/'),
    usesNavbar: (await readFile(file, 'utf8')).includes('shell/navbar.js')
  }))
);

test('the build produced the pages we expect to test', () => {
  // Guards against the glob silently finding nothing and every test vacuously passing.
  expect(pages.length).toBeGreaterThan(20);
});

for (const { urlPath, usesNavbar } of pages) {
  test(`loads clean: ${urlPath}`, async ({ page }) => {
    /* Block the webfonts.

       Every page links fonts.googleapis.com, and `waitUntil: 'load'` waits for
       every subresource -- so with four workers over fifty pages the run makes
       hundreds of external requests, and when those are slow the load event
       never fires and the test times out after thirty seconds naming the page
       rather than the cause. It cost a 1-in-5 flake in a suite that gates the
       deploy.

       Only the fonts: the Firebase SDK also comes from gstatic, and blocking it
       would leave `firebase` undefined and every tool script throwing a
       ReferenceError -- a failure about the test, not the page. What is under
       test is that the page comes up without errors, which does not depend on
       a typeface arriving. */
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());

    const crashes = [];
    const errors = [];

    page.on('pageerror', (err) => crashes.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (!IGNORED_CONSOLE.some((re) => re.test(text))) errors.push(text);
    });

    await page.goto(urlPath, { waitUntil: 'load' });
    // Let DOMContentLoaded handlers (the shared shell, each tool's init) run.
    await page.waitForTimeout(400);

    expect(crashes, `uncaught exception on ${urlPath}`).toEqual([]);
    expect(errors, `console errors on ${urlPath}`).toEqual([]);

    // If the page opts into the shared navbar, it must actually appear.
    if (usesNavbar) {
      await expect(page.locator('.tk-navbar'), `navbar missing on ${urlPath}`).toHaveCount(1);
    }
  });
}

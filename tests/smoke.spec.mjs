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

const pages = await htmlPages(DIST);

test('the build produced the pages we expect to test', () => {
  // Guards against the glob silently finding nothing and every test vacuously passing.
  expect(pages.length).toBeGreaterThan(20);
});

for (const file of pages) {
  const urlPath = '/' + relative(DIST, file).split(/[/\\]/).join('/');

  test(`loads clean: ${urlPath}`, async ({ page }) => {
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
    const source = await readFile(file, 'utf8');
    if (source.includes('shell/navbar.js')) {
      await expect(page.locator('.tk-navbar'), `navbar missing on ${urlPath}`).toHaveCount(1);
    }
  });
}

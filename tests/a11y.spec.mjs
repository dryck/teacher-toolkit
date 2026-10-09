/* Accessibility, on every built page.
 *
 * There was nothing checking this, and the gap was not theoretical: axe found
 * 293 WCAG A/AA violations across the 50 pages. Nearly all of the contrast
 * ones traced to a single shared token sitting at 4.30:1, just under the 4.5:1
 * floor -- which matters most where these tools are actually read, on a
 * projector in a bright classroom that washes out exactly that kind of
 * low-contrast secondary text.
 *
 * Twelve student-facing pages also shipped `user-scalable=no`, so a child
 * could not pinch-zoom their own phone.
 *
 * This suite exists to keep that from drifting back. It runs with the smoke
 * tests, needs no backend, and fails on anything serious or critical.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readdir } from 'node:fs/promises';
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

const pages = (await htmlPages(DIST)).map(
  (f) => '/' + relative(DIST, f).split(/[/\\]/).join('/')
);

test('the build produced the pages we expect to audit', () => {
  expect(pages.length).toBeGreaterThan(20);
});

for (const urlPath of pages) {
  test(`accessible: ${urlPath}`, async ({ page }) => {
    // Same reason as the smoke suite: waiting on Google Fonts made the run
    // slow and intermittently time out, and a typeface has no bearing on this.
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());

    await page.goto(urlPath, { waitUntil: 'load' });
    // Let each tool's init run; several render their first screen from JS.
    await page.waitForTimeout(300);

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const blocking = violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );

    // Name the rule, the count and one offending selector: a bare count sends
    // the next person back to axe to find out what broke.
    const detail = blocking
      .map((v) => `${v.id} (${v.impact}, ${v.nodes.length}x) e.g. ${v.nodes[0].target.join(' ')}`)
      .join('\n  ');

    expect(blocking.length, `${urlPath}\n  ${detail}`).toBe(0);
  });
}

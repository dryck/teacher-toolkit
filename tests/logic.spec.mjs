/* Behaviour tests for the logic the smoke tests can't see.

   A page that loads without throwing can still be quietly wrong, and these
   are the places where "quietly wrong" actually costs something in a
   classroom: a fairness promise that isn't kept, a student dropped from
   every group, a projected timer that drifts.

   These drive the real shipped functions inside each page rather than a
   copy of the logic. The tools keep their code inline in the HTML and read
   the DOM directly (spinWheel() pulls names straight out of the textarea),
   so extracting it to import would mean refactoring 21 tools; running it in
   the page tests exactly what ships instead.

   Playwright's clock API does the heavy lifting: the picker only commits a
   pick ~6s after the wheel starts spinning, so a full equity cycle would
   take about a minute of real time. Faking the clock makes it instant, and
   -- usefully -- lets the timer test jump time in one large step, which is
   precisely what a throttled background tab does to a real timer. */
import { test, expect } from '@playwright/test';

/* ---------------------------------------------------------------- picker */

test.describe('Random Picker — Equity Mode', () => {
  /** Spin once and run the clock out until the pick is committed. */
  async function spin(page) {
    await page.evaluate(() => window.spinWheel());
    // Spin animation (4s) + reveal pause (2s), plus slack.
    await page.clock.runFor(8000);
    await page.waitForFunction(() => isSpinning === false);
  }

  test('picks everyone exactly once before repeating, then refills', async ({ page }) => {
    await page.clock.install();
    await page.goto('/random-picker/index.html');

    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Evan', 'Fiona', 'George', 'Hannah'];
    await page.evaluate((n) => {
      document.getElementById('nameInput').value = n.join('\n');
      document.getElementById('equityMode').checked = true;
      // Think Time adds a 30s countdown before the reveal; off for this test.
      const tt = document.getElementById('thinkTimeMode');
      if (tt) tt.checked = false;
    }, names);

    // A full cycle: every name should come out exactly once.
    const cycle = [];
    for (let i = 0; i < names.length; i++) {
      await spin(page);
      cycle.push(await page.evaluate(() => pickedIndices.at(-1)));
    }

    expect(new Set(cycle).size, 'a name was picked twice within one cycle').toBe(names.length);
    expect([...cycle].sort((a, b) => a - b)).toEqual(names.map((_, i) => i));
    expect(await page.evaluate(() => remainingIndices.length)).toBe(0);

    // Pool is exhausted, so the next spin must start a fresh cycle.
    await spin(page);
    expect(await page.evaluate(() => pickedIndices.length)).toBe(1);
    expect(await page.evaluate(() => remainingIndices.length)).toBe(names.length - 1);
  });

  test('without equity mode the pool is never consumed', async ({ page }) => {
    await page.clock.install();
    await page.goto('/random-picker/index.html');

    await page.evaluate(() => {
      document.getElementById('nameInput').value = 'Alice\nBob\nCharlie';
      document.getElementById('equityMode').checked = false;
      const tt = document.getElementById('thinkTimeMode');
      if (tt) tt.checked = false;
    });

    await spin(page);
    // Every name stays eligible when equity mode is off.
    expect(await page.evaluate(() => remainingIndices.length)).toBe(3);
  });
});

/* ------------------------------------------------------------ group gen */

test.describe('Group Generator', () => {
  /** Build `groups` groups from `count` students, returned as name arrays. */
  async function group(page, count, groups) {
    return page.evaluate(([count, groups]) => {
      const students = Array.from({ length: count }, (_, i) => ({
        index: i, name: `S${i}`, label: `S${i}`
      }));
      return window.buildGrouping(students, groups).map((g) => g.map((s) => s.name));
    }, [count, groups]);
  }

  test('every student lands in exactly one group, with none dropped', async ({ page }) => {
    await page.goto('/group-generator/index.html');

    // Awkward sizes are where off-by-one distribution bugs show up.
    for (const [count, groups] of [[7, 3], [8, 3], [9, 3], [5, 5], [1, 3], [12, 5]]) {
      const result = await group(page, count, groups);
      const flat = result.flat();

      expect(flat.length, `${count} students into ${groups} groups: wrong total`).toBe(count);
      expect(new Set(flat).size, `${count}/${groups}: a student appears twice`).toBe(count);
      expect(result.length).toBe(groups);
    }
  });

  test('groups stay balanced — sizes never differ by more than one', async ({ page }) => {
    await page.goto('/group-generator/index.html');

    for (const [count, groups] of [[7, 3], [8, 3], [10, 4], [11, 4]]) {
      const sizes = (await group(page, count, groups)).map((g) => g.length);
      expect(Math.max(...sizes) - Math.min(...sizes),
        `${count} into ${groups} gave lopsided sizes ${sizes}`).toBeLessThanOrEqual(1);
    }
  });
});

/* ---------------------------------------------------------------- timer */

test.describe('Visual Timer', () => {
  test('stays accurate when the tab is throttled', async ({ page }) => {
    // Regression test. The timer used to do `remainingSeconds--` once per
    // setInterval tick, which assumes every tick is exactly 1s. A
    // backgrounded tab gets throttled to roughly one tick a minute, so the
    // old code lost almost the entire minute. Jumping the clock in one
    // large step reproduces that exactly: a single tick spanning 60s.
    await page.clock.install();
    await page.goto('/visual-timer/index.html');

    await page.evaluate(() => {
      window.setTimer(10);      // 10:00
      window.startTimer();
    });

    await page.clock.runFor(60_000);

    expect(await page.evaluate(() => remainingSeconds),
      'timer lost time while throttled').toBe(9 * 60);
    expect(await page.textContent('#timerDisplay')).toBe('09:00');
  });

  test('counts down correctly across many small ticks', async ({ page }) => {
    await page.clock.install();
    await page.goto('/visual-timer/index.html');

    await page.evaluate(() => { window.setTimer(1); window.startTimer(); });
    for (let i = 0; i < 10; i++) await page.clock.runFor(1000);

    expect(await page.evaluate(() => remainingSeconds)).toBe(50);
  });

  test('reaching zero finishes cleanly rather than counting negative', async ({ page }) => {
    await page.clock.install();
    await page.goto('/visual-timer/index.html');

    await page.evaluate(() => {
      document.getElementById('customMin').value = '0';
      document.getElementById('customSec').value = '5';
      window.setCustomTimer();
      window.startTimer();
    });

    await page.clock.runFor(20_000);

    expect(await page.evaluate(() => remainingSeconds)).toBe(0);
    expect(await page.evaluate(() => isRunning)).toBe(false);
    expect(await page.textContent('#timerDisplay')).toBe('DONE!');
  });
});

/* ---------------------------------------------------------------- audio */

test('shared AudioContext is created once, not per sound', async ({ page }) => {
  // Regression test: every beep used to build its own AudioContext. Browsers
  // cap how many a page may open (~6 in Chrome) and Visual Timer's alarm
  // fires six tones in a row, so audio died part-way through a lesson.
  await page.goto('/visual-timer/index.html');

  const distinct = await page.evaluate(() => {
    const seen = new Set();
    for (let i = 0; i < 20; i++) seen.add(window.TKAudio.ctx());
    return seen.size;
  });

  expect(distinct, 'AudioContext is being recreated per call again').toBe(1);
});

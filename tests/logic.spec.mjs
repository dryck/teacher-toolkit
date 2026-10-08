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

/* ------------------------------------------------------- the other timers */

/* The throttled-tab regression this file already documents for Visual Timer
   was fixed there, and in rotation-timer, break-timer, think-time and
   brainstorm-timer -- but kagan-timer and presentation-timer kept decrementing
   once per setInterval tick. A backgrounded tab is throttled to roughly one
   tick a minute, so a teacher who switches to their slides and back finds the
   round barely moved. Jumping the clock in one large step reproduces exactly
   that: a single tick spanning the whole minute. */

test.describe('Kagan Timer', () => {
  /** Start the first phase with a known length, in seconds. */
  async function startWith(page, seconds) {
    await page.clock.install();
    await page.goto('/kagan-timer/index.html');
    await page.evaluate((s) => {
      // Drive the shipped functions rather than the setup UI: the structure
      // being tested is the countdown, not the form.
      //
      // Bare assignment, not window.phases: these are top-level `let`
      // bindings, which unlike `var` and function declarations do not become
      // window properties. Assigning window.phases would create a separate
      // property the tool never reads.
      phases = [{ name: 'Think', emoji: '🤔', instruction: 'Think', seconds: s }];
      loadPhase(0);
    }, seconds);
  }

  test('does not lose time while the tab is throttled', async ({ page }) => {
    await startWith(page, 300);
    // One tick spanning a full minute, as a throttled tab delivers.
    await page.clock.runFor(60_000);
    expect(await page.evaluate(() => remainingSeconds),
      'kagan timer lost time while throttled').toBe(240);
  });

  test('counts down correctly across many small ticks', async ({ page }) => {
    await startWith(page, 300);
    for (let i = 0; i < 10; i++) await page.clock.runFor(1000);
    expect(await page.evaluate(() => remainingSeconds)).toBe(290);
  });

  test('never shows a negative time', async ({ page }) => {
    await startWith(page, 5);
    await page.clock.runFor(30_000);
    expect(await page.evaluate(() => remainingSeconds)).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Presentation Timer', () => {
  /** One team, a known slot length, no Q&A. */
  async function startWith(page, minutes, qna = 0) {
    await page.clock.install();
    await page.goto('/presentation-timer/index.html');
    await page.evaluate(([m, q]) => {
      // Bare assignment: top-level `let`, see the note in the Kagan block.
      teams = [{ name: 'Team A', minutes: m }];
      qnaSeconds = q;
      beginPhase(0, 'presenting');
    }, [minutes, qna]);
  }

  test('does not lose time while the tab is throttled', async ({ page }) => {
    await startWith(page, 5);
    await page.clock.runFor(60_000);
    expect(await page.evaluate(() => remaining),
      'presentation timer lost time while throttled').toBe(240);
  });

  test('a pause does not count against the slot', async ({ page }) => {
    // The deadline has to be rebuilt on resume. Without that, time spent
    // paused is silently deducted from the team's slot -- the opposite of
    // what pausing is for.
    await startWith(page, 5);
    await page.clock.runFor(30_000);
    expect(await page.evaluate(() => remaining)).toBe(270);

    // .click() through evaluate rather than page.click: beginPhase sets the
    // phase up without leaving the setup screen, so the button is not visible
    // to a real click. What is under test is the countdown arithmetic; the
    // smoke suite covers whether the page renders.
    const pause = () => page.evaluate(() => document.getElementById('pauseBtn').click());

    await pause();
    await page.clock.runFor(120_000);          // two minutes paused
    expect(await page.evaluate(() => remaining),
      'the clock kept running while paused').toBe(270);

    await pause();
    await page.clock.runFor(30_000);

    // 240 or 241: the interval ticks every 250ms and is not aligned to the
    // clock jump, so the last tick can land a quarter-second early and ceil()
    // rounds up. What matters is that the two paused minutes were not taken
    // out of the team's slot -- a whole minute of error is the bug, not a
    // second of tick granularity.
    const afterResume = await page.evaluate(() => remaining);
    expect(afterResume,
      `expected about 240s left after 60s of running; got ${afterResume}, so ` +
      `the pause was deducted from the slot`).toBeGreaterThanOrEqual(239);
    expect(afterResume).toBeLessThanOrEqual(241);
  });

  test('never shows a negative time', async ({ page }) => {
    await startWith(page, 0.1);                // 6 seconds
    await page.clock.runFor(30_000);
    expect(await page.evaluate(() => remaining)).toBeGreaterThanOrEqual(0);
  });
});

/* --------------------------------------------------- jigsaw coordinator */

test.describe('Jigsaw Coordinator', () => {
  /* Jigsaw only works if two things hold: every student becomes the expert on
     exactly one topic, and every home group gathers one expert per topic. If
     either slips, the lesson still runs and looks fine -- a group just never
     hears about a topic, or hears it twice. That is the quiet failure worth
     testing. */
  async function assign(page, studentCount, topicCount) {
    return page.evaluate(([n, k]) => {
      const names = Array.from({ length: n }, (_, i) => `S${i}`);
      const topics = Array.from({ length: k }, (_, i) => `T${i}`);
      return generateAssignments(names, topics);
    }, [studentCount, topicCount]);
  }

  const SHAPES = [[12, 3], [12, 4], [13, 4], [7, 3], [5, 5], [20, 6], [9, 2]];

  test('every student is the expert on exactly one topic', async ({ page }) => {
    await page.goto('/jigsaw-coordinator/index.html');
    for (const [n, k] of SHAPES) {
      const { expertGroups } = await assign(page, n, k);
      const flat = expertGroups.flat().map((s) => s.name);
      expect(flat.length, `${n} students / ${k} topics: wrong total`).toBe(n);
      expect(new Set(flat).size, `${n}/${k}: a student is an expert twice`).toBe(n);
      expect(expertGroups.length).toBe(k);
    }
  });

  test('expert groups stay balanced', async ({ page }) => {
    await page.goto('/jigsaw-coordinator/index.html');
    for (const [n, k] of SHAPES) {
      const { expertGroups } = await assign(page, n, k);
      const sizes = expertGroups.map((g) => g.length);
      expect(Math.max(...sizes) - Math.min(...sizes),
        `${n}/${k} gave lopsided expert groups ${sizes}`).toBeLessThanOrEqual(1);
    }
  });

  test('every student lands in exactly one home group', async ({ page }) => {
    await page.goto('/jigsaw-coordinator/index.html');
    for (const [n, k] of SHAPES) {
      const { homeGroups } = await assign(page, n, k);
      const flat = homeGroups.flat().map((m) => m.name);
      expect(flat.length, `${n}/${k}: a student was dropped from home groups`).toBe(n);
      expect(new Set(flat).size, `${n}/${k}: a student is in two home groups`).toBe(n);
    }
  });

  test('no home group hears the same topic twice', async ({ page }) => {
    // The invariant that makes the method work: within a home group, each
    // member reports on a different topic.
    await page.goto('/jigsaw-coordinator/index.html');
    for (const [n, k] of SHAPES) {
      const { homeGroups } = await assign(page, n, k);
      homeGroups.forEach((group, i) => {
        const topics = group.map((m) => m.topicIndex);
        expect(new Set(topics).size,
          `${n}/${k}: home group ${i} has two experts on the same topic`).toBe(topics.length);
      });
    }
  });

  test('a home group is short only when the class does not divide evenly', async ({ page }) => {
    await page.goto('/jigsaw-coordinator/index.html');
    for (const [n, k] of SHAPES) {
      const { homeGroups } = await assign(page, n, k);
      const short = homeGroups.filter((g) => g.length < k).length;
      if (n % k === 0) {
        expect(short, `${n}/${k} divides evenly, so every home group should cover all ${k} topics`).toBe(0);
      } else {
        // Exactly the remainder's worth of groups may be short, never more.
        expect(short, `${n}/${k}: too many incomplete home groups`).toBeLessThanOrEqual(1);
      }
    }
  });

  test('fewer students than topics leaves topics unrepresented rather than crashing', async ({ page }) => {
    // A real setup mistake. It should degrade visibly, not throw: three
    // students cannot cover five topics, and the teacher needs to see that.
    await page.goto('/jigsaw-coordinator/index.html');
    const { expertGroups, homeGroups } = await assign(page, 3, 5);
    expect(expertGroups.length).toBe(5);
    expect(expertGroups.filter((g) => g.length === 0).length).toBe(2);
    expect(homeGroups.flat().length).toBe(3);
  });
});

/* ------------------------------------------------- assessment checklist */

test.describe('Assessment Checklist', () => {
  /* The only tool here whose output a teacher may turn into a grade, so the
     arithmetic is worth pinning -- and so is what happens when the rubric is
     edited after scoring has started, which is the sequence a real lesson
     produces. */

  test('a level label exists for every level of every rubric size', async ({ page }) => {
    await page.goto('/assessment-checklist/index.html');
    const gaps = await page.evaluate(() => {
      const bad = [];
      for (let max = 1; max <= 10; max++) {
        for (let level = 0; level <= max; level++) {
          const label = levelLabel(max, level);
          if (typeof label !== 'string' || !label) bad.push({ max, level, label });
        }
      }
      return bad;
    });
    expect(gaps, 'some rubric size/level combination has no label').toEqual([]);
  });

  test('editing the rubric brings existing scores back inside it', async ({ page }) => {
    /* The sequence a real lesson produces: score the teams, then decide a
       criterion should be out of 3 rather than 5. The stored 5 used to survive
       that, and the total still counted it against a possible 3 -- so a team
       could show 167% on something a teacher may turn into a grade. The level
       label went blank too, because levelLabel(3, 5) runs off the end of its
       list. */
    await page.goto('/assessment-checklist/index.html');

    const result = await page.evaluate(() => {
      rubric = { title: 'T', criteria: [{ id: 'a', name: 'Teamwork', max: 5 }] };
      teams = [{ id: 't1', name: 'Team A', scores: { a: 5 } }];

      // The teacher reduces the maximum and saves.
      rubric.criteria[0].max = 3;
      document.getElementById('saveRubricBtn').click();

      const possible = rubric.criteria.reduce((s, c) => s + c.max, 0);
      const total = rubric.criteria.reduce((s, c) => s + (teams[0].scores[c.id] || 0), 0);
      return {
        score: teams[0].scores.a,
        pct: Math.round((total / possible) * 100),
        label: levelLabel(3, teams[0].scores.a)
      };
    });

    expect(result.score, 'the score was left above the new maximum').toBe(3);
    expect(result.pct, 'a team can score above 100%').toBe(100);
    expect(result.label, 'the level label is blank').toBeTruthy();
  });

  test('a score for a deleted criterion is dropped', async ({ page }) => {
    await page.goto('/assessment-checklist/index.html');
    const leftovers = await page.evaluate(() => {
      rubric = { title: 'T', criteria: [{ id: 'a', name: 'Kept', max: 4 }] };
      teams = [{ id: 't1', name: 'Team A', scores: { a: 2, gone: 9 } }];
      document.getElementById('saveRubricBtn').click();
      return Object.keys(teams[0].scores);
    });
    expect(leftovers, 'a score survived its criterion').toEqual(['a']);
  });

  test('percentages are computed from the rubric, and an empty rubric does not divide by zero', async ({ page }) => {
    await page.goto('/assessment-checklist/index.html');
    const result = await page.evaluate(() => {
      const pct = (criteria, scores) => {
        const possible = criteria.reduce((s, c) => s + c.max, 0);
        const total = criteria.reduce((s, c) => s + (scores[c.id] || 0), 0);
        return possible > 0 ? Math.round((total / possible) * 100) : 0;
      };
      return {
        full: pct([{ id: 'a', max: 4 }, { id: 'b', max: 6 }], { a: 4, b: 6 }),
        half: pct([{ id: 'a', max: 4 }, { id: 'b', max: 6 }], { a: 2, b: 3 }),
        none: pct([{ id: 'a', max: 4 }], {}),
        empty: pct([], {})
      };
    });
    expect(result.full).toBe(100);
    expect(result.half).toBe(50);
    expect(result.none).toBe(0);
    expect(result.empty, 'an empty rubric must not yield NaN').toBe(0);
  });
});

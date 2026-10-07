/* End-to-end tests against the Firestore + Auth emulators.
 *
 * Everything else verifies these tools by reading them. The smoke suite proves
 * the pages load; the rules suite proves the security model is right. Neither
 * touches a backend, so nothing until now has shown that a page actually
 * signs in, stamps ownerUid, and writes a shape its own rules accept -- the
 * exact seam where the rules and the client can silently disagree.
 *
 * The shape of each test is the thing the tool is for: a teacher screen and a
 * student phone, as two browser contexts, with a session code passed between
 * them the way a projector and a QR code pass it.
 *
 *   npm run test:e2e
 */
import { test, expect } from '@playwright/test';

const EMULATOR = {
  firestore: '127.0.0.1:8080',
  auth: 'http://127.0.0.1:9099'
};

// firebase-config.js ships REPLACE_ME, so every page needs a config before its
// scripts run. The values are arbitrary -- the emulator only cares that
// projectId matches the one it was started with.
const CONFIG = {
  apiKey: 'demo-key',
  authDomain: 'demo-teacher-toolkit.firebaseapp.com',
  projectId: 'demo-teacher-toolkit',
  storageBucket: 'demo-teacher-toolkit.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000000000'
};

/** A page wired to the emulator, as a fresh context so each party has its own
 *  localStorage -- a student and a teacher are different devices. */
async function openAs(browser, url) {
  const context = await browser.newContext();

  // Serve a config instead of the committed REPLACE_ME one. Setting
  // window.TK_FIREBASE_CONFIG in an init script does not work: firebase-config.js
  // runs afterwards and overwrites it. Replacing the file is also what a real
  // deployment has to do, so this exercises the same seam.
  await context.route('**/shell/firebase-config.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `window.TK_FIREBASE_CONFIG = ${JSON.stringify(CONFIG)};`
    })
  );

  await context.addInitScript((emulator) => {
    window.TK_EMULATOR = emulator;
  }, EMULATOR);

  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (err) => problems.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(msg.text());
    // A failed anonymous sign-in only warns, and every ownership rule depends
    // on it, so treat it as a failure rather than letting tests pass because
    // an unauthenticated write was denied for the wrong reason.
    if (msg.type() === 'warning' && /TKFirebase/.test(msg.text())) {
      problems.push(msg.text());
    }
  });
  await page.goto(url, { waitUntil: 'load' });
  return { context, page, problems };
}


/** Wait until the teacher page's session doc exists.
 *
 *  The teacher page claims it fire-and-forget on load, so a student that
 *  joins instantly can genuinely be told the code is not open yet. That
 *  window is milliseconds and a teacher has to show the QR first, so it is
 *  not worth engineering around -- but a test must not race it.
 */
async function awaitSession(page, accessor) {
  await page.waitForFunction(
    async (ref) => {
      // eslint-disable-next-line no-eval
      const doc = await eval(ref).get();
      return doc.exists;
    },
    accessor,
    { timeout: 15_000 }
  );
}

/* ------------------------------------------------------------------ Zones */

test('Zones: a student check-in reaches the projected dashboard', async ({ browser }) => {
  // The teacher page claims the session on load, which is new -- the document
  // used to be created by whichever student wrote first.
  const teacher = await openAs(browser, '/zones/teacher.html');
  const code = await teacher.page.textContent('#sessionCode');
  expect(code, 'teacher page did not generate a session code').toBeTruthy();

  await awaitSession(teacher.page,
    `TKZones.sessionDocRef(new URLSearchParams(location.search).get('session'))`);

  const student = await openAs(browser, `/zones/index.html?session=${code}`);
  await student.page.locator('.zone-btn').nth(1).click();   // green

  // Check for a rejected write before waiting on the UI: a denied write shows
  // up as a generic "check your connection" toast eight seconds later, and
  // the assertion that times out would name the screen, not the cause.
  await expect
    .poll(() => student.problems, { timeout: 10_000 })
    .toEqual([]);
  await expect(student.page.locator('#thanksScreen')).toBeVisible();

  // The whole point of the tool: the teacher's screen moves on its own.
  await expect(teacher.page.locator('#count-green')).toHaveText('1');
  await expect(teacher.page.locator('#totalCount')).toHaveText('1');

  expect(teacher.problems, 'teacher page errors').toEqual([]);
  expect(student.problems, 'student page errors').toEqual([]);

  await teacher.context.close();
  await student.context.close();
});

test('Zones: a mistyped code is refused instead of silently starting a session', async ({ browser }) => {
  // This used to "work": set(..., {merge:true}) created the document, so the
  // student saw a thank-you screen and the check-in went nowhere.
  const student = await openAs(browser, '/zones/index.html');
  await student.page.fill('#codeInput', 'ZZZZZZ');
  await student.page.click('#joinBtn');

  await expect(student.page.locator('#errorMsg')).toContainText(/isn't open/i);
  await expect(student.page.locator('#zoneScreen')).toBeHidden();

  await student.context.close();
});

test('Zones: another teacher cannot take over a running session', async ({ browser }) => {
  // Two teachers, two anonymous uids. ownerUid is what separates them.
  const owner = await openAs(browser, '/zones/teacher.html');
  const code = await owner.page.textContent('#sessionCode');
  await awaitSession(owner.page,
    `TKZones.sessionDocRef(new URLSearchParams(location.search).get('session'))`);

  const ownerUid = await owner.page.evaluate(async () => {
    await window.TKFirebase.ready;
    return window.TKFirebase.uid();
  });

  const intruder = await openAs(browser, `/zones/teacher.html?session=${code}`);

  const result = await intruder.page.evaluate(async () => {
    await window.TKFirebase.ready;
    const uid = window.TKFirebase.uid();
    try {
      await TKZones.sessionDocRef(
        new URLSearchParams(location.search).get('session')
      ).delete();
      return { uid, outcome: 'allowed' };
    } catch (err) {
      return { uid, outcome: err.code || String(err) };
    }
  });

  // Without these two the test would pass for the wrong reason: an
  // unauthenticated client is also denied, which proves nothing about
  // ownership.
  expect(ownerUid, 'owner never signed in').toBeTruthy();
  expect(result.uid, 'intruder never signed in').toBeTruthy();
  expect(result.uid, 'both pages got the same anonymous uid').not.toBe(ownerUid);
  expect(result.outcome, 'a signed-in non-owner deleted the session')
    .toContain('permission-denied');

  expect(owner.problems, 'owner page errors').toEqual([]);

  await owner.context.close();
  await intruder.context.close();
});

/* ------------------------------------------------------------ Exit Ticket */

test('Exit Ticket: a response reaches the teacher dashboard', async ({ browser }) => {
  const teacher = await openAs(browser, '/exit-ticket/teacher.html');
  await teacher.page.click('#generateBtn');

  // The page reloads itself with ?session=CODE once the write lands, so this
  // also asserts that createSession() succeeded against the real rules.
  await teacher.page.waitForURL(/\?session=/, { timeout: 20_000 });
  const code = await teacher.page.textContent('#sessionCode');
  expect(code).toBeTruthy();

  const student = await openAs(browser, `/exit-ticket/index.html?session=${code}`);
  await student.page.fill('#q1Input', 'that fractions are division');
  await student.page.locator('.confidence-btn').nth(2).click();
  await student.page.fill('#q3Input', 'why the denominators have to match');
  await student.page.click('#submitBtn');

  await expect
    .poll(() => student.problems, { timeout: 10_000 })
    .toEqual([]);
  await expect(student.page.locator('#thanksScreen')).toBeVisible();
  await expect(teacher.page.locator('#totalCount')).toHaveText('1');
  await expect(teacher.page.locator('#q1List')).toContainText('that fractions are division');
  await expect(teacher.page.locator('#q3List')).toContainText('denominators have to match');

  expect(teacher.problems, 'teacher page errors').toEqual([]);
  expect(student.problems, 'student page errors').toEqual([]);

  await teacher.context.close();
  await student.context.close();
});

/* --------------------------------------------------------------- the seam */

test('a page signs in anonymously and stamps ownerUid on the session it creates', async ({ browser }) => {
  // The claim the rules depend on, asserted directly: without this, every
  // ownership rule in firestore.rules is guarding a field nobody writes.
  const teacher = await openAs(browser, '/zones/teacher.html');
  const code = await teacher.page.textContent('#sessionCode');
  await awaitSession(teacher.page,
    `TKZones.sessionDocRef(new URLSearchParams(location.search).get('session'))`);

  const result = await teacher.page.evaluate(async (sessionCode) => {
    await window.TKFirebase.ready;
    const uid = window.TKFirebase.uid();

    // A serverTimestamp() reads back null from the local cache until the
    // server acknowledges it, so poll rather than reading once.
    let data = {};
    for (let i = 0; i < 40 && !data.createdAt; i++) {
      const doc = await TKZones.sessionDocRef(sessionCode).get();
      data = doc.data() || {};
      if (!data.createdAt) await new Promise((r) => setTimeout(r, 250));
    }
    return {
      uid,
      exists: !!data.ownerUid || !!data.createdAt,
      ownerUid: data.ownerUid || null,
      hasCreatedAt: !!data.createdAt
    };
  }, code);

  expect(result.uid, 'anonymous sign-in never completed').toBeTruthy();
  expect(result.exists, 'the teacher page did not create the session doc').toBe(true);
  expect(result.ownerUid, 'ownerUid was not stamped').toBe(result.uid);
  expect(result.hasCreatedAt, 'createdAt was not stamped, so TTL cannot expire this').toBe(true);

  await teacher.context.close();
});

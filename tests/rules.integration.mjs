/* Firestore rules tests.
 *
 * These assert the security model itself rather than any page: that a session
 * cannot be enumerated, that a student cannot rewrite the teacher's config,
 * and that moderation is enforced by the database instead of by a disabled
 * button. It is the only place in the repo where a bug has consequences
 * beyond one lesson, so it is worth testing both directions of every rule.
 *
 * Needs the emulator, which is why this is not part of `npm test`:
 *   npm i -g firebase-tools
 *   firebase emulators:start --only firestore     # terminal 1
 *   npm run test:rules                            # terminal 2
 */
import { test, expect } from '@playwright/test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const RULES = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'shell', 'firestore.rules');

const TEACHER = 'teacher-uid';
const OTHER_TEACHER = 'other-teacher-uid';
const STUDENT = 'student-uid';

let env;

test.beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'teacher-toolkit-rules-test',
    firestore: { rules: readFileSync(RULES, 'utf8') }
  });
});

test.afterAll(async () => {
  if (env) await env.cleanup();
});

test.beforeEach(async () => {
  await env.clearFirestore();
});

/** Write a document bypassing the rules, to set up a fixture. */
async function seed(path, data) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(path).set(data);
  });
}

const db = (uid) =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();

/* ------------------------------------------------------------------ C1 */

test.describe('C1: a session collection cannot be enumerated', () => {
  // `allow read` grants get AND list. With list open, the 5-char code was not
  // access control at all: anyone with the public config could dump every
  // session every class had ever created, free text included.
  const COLLECTIONS = [
    'zonesSessions', 'exitTicketSessions', 'choiceBoardSessions',
    'growthWallSessions', 'snowballSessions', 'challengeDeckSessions',
    'chiliChallengeSessions', 'helpLadderSessions', 'brainstormSessions',
    'peerFeedbackSessions', 'liveQuizSessions'
  ];

  for (const coll of COLLECTIONS) {
    test(`${coll}: get on a known id succeeds, list is denied`, async () => {
      await seed(`${coll}/CODE01`, { ownerUid: TEACHER });

      // A student arriving from a QR code resolves one known id.
      await assertSucceeds(db(null).doc(`${coll}/CODE01`).get());

      // Nobody gets to walk the collection.
      await assertFails(db(null).collection(coll).get());
      await assertFails(db(STUDENT).collection(coll).get());
    });
  }
});

/* ------------------------------------------------------------------ C2 */

test.describe('C2: session config is writable only by its creator', () => {
  test('liveQuiz: the owner creates, a student cannot overwrite', async () => {
    const quiz = {
      title: 'Fractions',
      questions: [{ text: 'Q1', options: ['a', 'b'], correctIndex: 0 }],
      currentQuestion: -1,
      revealed: false,
      ownerUid: TEACHER,
      createdAt: new Date()
    };

    await assertSucceeds(db(TEACHER).doc('liveQuizSessions/CODE01').set(quiz));

    // The live-quiz attack: swap the question set, or jump/reveal mid-lesson,
    // which silently rewrites every student's derived score.
    await assertFails(
      db(STUDENT).doc('liveQuizSessions/CODE01').update({ revealed: true }));
    await assertFails(
      db(STUDENT).doc('liveQuizSessions/CODE01').update({ currentQuestion: 99 }));
    await assertFails(
      db(STUDENT).doc('liveQuizSessions/CODE01').update({ questions: [] }));
    await assertFails(
      db(OTHER_TEACHER).doc('liveQuizSessions/CODE01').update({ title: 'Mine now' }));

    await assertSucceeds(
      db(TEACHER).doc('liveQuizSessions/CODE01').update({ revealed: true }));
  });

  test('creating a session claiming someone else as owner is denied', async () => {
    await assertFails(db(STUDENT).doc('liveQuizSessions/CODE02').set({
      title: 'x', questions: [], currentQuestion: 0, revealed: false,
      ownerUid: TEACHER, createdAt: new Date()
    }));
  });

  test('an unauthenticated client cannot create a session at all', async () => {
    await assertFails(db(null).doc('choiceBoardSessions/CODE03').set({
      title: 'x', cells: [], mustDoMode: false, minRequired: 1,
      ownerUid: TEACHER, createdAt: new Date()
    }));
  });

  test('only the owner can delete a session', async () => {
    await seed('snowballSessions/CODE04', { concept: 'c', phase: 1, ownerUid: TEACHER });
    await assertFails(db(STUDENT).doc('snowballSessions/CODE04').delete());
    await assertSucceeds(db(TEACHER).doc('snowballSessions/CODE04').delete());
  });
});

/* ------------------------------------------------------------------ H1 */

test.describe('H1: moderation is enforced by the rules, not the UI', () => {
  test('growth wall: a student cannot approve or delete an entry', async () => {
    await seed('growthWallSessions/CODE01', { ownerUid: TEACHER });

    // A student may submit, but only as unapproved.
    await assertSucceeds(db(STUDENT).doc('growthWallSessions/CODE01/entries/e1').set({
      text: "I can't do long division", approved: false, createdAt: new Date()
    }));
    await assertFails(db(STUDENT).doc('growthWallSessions/CODE01/entries/e2').set({
      text: 'straight to the projector', approved: true, createdAt: new Date()
    }));

    // The whole point of the two-state design: self-approval is impossible.
    await assertFails(
      db(STUDENT).doc('growthWallSessions/CODE01/entries/e1').update({ approved: true }));
    await assertFails(
      db(STUDENT).doc('growthWallSessions/CODE01/entries/e1').delete());

    await assertSucceeds(
      db(TEACHER).doc('growthWallSessions/CODE01/entries/e1').update({ approved: true }));
  });

  test('snowball: a student cannot wipe the class wall', async () => {
    await seed('snowballSessions/CODE01', { concept: 'c', phase: 1, ownerUid: TEACHER });
    await seed('snowballSessions/CODE01/stickies/s1', { text: 'an idea', phase: 1 });

    await assertFails(db(STUDENT).doc('snowballSessions/CODE01/stickies/s1').delete());
    await assertSucceeds(db(TEACHER).doc('snowballSessions/CODE01/stickies/s1').delete());
  });
});

/* ---------------------------------------------------------------- Zones */

test.describe('Zones: the session doc is student-written, so ownership works differently', () => {
  // Zones is the one tool where students write the session document itself
  // (four counters via increment), so update cannot be owner-scoped without
  // blocking every check-in. Ownership guards create/delete; the counters
  // stay open but nothing else about the document does.
  test('a student may move counters but not touch anything else', async () => {
    await seed('zonesSessions/CODE01',
      { blue: 0, green: 0, yellow: 0, red: 0, ownerUid: TEACHER, createdAt: new Date() });

    await assertSucceeds(db(STUDENT).doc('zonesSessions/CODE01').update({ green: 1 }));

    // Reassigning the session to yourself, or smuggling in a field.
    await assertFails(db(STUDENT).doc('zonesSessions/CODE01').update({ ownerUid: STUDENT }));
    await assertFails(db(STUDENT).doc('zonesSessions/CODE01').update({ note: 'hi' }));

    // Negative counters would corrupt the teacher's reading of the room.
    await assertFails(db(STUDENT).doc('zonesSessions/CODE01').update({ red: -500 }));
  });

  test('a student cannot conjure a session from a mistyped code', async () => {
    // set(..., {merge:true}) used to create the doc, so a typo silently made
    // a brand-new session and swallowed the check-in.
    await assertFails(db(STUDENT).doc('zonesSessions/NOSUCH').set(
      { green: 1 }, { merge: true }));
  });

  test('only the owner deletes', async () => {
    await seed('zonesSessions/CODE01',
      { blue: 0, green: 0, yellow: 0, red: 0, ownerUid: TEACHER });
    await assertFails(db(STUDENT).doc('zonesSessions/CODE01').delete());
    await assertSucceeds(db(TEACHER).doc('zonesSessions/CODE01').delete());
  });
});

/* ------------------------------------------------- field-level validation */

test.describe('Student submissions stay inside their declared shape', () => {
  test('exit ticket: free text is length-capped', async () => {
    await seed('exitTicketSessions/CODE01', { mode: 'ticket', ownerUid: TEACHER });

    await assertSucceeds(db(STUDENT).doc('exitTicketSessions/CODE01/responses/r1').set({
      q1Answer: 'fractions', confidence: 3, submittedAt: new Date()
    }));

    // Previously uncapped: a ~1MB answer renders onto the projected dashboard.
    await assertFails(db(STUDENT).doc('exitTicketSessions/CODE01/responses/r2').set({
      q1Answer: 'x'.repeat(5000), submittedAt: new Date()
    }));
  });

  test('exit ticket responses cannot be edited or deleted once submitted', async () => {
    await seed('exitTicketSessions/CODE01', { mode: 'ticket', ownerUid: TEACHER });
    await seed('exitTicketSessions/CODE01/responses/r1', { q1Answer: 'a' });

    await assertFails(
      db(STUDENT).doc('exitTicketSessions/CODE01/responses/r1').update({ q1Answer: 'b' }));
    await assertFails(
      db(STUDENT).doc('exitTicketSessions/CODE01/responses/r1').delete());
  });

  test('chili challenge: level must be one of the three chillies', async () => {
    await seed('chiliChallengeSessions/CODE01', { title: 't', ownerUid: TEACHER });

    await assertSucceeds(db(STUDENT).doc('chiliChallengeSessions/CODE01/choices/s1').set({
      nickname: 'Sam', level: 2, joinedAt: new Date()
    }));
    await assertFails(db(STUDENT).doc('chiliChallengeSessions/CODE01/choices/s1').set({
      nickname: 'Sam', level: 99, joinedAt: new Date()
    }));
    await assertFails(db(STUDENT).doc('chiliChallengeSessions/CODE01/choices/s1').set({
      nickname: 'x'.repeat(100), level: 1, joinedAt: new Date()
    }));
  });

  test('an unknown collection is denied outright', async () => {
    await assertFails(db(TEACHER).doc('somethingElse/CODE01').set({ a: 1 }));
  });
});

/* ------------------------------------------------- legacy sessions */

test.describe('Sessions created before ownerUid existed', () => {
  // These have no ownerUid. The rules read it with .get('ownerUid', '') so a
  // missing field evaluates to false instead of throwing, which makes the
  // behaviour a decision rather than an accident: a lesson already running
  // keeps collecting submissions, but nobody inherits ownership of it.
  test('a Zones check-in still lands on a session with no owner', async () => {
    await seed('zonesSessions/LEGACY', { blue: 0, green: 0, yellow: 0, red: 0 });
    await assertSucceeds(db(STUDENT).doc('zonesSessions/LEGACY').update({ green: 1 }));
  });

  test('nobody can claim an unowned session by writing ownerUid', async () => {
    await seed('zonesSessions/LEGACY', { blue: 0, green: 0, yellow: 0, red: 0 });
    await assertFails(
      db(STUDENT).doc('zonesSessions/LEGACY').update({ green: 1, ownerUid: STUDENT }));
  });

  test('an unowned session config can no longer be edited', async () => {
    await seed('liveQuizSessions/LEGACY',
      { title: 'old', questions: [], currentQuestion: 0, revealed: false });
    await assertFails(db(TEACHER).doc('liveQuizSessions/LEGACY').update({ revealed: true }));
    await assertFails(db(TEACHER).doc('liveQuizSessions/LEGACY').delete());
  });

  test('students can still submit to an unowned session', async () => {
    await seed('exitTicketSessions/LEGACY', { mode: 'ticket' });
    await assertSucceeds(db(STUDENT).doc('exitTicketSessions/LEGACY/responses/r1').set({
      q1Answer: 'still works', submittedAt: new Date()
    }));
  });

  test('moderation on an unowned growth wall is denied, not crashed', async () => {
    // The parent session doc does not exist at all here, which is how every
    // growth wall used to look -- only the entries subcollection was written.
    // Without the exists() guard the rule threw on get(...).data.
    await seed('growthWallSessions/LEGACY/entries/e1', { text: 'hi', approved: false });
    await assertFails(
      db(TEACHER).doc('growthWallSessions/LEGACY/entries/e1').update({ approved: true }));
    await assertFails(
      db(STUDENT).doc('growthWallSessions/LEGACY/entries/e1').update({ approved: true }));
  });
});

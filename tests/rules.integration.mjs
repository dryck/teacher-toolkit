/**
 * Firestore Rules Integration Tests
 * Tests security model with @firebase/rules-unit-testing + emulator
 *
 * Run: npm test -- rules.integration.mjs
 * Requires: Firestore emulator running (firebase emulators:start)
 */

import { test, expect } from '@playwright/test';
import { initializeTestEnvironment, RulesTestContext } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rulesPath = join(__dirname, '../packages/shell/firestore.rules');

let testEnv;

test.describe('Firestore Rules Integration Tests', () => {
  test.beforeAll(async () => {
    // Load rules from file
    const rules = readFileSync(rulesPath, 'utf8');

    // Initialize test environment with actual rules
    testEnv = await initializeTestEnvironment({
      projectId: 'teacher-toolkit-test',
      firestore: { rules, host: 'localhost', port: 8080 }
    });
  });

  test.afterAll(async () => {
    await testEnv.cleanup();
  });

  test.describe('C1: Enumeration Protection', () => {
    test('unauthenticated user CAN get() known session', async () => {
      const db = testEnv.unauthenticatedContext().firestore();

      // Create a known session first (as admin)
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore()
          .collection('zonesSessions')
          .doc('TEST123')
          .set({ blue: 0, green: 0, yellow: 0, red: 0, ownerUid: 'admin', createdAt: new Date() });
      });

      // Unauthenticated user should be able to GET it
      const doc = await db.collection('zonesSessions').doc('TEST123').get();
      expect(doc.exists).toBe(true);
    });

    test('unauthenticated user CANNOT list() sessions', async () => {
      const db = testEnv.unauthenticatedContext().firestore();

      // Should fail: list all sessions
      await expect(db.collection('zonesSessions').get())
        .rejects.toThrow(/permission|denied/i);
    });
  });

  test.describe('C2: Ownership Protection', () => {
    test('student CANNOT create session without ownerUid', async () => {
      const studentDb = testEnv.authenticatedContext('student-123').firestore();

      await expect(
        studentDb.collection('liveQuizSessions').doc('QUIZ1').create({
          title: 'Math Quiz',
          questions: []
          // Missing ownerUid - should fail
        })
      ).rejects.toThrow(/permission|denied/i);
    });

    test('teacher CAN create session (ownerUid auto-set)', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher-456').firestore();

      // Should succeed
      await expect(
        teacherDb.collection('liveQuizSessions').doc('QUIZ2').create({
          title: 'History Quiz',
          questions: [{ text: 'Q1', options: ['A', 'B'], correctIndex: 0 }],
          currentQuestion: 0,
          revealed: false,
          ownerUid: 'teacher-456',
          createdAt: new Date()
        })
      ).resolves.toBeUndefined();
    });

    test('student CANNOT modify quiz (ownership check)', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher-456').firestore();
      const studentDb = testEnv.authenticatedContext('student-789').firestore();

      // Teacher creates quiz
      await teacherDb.collection('liveQuizSessions').doc('QUIZ3').create({
        title: 'Science Quiz',
        questions: [],
        currentQuestion: 0,
        revealed: false,
        ownerUid: 'teacher-456',
        createdAt: new Date()
      });

      // Student tries to modify it
      await expect(
        studentDb.collection('liveQuizSessions').doc('QUIZ3').update({
          revealed: true
        })
      ).rejects.toThrow(/permission|denied/i);
    });
  });

  test.describe('H1: Moderation Protection', () => {
    test('student CANNOT self-approve growth mindset entry', async () => {
      const teacherDb = testEnv.authenticatedContext('teacher-111').firestore();
      const studentDb = testEnv.authenticatedContext('student-222').firestore();

      // Teacher creates session
      await teacherDb.collection('growthWallSessions').doc('WALL1').create({
        ownerUid: 'teacher-111',
        createdAt: new Date()
      });

      // Student submits entry (unapproved)
      await studentDb.collection('growthWallSessions/WALL1/entries').doc('E1').create({
        text: 'I can learn anything',
        approved: false,
        createdAt: new Date()
      });

      // Student tries to self-approve
      await expect(
        studentDb.collection('growthWallSessions/WALL1/entries').doc('E1').update({
          approved: true
        })
      ).rejects.toThrow(/permission|denied/i);

      // Teacher CAN approve
      await expect(
        teacherDb.collection('growthWallSessions/WALL1/entries').doc('E1').update({
          approved: true
        })
      ).resolves.toBeUndefined();
    });
  });

  test.describe('Authentication Required', () => {
    test('unauthenticated user CANNOT create session', async () => {
      const db = testEnv.unauthenticatedContext().firestore();

      await expect(
        db.collection('zonesSessions').doc('ZONES1').create({
          blue: 0, green: 0, yellow: 0, red: 0,
          ownerUid: 'fake-uid',
          createdAt: new Date()
        })
      ).rejects.toThrow(/permission|denied/i);
    });
  });
});

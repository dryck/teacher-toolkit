// Shared Firebase/session helpers + local-storage step config, used by
// the teacher dashboard (teacher.html) and the student page (index.html).
// Loaded after firebase-config.js and the Firebase compat SDK scripts
// (same pattern as apps/zones/zones.js and apps/choice-board/choice-board.js).
//
// This tool has two independent modes:
//   Mode A "Ladder Display" is fully local (localStorage only, no
//   Firestore reads/writes) so it keeps working even if Firebase is
//   unconfigured/unreachable.
//   Mode B "Ask 3 Before Me" is Firebase-backed, described below.
(function () {
  firebase.initializeApp(window.TK_FIREBASE_CONFIG);
  const db = firebase.firestore();

  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I

  function randomSessionCode() {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
  }

  // Stable per-device student identifier, stored in localStorage, so a
  // student can un-signal (delete their own doc) and re-tapping "I'm still
  // stuck" doesn't create a duplicate signal.
  function randomStudentId() {
    return 'stu_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Firestore shape:
  //   helpLadderSessions/{sessionId} -- { step1, step2, step3, step4, step5, createdAt }
  //   helpLadderSessions/{sessionId}/signals/{studentId} -- { joinedAt } only,
  //     one doc per currently-stuck student, fully anonymous (no nickname).
  function sessionDocRef(sessionId) {
    return db.collection('helpLadderSessions').doc(sessionId);
  }
  function signalsRef(sessionId) {
    return sessionDocRef(sessionId).collection('signals');
  }
  function signalDocRef(sessionId, studentId) {
    return signalsRef(sessionId).doc(studentId);
  }

  // Default ladder step text ("5B": Brain / Board / Buddy / Book / Boss).
  // Shared by the teacher's local settings panel (Mode A) and as a
  // per-step fallback if a session's config doc is missing a field.
  const DEFAULT_STEPS = [
    '🧠 Brain — Have you tried it yourself?',
    '📋 Board — Is the answer on the board/screen?',
    '👥 Buddy — Have you asked a classmate?',
    '📖 Book — Have you checked your notes/book?',
    '🙋 Boss — Now you can ask the teacher.'
  ];

  const STEPS_KEY = 'tk-help-ladder-steps';

  // Local-only (no Firestore) — Mode A's editable step labels, persisted
  // across sessions in this browser.
  function loadSteps() {
    try {
      const raw = localStorage.getItem(STEPS_KEY);
      if (!raw) return DEFAULT_STEPS.slice();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 5) {
        return parsed.map((s, i) => (typeof s === 'string' && s.trim()) ? s : DEFAULT_STEPS[i]);
      }
    } catch (e) { /* ignore malformed data, fall back to defaults */ }
    return DEFAULT_STEPS.slice();
  }

  function saveSteps(steps) {
    localStorage.setItem(STEPS_KEY, JSON.stringify(steps));
  }

  window.TKHelpLadder = {
    db,
    randomSessionCode,
    randomStudentId,
    sessionDocRef,
    signalsRef,
    signalDocRef,
    DEFAULT_STEPS,
    loadSteps,
    saveSteps
  };
})();

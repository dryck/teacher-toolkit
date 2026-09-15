// Shared Firebase/session helpers for both the student page and the
// teacher dashboard. Loaded after firebase-config.js and the Firebase
// compat SDK scripts. Mirrors apps/choice-board/choice-board.js.
(function () {
  firebase.initializeApp(window.TK_FIREBASE_CONFIG);
  const db = firebase.firestore();

  // Difficulty levels are shown as chili emoji only (🌶 / 🌶🌶 / 🌶🌶🌶),
  // never as "easy/medium/hard" words -- removing ability-based labels is
  // the whole pedagogical point of this tool (self-differentiation without
  // a fixed-mindset label attached to the choice).
  const LEVELS = [1, 2, 3];
  const LEVEL_EMOJI = { 1: '🌶', 2: '🌶🌶', 3: '🌶🌶🌶' };

  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I

  function randomSessionCode() {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
  }

  // Stable per-device student identifier, stored in localStorage alongside
  // the nickname so a student's choice doc persists (and can be changed)
  // across visits.
  function randomStudentId() {
    return 'stu_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function sessionDocRef(sessionId) {
    return db.collection('chiliChallengeSessions').doc(sessionId);
  }

  function choicesCollRef(sessionId) {
    return sessionDocRef(sessionId).collection('choices');
  }

  function choiceDocRef(sessionId, studentId) {
    return choicesCollRef(sessionId).doc(studentId);
  }

  // The task text a student sees/reads for a given level (1/2/3), pulled
  // out of the session config doc's level1Text/level2Text/level3Text fields.
  function levelText(config, level) {
    return (config && config['level' + level + 'Text']) || '';
  }

  function emptyCounts() {
    return { 1: 0, 2: 0, 3: 0 };
  }

  window.TKChiliChallenge = {
    db,
    LEVELS,
    LEVEL_EMOJI,
    randomSessionCode,
    randomStudentId,
    sessionDocRef,
    choicesCollRef,
    choiceDocRef,
    levelText,
    emptyCounts
  };
})();

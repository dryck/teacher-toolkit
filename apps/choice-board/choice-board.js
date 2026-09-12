// Shared Firebase/session helpers for both the student board page and the
// teacher dashboard. Loaded after firebase-config.js and the Firebase
// compat SDK scripts.
(function () {
  firebase.initializeApp(window.TK_FIREBASE_CONFIG);
  const db = firebase.firestore();

  const CELL_COUNT = 9;

  // Suggested icons offered in the teacher's cell-icon picker.
  const ICONS = [
    { emoji: '✏️', label: 'Write' },
    { emoji: '🎨', label: 'Draw' },
    { emoji: '🗣️', label: 'Explain' },
    { emoji: '🔨', label: 'Build' },
    { emoji: '🔍', label: 'Research' },
    { emoji: '🎭', label: 'Act out' },
    { emoji: '📊', label: 'Chart' },
    { emoji: '💻', label: 'Create' },
    { emoji: '🤝', label: 'Teach someone' },
    { emoji: '⭐', label: 'Free choice' }
  ];

  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I

  function randomSessionCode() {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
  }

  // Stable per-device student identifier, stored in localStorage alongside
  // the nickname so a student's progress doc persists across visits.
  function randomStudentId() {
    return 'stu_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function boardDocRef(sessionId) {
    return db.collection('choiceBoardSessions').doc(sessionId);
  }

  function progressCollRef(sessionId) {
    return boardDocRef(sessionId).collection('progress');
  }

  function progressDocRef(sessionId, studentId) {
    return progressCollRef(sessionId).doc(studentId);
  }

  function emptyCells() {
    return new Array(CELL_COUNT).fill(null);
  }

  function emptyCompleted() {
    return new Array(CELL_COUNT).fill(false);
  }

  function countCompleted(completed) {
    return (completed || []).filter(Boolean).length;
  }

  window.TKChoiceBoard = {
    db,
    CELL_COUNT,
    ICONS,
    randomSessionCode,
    randomStudentId,
    boardDocRef,
    progressCollRef,
    progressDocRef,
    emptyCells,
    emptyCompleted,
    countCompleted
  };
})();

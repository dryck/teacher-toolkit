// Shared Firebase/session helpers for both the student board page and the
// teacher dashboard. Loaded after firebase-config.js and the Firebase
// compat SDK scripts.
(function () {
  
  const db = window.TKFirebase.db();

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

  // Import from shared firebase.js
  const { randomSessionCode, randomStudentId } = window.TKFirebase;

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

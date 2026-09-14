// Shared Firebase/session helpers for both the student deck page and the
// teacher dashboard. Loaded after firebase-config.js and the Firebase
// compat SDK scripts. Mirrors apps/choice-board/choice-board.js.
(function () {
  firebase.initializeApp(window.TK_FIREBASE_CONFIG);
  const db = firebase.firestore();

  const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

  // Small semantic accent colors for difficulty badges -- functional
  // indicators, not brand chrome, so these are kept separate from the
  // shared theme tokens on purpose.
  const DIFFICULTY_COLORS = {
    Easy: { bg: '#dcfce7', fg: '#15803d' },
    Medium: { bg: '#fef3c7', fg: '#b45309' },
    Hard: { bg: '#fee2e2', fg: '#b91c1c' }
  };

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

  function sessionDocRef(sessionId) {
    return db.collection('challengeDeckSessions').doc(sessionId);
  }

  function progressCollRef(sessionId) {
    return sessionDocRef(sessionId).collection('progress');
  }

  function progressDocRef(sessionId, studentId) {
    return progressCollRef(sessionId).doc(studentId);
  }

  // A card's stable ID is "{categoryIndex}_{cardIndexWithinCategory}" so
  // completion tracking survives without needing real database IDs per card.
  function cardId(categoryIndex, cardIndex) {
    return categoryIndex + '_' + cardIndex;
  }

  function defaultCategories() {
    return [
      { name: 'Warm-up', difficulty: 'Easy', cards: [] },
      { name: 'Challenge', difficulty: 'Medium', cards: [] },
      { name: 'Creative', difficulty: 'Hard', cards: [] }
    ];
  }

  // How many of a given category's cards this student has completed.
  function countCompletedInCategory(completedCardIds, categoryIndex) {
    const prefix = categoryIndex + '_';
    return (completedCardIds || []).filter(id => id.startsWith(prefix)).length;
  }

  function countCompletedTotal(completedCardIds) {
    return (completedCardIds || []).length;
  }

  window.TKChallengeDeck = {
    db,
    DIFFICULTIES,
    DIFFICULTY_COLORS,
    randomSessionCode,
    randomStudentId,
    sessionDocRef,
    progressCollRef,
    progressDocRef,
    cardId,
    defaultCategories,
    countCompletedInCategory,
    countCompletedTotal
  };
})();

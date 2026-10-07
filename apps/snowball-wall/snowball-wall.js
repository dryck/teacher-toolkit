// Shared Firebase/session helpers for both the student wall page and the
// teacher dashboard. Loaded after firebase-config.js and the Firebase
// compat SDK scripts.
(function () {
  
  const db = window.TKFirebase.db();


  const MAX_STICKY_LEN = 140;

  // Phase metadata shared by both the teacher dashboard and the student
  // page, so the wording/order of each stage only lives in one place.
  const PHASES = [
    { n: 1, emoji: '✍️', label: 'Everyone writes on their own', instruction: 'Write your own idea about:' },
    { n: 2, emoji: '🤝', label: 'Pairs combine into one sticky', instruction: 'Talk to your partner, then write ONE combined idea about:' },
    { n: 3, emoji: '👥', label: 'Groups of 4 combine into one sticky', instruction: 'Talk to your group of 4, then write ONE combined idea about:' },
    { n: 4, emoji: '🏛️', label: 'Class Wall', instruction: '' }
  ];

  function phaseInfo(n) {
    return PHASES.find(p => p.n === n) || PHASES[0];
  }

  // Import from shared firebase.js
  const { randomSessionCode, randomStudentId } = window.TKFirebase;
    return code;
  }

  function sessionDocRef(sessionId) {
    return db.collection('snowballSessions').doc(sessionId);
  }

  function stickiesCollRef(sessionId) {
    return sessionDocRef(sessionId).collection('stickies');
  }

  window.TKSnowball = {
    db,
    PHASES,
    MAX_STICKY_LEN,
    phaseInfo,
    randomSessionCode,
    sessionDocRef,
    stickiesCollRef
  };
})();

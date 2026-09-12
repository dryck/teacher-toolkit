// Shared Firebase/session helpers for both the student check-in page and
// the teacher dashboard. Loaded after firebase-config.js and the Firebase
// compat SDK scripts.
(function () {
  firebase.initializeApp(window.TK_FIREBASE_CONFIG);
  const db = firebase.firestore();

  const ZONES = [
    { key: 'blue', emoji: '🔵', label: 'Low Energy', examples: 'Tired, sad, bored', color: '#3b82f6' },
    { key: 'green', emoji: '🟢', label: 'Ready to Go', examples: 'Calm, focused, happy', color: '#22c55e' },
    { key: 'yellow', emoji: '🟡', label: 'Excited', examples: 'Silly, worried, nervous', color: '#eab308' },
    { key: 'red', emoji: '🔴', label: 'Out of Control', examples: 'Angry, panicked, overwhelmed', color: '#ef4444' }
  ];

  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I

  function randomSessionCode() {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
  }

  function sessionDocRef(sessionId) {
    return db.collection('zonesSessions').doc(sessionId);
  }

  function emptyCounts() {
    const counts = {};
    ZONES.forEach(z => { counts[z.key] = 0; });
    return counts;
  }

  window.TKZones = { db, ZONES, randomSessionCode, sessionDocRef, emptyCounts };
})();

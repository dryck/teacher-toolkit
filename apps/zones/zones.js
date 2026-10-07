// Shared Firebase/session helpers for both the student check-in page and
// the teacher dashboard. Loaded after firebase-config.js, firebase-sdk.js,
// and the Firebase compat SDK scripts.
(function () {
  const db = window.TKFirebase.db();

  const ZONES = [
    { key: 'blue', emoji: '🔵', label: 'Low Energy', examples: 'Tired, sad, bored', color: '#3b82f6' },
    { key: 'green', emoji: '🟢', label: 'Ready to Go', examples: 'Calm, focused, happy', color: '#22c55e' },
    { key: 'yellow', emoji: '🟡', label: 'Excited', examples: 'Silly, worried, nervous', color: '#eab308' },
    { key: 'red', emoji: '🔴', label: 'Out of Control', examples: 'Angry, panicked, overwhelmed', color: '#ef4444' }
  ];

  function sessionDocRef(sessionId) {
    return db.collection('zonesSessions').doc(sessionId);
  }

  function emptyCounts() {
    const counts = {};
    ZONES.forEach(z => { counts[z.key] = 0; });
    return counts;
  }

  // Export from shared firebase.js
  const { randomSessionCode } = window.TKFirebase;

  window.TKZones = { db, ZONES, randomSessionCode, sessionDocRef, emptyCounts };
})();

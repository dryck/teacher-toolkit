// Firebase initialization and utilities shared by all 11 Firebase-backed tools.
// Extracted from per-tool duplicates to a single source of truth.

// Must be called AFTER:
// - window.TK_FIREBASE_CONFIG is set (from firebase-config.js)
// - Firebase SDK is loaded (firebase-app-compat.js + firebase-firestore-compat.js)

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I

export const TKFirebase = {
  /** Get the shared Firestore database instance. Call once per page load. */
  db: () => {
    if (!firebase.apps.length) {
      firebase.initializeApp(window.TK_FIREBASE_CONFIG);
    }
    return firebase.firestore();
  },

  /** Generate a random 5-character session code. Used for teacher-facing join URLs. */
  randomSessionCode: () => {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
  },

  /** Generate a stable session-local student identifier. Used as a doc key for per-student data. */
  randomStudentId: () => {
    return 'stu_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  /** Retry a Firestore write with exponential backoff + timeout.
   *  Used for teacher dashboard writes (start session, update timer, etc.) where network
   *  delays or quota exhaustion should not silently fail.
   *  @param {Function} op - async function returning a Promise (e.g. db.collection(...).set(...))
   *  @param {number} maxMs - total time budget in milliseconds (default 5000)
   *  @returns {Promise} resolves when op succeeds, rejects on timeout
   */
  withTimeout: async (op, maxMs = 5000) => {
    const start = Date.now();
    let delay = 100;
    while (true) {
      try {
        return await op();
      } catch (err) {
        if (Date.now() - start + delay > maxMs) throw err;
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, 1000);
      }
    }
  }
};

// For backwards compatibility, expose on window in case old code tries to call directly
window.TKFirebase = TKFirebase;

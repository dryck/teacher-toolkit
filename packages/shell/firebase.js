// Firebase bootstrap + session helpers shared by every Firebase-backed tool.
//
// Replaces eleven byte-identical copies of initializeApp/randomSessionCode/
// randomStudentId that had drifted into each apps/<tool>/<tool>.js. Same
// reason packages/shell/escape.js exists: one copy, one place to fix.
//
// Load order on a page (all plain <script>, no modules):
//   firebase-app-compat.js
//   firebase-auth-compat.js        <- required: the rules check request.auth
//   firebase-firestore-compat.js
//   ../shell/firebase-config.js    <- sets window.TK_FIREBASE_CONFIG
//   ../shell/firebase.js           <- this file
//   <tool>.js
(function () {
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I

  function app() {
    if (!firebase.apps.length) firebase.initializeApp(window.TK_FIREBASE_CONFIG);
    return firebase.app();
  }

  // Anonymous sign-in, started once at load. The Firestore rules require
  // request.auth != null for every write, so this has to be in flight before
  // the first write -- which in practice is always a user action (joining a
  // session, tapping a zone), hundreds of milliseconds later. Reads don't
  // need it: `get` is open so a student can resolve a session code.
  //
  // Writes that want the guarantee rather than the race should
  // `await TKFirebase.ready` first; TKFirebase.withTimeout() does it for you.
  let readyPromise = null;

  function ready() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      try {
        app();
        const auth = firebase.auth();
        if (!auth.currentUser) await auth.signInAnonymously();
        return auth.currentUser;
      } catch (err) {
        // No network, no config (firebase-config.js still ships REPLACE_ME),
        // or the auth SDK missing. Reads still work; writes will be denied by
        // the rules, which the tools already surface as a write timeout.
        console.warn('[TKFirebase] anonymous sign-in unavailable:', err && err.message);
        return null;
      }
    })();
    return readyPromise;
  }

  const TKFirebase = {
    /** The shared Firestore instance. Synchronous: building refs needs no auth. */
    db: function () {
      app();
      return firebase.firestore();
    },

    /** Promise resolving once anonymous sign-in has settled (to a user or to null). */
    get ready() {
      return ready();
    },

    /** Current anonymous uid, or null before sign-in settles / when unavailable. */
    uid: function () {
      try {
        const user = firebase.auth().currentUser;
        return user ? user.uid : null;
      } catch (err) {
        return null;
      }
    },

    /** Random 8-character session code, one random byte per character.
     *
     *  Was 5 chars from Math.random(): ~33M codes, and V8's PRNG state is
     *  recoverable from observed output, so codes shown on a projector in
     *  sequence are predictable. 8 chars from crypto.getRandomValues() is
     *  32^8 ~= 1.1e12. 256 is a multiple of 32, so `byte % 32` is unbiased.
     */
    randomSessionCode: function () {
      const bytes = new Uint8Array(8);
      crypto.getRandomValues(bytes);
      let code = '';
      for (let i = 0; i < bytes.length; i++) {
        code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
      }
      return code;
    },

    /** Stable per-device student id, persisted by each tool in localStorage. */
    randomStudentId: function () {
      if (crypto.randomUUID) return 'stu_' + crypto.randomUUID();
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return 'stu_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    },

    /** Run a Firestore write, failing loudly instead of hanging forever.
     *
     *  Firestore queues writes offline rather than rejecting, so a teacher
     *  with no network sees a button that does nothing. Waits for sign-in
     *  first, since the rules reject unauthenticated writes.
     */
    withTimeout: async function (op, maxMs = 8000) {
      await ready();
      let timer;
      try {
        return await Promise.race([
          op(),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Firestore write timed out')), maxMs);
          })
        ]);
      } finally {
        clearTimeout(timer);
      }
    },

    /** Create a session doc, stamped with its owner so the rules can scope
     *  later edits to the teacher who made it.
     *
     *  Uses set() on a fresh random code. If that code somehow already exists
     *  the write is evaluated as an update, which the rules only allow for the
     *  existing ownerUid -- so a collision is rejected rather than silently
     *  overwriting another class's live session.
     */
    createSession: async function (collection, sessionCode, data) {
      await ready();
      const uid = TKFirebase.uid();
      if (!uid) throw new Error('Not signed in: cannot create a session');
      return TKFirebase.db().collection(collection).doc(sessionCode).set(
        Object.assign({}, data, {
          ownerUid: uid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        })
      );
    }
  };

  window.TKFirebase = TKFirebase;
})();

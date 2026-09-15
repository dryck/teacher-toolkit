// Shared Firebase/session helpers for both the student page and the
// teacher dashboard. Loaded after firebase-config.js and the Firebase
// compat SDK scripts. Mirrors apps/chili-challenge/chili-challenge.js and
// apps/brainstorm-timer/brainstorm-timer.js.
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

  // Firestore shape:
  //   peerFeedbackSessions/{sessionId} -- { targets, createdAt }. `targets`
  //   is the optional list of presenter/group names the teacher entered
  //   during setup; an empty array means feedback is generic/untargeted.
  //   peerFeedbackSessions/{sessionId}/feedback/{autoId} -- one doc per
  //   submission, fully anonymous (no student identity field anywhere):
  //   { target, stars: [string, string], wish, createdAt }. `target` is
  //   the chosen presenter/group name, or null when the session has no
  //   targets configured.
  function sessionDocRef(sessionId) {
    return db.collection('peerFeedbackSessions').doc(sessionId);
  }

  function feedbackCollRef(sessionId) {
    return sessionDocRef(sessionId).collection('feedback');
  }

  // Each of the two stars and the one wish is kept short -- long enough for
  // a genuine sentence, short enough to keep the live feed skimmable.
  const MAX_FIELD_LEN = 150;

  window.TKPeerFeedback = {
    db,
    randomSessionCode,
    sessionDocRef,
    feedbackCollRef,
    MAX_FIELD_LEN
  };
})();

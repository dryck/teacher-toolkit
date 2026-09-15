// Shared Firebase/session helpers for both the student page and the
// teacher dashboard. Loaded after firebase-config.js and the Firebase
// compat SDK scripts. Mirrors apps/chili-challenge/chili-challenge.js.
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

  function sessionDocRef(sessionId) {
    return db.collection('brainstormSessions').doc(sessionId);
  }

  // Ideas are stored one-per-doc, fully anonymous (no student id/nickname
  // field anywhere) -- this is a fast-fire idea-count tool, not an
  // attributed-response tool like chili-challenge/choice-board.
  function ideasCollRef(sessionId) {
    return sessionDocRef(sessionId).collection('ideas');
  }

  // A big, varied bank of genuinely everyday objects for the "🎲 Random
  // Object" button -- things every student has handled, nothing obscure or
  // requiring specialist knowledge, so "brainstorm alternative uses for
  // this" works for any class.
  const OBJECTS = [
    'paperclip', 'rubber band', 'cardboard box', 'plastic bottle', 'sock',
    'wooden spoon', 'umbrella', 'brick', 'balloon', 'shoelace',
    'coffee mug', 'hairbrush', 'bottle cap', 'rubber duck', 'traffic cone',
    'flashlight', 'ice cube tray', 'clothespin', 'tennis ball', 'egg carton',
    'drinking straw', 'paper plate', 'toothbrush', 'oven mitt', 'bucket',
    'garden hose', 'dish sponge', 'safety pin', 'binder clip', 'tin can',
    'cereal box', 'newspaper', 'magnet', 'spoon', 'pillow',
    'blanket', 'backpack', 'chopstick', 'rubber glove', 'plastic bag',
    'milk carton', 'yoga mat', 'hula hoop', 'jump rope', 'frisbee',
    'hair tie', 'button', 'zipper', 'wine cork', 'matchbox',
    'candle', 'flowerpot', 'welcome mat', 'paper cup', 'shopping cart',
    'door hinge', 'picture frame', 'wristwatch', 'keychain', 'shower curtain'
  ];

  function randomObject() {
    return OBJECTS[Math.floor(Math.random() * OBJECTS.length)];
  }

  window.TKBrainstormTimer = {
    db,
    randomSessionCode,
    sessionDocRef,
    ideasCollRef,
    OBJECTS,
    randomObject
  };
})();

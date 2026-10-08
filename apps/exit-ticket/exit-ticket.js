// Shared Firebase/session helpers for both the student ticket page and the
// teacher dashboard. Loaded after ../shell/firebase.js and the Firebase compat
// SDK scripts (mirrors apps/zones/zones.js).
(function () {
  const db = window.TKFirebase.db();
  const { randomSessionCode } = window.TKFirebase;

  const DEFAULT_Q1_TEXT = 'What did you learn today?';
  const DEFAULT_Q2_TEXT = 'How confident do you feel?'; // fixed wording, not editable by the teacher
  const DEFAULT_Q3_TEXT = 'What question do you still have?';

  // Top-level collection, distinct from Zones' `zonesSessions` in the same
  // Firebase project. One doc per session holds the setup config:
  // { mode, createdAt, ...mode-specific fields }
  //
  // mode: 'ticket' | 'clearCloudy' | 'trafficLight' — defaults to 'ticket'
  // when absent (sessions created before this field existed).
  //
  // mode === 'ticket' (the original/default mode):
  //   { mode: 'ticket', q1Enabled, q1Text, q2Enabled, q3Enabled, q3Text, createdAt }
  // mode === 'clearCloudy': no question toggles/text — the two prompts are
  // fixed UI labels, not teacher-editable:
  //   { mode: 'clearCloudy', createdAt }
  // mode === 'trafficLight': single-tap, no extra config:
  //   { mode: 'trafficLight', createdAt }
  function sessionDocRef(sessionId) {
    return db.collection('exitTicketSessions').doc(sessionId);
  }

  // Subcollection of one doc per student submission. Shape depends on the
  // session's mode:
  //
  // mode === 'ticket':
  //   { q1Answer?, confidence?, q3Answer?, submittedAt } — fields for
  //   disabled questions are omitted entirely.
  // mode === 'clearCloudy':
  //   { clearText?, cloudyText?, submittedAt } — both optional/leniently
  //   trimmed, same as q1Answer/q3Answer above (a student may leave either
  //   blank).
  // mode === 'trafficLight':
  //   { light: 'red' | 'yellow' | 'green', submittedAt }
  function responsesRef(sessionId) {
    return sessionDocRef(sessionId).collection('responses');
  }

  window.TKExitTicket = {
    db,
    DEFAULT_Q1_TEXT,
    DEFAULT_Q2_TEXT,
    DEFAULT_Q3_TEXT,
    randomSessionCode,
    sessionDocRef,
    responsesRef
  };
})();

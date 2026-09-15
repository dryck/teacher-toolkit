// Shared Firebase/session helpers for both the student page and the teacher
// dashboard. Loaded after firebase-config.js and the Firebase compat SDK
// scripts. Mirrors apps/choice-board/choice-board.js and
// apps/challenge-deck/challenge-deck.js.
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

  // Stable per-device student identifier, stored in localStorage alongside
  // the nickname so a student's identity (and their responses) persist
  // across visits to the same session. Mirrors choice-board's/
  // challenge-deck's randomStudentId().
  function randomStudentId() {
    return 'stu_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function sessionDocRef(sessionId) {
    return db.collection('liveQuizSessions').doc(sessionId);
  }

  function playersCollRef(sessionId) {
    return sessionDocRef(sessionId).collection('players');
  }

  function playerDocRef(sessionId, studentId) {
    return playersCollRef(sessionId).doc(studentId);
  }

  function responsesCollRef(sessionId) {
    return sessionDocRef(sessionId).collection('responses');
  }

  // Deterministic doc ID: studentId + '_' + questionIndex. A student
  // changing their mind before reveal just overwrites their own response
  // via .set() -- this is the single source of truth for that ID shape,
  // used identically by the student's write path and the teacher's tally.
  function responseId(studentId, questionIndex) {
    return studentId + '_' + questionIndex;
  }

  function responseDocRef(sessionId, studentId, questionIndex) {
    return responsesCollRef(sessionId).doc(responseId(studentId, questionIndex));
  }

  // A question only counts toward anyone's derived score once the teacher
  // has revealed it. There's no per-question "revealed" history stored --
  // just today's currentQuestion/revealed pair on the session doc -- so
  // this assumes every question *before* currentQuestion was revealed
  // before the teacher advanced past it. The dashboard's "Next Question"
  // button is disabled until reveal specifically to keep that assumption
  // true; see teacher.html's render().
  function isQuestionRevealed(questionIndex, currentQuestion, revealed) {
    return questionIndex < currentQuestion || (questionIndex === currentQuestion && !!revealed);
  }

  // Score = count of a student's responses to revealed questions where
  // optionIndex matches that question's correctIndex. Never stored --
  // always recomputed from `responses` + `questions`, for both the
  // teacher's leaderboard and each student's own running score, so the
  // two can never silently drift apart.
  function computeScores(questions, responses, currentQuestion, revealed) {
    const scores = {};
    (responses || []).forEach(r => {
      if (!isQuestionRevealed(r.questionIndex, currentQuestion, revealed)) return;
      const q = questions && questions[r.questionIndex];
      if (!q) return;
      if (r.optionIndex === q.correctIndex) {
        scores[r.studentId] = (scores[r.studentId] || 0) + 1;
      }
    });
    return scores;
  }

  // How many students picked each option for one question, from an
  // already-loaded responses array (used for the reveal bar chart --
  // no extra Firestore read, just a client-side tally of what's already
  // been streamed down by the responses listener).
  function tallyOptionCounts(responses, questionIndex, optionCount) {
    const counts = new Array(optionCount).fill(0);
    (responses || []).forEach(r => {
      if (r.questionIndex === questionIndex && r.optionIndex >= 0 && r.optionIndex < optionCount) {
        counts[r.optionIndex]++;
      }
    });
    return counts;
  }

  // Validates the compacted question set right before "Start Session"
  // writes it: every question needs text, 2-4 non-empty options, and
  // exactly one of those options marked correct.
  function validateQuestions(questions) {
    if (!questions || !questions.length) return false;
    return questions.every(q => {
      if (!q || !q.text || !q.text.trim()) return false;
      const options = q.options || [];
      if (options.length < 2 || options.length > 4) return false;
      if (!options.every(o => typeof o === 'string' && o.trim())) return false;
      if (typeof q.correctIndex !== 'number') return false;
      if (q.correctIndex < 0 || q.correctIndex >= options.length) return false;
      return true;
    });
  }

  window.TKLiveQuiz = {
    db,
    randomSessionCode,
    randomStudentId,
    sessionDocRef,
    playersCollRef,
    playerDocRef,
    responsesCollRef,
    responseId,
    responseDocRef,
    isQuestionRevealed,
    computeScores,
    tallyOptionCounts,
    validateQuestions
  };
})();

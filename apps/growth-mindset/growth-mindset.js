// Shared Firebase/session helpers + the reframe-template library, used by
// both the student page (index.html) and the teacher "Wall of Yet" page
// (wall.html). Loaded after firebase-config.js and the Firebase compat SDK
// scripts (same pattern as apps/zones/zones.js).
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

  // growthWallSessions/{code}/entries/{autoId} -- { text, approved, createdAt }
  function sessionDocRef(sessionId) {
    return db.collection('growthWallSessions').doc(sessionId);
  }
  function entriesRef(sessionId) {
    return sessionDocRef(sessionId).collection('entries');
  }

  // ---------------------------------------------------------------------
  // Reframe template library
  //
  // Fully offline, no AI/API call: a small library of regex patterns that
  // recognize common negative/fixed-mindset phrasings, pull out the "topic"
  // (X) where possible, and rewrite the thought using growth-mindset
  // language (effort, practice, "yet", brains-grow-with-use framing).
  //
  // Each entry has 2 variant templates so "Try another" can show a second
  // phrasing of the same reframe. `extract` returns the captured topic
  // string (or null if the pattern has no capture group), which the
  // variant builder functions receive.
  // ---------------------------------------------------------------------

  function cleanTopic(raw) {
    if (!raw) return '';
    return raw
      .trim()
      // drop a trailing sentence terminator/quote left over from capture
      .replace(/["'.!?\s]+$/, '')
      .trim();
  }

  const PATTERNS = [
    {
      name: "i'm bad at X",
      regex: /\bi'?m\s+bad\s+at\s+(.+)/i,
      variants: (x) => [
        `I haven't mastered ${x} yet — and that's what practice is for.`,
        `${cap(x)} is hard for me right now, but my brain grows stronger every time I practice it.`
      ]
    },
    {
      name: "i'm not good at X",
      regex: /\bi'?m\s+not\s+good\s+at\s+(.+)/i,
      variants: (x) => [
        `I'm not good at ${x} yet — "good" is something you build, not something you're born with.`,
        `${cap(x)} isn't my strength yet, but strengths come from practice, not luck.`
      ]
    },
    {
      name: "i can't X",
      regex: /\bi\s+can'?t\s+(.+)/i,
      variants: (x) => [
        `I can't ${x} yet — but with practice, I will.`,
        `I'm still learning how to ${x}. Every attempt gets me a little closer.`
      ]
    },
    {
      name: "i'll never X",
      regex: /\bi'?ll\s+never\s+(.+)/i,
      variants: (x) => [
        `I haven't figured out how to ${x} yet — "never" isn't true, it just takes time.`,
        `Right now, figuring out how to ${x} feels impossible, but skills are built one try at a time.`
      ]
    },
    {
      name: "i don't understand X",
      regex: /\bi\s+don'?t\s+understand\s+(.+)/i,
      variants: (x) => [
        `I don't understand ${x} yet — confusion is just the first step before it clicks.`,
        `${cap(x)} doesn't make sense to me right now, but asking questions will get me there.`
      ]
    },
    {
      name: "i'm too dumb/stupid to X",
      regex: /\bi'?m\s+too\s+(?:dumb|stupid)\s+(?:to|for)\s+(.+)/i,
      variants: (x) => [
        `I haven't learned how to ${x} yet — that's different from not being able to.`,
        `Learning to ${x} is a skill, not a fixed trait, and skills grow with effort.`
      ]
    },
    {
      name: "i'm not smart enough to X",
      regex: /\bi'?m\s+not\s+smart\s+enough\s+(?:to|for)\s+(.+)/i,
      variants: (x) => [
        `I haven't built the skills to ${x} yet — smart isn't fixed, it's grown.`,
        `Learning to ${x} is a challenge for my brain right now, and challenges are how brains grow stronger.`
      ]
    },
    {
      name: "i'm stupid/dumb (no topic)",
      regex: /\bi'?m\s+(?:so\s+)?(?:stupid|dumb)\b/i,
      variants: () => [
        `My brain is still growing — mistakes are how it gets stronger.`,
        `I'm not stupid — I'm still learning, and learning takes time.`
      ]
    },
    {
      name: "everyone else is better at X",
      regex: /\beveryone\s+else\s+is\s+better\s+at\s+(.+)/i,
      variants: (x) => [
        `Other people may be further along in ${x}, but everyone starts somewhere — my only competition is who I was yesterday.`,
        `I can't compare my beginning to someone else's practice. I'm building ${x} at my own pace.`
      ]
    },
    {
      name: "i always mess up / i always X",
      regex: /\bi\s+always\s+(.+)/i,
      variants: (x) => [
        `I've noticed I ${x} sometimes, but "always" isn't true — every attempt is a new chance to improve.`,
        `I ${x} sometimes right now, but that pattern can change with practice.`
      ]
    },
    {
      name: "i give up",
      regex: /\bi\s+(?:want\s+to\s+)?give\s+up\b/i,
      variants: () => [
        `I want to give up right now — but taking a break and trying again still counts as progress.`,
        `This is hard enough that I want to stop — that's exactly when growth happens if I keep going.`
      ]
    },
    {
      name: "i hate X",
      regex: /\bi\s+hate\s+(.+)/i,
      variants: (x) => [
        `${cap(x)} is frustrating for me right now — strong feelings often mean I care about getting better at it.`,
        `I don't enjoy ${x} yet, but that can change as I get more comfortable with it.`
      ]
    }
  ];

  function cap(s) {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Generic fallback: whatever the pattern library doesn't recognize still
  // gets wrapped in "yet"/effort framing so the tool never dead-ends with
  // "sorry, I don't understand".
  function fallbackVariants(original) {
    const trimmed = original.trim().replace(/[.!?\s]+$/, '');
    return [
      `"${trimmed}" — you haven't gotten there yet, and "yet" changes everything. Keep practicing.`,
      `Right now: ${trimmed}. But with effort and practice, that's already starting to change.`
    ];
  }

  function reframe(input) {
    const text = (input || '').trim();
    if (!text) return { matched: false, pattern: null, variants: fallbackVariants('') };

    for (const p of PATTERNS) {
      const m = text.match(p.regex);
      if (m) {
        const topic = m[1] ? cleanTopic(m[1]) : null;
        const variants = topic ? p.variants(topic) : p.variants();
        return { matched: true, pattern: p.name, variants };
      }
    }
    return { matched: false, pattern: null, variants: fallbackVariants(text) };
  }

  window.TKGrowth = {
    db,
    randomSessionCode,
    sessionDocRef,
    entriesRef,
    reframe,
    PATTERNS // exposed for debugging/tests, not required by the pages
  };
})();

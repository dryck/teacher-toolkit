/* Teacher Toolkit — shared Web Audio context.

   Every tool that beeps used to do `new AudioContext()` per sound. That
   leaks: a context holds an OS audio thread and is never garbage-collected
   while running, and browsers cap how many a page may create (Chrome
   historically ~6). Visual Timer's alarm alone opens six in a row, so after
   an alarm or two `new AudioContext()` starts throwing and every sound in
   the tool goes silent for the rest of the lesson.

   One lazily-created context, reused forever, fixes that and is also
   cheaper — construction is the expensive part, oscillators are throwaway.

   Usage:  var ctx = TKAudio.ctx(); if (!ctx) return;   // null if unsupported
*/
(function () {
  var ctx = null;

  function getCtx() {
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;

    if (!ctx) {
      try {
        ctx = new Ctor();
      } catch (e) {
        return null;
      }
    }

    // Browsers start a context suspended until a user gesture, and may
    // suspend it again when a backgrounded tab is throttled. Resuming is
    // a no-op when already running.
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume().catch(function () {});
    }

    return ctx;
  }

  window.TKAudio = { ctx: getCtx };
})();

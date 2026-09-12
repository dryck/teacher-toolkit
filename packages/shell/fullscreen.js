/* Teacher Toolkit — shared fullscreen toggle button, injected into every
   tool page. Toggles the browser's native Fullscreen API on the whole
   document, so classroom displays/projectors can hide browser chrome. */
(function () {
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tk-fullscreen-btn';
  btn.setAttribute('aria-label', 'Toggle fullscreen');
  btn.textContent = '⛶';
  btn.addEventListener('click', toggleFullscreen);

  document.addEventListener('DOMContentLoaded', function () {
    document.body.appendChild(btn);
  });
})();

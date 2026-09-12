// Shared non-blocking status toast. Firestore writes against a
// misconfigured/offline backend never reject, they just hang -- callers pair
// this with a client-side timeout. A native alert() would freeze the whole
// page (and any automated testing of it) until dismissed, which reads as the
// app having crashed; this banner shows the same message without blocking.
(function () {
  let toastEl = null;
  let hideTimer = null;

  function ensureToast() {
    if (toastEl) return toastEl;
    toastEl = document.createElement('div');
    toastEl.setAttribute('role', 'alert');
    toastEl.style.cssText = [
      'position: fixed',
      'left: 50%',
      'bottom: 24px',
      'transform: translateX(-50%)',
      'max-width: 90vw',
      'background: #dc3545',
      'color: #fff',
      "font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      'font-size: 0.95rem',
      'font-weight: 600',
      'padding: 14px 20px',
      'border-radius: 12px',
      'box-shadow: 0 8px 24px rgba(0,0,0,0.25)',
      'z-index: 9999',
      'opacity: 0',
      'transition: opacity 0.2s ease',
      'text-align: center'
    ].join(';');
    document.body.appendChild(toastEl);
    return toastEl;
  }

  function show(message, ms) {
    const el = ensureToast();
    el.textContent = message;
    clearTimeout(hideTimer);
    void el.offsetWidth;
    el.style.opacity = '1';
    hideTimer = setTimeout(() => { el.style.opacity = '0'; }, ms || 4000);
  }

  window.TKToast = { show };
})();

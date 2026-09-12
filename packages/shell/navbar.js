/* Teacher Toolkit — shared navbar, injected into every app.
   Each page sets `window.TK_CURRENT` to its own key ('hub' for the
   landing page, or a tool key) before loading this script. Links are
   built relative to that page so the whole site can be deployed at
   any base path (e.g. GitHub Pages project sites). */
(function () {
  var TOOLS = [
    { key: 'hub', label: 'Teacher Toolkit', href: '', isBrand: true },
    { key: 'noise-monitor', label: 'Noise Monitor', href: 'noise-monitor/' },
    { key: 'quick-poll', label: 'Quick Poll', href: 'quick-poll/' },
    { key: 'random-picker', label: 'Random Picker', href: 'random-picker/' },
    { key: 'visual-timer', label: 'Visual Timer', href: 'visual-timer/' },
    { key: 'research', label: 'Research', href: 'research/' }
  ];

  var current = window.TK_CURRENT || 'hub';
  var prefix = current === 'hub' ? '' : '../';

  var nav = document.createElement('nav');
  nav.className = 'tk-navbar';

  TOOLS.forEach(function (tool) {
    var a = document.createElement('a');
    a.textContent = tool.label;
    // Brand link always points at the toolkit root; every other link is
    // relative to the current page's own directory.
    a.href = tool.isBrand
      ? (current === 'hub' ? '#' : '../')
      : (current === 'hub' ? tool.href : (tool.key === current ? '#' : '../' + tool.href));

    a.className = tool.isBrand ? 'tk-navbar__brand' : 'tk-navbar__link';
    if (tool.key === current) {
      a.classList.add('tk-navbar__link--active');
      a.setAttribute('aria-current', 'page');
    }
    nav.appendChild(a);
  });

  document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.add('tk-has-navbar');
    document.body.insertBefore(nav, document.body.firstChild);
  });
})();

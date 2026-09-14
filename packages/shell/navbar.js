/* Teacher Toolkit — shared navbar, injected into every app.
   Each page sets `window.TK_CURRENT` to its own key ('hub' for the
   landing page, or a tool key) before loading this script. Links are
   built relative to that page so the whole site can be deployed at
   any base path (e.g. GitHub Pages project sites).

   Layout: brand on the left, a single "Tools ▾" dropdown on the right
   listing every tool — keeps the bar one row at any width instead of
   forcing a horizontal scroll strip. */
(function () {
  var TOOLS = [
    { key: 'hub', label: 'Teacher Toolkit', href: '', isBrand: true },
    { key: 'noise-monitor', label: 'Noise Monitor', href: 'noise-monitor/' },
    { key: 'quick-poll', label: 'Quick Poll', href: 'quick-poll/' },
    { key: 'random-picker', label: 'Random Picker', href: 'random-picker/' },
    { key: 'visual-timer', label: 'Visual Timer', href: 'visual-timer/' },
    { key: 'zones', label: 'Zones Check-In', href: 'zones/teacher.html' },
    { key: 'exit-ticket', label: 'Exit Ticket', href: 'exit-ticket/teacher.html' },
    { key: 'group-generator', label: 'Group Generator', href: 'group-generator/' },
    { key: 'behaviour-tracker', label: 'Behaviour Tracker', href: 'behaviour-tracker/' },
    { key: 'restorative-circle', label: 'Restorative Circle', href: 'restorative-circle/' },
    { key: 'growth-mindset', label: 'Growth Mindset', href: 'growth-mindset/wall.html' },
    { key: 'kagan-timer', label: 'Kagan Timer', href: 'kagan-timer/' },
    { key: 'choice-board', label: 'Choice Board', href: 'choice-board/teacher.html' },
    { key: 'presentation-timer', label: 'Presentation Timer', href: 'presentation-timer/' },
    { key: 'assessment-checklist', label: 'Assessment Checklist', href: 'assessment-checklist/' },
    { key: 'snowball-wall', label: 'Snowball Wall', href: 'snowball-wall/teacher.html' },
    { key: 'question-builder', label: "Bloom's Questions", href: 'question-builder/' },
    { key: 'challenge-deck', label: 'Challenge Deck', href: 'challenge-deck/teacher.html' },
    { key: 'research', label: 'Research', href: 'research/' }
  ];

  var current = window.TK_CURRENT || 'hub';

  var nav = document.createElement('nav');
  nav.className = 'tk-navbar';

  // Brand, always top-left, always points at the toolkit root.
  var brand = document.createElement('a');
  brand.textContent = 'Teacher Toolkit';
  brand.href = current === 'hub' ? '#' : '../';
  brand.className = 'tk-navbar__brand';
  nav.appendChild(brand);

  // Dropdown: a single trigger button + a panel listing every tool.
  var currentTool = TOOLS.filter(function (t) { return t.key === current; })[0];
  var dropdown = document.createElement('div');
  dropdown.className = 'tk-navbar__dropdown';

  var trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'tk-navbar__trigger';
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  var triggerLabel = document.createElement('span');
  triggerLabel.textContent = current === 'hub' ? 'Tools' : (currentTool ? currentTool.label : 'Tools');
  var triggerChevron = document.createElement('span');
  triggerChevron.className = 'tk-navbar__chevron';
  triggerChevron.setAttribute('aria-hidden', 'true');
  triggerChevron.textContent = '▾';
  trigger.appendChild(triggerLabel);
  trigger.appendChild(triggerChevron);
  dropdown.appendChild(trigger);

  var panel = document.createElement('div');
  panel.className = 'tk-navbar__panel';
  panel.setAttribute('role', 'menu');

  TOOLS.filter(function (tool) { return !tool.isBrand; }).forEach(function (tool) {
    var a = document.createElement('a');
    a.textContent = tool.label;
    a.href = current === 'hub' ? tool.href : (tool.key === current ? '#' : '../' + tool.href);
    a.className = 'tk-navbar__link';
    a.setAttribute('role', 'menuitem');
    if (tool.key === current) {
      a.classList.add('tk-navbar__link--active');
      a.setAttribute('aria-current', 'page');
    }
    panel.appendChild(a);
  });

  dropdown.appendChild(panel);
  nav.appendChild(dropdown);

  function closeDropdown() {
    dropdown.classList.remove('tk-navbar__dropdown--open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  trigger.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = dropdown.classList.toggle('tk-navbar__dropdown--open');
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  document.addEventListener('click', function (e) {
    if (!dropdown.contains(e.target)) closeDropdown();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDropdown();
  });

  document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.add('tk-has-navbar');
    document.body.insertBefore(nav, document.body.firstChild);
  });
})();

/* Small UI behaviours shared by every page: menu, copy button, form guards. */
(function () {
  'use strict';

  /* mobile navigation — full-screen overlay menu */
  var toggle = document.querySelector('[data-nav-toggle]');
  var menu = document.querySelector('[data-mobile-menu]');
  var closeBtn = document.querySelector('[data-mobile-menu-close]');
  if (toggle && menu) {
    var openMenu = function () {
      menu.classList.add('is-open');
      menu.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
    };
    var closeMenu = function () {
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
    };
    toggle.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMenu); });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMenu();
    });
  }

  /* copy the card number */
  document.querySelectorAll('[data-copy]').forEach(function (button) {
    button.addEventListener('click', function () {
      var value = button.getAttribute('data-copy') || '';
      var done = function () {
        var original = button.getAttribute('data-label') || button.textContent;
        button.setAttribute('data-label', original);
        button.textContent = 'کپی شد';
        window.setTimeout(function () { button.textContent = original; }, 1800);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(value).then(done).catch(fallback);
      } else {
        fallback();
      }
      function fallback() {
        var input = document.createElement('textarea');
        input.value = value;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
        document.body.removeChild(input);
      }
    });
  });

  /* keep Persian digits out of numeric fields */
  document.querySelectorAll('[data-digits]').forEach(function (input) {
    input.addEventListener('input', function () {
      var map = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
                  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
      var next = input.value.replace(/[۰-۹٠-٩]/g, function (d) { return map[d]; });
      if (next !== input.value) input.value = next;
    });
  });

  /* block double submits, which would create duplicate orders */
  document.querySelectorAll('form[data-once]').forEach(function (form) {
    form.addEventListener('submit', function () {
      var button = form.querySelector('button[type="submit"], input[type="submit"]');
      if (!button) return;
      window.setTimeout(function () {
        button.setAttribute('disabled', 'disabled');
        button.textContent = 'در حال ارسال…';
      }, 0);
    });
  });

  /* show the chosen file name */
  document.querySelectorAll('input[type="file"][data-filename]').forEach(function (input) {
    var output = document.getElementById(input.getAttribute('data-filename'));
    if (!output) return;
    input.addEventListener('change', function () {
      output.textContent = input.files && input.files[0] ? input.files[0].name : '';
    });
  });
})();

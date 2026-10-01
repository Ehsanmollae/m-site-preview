/* =============================================================
   Scroll cinematics — vanilla, no dependencies, ~9KB unminified.
   Every scene is progressive enhancement: without JS or with
   prefers-reduced-motion the page renders in its final, readable state.
   ============================================================= */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var desktop = window.matchMedia('(min-width: 1024px)');
  var root = document.documentElement;

  /* ---------------------------------------------------- scroll scheduler */
  var listeners = [];
  var ticking = false;

  function onScroll(fn) {
    listeners.push(fn);
  }

  function tick() {
    ticking = false;
    var y = window.pageYOffset;
    var vh = window.innerHeight;
    for (var i = 0; i < listeners.length; i++) {
      listeners[i](y, vh);
    }
  }

  function schedule() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(tick);
    }
  }

  /** Progress of an element through the viewport, clamped to 0..1. */
  function progressOf(el, startOffset, endOffset) {
    var rect = el.getBoundingClientRect();
    var vh = window.innerHeight;
    var start = vh * (startOffset === undefined ? 1 : startOffset);
    var end = vh * (endOffset === undefined ? 0 : endOffset);
    var total = rect.height + start - end;
    if (total <= 0) return 1;
    var p = (start - rect.top) / total;
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function persianDigits(value) {
    return String(value).replace(/[0-9]/g, function (d) {
      return '۰۱۲۳۴۵۶۷۸۹'[Number(d)];
    });
  }

  /** Progress of a sticky-pinned track: 0 when pinning starts, 1 right
      before it un-pins — unlike progressOf, which measures a much longer
      "fully scrolled past" distance and is for normal (non-pinned) sections. */
  function pinProgress(el) {
    var rect = el.getBoundingClientRect();
    var total = rect.height - window.innerHeight;
    if (total <= 0) return 1;
    var p = -rect.top / total;
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }

  /* ---------------------------------------------------- reveal on enter */
  function initReveal() {
    var items = document.querySelectorAll('[data-reveal]');
    if (!items.length) return;

    if (reduced.matches || !('IntersectionObserver' in window)) {
      for (var i = 0; i < items.length; i++) items[i].classList.add('is-visible');
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = parseInt(el.getAttribute('data-reveal-delay') || '0', 10);
        window.setTimeout(function () { el.classList.add('is-visible'); }, delay);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });

    for (var j = 0; j < items.length; j++) io.observe(items[j]);
  }

  /* ---------------------------------------------------- reading progress */
  function initProgress() {
    var bar = document.querySelector('[data-progress]');
    if (!bar) return;
    onScroll(function (y) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? clamp(y / max, 0, 1) : 0;
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    });
  }

  /* ---------------------------------------------------- header behaviour */
  function initHeader() {
    var header = document.querySelector('[data-header]');
    if (!header) return;
    var last = 0;
    onScroll(function (y) {
      header.classList.toggle('is-stuck', y > 8);
      // Hide on the way down, bring it back the moment the user scrolls up.
      var goingDown = y > last && y > 260;
      if (!reduced.matches) header.classList.toggle('is-hidden', goingDown);
      last = y;
    });
  }

  /* ---------------------------------------------------- section dots */
  function initDots() {
    var dots = document.querySelectorAll('[data-dot]');
    if (!dots.length) return;
    var targets = [];
    for (var i = 0; i < dots.length; i++) {
      var id = dots[i].getAttribute('href').slice(1);
      var section = document.getElementById(id);
      if (section) targets.push({ dot: dots[i], section: section });
    }
    onScroll(function (y, vh) {
      var activeIndex = -1;
      for (var i = 0; i < targets.length; i++) {
        var top = targets[i].section.getBoundingClientRect().top;
        if (top <= vh * 0.4) activeIndex = i;
      }
      for (var j = 0; j < targets.length; j++) {
        targets[j].dot.classList.toggle('is-active', j === activeIndex);
      }
    });
  }

  /* ---------------------------------------------------- frame scrubbers */

  // Draws an image sequence frame into a canvas, cover-fit, DPR-aware —
  // same approach as a <video> scrub but without the async-seek stutter.
  function drawScrubFrame(canvas, ctx, img) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var ratio = img.naturalWidth / img.naturalHeight;
    // Horizontal point of the picture to keep in view when it is cropped
    // (data-focus, 0 = left edge, 1 = right edge).
    var focus = parseFloat(canvas.getAttribute('data-focus'));
    if (isNaN(focus)) focus = 0.5;

    if (w / h < 0.8) {
      // Portrait phone: a cover crop of a wide frame would show only its
      // middle third. Draw it as a band across the top half instead, cropped
      // around the focus, and leave the lower half to the copy.
      var bh = h * 0.5;
      var bw = Math.max(w, bh * ratio);
      bh = bw / ratio;
      var bx = clamp(w / 2 - bw * focus, w - bw, 0);
      ctx.drawImage(img, bx, Math.min(64, h * 0.08), bw, bh);
      return;
    }
    var fill = ratio < w / h; // cover
    var dw = fill ? w : h * ratio;
    var dh = fill ? w / ratio : h;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  // One scrubber instance: fetches manifest.json, eager-loads the first few
  // frames, then draws whichever frame `progress()` (0..1) points to on
  // every scheduled scroll tick. Used by every decorative scene below.
  // Frame loading only starts once the scene is close to the viewport, so a
  // page load never pulls all five scenes' frames at once.
  function initScrubber(wrapSelector, canvasSelector, progress) {
    var wrap = document.querySelector(wrapSelector);
    if (!wrap) return;
    var canvas = wrap.querySelector(canvasSelector);
    if (!canvas || !canvas.getContext || !window.fetch) return;

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          io.disconnect();
          startScrubber(wrap, canvas, progress);
        });
      }, { rootMargin: '600px 0px' });
      io.observe(wrap);
    } else {
      startScrubber(wrap, canvas, progress);
    }
  }

  function startScrubber(wrap, canvas, progress) {
    var base = canvas.getAttribute('data-frames-base') || '';

    fetch(base + 'manifest.json')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (manifest) {
        var count = manifest && manifest.count ? manifest.count : 0;
        if (!count) return;
        var pattern = manifest.pattern || 'frame_%04d.webp';

        function srcFor(i) {
          var num = String(i + 1);
          while (num.length < 4) num = '0' + num;
          return base + pattern.replace('%04d', num);
        }

        var images = new Array(count);
        var ctx = canvas.getContext('2d', { alpha: true });
        var current = 0;

        function draw(i) {
          var img = images[i];
          for (var d = 1; !img && d < count; d++) {
            img = images[i - d] || images[i + d];
          }
          if (img) drawScrubFrame(canvas, ctx, img);
        }

        function load(i) {
          return new Promise(function (resolve) {
            var img = new Image();
            img.decoding = 'async';
            img.onload = img.onerror = function () {
              images[i] = img.naturalWidth ? img : null;
              resolve();
            };
            img.src = srcFor(i);
          });
        }

        var eager = Math.min(6, count);
        var eagerLoads = [];
        for (var i = 0; i < eager; i++) eagerLoads.push(load(i));

        Promise.all(eagerLoads).then(function () {
          wrap.classList.add('is-scrubbing');
          draw(0);
          for (var j = eager; j < count; j++) load(j);

          onScroll(function () {
            var p = clamp(progress(), 0, 1);
            current = Math.min(count - 1, Math.round(p * (count - 1)));
            draw(current);
          });
          window.addEventListener('resize', function () { draw(current); });
        });
      })
      .catch(function () { /* no manifest yet — keep the static fallback */ });
  }

  /* Background plane of a pinned stage: starts oversized and eases back to
     rest, so it reads as sitting behind the copy rather than under it. */
  function recedeStage(stage, p) {
    var scale = 'scale(' + (1.09 - clamp(p, 0, 1) * 0.09).toFixed(4) + ')';
    var layers = stage.querySelectorAll('canvas, .cine__fallback');
    for (var i = 0; i < layers.length; i++) layers[i].style.transform = scale;
  }

  /* ---------------------------------------------------- article row */

  // On desktop the card row becomes an endless slider driven by the two
  // buttons. Phones keep the native scroll-snap row, which already answers
  // to a swipe; the choice is made once, at load.
  function initArticles() {
    var section = document.querySelector('[data-articles]');
    if (!section || reduced.matches || !desktop.matches) return;
    var track = section.querySelector('[data-sights-track]');
    if (!track || track.children.length < 2) return;
    section.classList.add('is-sliding');
    initSightSlider(section, track);
  }

  // Infinite card row: the real cards sit in the middle, with a cloned set on
  // each side so the track can always slide one step and then silently jump
  // back into the middle set. Clones are hidden from assistive tech and
  // taken out of the tab order, so each article is announced once.
  function initSightSlider(section, track) {
    var originals = Array.prototype.slice.call(track.children);
    var count = originals.length;
    if (count < 2) return;

    function cloneSet() {
      var frag = document.createDocumentFragment();
      originals.forEach(function (card) {
        var clone = card.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        clone.setAttribute('inert', '');
        clone.querySelectorAll('a, button').forEach(function (el) { el.setAttribute('tabindex', '-1'); });
        frag.appendChild(clone);
      });
      return frag;
    }
    track.insertBefore(cloneSet(), track.firstChild);
    track.appendChild(cloneSet());

    var cards = track.children;
    var active = count;

    function layout() {
      var width = cards[0].offsetWidth;
      var gap = parseFloat(window.getComputedStyle(track).columnGap || '0') || 0;
      section.style.setProperty('--sights-shift', ((width + gap) * active).toFixed(1) + 'px');
    }

    function move(dir) {
      active += dir;
      layout();
    }

    function jump(index) {
      track.classList.add('is-jumping');
      active = index;
      layout();
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { track.classList.remove('is-jumping'); });
      });
    }

    track.addEventListener('transitionend', function (event) {
      if (event.target !== track) return;
      if (active >= count * 2) jump(active - count);
      else if (active < count) jump(active + count);
    });

    var prev = section.querySelector('.sight-prev');
    var next = section.querySelector('.sight-next');
    if (prev) prev.addEventListener('click', function () { move(-1); });
    if (next) next.addEventListener('click', function () { move(1); });
    window.addEventListener('resize', layout);
    layout();
  }

  /* ---------------------------------------------------- pinned N-scene sections (steps) */

  // Opacity of scene `i` of `total` sequential scenes sharing one pinned
  // track and progress value `p` (0..1). Each internal boundary between
  // scene i and i+1 is a symmetric crossfade zone (both scenes pass through
  // 0.5 at the midpoint, opacities always sum to 1) — the first scene skips
  // its fade-in (already visible at p=0), the last skips its fade-out
  // (stays to p=1).
  function sequentialSceneOpacity(p, i, total) {
    var fade = 0.6 / total / 2;
    var bStart = i / total;
    var bEnd = (i + 1) / total;
    var op = 1;
    if (i > 0) {
      if (p < bStart - fade) op = 0;
      else if (p < bStart + fade) op = Math.min(op, (p - (bStart - fade)) / (2 * fade));
    }
    if (i < total - 1) {
      if (p > bEnd + fade) op = 0;
      else if (p > bEnd - fade) op = Math.min(op, 1 - (p - (bEnd - fade)) / (2 * fade));
    }
    return clamp(op, 0, 1);
  }

  function initStepsScenes() {
    var root = document.querySelector('[data-steps]');
    if (!root || reduced.matches) return;

    var scenes = root.querySelectorAll('[data-steps-scene]');
    if (!scenes.length) return;

    root.classList.add('is-pinned');

    function progress() { return pinProgress(root); }

    var stage = root.querySelector('[data-steps-stage]');
    var numerals = [];
    var panels = [];
    for (var n = 0; n < scenes.length; n++) {
      numerals.push(scenes[n].querySelector('.steps__no'));
      panels.push(scenes[n].querySelector('.steps__panel'));
    }

    onScroll(function () {
      var p = progress();
      if (stage) recedeStage(stage, p);

      for (var i = 0; i < scenes.length; i++) {
        var op = sequentialSceneOpacity(p, i, scenes.length);
        scenes[i].style.opacity = op.toFixed(3);
        scenes[i].classList.toggle('is-live', op > 0.05);

        // How far this scene is from being the current one, -1..1. The numeral
        // travels a third of the copy's distance, which puts it visibly further
        // back than the text sitting on top of it.
        var local = clamp(p * scenes.length - i, -1, 1);
        if (numerals[i]) numerals[i].style.transform = 'translate3d(0,' + (local * -26).toFixed(1) + 'px,0)';
        if (panels[i]) panels[i].style.transform = 'translate3d(0,' + (local * -78).toFixed(1) + 'px,0)';
      }
    });

    initScrubber('[data-steps-stage]', '[data-steps-canvas]', progress);
  }

  /* ---------------------------------------------------- pinned single-scene sections (benefits) */
  function initBenefitsPin() {
    var root = document.querySelector('[data-benefits]');
    // On a phone the list is too long to share a pinned screen with the
    // painting; it stays a plain section with the finished frame above it.
    if (!root || reduced.matches || !desktop.matches) return;
    root.classList.add('is-pinned');

    var stage = root.querySelector('[data-benefits-stage]');
    var rows = root.querySelectorAll('.benefit');

    onScroll(function () {
      var p = pinProgress(root);
      if (stage) recedeStage(stage, p);

      // Rows lift into place one after another across the pin, so the list
      // gains depth as you hold on it instead of arriving all at once.
      for (var i = 0; i < rows.length; i++) {
        var startAt = 0.10 + (i / rows.length) * 0.42;
        var q = clamp((p - startAt) / 0.22, 0, 1);
        var eased = 1 - Math.pow(1 - q, 3);
        rows[i].style.transform = 'translate3d(0,' + ((1 - eased) * 34).toFixed(1) + 'px,0)';
        rows[i].style.opacity = (0.15 + eased * 0.85).toFixed(3);
      }
    });

    initScrubber('[data-benefits-stage]', '[data-benefits-canvas]', function () { return pinProgress(root); });
  }

  /* ---------------------------------------------------- depth layers */

  // Separation, not decoration: layers of one scene move at different rates,
  // so the eye reads them as sitting at different distances. `data-parallax`
  // is the drift rate (px per px of scroll past centre) and the optional
  // `data-depth-scale` adds a slow dolly — a background plane that eases from
  // slightly oversized down to its resting size reads as further away.
  function initParallax() {
    var items = document.querySelectorAll('[data-parallax]');
    if (!items.length || reduced.matches) return;

    onScroll(function (y, vh) {
      for (var i = 0; i < items.length; i++) {
        var el = items[i];
        var rect = el.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) continue;

        var speed = parseFloat(el.getAttribute('data-parallax')) || 0.12;
        var centre = rect.top + rect.height / 2 - vh / 2;
        var t = 'translate3d(0,' + (-centre * speed).toFixed(1) + 'px,0)';

        var dolly = parseFloat(el.getAttribute('data-depth-scale'));
        if (dolly) {
          // 1 when the layer is a full viewport away, 0 at rest in the middle.
          var away = clamp(Math.abs(centre) / vh, 0, 1);
          t += ' scale(' + (1 + dolly * away).toFixed(4) + ')';
        }
        el.style.transform = t;
      }
    });
  }

  /* ---------------------------------------------------- counters */
  function initCounters() {
    var counters = document.querySelectorAll('[data-count]');
    if (!counters.length) return;

    var persian = persianDigits;

    if (reduced.matches || !('IntersectionObserver' in window)) {
      for (var i = 0; i < counters.length; i++) {
        counters[i].textContent = persian(counters[i].getAttribute('data-count'));
      }
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);
        var target = parseInt(el.getAttribute('data-count'), 10) || 0;
        var started = null;
        var duration = 900;
        function step(ts) {
          if (started === null) started = ts;
          var p = clamp((ts - started) / duration, 0, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = persian(Math.round(target * eased));
          if (p < 1) window.requestAnimationFrame(step);
        }
        window.requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });

    for (var j = 0; j < counters.length; j++) io.observe(counters[j]);
  }

  /* ---------------------------------------------------- marquee */
  function initMarquee() {
    var track = document.querySelector('[data-marquee]');
    if (!track || reduced.matches) return;
    if (track.children.length === 0) return;

    // Duplicate the content once so the loop has no visible seam.
    var original = track.innerHTML;
    track.innerHTML = original + original;
    var half = track.scrollWidth / 2;
    if (half <= 0) return;

    var offset = 0;
    var speed = 0.35;
    var paused = false;
    var last = 0;

    track.parentElement.addEventListener('mouseenter', function () { paused = true; });
    track.parentElement.addEventListener('mouseleave', function () { paused = false; });
    track.parentElement.addEventListener('focusin', function () { paused = true; });
    track.parentElement.addEventListener('focusout', function () { paused = false; });

    function frame(ts) {
      var dt = last ? Math.min(ts - last, 50) : 16;
      last = ts;
      var rect = track.getBoundingClientRect();
      var visible = rect.bottom > 0 && rect.top < window.innerHeight;
      if (!paused && visible && !document.hidden) {
        offset += speed * (dt / 16);
        if (offset >= half) offset -= half;
        track.style.transform = 'translate3d(' + offset.toFixed(1) + 'px,0,0)';
      }
      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------- boot */
  function boot() {
    root.classList.add('js');
    root.classList.add('cinema-ready');
    initReveal();
    initProgress();
    initHeader();
    initDots();
    initArticles();
    initBenefitsPin();
    initStepsScenes();
    initParallax();
    initCounters();
    initMarquee();

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    // First pass runs now rather than on the next frame, so the page is
    // painted in its scrolled state from the start (a reload half way down
    // must not flash the header or the pinned stages in their start state).
    var header = document.querySelector('[data-header]');
    if (header) header.style.transition = 'none';
    tick();
    if (header) {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { header.style.transition = ''; });
      });
    }

    // Re-measure once fonts and images have settled.
    window.addEventListener('load', schedule);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

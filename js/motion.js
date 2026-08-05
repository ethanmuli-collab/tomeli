/* TOMELI — motion runtime + auto image wiring. Vanilla, no dependencies. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!reduceQuery.matches) root.classList.add('js-motion');

  reduceQuery.addEventListener('change', function (e) {
    if (e.matches) {
      root.classList.remove('js-motion');
      revealAll();
    }
  });

  function revealAll() {
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      el.classList.add('is-revealed');
    });
    document.querySelectorAll('[data-hero]').forEach(function (el) {
      el.classList.add('is-entered');
    });
    document.querySelectorAll('[data-counter]').forEach(function (el) {
      el.textContent = el.getAttribute('data-counter') + (el.getAttribute('data-counter-suffix') || '');
    });
  }

  /* ---------- Auto image wiring ----------
     Drop files into /images and refresh:
       logo.png (or logo.svg)      -> header logo
       hero.jpg                    -> hero background
       about.jpg                   -> about section portrait
       gallery-01.jpg ... -12.jpg  -> gallery grid                */

  function tryImage(sources, onFound) {
    if (!sources.length) return;
    var img = new Image();
    img.onload = function () { onFound(img.src); };
    img.onerror = function () { tryImage(sources.slice(1), onFound); };
    img.src = sources[0];
  }

  // hero background
  tryImage(['images/hero.jpg', 'images/hero.png'], function (src) {
    var bg = document.querySelector('.hero-bg');
    if (!bg) return;
    bg.style.backgroundImage = 'url("' + src + '")';
    bg.classList.add('has-photo');
  });

  // about photo
  document.querySelectorAll('[data-photo]').forEach(function (frame) {
    tryImage([frame.getAttribute('data-photo')], function (src) {
      var img = document.createElement('img');
      img.src = src;
      img.alt = frame.getAttribute('data-photo-alt') || '';
      var ph = frame.querySelector('.media-placeholder');
      if (ph) ph.remove();
      frame.appendChild(img);
    });
  });

  // gallery: build 6 placeholder slots, upgrade each that has a real file
  var galleryGrid = document.getElementById('gallery-grid');
  if (galleryGrid) {
    var SLOTS = 12, VISIBLE_PLACEHOLDERS = 6;
    var found = 0;
    for (var i = 1; i <= SLOTS; i++) {
      (function (i) {
        var slot = document.createElement('figure');
        slot.className = 'gallery-item';
        slot.setAttribute('data-reveal', 'wipe');
        if (i > VISIBLE_PLACEHOLDERS) slot.hidden = true;
        slot.innerHTML =
          '<div class="media-placeholder"><span class="ph-mark">T</span>' +
          '<span class="ph-note">עבודה ' + i + '</span></div>';
        galleryGrid.appendChild(slot);

        var pad = i < 10 ? '0' + i : '' + i;
        tryImage(['images/gallery-' + pad + '.jpg', 'images/gallery-' + pad + '.png', 'images/gallery-' + pad + '.jpeg'], function (src) {
          var img = document.createElement('img');
          img.src = src;
          img.alt = 'עבודת נגרות של TOMELI';
          img.loading = 'lazy';
          slot.innerHTML = '';
          slot.appendChild(img);
          slot.hidden = false;
          found++;
          // once real photos exist, hide remaining placeholders
          galleryGrid.querySelectorAll('.gallery-item').forEach(function (s) {
            if (s.querySelector('.media-placeholder')) s.hidden = true;
          });
          if (observer) observer.observe(slot);
          slot.classList.add('is-revealed');
        });
      })(i);
    }
    var note = document.getElementById('gallery-note');
    setTimeout(function () {
      if (found === 0 && note) note.hidden = false;
    }, 1500);
  }

  if (reduceQuery.matches) { revealAll(); return; }

  /* ---------- Hero entrance: after fonts settle ---------- */
  var hero = document.querySelector('[data-hero]');
  if (hero) {
    var started = false;
    var start = function () {
      if (started) return;
      started = true;
      requestAnimationFrame(function () { hero.classList.add('is-entered'); });
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(start);
      setTimeout(start, 300);
    } else {
      start();
    }
  }

  /* ---------- Scroll reveals: one observer ---------- */
  var revealTargets = document.querySelectorAll('[data-reveal]');
  var counts = new Map();
  revealTargets.forEach(function (el) {
    var parent = el.parentElement;
    var i = counts.get(parent) || 0;
    counts.set(parent, i + 1);
    el.style.setProperty('--i', Math.min(i, 5));
  });

  var observer = null;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          var counter = entry.target.querySelector('[data-counter]');
          if (counter) countUp(counter);
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 }
    );
    revealTargets.forEach(function (el) { observer.observe(el); });
  } else {
    revealAll();
  }

  /* Safety net: fast flicks (momentum scroll + image-decode jank) can jump
     an element across the whole viewport between observer checks, leaving it
     invisible forever. Sweep on every scroll frame and reveal anything whose
     top has crossed the same line the observer watches. */
  var pendingReveals = Array.prototype.slice.call(revealTargets);
  function sweepReveals() {
    if (!pendingReveals.length) return;
    var line = window.innerHeight * 0.88;
    pendingReveals = pendingReveals.filter(function (el) {
      if (el.classList.contains('is-revealed')) return false;
      if (el.getBoundingClientRect().top >= line) return true;
      el.classList.add('is-revealed');
      var counter = el.querySelector('[data-counter]');
      if (counter) countUp(counter);
      if (observer) observer.unobserve(el);
      return false;
    });
  }

  /* ---------- Counters ---------- */
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-counter'));
    if (isNaN(target)) return;
    var suffix = el.getAttribute('data-counter-suffix') || '';
    var duration = 1100;
    var t0 = null;
    function frame(t) {
      if (t0 === null) t0 = t;
      var p = Math.min((t - t0) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Header state + hero parallax ---------- */
  var header = document.querySelector('.site-header');
  var heroContent = document.querySelector('.hero-content');
  var parallaxLayers = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
  var allowParallax =
    parallaxLayers.length > 0 &&
    window.matchMedia('(min-width: 768px) and (hover: hover)').matches;

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY;
      if (header) {
        if (y > 24) header.classList.add('is-scrolled');
        else if (y < 8) header.classList.remove('is-scrolled');
      }
      sweepReveals();
      if (allowParallax && y < window.innerHeight) {
        parallaxLayers.forEach(function (layer) {
          var depth = parseFloat(layer.getAttribute('data-parallax')) || 0.05;
          var offset = Math.min(y * depth, 24);
          layer.style.transform = 'translate3d(0,' + offset + 'px,0)';
        });
      }
      // cinematic pull-away: hero copy sinks and dims as you scroll past it
      if (heroContent && allowParallax && y <= window.innerHeight) {
        var p = Math.min(y / (window.innerHeight * 0.7), 1);
        heroContent.style.opacity = String(1 - p * 0.9);
        heroContent.style.transform = 'translate3d(0,' + (y * 0.12) + 'px,0)';
      }
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var menu = document.querySelector('.mobile-menu');
  var toggle = document.querySelector('[data-menu-toggle]');

  if (menu && toggle) {
    menu.querySelectorAll('.mobile-menu__item').forEach(function (el, i) {
      el.style.setProperty('--i', i);
    });

    var lastFocused = null;

    var open = function () {
      lastFocused = document.activeElement;
      menu.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      var first = menu.querySelector('a, button');
      if (first) first.focus();
    };

    var close = function () {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      if (lastFocused) lastFocused.focus();
    };

    toggle.addEventListener('click', function () {
      menu.classList.contains('is-open') ? close() : open();
    });

    var backdrop = menu.querySelector('[data-menu-close]');
    if (backdrop) backdrop.addEventListener('click', close);

    menu.querySelectorAll('.mobile-menu__item').forEach(function (link) {
      link.addEventListener('click', close);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) close();
      if (e.key !== 'Tab' || !menu.classList.contains('is-open')) return;
      var items = menu.querySelectorAll('a[href], button:not([disabled])');
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });
  }

  /* ---------- Footer year ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();

(function () {
  'use strict';

  var body = document.body;
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* Header ---------------------------------------------------------------- */
  function onScroll() { header.classList.toggle('scrolled', window.scrollY > 30); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  function closeNav() {
    body.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
  }
  toggle.addEventListener('click', function () {
    var open = body.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) closeNav(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(); });

  /* Scroll reveal --------------------------------------------------------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add('in');
        io.unobserve(el);
        // drop the stagger delay once shown so hover effects stay snappy
        setTimeout(function () { el.style.transitionDelay = ''; }, 1400);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
    reveals.forEach(function (el) {
      var i = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.transitionDelay = Math.min(i, 5) * 90 + 'ms';
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* Statement: words light up as you scroll ------------------------------- */
  var statement = document.querySelector('[data-words]');
  if (statement && !reduced) {
    var words = statement.textContent.trim().split(/\s+/);
    statement.setAttribute('aria-label', statement.textContent.trim());
    statement.innerHTML = words.map(function (w) {
      return '<span class="w" aria-hidden="true">' + w + '</span>';
    }).join(' ');
    var spans = statement.querySelectorAll('.w');
    var ticking = false;
    var paint = function () {
      ticking = false;
      var r = statement.getBoundingClientRect();
      var vh = window.innerHeight;
      var p = (vh * 0.88 - r.top) / (vh * 0.5 + r.height * 0.6);
      p = Math.max(0, Math.min(1, p));
      var n = Math.round(p * spans.length);
      for (var i = 0; i < spans.length; i++) spans[i].classList.toggle('on', i < n);
    };
    var req = function () { if (!ticking) { ticking = true; requestAnimationFrame(paint); } };
    window.addEventListener('scroll', req, { passive: true });
    window.addEventListener('resize', req);
    paint();
  }

  /* Hero parallax (pointer) ----------------------------------------------- */
  var art = document.querySelector('.hero-art');
  var hero = document.querySelector('.hero');
  if (art && !reduced && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var layers = art.querySelectorAll('[data-depth]');
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    var step = function () {
      cx += (tx - cx) * 0.07; cy += (ty - cy) * 0.07;
      layers.forEach(function (l) {
        var d = parseFloat(l.getAttribute('data-depth'));
        l.style.transform = 'translate3d(' + (cx * d).toFixed(2) + 'px,' + (cy * d).toFixed(2) + 'px,0)';
      });
      raf = (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) ? requestAnimationFrame(step) : null;
    };
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(step);
    });
    hero.addEventListener('pointerleave', function () { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(step); });
  }

  /* Active nav link -------------------------------------------------------- */
  var links = nav.querySelectorAll('a[href^="#"]:not(.btn):not([data-enquiry-scroll])');
  if ('IntersectionObserver' in window) {
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (a) {
      var s = document.querySelector(a.getAttribute('href'));
      if (s) navIO.observe(s);
    });
  }

  /* Contact form ----------------------------------------------------------- */
  var form = document.querySelector('.contact-form');
  if (!form) return;
  var status = form.querySelector('.form-status');
  var typeInputs = form.querySelectorAll('input[name="enquiry_type"]');
  var FALLBACK = 'Sorry, your enquiry could not be sent. Please email tonio@baresicadvisory.com directly.';
  var THANKS = 'Thank you. Your enquiry has been sent and we will be in touch shortly.';

  function setType(type) {
    typeInputs.forEach(function (r) { r.checked = r.value === type; });
    form.querySelectorAll('[data-for]').forEach(function (el) { el.hidden = el.getAttribute('data-for') !== type; });
  }
  typeInputs.forEach(function (r) { r.addEventListener('change', function () { setType(r.value); }); });
  document.querySelectorAll('[data-enquiry]').forEach(function (b) {
    b.addEventListener('click', function () { setType(b.getAttribute('data-enquiry')); });
  });

  function showStatus(kind, msg) {
    status.hidden = false;
    status.className = 'form-status ' + kind;
    status.textContent = msg;
  }

  var params = new URLSearchParams(window.location.search);
  if (params.get('sent') === '1') showStatus('success', THANKS);
  else if (params.get('sent') === '0') showStatus('error', params.get('msg') || FALLBACK);

  function flag(input, msg) {
    var wrap = input.closest('.field') || input.closest('.consent');
    wrap.classList.add('invalid');
    if (msg && wrap.classList.contains('field')) {
      var e = document.createElement('span');
      e.className = 'error';
      e.textContent = msg;
      wrap.appendChild(e);
    }
  }

  function validate() {
    form.querySelectorAll('.invalid').forEach(function (el) { el.classList.remove('invalid'); });
    form.querySelectorAll('.error').forEach(function (el) { el.remove(); });
    var ok = true, el = form.elements;
    if (!el.name.value.trim()) { flag(el.name, 'Please enter your name.'); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.email.value.trim())) { flag(el.email, 'Please enter a valid email address.'); ok = false; }
    if (!el.message.value.trim()) { flag(el.message, 'Please tell us a little about your enquiry.'); ok = false; }
    if (!el.consent.checked) { flag(el.consent); ok = false; }
    var f = el.cv.files && el.cv.files[0];
    if (f && !el.cv.closest('.field').hidden) {
      if (f.size > 5 * 1024 * 1024) { flag(el.cv, 'File must be 5MB or smaller.'); ok = false; }
      else if (!/\.(pdf|docx?)$/i.test(f.name)) { flag(el.cv, 'Please attach a PDF, DOC or DOCX file.'); ok = false; }
    }
    if (!ok) {
      var first = form.querySelector('.invalid input, .invalid textarea');
      if (first) first.focus();
    }
    return ok;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;
    var btn = form.querySelector('button[type="submit"]');
    var label = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Sending…';

    var data = new FormData(form);
    if (form.elements.cv.closest('.field').hidden) data.delete('cv');

    fetch(form.action, { method: 'POST', body: data, headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (res) {
        if (res.ok) { form.reset(); setType('Company'); showStatus('success', THANKS); }
        else showStatus('error', res.message || FALLBACK);
      })
      .catch(function () { showStatus('error', FALLBACK); })
      .then(function () {
        btn.disabled = false;
        btn.innerHTML = label;
        status.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
  });
})();

(function () {
  'use strict';

  var body = document.body;
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');

  /* Year */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* Header state on scroll */
  function onScroll() {
    header.classList.toggle('scrolled', window.scrollY > 40);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* Mobile nav */
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
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) closeNav();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && body.classList.contains('nav-open')) closeNav();
  });

  /* Reveal on scroll */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el, i) {
      // light stagger for siblings
      var siblings = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.transitionDelay = Math.min(siblings, 5) * 80 + 'ms';
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* Active nav link */
  var links = nav.querySelectorAll('a[href^="#"]:not(.btn)');
  var sections = Array.prototype.map.call(links, function (a) {
    return document.querySelector(a.getAttribute('href'));
  });
  if ('IntersectionObserver' in window) {
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          links.forEach(function (a) {
            a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
          });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { if (s) navIO.observe(s); });
  }

  /* Contact form */
  var form = document.querySelector('.contact-form');
  if (!form) return;

  var status = form.querySelector('.form-status');
  var typeInputs = form.querySelectorAll('input[name="enquiry_type"]');

  function setType(type) {
    typeInputs.forEach(function (r) { r.checked = r.value === type; });
    form.querySelectorAll('[data-for]').forEach(function (el) {
      el.hidden = el.getAttribute('data-for') !== type;
    });
  }
  typeInputs.forEach(function (r) {
    r.addEventListener('change', function () { setType(r.value); });
  });
  document.querySelectorAll('[data-enquiry]').forEach(function (btn) {
    btn.addEventListener('click', function () { setType(btn.getAttribute('data-enquiry')); });
  });

  function showStatus(kind, msg) {
    status.hidden = false;
    status.className = 'form-status ' + kind;
    status.textContent = msg;
  }

  // Status passed back from contact.php (non-JS fallback)
  var params = new URLSearchParams(window.location.search);
  if (params.get('sent') === '1') {
    showStatus('success', 'Thank you. Your enquiry has been sent and we will be in touch shortly.');
  } else if (params.get('sent') === '0') {
    showStatus('error', params.get('msg') || 'Sorry, your enquiry could not be sent. Please email tonio@baresicadvisory.com directly.');
  }

  function clearErrors() {
    form.querySelectorAll('.invalid').forEach(function (el) { el.classList.remove('invalid'); });
    form.querySelectorAll('.error').forEach(function (el) { el.remove(); });
  }
  function flag(input, msg) {
    var wrap = input.closest('.field') || input.closest('.consent');
    wrap.classList.add('invalid');
    if (wrap.classList.contains('field')) {
      var e = document.createElement('span');
      e.className = 'error';
      e.textContent = msg;
      wrap.appendChild(e);
    }
  }

  function validate() {
    clearErrors();
    var ok = true;
    var name = form.elements.name, email = form.elements.email, message = form.elements.message;
    var consent = form.elements.consent, cv = form.elements.cv;
    if (!name.value.trim()) { flag(name, 'Please enter your name.'); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { flag(email, 'Please enter a valid email address.'); ok = false; }
    if (!message.value.trim()) { flag(message, 'Please tell us a little about your enquiry.'); ok = false; }
    if (!consent.checked) { flag(consent, ''); ok = false; }
    if (cv && cv.files && cv.files[0] && !cv.closest('.field').hidden) {
      var f = cv.files[0];
      if (f.size > 5 * 1024 * 1024) { flag(cv, 'File must be 5MB or smaller.'); ok = false; }
      else if (!/\.(pdf|docx?)$/i.test(f.name)) { flag(cv, 'Please attach a PDF, DOC or DOCX file.'); ok = false; }
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
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending…';

    var data = new FormData(form);
    // Don't send the CV for company enquiries
    if (form.elements.cv.closest('.field').hidden) data.delete('cv');

    fetch(form.action, {
      method: 'POST',
      body: data,
      headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
    })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (res) {
        if (res.ok) {
          form.reset();
          setType('Company');
          showStatus('success', 'Thank you. Your enquiry has been sent and we will be in touch shortly.');
        } else {
          showStatus('error', res.message || 'Sorry, your enquiry could not be sent. Please email tonio@baresicadvisory.com directly.');
        }
      })
      .catch(function () {
        showStatus('error', 'Sorry, something went wrong. Please email tonio@baresicadvisory.com directly.');
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = label;
        status.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
  });
})();

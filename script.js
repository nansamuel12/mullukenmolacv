(() => {
  'use strict';

  // ====== SETTINGS ======
  // Messages from the contact form are delivered to this address.
  const OWNER_EMAIL = 'mulukenmola14@gmail.com';
  const ENDPOINT = 'https://formsubmit.co/ajax/' + OWNER_EMAIL;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ====== Theme (light / dark) ======
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch (_) {}
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = saved || (prefersDark ? 'dark' : 'light');

  $('#themeToggle').addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (_) {}
  });

  // ====== Mobile menu ======
  const menuBtn = $('#menuBtn');
  const links = $('#navLinks');
  menuBtn.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  $$('a', links).forEach(a => a.addEventListener('click', () => {
    links.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }));

  // ====== Nav shadow on scroll ======
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 10);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // ====== Active link highlight ======
  const sectionIds = ['home', 'about', 'experience', 'skills', 'education', 'contact'];
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      $$('.nav__links a:not(.btn)').forEach(a =>
        a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sectionIds.forEach(id => { const el = document.getElementById(id); if (el) spy.observe(el); });

  // ====== Reveal on scroll, skill bars, counters ======
  const countUp = el => {
    const target = +el.dataset.count;
    const start = performance.now();
    const dur = 1200;
    const tick = now => {
      const p = Math.min((now - start) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const reveal = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      $$('[data-count]', e.target).forEach(countUp);
      reveal.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  $$('.reveal').forEach(el => reveal.observe(el));

  // ====== Footer year ======
  $('#year').textContent = new Date().getFullYear();

  // ====== Contact form ======
  const form = $('#contactForm');
  const statusEl = $('#formStatus');
  const sendBtn = $('#sendBtn');

  const rules = {
    name: v => v.trim().length >= 2 || 'Please enter your name.',
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Please enter a valid email address.',
    message: v => v.trim().length >= 10 || 'Your message should be at least 10 characters.'
  };

  const setError = (name, msg) => {
    const field = form.elements[name].closest('.field');
    field.classList.toggle('invalid', !!msg);
    $(`.err[data-for="${name}"]`, form).textContent = msg || '';
  };

  const validate = () => {
    let ok = true;
    Object.keys(rules).forEach(name => {
      const res = rules[name](form.elements[name].value);
      setError(name, res === true ? '' : res);
      if (res !== true) ok = false;
    });
    return ok;
  };

  Object.keys(rules).forEach(name =>
    form.elements[name].addEventListener('input', () => {
      const res = rules[name](form.elements[name].value);
      setError(name, res === true ? '' : '');
    }));

  const say = (msg, type) => { statusEl.textContent = msg; statusEl.className = 'form__status ' + (type || ''); };

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    say('');
    if (form.elements._honey.value) return;       // spam bot
    if (!validate()) { say('Please fix the highlighted fields.', 'fail'); return; }

    const payload = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      message: form.elements.message.value.trim(),
      _subject: 'New message from your website – ' + form.elements.name.value.trim(),
      _replyto: form.elements.email.value.trim(),
      _template: 'table',
      _captcha: 'false'
    };

    // The email service cannot be used when the page is opened as a local file
    if (location.protocol === 'file:') {
      fail('This form only works when the website is hosted online (not opened from a file on your computer).', payload);
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending…';
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      console.log('FormSubmit response:', res.status, data);
      const failed = !res.ok || String(data.success) === 'false';
      const needsActivation = /activat/i.test(data.message || '');
      if (failed && !needsActivation) throw new Error(data.message || ('Server error ' + res.status));
      form.reset();
      if (needsActivation) {
        say('Almost done! An activation email was sent to ' + OWNER_EMAIL + '. Open it and click “Activate Form”, then send again.', 'ok');
      } else {
        say('Thank you! Your message was sent. I’ll reply to you soon.', 'ok');
      }
    } catch (err) {
      console.error('Send failed:', err);
      fail('Could not send: ' + (err.message || 'network problem') + '.', payload);
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send message';
    }

    // Show the error and offer an email-app link (the typed message is kept)
    function fail(reason, p) {
      statusEl.className = 'form__status fail';
      statusEl.textContent = reason + ' ';
      const a = document.createElement('a');
      a.href = 'mailto:' + OWNER_EMAIL + '?subject=' + encodeURIComponent('Message from website – ' + p.name) +
               '&body=' + encodeURIComponent(p.message + '\n\n— ' + p.name + ' (' + p.email + ')');
      a.textContent = 'Send with my email app instead';
      a.style.textDecoration = 'underline';
      statusEl.appendChild(a);
    }
  });
})();

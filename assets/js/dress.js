/* Dressing your page, on your page.

   This replaces a form in the Guild Hall with a shrunken copy of the page
   beside it. The copy could disagree with the original and did — wax charms
   previewed in a colour nobody had chosen, and a stroke-drawn charm ignored the
   colour entirely on one side but not the other. There is nothing left to keep
   in step: every control writes onto the page you are looking at, and charms
   are dragged on the real banner at its real size, so what you are judging is
   the thing itself.

   None of it is saved until the form is posted. The colours are checked against
   a six-digit hex on the way in, the lists against fixed lists, and the charms
   are taken apart and rebuilt — this file only decides what to show you. */
(function () {
  var panel = document.getElementById('dress');
  var pro   = document.querySelector('.pro');
  if (!panel || !pro) return;

  var tab   = document.getElementById('dressTab');
  var body  = document.getElementById('dressBody');
  var state = document.getElementById('dressState');
  var store = document.getElementById('pgCharms');
  var count = document.getElementById('charmCount');
  var tray  = document.getElementById('charmTray');
  var art   = window.__CHARM_ART__ || {};
  var FONTS = window.__FONTS__ || {};
  var SIZES = window.__SIZES__ || {};
  var MAX   = Number(panel.getAttribute('data-max')) || 14;
  var INKS  = ['gold', 'seal', 'pale', 'dark'];

  var f = {
    motto:  document.getElementById('pgMotto'),
    about:  document.getElementById('pgAbout'),
    accent: document.getElementById('pgAccent'),
    seal:   document.getElementById('pgSeal'),
    tint:   document.getElementById('pgTint'),
    ink:    document.getElementById('pgInk'),
    font:   document.getElementById('pgFont'),
    size:   document.getElementById('pgSize'),
    back:   document.getElementById('pgBack'),
    lay:    document.getElementById('pgLay'),
    banner: document.getElementById('pgBanner'),
    drop:   document.querySelector('input[name="dropBanner"]')
  };

  var touched = false;
  function moved() {
    touched = true;
    if (state) state.textContent = 'Not saved yet';
  }

  /* ── the panel ──────────────────────────────────────────────────────── */
  function setOpen(open) {
    panel.dataset.open = open ? '1' : '0';
    tab.setAttribute('aria-expanded', open ? 'true' : 'false');
    pro.classList.toggle('is-dressing', open);   // wakes the charms up
  }
  tab.addEventListener('click', function () { setOpen(panel.dataset.open !== '1'); });

  // Leaving with work in hand should say so.
  window.addEventListener('beforeunload', function (e) {
    if (!touched) return;
    e.preventDefault();
    e.returnValue = '';
  });
  if (body) body.addEventListener('submit', function () { touched = false; });

  /* ── the controls ───────────────────────────────────────────────────── */
  function paint() {
    if (f.accent) pro.style.setProperty('--u-accent', f.accent.value);
    if (f.seal)   pro.style.setProperty('--u-seal',   f.seal.value);
    if (f.tint)   pro.style.setProperty('--u-tint',   f.tint.value);
    if (f.ink)    pro.style.setProperty('--u-ink',    f.ink.value);
    if (f.font)   pro.style.setProperty('--u-font',   FONTS[f.font.value] || '');
    if (f.size)   pro.style.setProperty('--u-scale',  SIZES[f.size.value] || '1');
    if (f.back)   pro.dataset.backdrop = f.back.value;
    if (f.lay)    pro.dataset.layout   = f.lay.value;

    line('.pro-motto', f.motto && f.motto.value.trim(), function () {
      var p = document.createElement('p');
      p.className = 'pro-motto';
      var w = document.querySelector('.pro-ident__words');
      if (w) w.appendChild(p);
      return p;
    }, function (v) { return '“' + v + '”'; });

    line('.pro-about', f.about && f.about.value.trim(), function () {
      var card = document.createElement('div');
      card.className = 'pro-card';
      var h = document.createElement('h2'); h.textContent = 'Of Yourself';
      var p = document.createElement('p');  p.className = 'pro-about';
      card.appendChild(h); card.appendChild(p);
      var main = document.querySelector('.pro-main');
      if (main) main.insertBefore(card, main.firstChild);
      return p;
    }, function (v) { return v; });
  }

  function line(sel, value, make, dress) {
    var el = document.querySelector(sel);
    if (!value) { if (el) el.textContent = ''; return; }
    if (!el) el = make();
    if (el) el.textContent = dress(value);
  }

  Object.keys(f).forEach(function (k) {
    if (!f[k]) return;
    ['input', 'change'].forEach(function (ev) {
      f[k].addEventListener(ev, function () { paint(); moved(); });
    });
  });

  // A picked banner is shown from memory, before it is uploaded.
  var picked = null;
  var banner = document.querySelector('.pro-banner');
  if (f.banner) {
    f.banner.addEventListener('change', function () {
      if (picked) { URL.revokeObjectURL(picked); picked = null; }
      var file = f.banner.files && f.banner.files[0];
      if (file) {
        picked = URL.createObjectURL(file);
        pro.style.setProperty('--u-banner', "url('" + picked + "')");
        if (banner) banner.classList.add('pro-banner--own');
      }
      moved();
    });
  }
  if (f.drop) {
    f.drop.addEventListener('change', function () {
      if (f.drop.checked) {
        pro.style.removeProperty('--u-banner');
        if (banner) banner.classList.remove('pro-banner--own');
      }
      moved();
    });
  }

  /* ── charms, dragged on the banner itself ───────────────────────────── */
  var charms = [];
  try { charms = JSON.parse(store.value || '[]') || []; } catch (e) { charms = []; }

  function wrap() {
    var w = banner && banner.querySelector('.pro-charms');
    if (!w && banner) {
      w = document.createElement('span');
      w.className = 'pro-charms';
      banner.appendChild(w);
    }
    return w;
  }

  function publish() {
    store.value = JSON.stringify(charms);
    if (count) count.textContent = String(charms.length);
  }

  function draw() {
    var w = wrap();
    if (!w) return;
    w.innerHTML = '';
    charms.forEach(function (c) {
      var el = document.createElement('span');
      el.className = 'pro-charm is-' + c.c;
      el.style.left = c.x + '%';
      el.style.top = c.y + '%';
      el.style.setProperty('--c-size', c.s || 1);
      el.innerHTML = art[c.k] || '';
      el.title = 'Drag to move · click to recolour · double-click to remove';
      hold(el, c);
      w.appendChild(el);
    });
    publish();
  }

  function hold(el, c) {
    var dragged = false, dx = 0, dy = 0;

    el.addEventListener('pointerdown', function (e) {
      if (panel.dataset.open !== '1') return;   // only while dressing
      e.preventDefault(); e.stopPropagation();
      dragged = false;
      var r = el.getBoundingClientRect();
      dx = e.clientX - (r.left + r.width / 2);
      dy = e.clientY - (r.top + r.height / 2);
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-held');
    });

    el.addEventListener('pointermove', function (e) {
      if (!el.classList.contains('is-held')) return;
      dragged = true;
      var b = banner.getBoundingClientRect();
      c.x = Math.min(100, Math.max(0, ((e.clientX - dx) - b.left) / b.width * 100));
      c.y = Math.min(100, Math.max(0, ((e.clientY - dy) - b.top) / b.height * 100));
      el.style.left = c.x + '%';
      el.style.top = c.y + '%';
      publish(); moved();
    });

    ['pointerup', 'pointercancel'].forEach(function (ev) {
      el.addEventListener(ev, function () { el.classList.remove('is-held'); });
    });

    el.addEventListener('click', function (e) {
      if (panel.dataset.open !== '1') return;
      e.stopPropagation();
      if (dragged) return;
      c.c = INKS[(INKS.indexOf(c.c) + 1) % INKS.length];
      el.className = 'pro-charm is-' + c.c;
      publish(); moved();
    });

    el.addEventListener('dblclick', function (e) {
      if (panel.dataset.open !== '1') return;
      e.stopPropagation();
      var i = charms.indexOf(c);
      if (i > -1) charms.splice(i, 1);
      draw(); moved();
    });
  }

  if (tray) {
    tray.addEventListener('click', function (e) {
      var b = e.target.closest('.dress__charm');
      if (!b) return;
      if (charms.length >= MAX) { if (state) state.textContent = 'The banner is full'; return; }
      var n = charms.length;
      charms.push({ k: b.dataset.charm, x: 12 + (n * 11) % 76, y: 26 + Math.sin(n * 1.1) * 18, c: 'gold', s: 1 });
      draw(); moved();
    });
  }

  draw();

  /* ── the nudges ─────────────────────────────────────────────────────
     "Not now" quiets one for a week, kept in this browser — somebody who
     does not want to say whether they are coming should not be asked
     every single visit. The nudge itself is gone for good the moment the
     thing is actually done, because the server stops sending it. */
  (function () {
    var box = document.getElementById("proNudges");
    if (!box) return;
    var KEY = "hocc-nudge-";
    var WEEK = 7 * 24 * 60 * 60 * 1000;

    Array.prototype.forEach.call(box.querySelectorAll(".nudge"), function (n) {
      var k = n.getAttribute("data-nudge");
      var until = 0;
      try { until = parseInt(localStorage.getItem(KEY + k) || "0", 10) || 0; } catch (e) {}
      if (Date.now() < until) { n.remove(); return; }

      var no = n.querySelector(".nudge__not");
      if (no) no.addEventListener("click", function () {
        try { localStorage.setItem(KEY + k, String(Date.now() + WEEK)); } catch (e) {}
        n.classList.add("is-going");
        setTimeout(function () { n.remove(); if (!box.children.length) box.remove(); }, 260);
      });

      // The one that wants the dressing panel opens it and puts the cursor
      // where the words go, rather than leaving you to find the field.
      var go = n.querySelector("[data-dress]");
      if (go) go.addEventListener("click", function () {
        setOpen(true);
        var f = document.getElementById(go.getAttribute("data-dress"));
        if (f) { f.scrollIntoView({ block: "center" }); f.focus(); }
      });
    });

    if (!box.children.length) box.remove();
  })();
})();

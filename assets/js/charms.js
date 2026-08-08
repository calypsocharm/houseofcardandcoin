/* Hanging charms on your banner.

   The mat below the tray is the same shape as the real banner and wears the
   same picture, so where you drop something is where it lands. Positions are
   kept as percentages of the banner rather than pixels, which is why a charm
   sits in the same spot on a phone as on a laptop.

   All of this is decoration we drew. You choose which, where, what colour and
   how big; none of it is markup you wrote, which is what makes it safe to hand
   round a guild. The whole arrangement travels in one hidden field as JSON and
   is picked apart and checked again on the server. */
(function () {
  var mat   = document.getElementById('charmMat');
  var tray  = document.getElementById('charmTray');
  var store = document.getElementById('pgCharms');
  var count = document.getElementById('charmCount');
  var hint  = document.getElementById('charmHint');
  var art   = window.__CHARM_ART__ || {};
  if (!mat || !tray || !store) return;

  var MAX = 14;
  var INKS = ['gold', 'seal', 'pale', 'dark'];
  var charms = [];
  try { charms = JSON.parse(store.value || '[]') || []; } catch (e) { charms = []; }

  // The banner the mat wears: whatever is saved, until a new file is picked.
  var bannerInput = document.getElementById('pgBanner');
  function dressMat(url) {
    if (url) { mat.style.backgroundImage = "url('" + url + "')"; mat.classList.add('has-banner'); }
    else { mat.style.backgroundImage = ''; mat.classList.remove('has-banner'); }
  }
  dressMat(mat.dataset.banner || '');
  if (bannerInput) {
    bannerInput.addEventListener('change', function () {
      var f = bannerInput.files && bannerInput.files[0];
      dressMat(f ? URL.createObjectURL(f) : (mat.dataset.banner || ''));
    });
  }
  var drop = document.querySelector('input[name="dropBanner"]');
  if (drop) drop.addEventListener('change', function () { if (drop.checked) dressMat(''); });

  function publish() {
    store.value = JSON.stringify(charms);
    if (count) count.textContent = String(charms.length);
    if (hint) hint.style.display = charms.length ? 'none' : '';
    // the preview next door repaints from the same list
    document.dispatchEvent(new CustomEvent('charms:changed', { detail: charms }));
  }

  function draw() {
    Array.prototype.slice.call(mat.querySelectorAll('.charmmat__c')).forEach(function (n) { n.remove(); });
    charms.forEach(function (c, i) {
      var el = document.createElement('span');
      el.className = 'charmmat__c is-' + c.c;
      el.style.left = c.x + '%';
      el.style.top = c.y + '%';
      el.style.setProperty('--c-size', c.s || 1);
      el.innerHTML = art[c.k] || '';
      el.dataset.i = String(i);
      el.title = 'Drag to move · click to recolour · double-click to remove';
      grab(el, c);
      mat.appendChild(el);
    });
    publish();
  }

  function grab(el, c) {
    var moved = false, dx = 0, dy = 0;

    el.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      moved = false;
      var r = el.getBoundingClientRect();
      dx = e.clientX - (r.left + r.width / 2);
      dy = e.clientY - (r.top + r.height / 2);
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-held');
    });

    el.addEventListener('pointermove', function (e) {
      if (!el.classList.contains('is-held')) return;
      moved = true;
      var m = mat.getBoundingClientRect();
      c.x = Math.min(100, Math.max(0, ((e.clientX - dx) - m.left) / m.width * 100));
      c.y = Math.min(100, Math.max(0, ((e.clientY - dy) - m.top) / m.height * 100));
      el.style.left = c.x + '%';
      el.style.top = c.y + '%';
      publish();
    });

    ['pointerup', 'pointercancel'].forEach(function (ev) {
      el.addEventListener(ev, function () { el.classList.remove('is-held'); });
    });

    // A click that did not drag cycles the colour — no extra control needed.
    el.addEventListener('click', function (e) {
      e.stopPropagation();
      if (moved) return;
      c.c = INKS[(INKS.indexOf(c.c) + 1) % INKS.length];
      el.className = 'charmmat__c is-' + c.c;
      publish();
    });

    el.addEventListener('dblclick', function (e) {
      e.stopPropagation();
      var i = charms.indexOf(c);
      if (i > -1) charms.splice(i, 1);
      draw();
    });
  }

  tray.addEventListener('click', function (e) {
    var b = e.target.closest('.charmtray__btn');
    if (!b) return;
    if (charms.length >= MAX) {
      if (hint) { hint.style.display = ''; hint.textContent = 'That is as many as the banner will hold.'; }
      return;
    }
    // Dropped along a gentle arc rather than all in a heap, so a handful looks
    // arranged before anybody has touched them.
    var n = charms.length;
    charms.push({
      k: b.dataset.charm,
      x: 12 + (n * 11) % 76,
      y: 26 + Math.sin(n * 1.1) * 18,
      c: 'gold',
      s: 1
    });
    draw();
  });

  draw();
})();

/* Dressing your page while looking at it.

   The controls sit in Profile and the page they dress is somewhere else, so
   choosing a colour meant saving, going to look, coming back and trying again.
   The preview beside them is the real page in a frame — not a drawing of it —
   so what you are judging is the thing itself, with your hand, your sheet and
   your talk already in it.

   Nothing here saves. It writes the same custom properties and data attributes
   the server would have written, straight into the frame, and the form still
   has to be posted for any of it to stick. */
(function () {
  var frame = document.getElementById('pagePreview');
  if (!frame) return;

  var f = {
    accent:   document.getElementById('pgAccent'),
    seal:     document.getElementById('pgSeal'),
    tint:     document.getElementById('pgTint'),
    backdrop: document.getElementById('pgBack'),
    layout:   document.getElementById('pgLay'),
    motto:    document.getElementById('pgMotto'),
    about:    document.getElementById('pgAbout'),
    banner:   document.getElementById('pgBanner'),
    drop:     document.querySelector('input[name="dropBanner"]')
  };

  function root() {
    try { return frame.contentDocument ? frame.contentDocument.querySelector('.pro') : null; }
    catch (e) { return null; }   // same origin, so this should not happen
  }

  // A picked file is shown from memory. It has not been uploaded yet and will
  // not be until the form is posted.
  var picked = null;

  function paint() {
    var pro = root();
    if (!pro) return;
    var d = frame.contentDocument;

    if (f.accent) pro.style.setProperty('--u-accent', f.accent.value);
    if (f.seal)   pro.style.setProperty('--u-seal',   f.seal.value);
    if (f.tint)   pro.style.setProperty('--u-tint',   f.tint.value);
    if (f.backdrop) pro.dataset.backdrop = f.backdrop.value;
    if (f.layout)   pro.dataset.layout   = f.layout.value;

    var banner = d.querySelector('.pro-banner');
    if (banner) {
      if (picked) {
        pro.style.setProperty('--u-banner', "url('" + picked + "')");
        banner.classList.add('pro-banner--own');
      } else if (f.drop && f.drop.checked) {
        pro.style.removeProperty('--u-banner');
        banner.classList.remove('pro-banner--own');
      }
    }

    // The motto and the about text may not have a home in the markup yet —
    // an empty one is not rendered — so make one rather than dropping the
    // change on the floor.
    setLine(d, '.pro-motto', f.motto && f.motto.value.trim(), function () {
      var p = d.createElement('p');
      p.className = 'pro-motto';
      var words = d.querySelector('.pro-ident__words');
      if (words) words.appendChild(p);
      return p;
    }, function (v) { return '“' + v + '”'; });

    setLine(d, '.pro-about', f.about && f.about.value.trim(), function () {
      var card = d.createElement('div');
      card.className = 'pro-card';
      var h = d.createElement('h2'); h.textContent = 'Of Yourself';
      var p = d.createElement('p'); p.className = 'pro-about';
      card.appendChild(h); card.appendChild(p);
      var main = d.querySelector('.pro-main');
      if (main) main.insertBefore(card, main.firstChild);
      return p;
    }, function (v) { return v; });
  }

  // Charms are held by charms.js, which shouts when the arrangement changes.
  // Repainting them here keeps the frame honest about where they will land.
  function paintCharms(list) {
    var pro = root();
    if (!pro) return;
    var d = frame.contentDocument;
    var banner = d.querySelector('.pro-banner');
    if (!banner) return;
    var wrap = banner.querySelector('.pro-charms');
    if (!wrap) {
      wrap = d.createElement('span');
      wrap.className = 'pro-charms';
      banner.appendChild(wrap);
    }
    wrap.innerHTML = '';
    (list || []).forEach(function (c) {
      var s = d.createElement('span');
      s.className = 'pro-charm is-' + c.c;
      s.style.left = c.x + '%';
      s.style.top = c.y + '%';
      s.style.setProperty('--c-size', c.s || 1);
      s.innerHTML = (window.__CHARM_ART__ || {})[c.k] || '';
      wrap.appendChild(s);
    });
  }

  document.addEventListener('charms:changed', function (e) { paintCharms(e.detail); });

  function currentCharms() {
    var store = document.getElementById('pgCharms');
    if (!store) return [];
    try { return JSON.parse(store.value || '[]') || []; } catch (e) { return []; }
  }

  function setLine(d, sel, value, make, dress) {
    var el = d.querySelector(sel);
    if (!value) { if (el) el.textContent = ''; return; }
    if (!el) el = make();
    if (el) el.textContent = dress(value);
  }

  // The frame loads the page as last saved; put the unsaved form on top of it.
  frame.addEventListener('load', function () { paint(); paintCharms(currentCharms()); });

  ['input', 'change'].forEach(function (ev) {
    Object.keys(f).forEach(function (k) {
      if (f[k]) f[k].addEventListener(ev, paint);
    });
  });

  if (f.banner) {
    f.banner.addEventListener('change', function () {
      if (picked) { URL.revokeObjectURL(picked); picked = null; }
      var file = f.banner.files && f.banner.files[0];
      if (file) picked = URL.createObjectURL(file);
      paint();
    });
  }
})();

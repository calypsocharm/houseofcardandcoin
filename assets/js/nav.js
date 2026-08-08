/* One nav for the whole House — always the hamburger, and it knows you.

   The bar used to keep two layouts honest at once: a row of links above
   1200px, a hamburger below. The row was the half that kept breaking. Eight
   links plus a "Signed in — <name>" pill, a Guild Hall link and a Sign out
   button ran several hundred pixels past the edge of an ordinary laptop
   window, and what fell off the end was the member's own profile.

   It is one control at every width now, and the panel changes with who you
   are. Signed out it offers the public rooms and a way in. Signed in it opens
   with your name and rank, then the places that are actually yours — the Guild
   Hall, your hand, your notices, and Administration if you hold the keys —
   before the rest of the House.

   State arrives two ways. The EJS pages already know it server-side and write
   window.__ME__ inline, so their menu is right on the first paint. The
   generated static pages cannot know it, so they ask /api/me and redraw. This
   replaces auth-signal.js, which patched the old row in place. */
(function () {
  var bar = document.querySelector('.nav');
  var panel = document.getElementById('nl');
  var btn = document.querySelector('.menu-toggle');
  if (!bar || !panel || !btn) return;

  /* The rooms anyone may walk into. Kept here rather than read off the markup
     so both halves of the site — generated HTML and EJS — get one list. */
  var HOUSE = [
    ['Home',                '/index.html'],
    ['The Guild',           '/guild.html'],
    ['Sellsword',           '/sellsword.html'],
    ['Scroll of Events',    '/events.html'],
    ['Ren Faire Camp',      '/camp.html'],
    ['The Tavern',          '/board'],
    ['The Roll of Hands',   '/board/roll'],
    ['Questions & Customs', '/faq'],
    ['Carrier Pigeon',      '/pigeon.html']
  ];

  var here = location.pathname === '/' ? '/index.html' : location.pathname;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function link(label, href, count) {
    var a = el('a', null, null);
    a.href = href;
    a.appendChild(el('span', null, label));
    if (count) a.appendChild(el('span', 'navdrawer__count', String(count)));
    // "Your hand" points at /board#hand and the Tavern at /board, so matching
    // on the path alone lit both of them at once. An entry carrying a fragment
    // has to match the fragment too.
    var hit = href.indexOf('#') > -1
      ? href === here + location.hash
      : href === here;
    if (hit) {
      a.className = 'active';
      a.setAttribute('aria-current', 'page');
    }
    return a;
  }

  function build(me) {
    var wasOpen = panel.classList.contains('open');
    panel.className = 'nav-links navdrawer' + (wasOpen ? ' open' : '');
    panel.innerHTML = '';

    var inside = !!(me && me.signedIn);
    var patron = inside && me.kind === 'patron';

    if (inside) {
      // Your own face is a door to your own page, the same as everybody
      // else's. Without this the only way to your page was via the roster.
      var who = me.slug
        ? (function () { var a = el('a', 'navdrawer__who'); a.href = '/guild/' + me.slug;
                         a.title = 'Your page'; return a; })()
        : el('div', 'navdrawer__who');
      if (me.avatar) {
        var face = el('img', 'navdrawer__face');
        face.src = me.avatar;
        face.alt = '';
        who.appendChild(face);
      } else {
        who.appendChild(el('span', 'navdrawer__face navdrawer__face--none',
          (me.name || '?').charAt(0).toUpperCase()));
      }
      var name = el('span', 'navdrawer__name');
      name.appendChild(el('b', null, me.name || ''));
      name.appendChild(el('small', null, me.rank || (patron ? 'Tavern guest' : '')));
      who.appendChild(name);
      panel.appendChild(who);

      panel.appendChild(el('p', 'navdrawer__label', patron ? 'Your seat' : 'Yours'));

      // The Tavern is left out of a patron's own section — it is already down
      // in The House, and listing a room twice makes the menu look padded.
      var mine = patron
        ? [['Your hand', '/board#hand'], ['Notices', '/board/notices']]
        : [['Profile', '/members'], ['Your hand', '/board#hand'], ['Notices', '/board/notices']];
      if (me.leader) mine.push(['Administration', '/members#admin']);

      mine.forEach(function (x) {
        panel.appendChild(link(x[0], x[1], x[1] === '/board/notices' ? me.unread : 0));
      });
    }

    panel.appendChild(el('p', 'navdrawer__label', 'The House'));
    HOUSE.forEach(function (x) { panel.appendChild(link(x[0], x[1], 0)); });

    var foot = el('div', 'navdrawer__foot');
    if (inside) {
      var form = document.createElement('form');
      form.method = 'post';
      form.action = patron ? '/tavern/logout' : '/members/logout';
      form.className = 'nav-logout';
      var out = el('button', 'nav-login', patron ? 'Leave the tavern' : 'Sign out');
      out.type = 'submit';
      form.appendChild(out);
      foot.appendChild(form);
    } else {
      var go = el('a', 'nav-login', 'Guild Login');
      go.href = '/members/login';
      foot.appendChild(go);
      foot.appendChild(el('small', 'navdrawer__note',
        'New here? The same door makes your account.'));
    }
    panel.appendChild(foot);

    // A mark on the button, so unread notices show without opening anything.
    var waiting = inside && me.unread > 0;
    btn.classList.toggle('menu-toggle--dot', waiting);
    btn.setAttribute('aria-label', waiting
      ? 'Menu — ' + me.unread + ' unread notice' + (me.unread === 1 ? '' : 's')
      : 'Menu');
  }

  // moveFocus only when the menu was opened from the keyboard. Doing it on a
  // tap leaves a focus ring sitting on the first item, which reads as though
  // the House had chosen something for you.
  function setOpen(open, moveFocus) {
    panel.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && moveFocus) {
      var first = panel.querySelector('a, button');
      if (first) first.focus();
    }
  }

  // The generated pages carry an inline onclick that toggles .open. This file
  // takes the button over completely, so that has to go first or every click
  // would fire twice and cancel itself out.
  btn.removeAttribute('onclick');
  btn.onclick = null;
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'nl');
  btn.setAttribute('aria-haspopup', 'true');

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    // A click fired by Enter or Space carries detail 0; a real pointer does not.
    setOpen(!panel.classList.contains('open'), e.detail === 0);
  });

  document.addEventListener('click', function (e) {
    if (!panel.classList.contains('open')) return;
    if (panel.contains(e.target) || btn.contains(e.target)) return;
    setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !panel.classList.contains('open')) return;
    setOpen(false);
    btn.focus();
  });

  if (window.__ME__) {
    build(window.__ME__);
  } else {
    // Draw the signed-out menu at once so the button works while the answer is
    // still in flight, then correct it if there is somebody there.
    build(null);
    fetch('/api/me', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (me) { if (me && me.signedIn) build(me); })
      .catch(function () { /* offline or blocked — the public menu stands */ });
  }
})();

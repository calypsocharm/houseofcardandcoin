/* Land where you should.

   Every button on this site is a form, and every form is a POST that ends in a
   redirect. That is the right way to build it — you can refresh without posting
   twice, and it all still works with scripting switched off — but it has one
   miserable side effect: the browser treats the answer as a brand new page and
   drops you at the very top of it.

   So you toast a note near the bottom of the Tavern and the whole room yanks
   back to the fire. You tick something off the bring list and you are looking
   at your own portrait again. Every small action costs a scroll to get back to
   where you were standing, and the yank itself is startling.

   Two things are going on, and this fixes both.

   1. MOST ACTIONS COME BACK WITH NO DESTINATION AT ALL — a react, a bunk, a
      claim on the bring list, a card thrown back. There is nowhere for the
      browser to aim, so it aims at the top. This remembers where you were
      standing as the form leaves and puts you back there.

   2. SOME COME BACK POINTING AT SOMETHING — #m1014, the note you just toasted;
      #r91, the reply you just wrote. The House has been sending those for a
      while and the browser has been ignoring them: the stylesheet asks for
      smooth scrolling, and a smooth scroll to an anchor on a page that is
      still laying itself out gets abandoned halfway and leaves you at the top.
      Which is why the anchors looked like they did nothing. This does the jump
      itself, instantly, once the page has stopped moving.

   The remembered place wins over the anchor when there is one, because it is
   the more exact answer: it is where you actually were, not the top of the
   thing you touched. The anchor is what is left when you have come from
   another page entirely.

   The rules it follows:

     · only non-GET forms. The Tavern's search box is a GET, and after a search
       the top of the results is the right place to be
     · only when the answer comes back on the same path it left from. A form
       that takes you somewhere else is a journey, not a fidget
     · only for a moment. The mark is read once and thrown away, and ignored if
       it is older than half a minute, so it can never surprise you later
     · never over the top of you. Once you have taken hold of the page it is
       yours, and nothing here moves it again

   A form marked data-jump opts out — for the few where the top genuinely is
   the right answer, like writing a new note, which appears up there.

   With scripting off, everything behaves exactly as it did before. */
(function () {
  var KEY = 'hocc-place';
  var FRESH = 30000;              // half a minute is plenty for a round trip

  /* ── remembering ──────────────────────────────────────────────────────── */

  // Capture phase, so a form whose own handler stops the event still gets
  // marked. Nothing here can cancel the submit — it only writes a note.
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.tagName !== 'FORM') return;
    if ((f.getAttribute('method') || 'get').toLowerCase() === 'get') return;
    if (f.hasAttribute('data-jump')) return;
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (y < 40) return;           // already at the top; nothing worth keeping
    try {
      sessionStorage.setItem(KEY, JSON.stringify({
        path: location.pathname, y: y, at: Date.now()
      }));
    } catch (err) { /* private window, or storage full — no harm done */ }
  }, true);

  /* ── where we ought to be ─────────────────────────────────────────────── */

  var remembered = null;
  try {
    var raw = sessionStorage.getItem(KEY);
    if (raw) {
      sessionStorage.removeItem(KEY);        // read once, whatever happens next
      var p = JSON.parse(raw);
      if (p && p.path === location.pathname && (Date.now() - p.at) < FRESH) {
        remembered = p.y;
      }
    }
  } catch (err) { /* nothing remembered */ }

  // The anchor, if the House sent one and it points at something real.
  var anchor = null;
  if (location.hash.length > 1) {
    try { anchor = document.getElementById(decodeURIComponent(location.hash.slice(1))); }
    catch (err) { anchor = null; }
  }

  if (remembered === null && !anchor) return;

  /* ── putting you there ────────────────────────────────────────────────── */

  // Smooth scrolling is right for a link to an anchor you clicked and wrong
  // here — animating down the page is its own small fright, and it is the very
  // thing that was losing the jump halfway. Off for the moment it takes.
  function instantly(go) {
    var root = document.documentElement;
    var had = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    go();
    root.style.scrollBehavior = had;
  }

  function place() {
    instantly(function () {
      if (remembered !== null) window.scrollTo(0, remembered);
      // scrollIntoView honours the stylesheet's scroll-padding-top, so an
      // anchor lands below the header rather than under it.
      else anchor.scrollIntoView({ block: 'start' });
    });
  }

  function where() {
    return window.pageYOffset || document.documentElement.scrollTop || 0;
  }

  // Once you touch the page it is yours, and nothing below will move it.
  var yours = false;
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (ev) {
    window.addEventListener(ev, function () { yours = true; }, { passive: true, once: true });
  });

  place();
  var landed = where();

  /* Pictures and web fonts arrive after this and change how tall the page is,
     sliding the spot out from under you — which is the other half of why the
     anchors never worked. So it is set again as things settle, and once more
     when everything has loaded, unless you have taken hold of it yourself. */
  function again() {
    if (yours) return;
    place();
    landed = where();
  }
  window.addEventListener('load', again);
  setTimeout(again, 120);
  setTimeout(again, 500);
})();

/* Live numbers in the map's hover signs.

   The map is on two pages — the Guild Hall's own /map and the homepage, which
   is static HTML with no template behind it. Rather than render the numbers
   into one and not the other, both ask /api/map for them. One mechanism, and
   the homepage stays static.

   The sign already carries a written line ("Talk by the fire"). That stays as
   the fallback and is what anyone sees before the answer arrives, or if it
   never does — the map must never sit there with blanks where words were. */
(function () {
  var frame = document.querySelector('.mapframe');
  if (!frame) return;

  fetch('/api/map', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (live) {
      if (!live) return;
      frame.querySelectorAll('.mapspot').forEach(function (a) {
        var href = a.getAttribute('href');
        var line = live[href];
        if (!line) return;
        var sub = a.querySelector('.mapspot__tip small');
        if (!sub) return;
        sub.textContent = line;
        sub.classList.add('is-live');
        // The label reads the whole sign to a screen reader, so it has to say
        // the same thing the eye is being shown.
        var name = (a.getAttribute('aria-label') || '').split(' — ')[0];
        a.setAttribute('aria-label', name + ' — ' + line);
      });
    })
    .catch(function () { /* the written lines are already there */ });
})();

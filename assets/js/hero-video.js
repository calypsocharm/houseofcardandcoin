/* Hero videos, only where they are worth their weight.
   The homepage carried 4.0 MB of background video and the Scroll of Events
   5.3 MB — around fourteen seconds on the busy 4G you get in a park full of
   people, which is exactly where and when someone checks the schedule or draws
   their card. Phones now get the poster still instead: the same frame, about
   50 KB, and nothing else changes.

   The markup keeps its source in data-src so nothing downloads until this
   decides it should. */
(function () {
  var vids = document.querySelectorAll('video[data-src]');
  if (!vids.length) return;

  var conn = navigator.connection || {};
  var wide = window.matchMedia('(min-width: 900px)').matches;
  var thrifty = conn.saveData === true ||
                /(^|-)2g$/.test(conn.effectiveType || '') ||
                conn.effectiveType === '3g';
  var stillOnly = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!wide || thrifty || stillOnly) return;   // the poster is already showing

  Array.prototype.forEach.call(vids, function (v) {
    var src = v.getAttribute('data-src');
    if (!src) return;
    var s = document.createElement('source');
    s.src = src;
    s.type = 'video/mp4';
    v.appendChild(s);
    v.load();
    var go = v.play();
    if (go && go.catch) go.catch(function () { /* autoplay refused; poster stays */ });
  });
})();

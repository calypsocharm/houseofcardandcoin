/* Hero videos, only where they are worth their weight.
   The homepage carried 4.0 MB of background video and the Scroll of Events
   5.3 MB — around fourteen seconds on the busy 4G you get in a park full of
   people, which is exactly where and when someone checks the schedule or draws
   their card. Phones now get the poster still instead: the same frame, about
   50 KB, and nothing else changes.

   The markup keeps its source in data-src so nothing downloads until this
   decides it should.

   Two ways of deciding, because one is not enough. First the guess: the screen
   is small, the browser is in data-saver, the connection calls itself 2G or 3G,
   or it is nominally fast but crawling. Then the answer: the file goes on, and
   if it has not begun playing within a few seconds the transfer is cancelled
   and the still comes back. A park full of phones reports 4G and behaves like
   nothing of the sort, and no amount of asking the browser about the network
   will tell you that — only trying it will. */
(function () {
  var vids = document.querySelectorAll('video[data-src]');
  if (!vids.length) return;

  /* How long to let it try before giving up on it. Long enough that an
     ordinary connection is never punished, short enough that nobody is left
     staring at a header doing nothing. */
  var PATIENCE = 6000;

  var conn = navigator.connection || {};
  var wide = window.matchMedia('(min-width: 900px)').matches;

  /* Slow by its own account. effectiveType is the browser's summary, but it is
     coarse and optimistic, so the raw figures get a look too: downlink in Mbps
     and rtt in milliseconds. Anything under about 1.5 Mbps or over a third of
     a second of latency is not going to carry a megabyte and a half without
     the header sitting empty first. Both are absent in Firefox and Safari,
     where undefined fails every comparison and the trial below is the whole
     defence — which is the point of having it. */
  var thrifty = conn.saveData === true ||
                /(^|-)2g$/.test(conn.effectiveType || '') ||
                conn.effectiveType === '3g' ||
                (typeof conn.downlink === 'number' && conn.downlink > 0 && conn.downlink < 1.5) ||
                (typeof conn.rtt === 'number' && conn.rtt > 350);

  var stillOnly = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!wide || thrifty || stillOnly) return;   // the poster is already showing

  /* Nothing happens while the page is in a background tab. Playback is
     suspended there, so the trial below would time out against a perfectly
     good connection and bin a video nobody had looked at yet — and a tab
     opened in the background has no business pulling a megabyte and a half
     before anyone has glanced at it. It waits until somebody is actually
     looking, then decides. */
  if (document.hidden) {
    document.addEventListener('visibilitychange', function once() {
      if (document.hidden) return;
      document.removeEventListener('visibilitychange', once);
      start();
    });
  } else {
    start();
  }

  function start() { Array.prototype.forEach.call(vids, attach); }

  function attach(v) {
    var src = v.getAttribute('data-src');
    if (!src) return;
    var s = document.createElement('source');
    s.src = src;
    s.type = 'video/mp4';
    v.appendChild(s);
    v.load();

    /* The trial. Either it starts, or the network gets one chance and loses
       it. Cancelling means taking the source away and reloading — that drops
       the transfer wherever it had got to and puts the poster back, which is
       what a page with no video source shows anyway. */
    var settled = false;
    function keep() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
    }
    function drop() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (s.parentNode === v) v.removeChild(s);
      v.load();
    }

    // 'playing' is the real answer. 'canplaythrough' stands in for it when the
    // browser will not autoplay but the file arrived perfectly well — binning
    // that would be throwing away a download that worked.
    v.addEventListener('playing', keep, { once: true });
    v.addEventListener('canplaythrough', keep, { once: true });

    /* Giving up is decided on what the browser actually has, not on whether an
       event announced itself. A connection that is slow but working will have
       frames by now even if nothing fired — readyState 2 means there is a
       picture to show. Only a video with nothing at all after all that time
       is the one worth cancelling. */
    var timer = setTimeout(function () {
      if (v.readyState >= 2) keep(); else drop();
    }, PATIENCE);

    var go = v.play();
    if (go && go.catch) go.catch(function () {
      // Autoplay refused. Nobody will ever see these frames, so there is no
      // reason to keep pulling them down — the poster is already in place.
      drop();
    });
  }
})();

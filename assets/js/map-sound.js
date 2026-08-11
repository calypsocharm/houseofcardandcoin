/* Sound when you hover a place on the map.

   The rule, and it is the whole design: this only ever makes a noise for
   somebody who has already turned the music on. Brushing a mouse across a map
   should never produce sound nobody asked for, and a page that does that is
   one people close. If the song is off, nothing here loads and nothing here
   plays — the files are not even fetched.

   Two kinds of sound, because they are not the same thing. A fire is
   continuous: it starts when you arrive, loops, and fades out when you leave.
   A coo or a card flick is an event: it plays once and is done. Trying to
   treat those the same gives you either a fire that stutters or a bird that
   will not shut up.

   Sound follows the music volume, quieter than the music itself, so it sits
   under the song rather than shouting over it. */
(function () {
  var frame = document.querySelector('.mapframe');
  if (!frame) return;

  var K_ON = 'hocc-song-on';
  var K_VOL = 'hocc-song-volume';

  /* Which place gets which sound, and whether it holds or fires once. Adding
     one is a line here plus the file — nothing else needs to know. */
  var SOUNDS = {
    '/camp.html':    { file: 'fire.mp3',   hold: true,  gain: 0.55 },
    '/board':        { file: 'tavern.mp3', hold: true,  gain: 0.5 },
    '/pigeon.html':  { file: 'pigeon.mp3', hold: true,  gain: 0.6 },
    '/board/roll':   { file: 'cards.mp3',  hold: false, gain: 0.7 },
    '/members/login':{ file: 'latch.mp3',  hold: false, gain: 0.7 }
  };

  function musicOn() {
    try { return localStorage.getItem(K_ON) === '1'; } catch (e) { return false; }
  }
  function baseVolume() {
    var v = parseFloat(localStorage.getItem(K_VOL));
    return (v >= 0 && v <= 1) ? v : 0.45;
  }

  var made = {};                     // one Audio per sound, built on first use
  var holding = null;                // the looping sound currently playing

  function get(spec) {
    if (!made[spec.file]) {
      var a = new Audio();
      a.preload = 'none';            // nothing fetched until it is wanted
      a.src = '/assets/audio/hover/' + spec.file;
      a.loop = !!spec.hold;
      made[spec.file] = a;
    }
    return made[spec.file];
  }

  // Fading rather than cutting, so leaving a tent does not chop the fire off.
  function fadeOut(a) {
    if (!a || a.paused) return;
    var step = a.volume / 8;
    var t = setInterval(function () {
      a.volume = Math.max(0, a.volume - step);
      if (a.volume <= 0.01) { clearInterval(t); a.pause(); a.currentTime = 0; }
    }, 40);
  }

  function enter(href) {
    if (!musicOn()) return;          // the whole gate
    var spec = SOUNDS[href];
    if (!spec) return;
    var a = get(spec);
    a.volume = Math.min(1, baseVolume() * spec.gain);
    if (spec.hold) {
      if (holding && holding !== a) fadeOut(holding);
      holding = a;
    }
    a.currentTime = 0;
    var p = a.play();
    if (p && p.catch) p.catch(function () { /* blocked; never mind */ });
  }

  function leave(href) {
    var spec = SOUNDS[href];
    if (!spec || !spec.hold) return; // one-shots run themselves out
    var a = made[spec.file];
    if (a) { fadeOut(a); if (holding === a) holding = null; }
  }

  frame.querySelectorAll('.mapspot').forEach(function (a) {
    var href = a.getAttribute('href');
    if (!SOUNDS[href]) return;
    a.addEventListener('mouseenter', function () { enter(href); });
    a.addEventListener('mouseleave', function () { leave(href); });
    // keyboard gets the same, so it is not a mouse-only flourish
    a.addEventListener('focus', function () { enter(href); });
    a.addEventListener('blur', function () { leave(href); });
  });

  // Leaving the page with a fire still crackling would be rude.
  window.addEventListener('pagehide', function () {
    Object.keys(made).forEach(function (k) { made[k].pause(); });
  });
})();

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
   under the song rather than shouting over it.

   The switch is here rather than in the header because the header's music
   control only draws itself in the Tavern. That left somebody arriving at the
   front door with hover sounds they could not hear and no way to ask for
   them — the only switch in the House was in a room they had not reached yet.
   This one sits under the map, on both pages the map appears on, and it is
   the same permission the music button grants. */
(function () {
  var frame = document.querySelector('.mapframe');
  if (!frame) return;

  var K_OK = 'hocc-sound-ok';     // set the first time the music is turned on
  var K_VOL = 'hocc-song-volume';

  /* Which place gets which sound, and whether it holds or fires once. Adding
     one is a line here plus the file — nothing else needs to know. */
  var SOUNDS = {
    '/index.html':   { file: 'house.mp3',  hold: false, gain: 0.5,  music: true },
    '/guild.html':   { file: 'banner.mp3', hold: false, gain: 0.6 },
    '/camp.html':    { file: 'fire.mp3',   hold: true,  gain: 0.55 },
    '/board':        { file: 'tavern.mp3', hold: true,  gain: 0.5,  music: true },
    '/pigeon.html':  { file: 'pigeon.mp3', hold: true,  gain: 0.6 },
    '/events.html':  { file: 'scroll.mp3', hold: false, gain: 0.55 },
    '/weekend':      { file: 'crowd.mp3',  hold: false, gain: 0.6 },
    '/faq':          { file: 'quest.mp3',  hold: false, gain: 0.5,  music: true },
    '/gallery':      { file: 'gallery.mp3',hold: false, gain: 0.55 },
    '/board/roll':   { file: 'cards.mp3',  hold: false, gain: 0.7 },
    '/members/login':{ file: 'latch.mp3',  hold: false, gain: 0.7 }
  };

  /* Permission, not playback. Somebody who has pressed play once has asked for
     sound; pausing the song is not a request for the map to go silent. What
     matters is that nothing here makes a noise for anyone who never asked. */
  function allowed() {
    try { return localStorage.getItem(K_OK) === '1'; } catch (e) { return false; }
  }
  /* The song itself, if the player drew itself on this page. Used only so the
     Tavern's clip can keep out of its way. */
  function songPlaying() {
    return !!(window.__hoccSong && !window.__hoccSong.paused);
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
    if (!allowed()) return;          // the whole gate
    var spec = SOUNDS[href];
    if (!spec) return;
    // The musical ones step aside while the song is actually sounding. A
    // stinger over a tune is not atmosphere, it is two pieces of music
    // fighting. The fire and the birds are happy over the top of it.
    if (spec.music && songPlaying()) return;
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

  /* ── the switch ────────────────────────────────────────────────────────
     Drawn from here so both pages carrying the map get it from one place.
     Turning it on plays the latch at once: the click is the gesture browsers
     want before they will allow audio, and hearing something immediately is
     the only honest confirmation that the switch did anything. */
  var lead = document.querySelector('.maplead');
  if (lead) {
    var row = document.createElement('p');
    row.className = 'mapsound';

    var sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'mapsound__btn';

    var hint = document.createElement('small');
    hint.className = 'mapsound__hint';

    row.appendChild(sw);
    row.appendChild(hint);
    lead.parentNode.insertBefore(row, lead.nextSibling);

    function paintSwitch() {
      var on = allowed();
      sw.textContent = (on ? '♫' : '♪') + '  ' + (on ? 'Sound is on' : 'Turn on sound');
      sw.title = on
        ? 'Silence the map'
        : 'Hear each place as you pass over it';
      sw.setAttribute('aria-pressed', on ? 'true' : 'false');
      sw.setAttribute('aria-label', sw.title);
      row.classList.toggle('is-on', on);
      hint.textContent = on
        ? 'Pass over a tent to hear it.'
        : 'Each place on the map has a sound of its own.';
    }

    sw.addEventListener('click', function () {
      var turningOn = !allowed();
      try { localStorage.setItem(K_OK, turningOn ? '1' : '0'); } catch (e) {}
      if (turningOn) {
        enter('/members/login');        // the latch — the House unlocking
      } else {
        Object.keys(made).forEach(function (k) { fadeOut(made[k]); });
        holding = null;
      }
      paintSwitch();
    });

    paintSwitch();
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

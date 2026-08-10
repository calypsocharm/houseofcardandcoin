/* The tavern song. Opt-in, never autoplay.

   The file is 1.7 MB, which is heavier than everything else on the page put
   together — so the <audio> element carries preload="none" and the browser
   fetches nothing at all until somebody presses the button. Anyone who never
   presses it pays nothing.

   Autoplay is not attempted even for someone who had it playing a minute ago:
   music starting on its own in a public place is the rudest thing a website
   can do, and browsers block it anyway. What is remembered is the volume, so
   the House does not shout at you twice.

   The button says what will happen when pressed, not what is happening now,
   because that is what a control is for. */
(function () {
  var btn = document.getElementById('songBtn');
  var audio = document.getElementById('tavernSong');
  if (!btn || !audio) return;

  var KEY = 'hocc-song-volume';
  var saved = parseFloat(localStorage.getItem(KEY));
  audio.volume = (saved >= 0 && saved <= 1) ? saved : 0.45;

  function paint(playing) {
    btn.textContent = playing ? '■ Stop the song' : '♪ Play the tavern song';
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    btn.classList.toggle('is-playing', playing);
  }
  paint(false);

  btn.addEventListener('click', function () {
    if (audio.paused) {
      // .play() returns a promise that rejects if the browser refuses. Say so
      // rather than leaving a button that looks broken.
      var p = audio.play();
      if (p && p.catch) {
        p.catch(function () {
          btn.textContent = 'Your browser would not play it';
          setTimeout(function () { paint(false); }, 2600);
        });
      }
    } else {
      audio.pause();
    }
  });

  audio.addEventListener('play', function () { paint(true); });
  audio.addEventListener('pause', function () { paint(false); });
  audio.addEventListener('volumechange', function () {
    try { localStorage.setItem(KEY, String(audio.volume)); } catch (e) {}
  });

  // Leaving the page should not leave music playing in a background tab.
  window.addEventListener('pagehide', function () { audio.pause(); });
})();

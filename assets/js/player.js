/* The tavern song, and where it is allowed to follow you.

   By default the music belongs to the Tavern and nowhere else — the control
   only appears in there, and walking out ends it. Anyone who wants it
   everywhere can say so from the Tavern, with the toggle beside the button,
   and then it follows them around the House until they say otherwise. It is
   never the House's decision.

   On autoplay. The song never starts for somebody who has not asked for it —
   that is the whole rule. But this is a site of separate pages, so moving from
   one room to the next destroys the audio element and builds a new one. If we
   did nothing, "play" would mean "play until you click anything". So the
   choice is remembered and picked up on the next page. That is not autoplay;
   it is honouring a decision already made. If the browser refuses anyway —
   most will until the page has been touched — nothing happens, no error, and
   the button sits there ready.

   Volume and position are remembered too, so it neither shouts at you twice
   nor restarts the song at every doorway. */
(function () {
  var SRC     = '/assets/audio/tavern.mp3';
  var K_ON    = 'hocc-song-on';
  var K_VOL   = 'hocc-song-volume';
  var K_AT    = 'hocc-song-at';
  var K_SCOPE = 'hocc-song-scope';   // 'tavern' (default) or 'everywhere'

  var bar = document.querySelector('.nav');
  var toggle = document.querySelector('.menu-toggle');
  if (!bar || !toggle) return;

  function remember(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} }
  function recall(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  // Every room off /board is the Tavern — the roll, the gallery of rogues,
  // the whispers, a single note. They are all the same building.
  var inTavern = location.pathname === '/board' || location.pathname.indexOf('/board/') === 0;
  var everywhere = recall(K_SCOPE) === 'everywhere';

  // Outside the Tavern, with no standing permission, there is nothing to draw
  // and nothing to play.
  if (!inTavern && !everywhere) return;

  var vol = parseFloat(recall(K_VOL));
  if (!(vol >= 0 && vol <= 1)) vol = 0.45;
  var at = parseFloat(recall(K_AT)) || 0;
  var wanted = recall(K_ON) === '1';

  var audio = new Audio();
  audio.preload = 'none';          // nothing is fetched until it is asked for
  audio.loop = true;
  audio.volume = vol;

  // ── the control ──────────────────────────────────────────────────────────
  var wrap = document.createElement('div');
  wrap.className = 'player';

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'player__btn';
  wrap.appendChild(btn);

  var slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'player__vol';
  slider.min = 0; slider.max = 1; slider.step = 0.01; slider.value = vol;
  slider.setAttribute('aria-label', 'Music volume');
  slider.title = 'Volume';
  wrap.appendChild(slider);

  // The permission to take the song out of the Tavern is offered in the
  // Tavern, which is the only place it makes sense to ask.
  var everyBtn = null;
  if (inTavern) {
    everyBtn = document.createElement('button');
    everyBtn.type = 'button';
    everyBtn.className = 'player__scope';
    wrap.appendChild(everyBtn);
  }

  bar.insertBefore(wrap, toggle);

  function paintScope() {
    if (!everyBtn) return;
    everyBtn.textContent = everywhere ? 'Tavern only' : 'Play everywhere';
    everyBtn.title = everywhere
      ? 'Keep the song to the Tavern'
      : 'Let the song follow you around the House';
    everyBtn.setAttribute('aria-pressed', everywhere ? 'true' : 'false');
    everyBtn.classList.toggle('is-on', everywhere);
  }

  function paint() {
    var on = !audio.paused;
    btn.textContent = on ? '♫' : '♪';
    btn.title = on ? 'Stop the tavern song' : 'Play the tavern song';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    wrap.classList.toggle('is-playing', on);
  }

  function start(explicit) {
    if (!audio.src) audio.src = SRC;
    if (at > 0 && !audio.currentTime) {
      // seeking before any data has loaded throws; wait for metadata
      audio.addEventListener('loadedmetadata', function once() {
        audio.removeEventListener('loadedmetadata', once);
        if (at < audio.duration) audio.currentTime = at;
      });
    }
    var p = audio.play();
    if (p && p.catch) {
      p.catch(function () {
        // Blocked, which is normal before the page has been touched. Say
        // nothing; leave the button ready. Only complain if they asked.
        if (explicit) {
          btn.title = 'Your browser would not play it';
          btn.setAttribute('aria-label', btn.title);
        }
        paint();
      });
    }
  }

  btn.addEventListener('click', function () {
    if (audio.paused) { remember(K_ON, 1); start(true); }
    else { remember(K_ON, 0); audio.pause(); }
  });

  if (everyBtn) {
    everyBtn.addEventListener('click', function () {
      everywhere = !everywhere;
      remember(K_SCOPE, everywhere ? 'everywhere' : 'tavern');
      paintScope();
    });
  }

  slider.addEventListener('input', function () {
    audio.volume = parseFloat(slider.value);
    remember(K_VOL, audio.volume);
  });

  audio.addEventListener('play', paint);
  audio.addEventListener('pause', paint);
  // Keep the place, so the next room carries on rather than starting over.
  audio.addEventListener('timeupdate', function () {
    if (!audio.paused) remember(K_AT, Math.floor(audio.currentTime));
  });
  window.addEventListener('pagehide', function () {
    if (!audio.paused) remember(K_AT, Math.floor(audio.currentTime));
    audio.pause();
  });

  paint();
  paintScope();
  if (wanted) start(false);
})();

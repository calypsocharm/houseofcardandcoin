/* Turning the site into something that lives on a phone.

   Two jobs. It registers the worker that keeps the House readable when the
   signal goes — which is the whole reason for any of this, since the weekend
   it matters is spent in a park with a festival hanging off one tower.

   And it offers the install rather than waiting to be found. A browser will
   bury "add to home screen" three menus deep and most people never meet it, so
   the House asks once, in its own words, and never mentions it again if the
   answer is no. */
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {
        /* No worker. Everything still works; it simply needs a signal. */
      });
    });
  }

  var K = 'hocc-install-asked';
  var deferred = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    try { if (localStorage.getItem(K)) return; } catch (x) {}
    show();
  });

  function stop() {
    try { localStorage.setItem(K, '1'); } catch (x) {}
    var b = document.querySelector('.installbar');
    if (b) b.remove();
  }

  function show() {
    if (document.querySelector('.installbar')) return;

    var bar = document.createElement('div');
    bar.className = 'installbar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Keep the House on your phone');

    var words = document.createElement('p');
    words.className = 'installbar__say';
    words.innerHTML = '<b>Keep the House on your phone.</b> It opens like an app, ' +
                      'and the camp page and the answers still work when the signal does not.';

    var yes = document.createElement('button');
    yes.className = 'installbar__yes';
    yes.type = 'button';
    yes.textContent = 'Add it';
    yes.addEventListener('click', function () {
      stop();
      if (!deferred) return;
      deferred.prompt();
      deferred = null;
    });

    var no = document.createElement('button');
    no.className = 'installbar__no';
    no.type = 'button';
    no.textContent = 'Not now';
    no.setAttribute('aria-label', 'Do not ask again');
    no.addEventListener('click', stop);

    bar.appendChild(words);
    bar.appendChild(yes);
    bar.appendChild(no);
    document.body.appendChild(bar);
  }

  // Once it is on the home screen there is nothing left to offer.
  window.addEventListener('appinstalled', stop);
})();

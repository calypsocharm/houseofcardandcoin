/* Putting pictures on the wall.

   Choosing them is putting them up. It used to take two steps, choose and
   then press "Put it up", and for a fortnight around the faire not one picture
   arrived: people chose their photos, saw the button still saying "Choose
   pictures", and reasonably concluded it had not worked. On a phone it was
   worse, because Android will quietly close a page while the photo picker is
   open and start it over afterwards, so the choice was gone before there was
   any button to press.

   So now:
     - the moment pictures are chosen (or dragged onto the page from a
       computer) they are shrunk and sent, with a bar showing how far along
     - they go a few at a time, so a big batch off a phone never meets the
       server's size limit in one piece
     - anything that goes wrong is said in words, and the picker is handed
       back so they can simply try again

   Shrinking is still a courtesy rather than a defence. A photo off a modern
   phone is four or five megabytes; redrawn at 1600px it is a few hundred
   kilobytes, which matters on one cell tower at a festival. The server
   re-encodes whatever arrives, and anything this cannot shrink goes as it is.

   Without scripts none of this runs, and the plain form (button and all)
   still works exactly as before. */
(function () {
  var input = document.getElementById('galPhoto');
  var note  = document.getElementById('galNote');
  var lbl   = document.getElementById('galPickLbl');
  var bar   = document.getElementById('galBar');
  var form  = input && input.closest('form');
  if (!input || !form || !note || !lbl || !bar) return;
  if (typeof FormData === 'undefined' || typeof XMLHttpRequest === 'undefined' || typeof Promise === 'undefined') return;

  form.classList.add('galadd--auto');

  var MAX = 1600;          // longest side after shrinking
  var BATCH = 4;           // pictures per request
  var canShrink = !!document.createElement('canvas').toBlob;
  var busy = false;

  function say(text, bad) {
    note.textContent = text;
    note.classList.toggle('galadd__note--bad', !!bad);
  }
  function along(frac) {
    bar.hidden = false;
    bar.firstElementChild.style.width = Math.max(2, Math.round(frac * 100)) + '%';
  }
  function hold(e) { e.preventDefault(); e.returnValue = ''; }

  /* One picture in, one file out: the shrunk version if it came out smaller,
     otherwise the original untouched. It never rejects. */
  function shrink(file) {
    return new Promise(function (done) {
      if (!canShrink || !/^image\//.test(file.type)) return done(file);
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth, h = img.naturalHeight;
        if (w <= MAX && h <= MAX && file.size < 900000) return done(file);
        var scale = Math.min(1, MAX / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width  = Math.round(w * scale);
        c.height = Math.round(h * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (blob) {
          if (!blob || blob.size >= file.size) return done(file);
          try {
            done(new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
          } catch (e) { done(file); }
        }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); done(file); };
      img.src = url;
    });
  }

  function pictures(list) {
    return Array.prototype.filter.call(list || [], function (f) {
      return /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(f.name || '');
    });
  }

  var SIGNED_OUT = 'You have been signed out.';

  /* Back to the start, with a reason, so they can just choose again. Signed
     out gets a way straight back in rather than an instruction, and the
     sign-in returns them here. */
  function giveBack(msg) {
    busy = false;
    window.removeEventListener('beforeunload', hold);
    form.classList.remove('galadd--busy');
    lbl.textContent = 'Choose pictures';
    bar.hidden = true;
    try { input.value = ''; } catch (e) {}
    say(msg, true);
    if (msg === SIGNED_OUT) {
      var a = document.createElement('a');
      a.href = '/members/login?next=/gallery';
      a.className = 'btn btn--gold';
      a.style.marginLeft = '10px';
      a.textContent = 'Sign in and come back';
      note.appendChild(a);
    }
  }

  /* Off to see them: the wall, or the page they were put up from. Whatever
     went up stays up even if a later batch failed, and the wall says both. */
  function arrive(t, msg) {
    if (!t.added) return giveBack(msg || 'None of those were pictures we could read. Try another.');
    window.removeEventListener('beforeunload', hold);
    var back = form.getAttribute('data-back');
    if (back) {
      var at = back.indexOf('#');
      location.href = back.slice(0, at < 0 ? back.length : at) + '?added=' + t.added + (at < 0 ? '' : back.slice(at));
      return;
    }
    var q = ['added=' + t.added];
    if (t.skipped) q.push('skipped=' + t.skipped);
    if (t.full) q.push('full=' + t.full);
    if (msg) q.push('e=' + encodeURIComponent(msg));
    location.href = '/gallery?' + q.join('&');
  }

  function send(files) {
    var batches = [];
    for (var i = 0; i < files.length; i += BATCH) batches.push(files.slice(i, i + BATCH));
    var total = files.reduce(function (n, f) { return n + f.size; }, 0) || 1;
    var sent = 0;
    var tally = { added: 0, skipped: 0, full: 0 };
    var caption = (form.querySelector('[name=caption]') || {}).value || '';
    var many = files.length > 1;

    (function next(b) {
      if (b >= batches.length) return arrive(tally);
      var these = batches[b];
      var size = these.reduce(function (n, f) { return n + f.size; }, 0);
      var fd = new FormData();
      fd.append('caption', caption);
      these.forEach(function (f) { fd.append('photo', f, f.name || 'photo.jpg'); });

      var x = new XMLHttpRequest();
      x.open('POST', form.getAttribute('action') || '/gallery/add');
      x.setRequestHeader('X-Gallery', '1');
      x.timeout = 300000;
      x.upload.onprogress = function (e) {
        if (!e.lengthComputable) return;
        var frac = (sent + size * (e.loaded / e.total)) / total;
        along(0.15 + 0.85 * frac);
        lbl.textContent = 'Sending' + (many ? ' ' + files.length : '') + '… ' + Math.round(frac * 100) + '%';
      };
      x.onload = function () {
        var r = null;
        try { r = JSON.parse(x.responseText); } catch (e) {}
        if (x.status === 413) return arrive(tally, 'Those were too big to send in one go. Try fewer at a time.');
        if (!r) {
          // Not an answer from the wall: most often a signed-out session that
          // was sent off to the sign-in page instead.
          return arrive(tally, /sign in|claim a seat/i.test(x.responseText || '')
            ? SIGNED_OUT
            : 'The House could not take them just now. Try again in a moment.');
        }
        tally.added += r.added || 0;
        tally.skipped += r.skipped || 0;
        tally.full += r.full || 0;
        sent += size;
        // A full wall is the end of it. An unreadable batch is not: carry on.
        if (r.e && r.full) return arrive(tally, r.e);
        next(b + 1);
      };
      x.onerror = x.ontimeout = function () {
        arrive(tally, 'The signal dropped before ' + (tally.added ? 'all of them' : 'they') +
          ' got there. Try again when the connection is better.');
      };
      x.send(fd);
    })(0);
  }

  function go(list) {
    if (busy) return;
    var picked = pictures(list);
    if (!picked.length) return say('Those were not pictures. Choose photos, like JPGs from your phone.', true);
    busy = true;
    window.addEventListener('beforeunload', hold);
    form.classList.add('galadd--busy');
    lbl.textContent = 'Getting ready…';
    along(0);

    var ready = [], n = picked.length;
    /* One after another: twenty photographs decoded into canvases at once is
       how a phone browser runs out of memory and drops the lot. */
    (function step(k) {
      if (k >= n) {
        say(n === 1 ? 'Sending your picture to the wall…' : 'Sending ' + n + ' pictures to the wall…');
        return send(ready);
      }
      say(n === 1 ? 'Getting your picture ready…' : 'Getting them ready: ' + (k + 1) + ' of ' + n + '…');
      shrink(picked[k]).then(function (f) {
        ready.push(f);
        along(0.15 * (k + 1) / n);
        step(k + 1);
      });
    })(0);
  }

  input.addEventListener('change', function () { go(input.files); });

  // Enter in the caption box, or a press of the hidden button: open the picker.
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;
    if (input.files && input.files.length) go(input.files);
    else input.click();
  });

  /* Pictures dragged onto the page from a computer. Without this, dropping a
     photo anywhere but the little picker makes the browser open the photo
     itself and leave the site, which looks exactly like "it did not work". */
  var veil = document.createElement('div');
  veil.className = 'galdrop';
  veil.setAttribute('aria-hidden', 'true');
  veil.innerHTML = '<b>Drop to put them up</b>';
  document.body.appendChild(veil);
  var depth = 0;
  function carriesFiles(e) {
    var t = e.dataTransfer && e.dataTransfer.types;
    return !!t && Array.prototype.indexOf.call(t, 'Files') > -1;
  }
  window.addEventListener('dragenter', function (e) {
    if (!carriesFiles(e)) return;
    e.preventDefault(); depth++; veil.classList.add('is-on');
  });
  window.addEventListener('dragover', function (e) {
    if (!carriesFiles(e)) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
  });
  window.addEventListener('dragleave', function (e) {
    if (!carriesFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (!depth) veil.classList.remove('is-on');
  });
  window.addEventListener('drop', function (e) {
    if (!carriesFiles(e)) return;
    e.preventDefault(); depth = 0; veil.classList.remove('is-on');
    go(e.dataTransfer.files);
  });
})();

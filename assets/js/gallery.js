/* Shrinking pictures before they leave the phone.

   A photograph off a modern phone is four or five megabytes. The server
   resizes it anyway, but only after the whole thing has been carried up a
   camping-ground signal — which is slow, and on a metered plan it is somebody
   else's money. This redraws each one at 1600px in the browser first, so what
   goes up is a few hundred kilobytes.

   The server still re-encodes whatever arrives: this is a courtesy, not a
   defence. If any of it is unsupported the original file is sent untouched and
   nothing is lost.

   It handles the whole selection now, not just the first file. That matters
   more than it sounds: the form takes up to twenty at once, and the old
   version rebuilt the file list from the one picture it had shrunk — so
   choosing twelve would have quietly sent one. */
(function () {
  var input = document.getElementById('galPhoto');
  var note  = document.getElementById('galNote');
  var form  = input && input.closest('form');
  if (!input || !form) return;
  if (typeof DataTransfer === 'undefined' || !document.createElement('canvas').toBlob) return;

  var MAX = 1600;
  var busy = false;

  function pretty(bytes) {
    return bytes >= 1048576
      ? (bytes / 1048576).toFixed(1) + ' MB'
      : Math.round(bytes / 1024) + ' KB';
  }

  /* One picture in, one file out — the shrunk version if it came out smaller,
     otherwise the original untouched. It never rejects: a file it cannot read
     is handed back as it arrived and the server deals with it. */
  function shrink(file) {
    return new Promise(function (done) {
      if (!/^image\//.test(file.type)) return done(file);
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
          // If the redraw came out bigger — a small PNG of flat colour can —
          // keep the original rather than making things worse.
          if (!blob || blob.size >= file.size) return done(file);
          try {
            done(new File([blob],
              (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg',
              { type: 'image/jpeg' }));
          } catch (e) { done(file); }
        }, 'image/jpeg', 0.82);
      };

      img.onerror = function () { URL.revokeObjectURL(url); done(file); };
      img.src = url;
    });
  }

  input.addEventListener('change', function () {
    var picked = Array.prototype.slice.call(input.files || []);
    if (!picked.length) return;

    var wasBytes = picked.reduce(function (n, f) { return n + f.size; }, 0);
    var out = [];

    /* One after another rather than all at once. Twenty photographs decoded
       into canvases at the same moment is how a phone browser runs out of
       memory and drops the lot. */
    function step(n) {
      if (n >= picked.length) return finish();
      if (note) {
        note.textContent = picked.length === 1
          ? 'Looking at ' + picked[0].name + '…'
          : 'Getting them ready — ' + (n + 1) + ' of ' + picked.length + '…';
      }
      shrink(picked[n]).then(function (f) { out.push(f); step(n + 1); });
    }

    function finish() {
      var nowBytes = out.reduce(function (n, f) { return n + f.size; }, 0);
      try {
        var dt = new DataTransfer();
        out.forEach(function (f) { dt.items.add(f); });
        input.files = dt.files;
      } catch (e) { /* the originals are still on the input; nothing is lost */ }

      if (!note) return;
      var many = out.length > 1;
      var what = many ? out.length + ' pictures' : (picked[0].name || 'that picture');
      note.textContent = nowBytes < wasBytes
        ? what + ' — ' + pretty(wasBytes) + ' shrunk to ' + pretty(nowBytes) + '.'
        : what + ' — ' + pretty(wasBytes) + ', small enough as they are.';
    }

    step(0);
  });

  // Stop a double press while a batch is still on its way up.
  form.addEventListener('submit', function () {
    if (busy) return;
    busy = true;
    var b = form.querySelector('button[type=submit]');
    if (b) {
      var n = (input.files || []).length;
      b.disabled = true;
      b.textContent = n > 1 ? 'Sending ' + n + '…' : 'Sending…';
    }
  });
})();

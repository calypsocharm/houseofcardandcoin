/* Shrinking a picture before it leaves the phone.

   A photograph off a modern phone is four or five megabytes. The server
   resizes it anyway, but only after the whole thing has been carried up a
   camping-ground signal — which is slow, and on a metered plan it is somebody
   else's money. This redraws it at 1600px in the browser first, so what goes
   up is a few hundred kilobytes.

   The server still re-encodes whatever arrives: this is a courtesy, not a
   defence. If any of it is unsupported the original file is sent untouched and
   nothing is lost. */
(function () {
  var input = document.getElementById('galPhoto');
  var note  = document.getElementById('galNote');
  var form  = input && input.closest('form');
  if (!input || !form) return;
  if (typeof DataTransfer === 'undefined' || !document.createElement('canvas').toBlob) return;

  var MAX = 1600;
  var busy = false;

  function pretty(bytes) {
    return bytes > 900000
      ? (bytes / 1048576).toFixed(1) + ' MB'
      : Math.round(bytes / 1024) + ' KB';
  }

  input.addEventListener('change', function () {
    var file = input.files && input.files[0];
    if (!file || !/^image\//.test(file.type)) return;
    if (note) note.textContent = 'Looking at ' + file.name + '…';

    var url = URL.createObjectURL(file);
    var img = new Image();

    img.onload = function () {
      URL.revokeObjectURL(url);
      var w = img.naturalWidth, h = img.naturalHeight;
      if (w <= MAX && h <= MAX && file.size < 900000) {
        if (note) note.textContent = file.name + ' — ' + pretty(file.size) + ', small enough as it is.';
        return;
      }
      var scale = Math.min(1, MAX / Math.max(w, h));
      var c = document.createElement('canvas');
      c.width  = Math.round(w * scale);
      c.height = Math.round(h * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);

      c.toBlob(function (blob) {
        // If the redraw came out bigger — a small PNG of flat colour can —
        // keep the original rather than making things worse.
        if (!blob || blob.size >= file.size) {
          if (note) note.textContent = file.name + ' — ' + pretty(file.size) + '.';
          return;
        }
        try {
          var dt = new DataTransfer();
          dt.items.add(new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
          input.files = dt.files;
          if (note) note.textContent = file.name + ' — ' + pretty(file.size) + ' shrunk to ' + pretty(blob.size) + '.';
        } catch (e) {
          if (note) note.textContent = file.name + ' — ' + pretty(file.size) + '.';
        }
      }, 'image/jpeg', 0.82);
    };

    img.onerror = function () {
      URL.revokeObjectURL(url);
      if (note) note.textContent = 'That did not look like a picture.';
    };

    img.src = url;
  });

  // Stop a double press while a large photo is still on its way up.
  form.addEventListener('submit', function () {
    if (busy) return;
    busy = true;
    var b = form.querySelector('button[type=submit]');
    if (b) { b.disabled = true; b.textContent = 'Sending…'; }
  });
})();

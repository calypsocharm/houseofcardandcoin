/* Avatar cropper for the Guild Hall profile.
   Shows exactly what the round avatar will look like before you commit, with a
   zoom slider and drag-to-move. On submit the framed 512x512 crop replaces the
   chosen file, so what you saw is what gets stored.
   If anything here is unsupported the original file submits untouched and the
   server still resizes it — you just lose the preview. */
(function () {
  var root = document.getElementById('cropper');
  if (!root) return;

  var canvas  = document.getElementById('cropCanvas');
  var input   = document.getElementById('avatarInput');
  var zoom    = document.getElementById('cropZoom');
  var hint    = document.getElementById('cropHint');
  var reset   = document.getElementById('cropReset');
  var form    = root.closest('form');
  if (!canvas || !input || !form) return;

  var ctx = canvas.getContext('2d');
  var SIZE = canvas.clientWidth || 180;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = SIZE * dpr;
  canvas.height = SIZE * dpr;
  ctx.scale(dpr, dpr);

  var img = null;      // the chosen Image
  var base = 1;        // scale that makes the image cover the circle
  var zoomVal = 1;
  var ox = 0, oy = 0;  // pan offset, in display px
  var dragging = false, lastX = 0, lastY = 0;
  var dirty = false;   // has the framing been changed since the page loaded?

  function clampPan() {
    // never let the image pull away from the edge of the circle
    var w = img.naturalWidth * base * zoomVal;
    var h = img.naturalHeight * base * zoomVal;
    var maxX = Math.max(0, (w - SIZE) / 2);
    var maxY = Math.max(0, (h - SIZE) / 2);
    ox = Math.max(-maxX, Math.min(maxX, ox));
    oy = Math.max(-maxY, Math.min(maxY, oy));
  }

  function paint() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    if (!img) return;
    clampPan();
    var w = img.naturalWidth * base * zoomVal;
    var h = img.naturalHeight * base * zoomVal;
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, (SIZE - w) / 2 + ox, (SIZE - h) / 2 + oy, w, h);
    ctx.restore();
  }

  function load(src, fromPicker) {
    var im = new Image();
    im.onload = function () {
      img = im;
      base = Math.max(SIZE / im.naturalWidth, SIZE / im.naturalHeight); // cover
      zoomVal = 1; ox = 0; oy = 0;
      if (zoom) { zoom.value = '1'; zoom.disabled = false; }
      if (reset) reset.disabled = false;
      root.classList.add('has-img');
      if (fromPicker) dirty = true;
      if (hint) hint.textContent = 'Drag to move it. Use the slider to zoom.';
      paint();
    };
    im.onerror = function () {
      if (hint) hint.textContent = "That file could not be read as an image.";
    };
    im.src = src;
  }

  // existing avatar, so the circle is never empty
  var current = root.getAttribute('data-current');
  if (current) load(current);

  input.addEventListener('change', function () {
    var f = input.files && input.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) {
      if (hint) hint.textContent = 'Pick an image file — jpg, png or webp.';
      return;
    }
    var fr = new FileReader();
    fr.onload = function (e) { load(e.target.result, true); };
    fr.readAsDataURL(f);
  });

  if (zoom) zoom.addEventListener('input', function () {
    zoomVal = parseFloat(zoom.value) || 1;
    dirty = true;
    paint();
  });

  if (reset) reset.addEventListener('click', function () {
    zoomVal = 1; ox = 0; oy = 0;
    if (zoom) zoom.value = '1';
    dirty = true;
    paint();
  });

  // drag to move
  canvas.addEventListener('pointerdown', function (e) {
    if (!img) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    ox += e.clientX - lastX; oy += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    dirty = true;
    paint();
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    canvas.addEventListener(ev, function () { dragging = false; });
  });

  // wheel to zoom, when the pointer is over the circle
  canvas.addEventListener('wheel', function (e) {
    if (!img) return;
    e.preventDefault();
    zoomVal = Math.max(1, Math.min(3, zoomVal + (e.deltaY < 0 ? 0.08 : -0.08)));
    if (zoom) zoom.value = String(zoomVal);
    dirty = true;
    paint();
  }, { passive: false });

  // On submit, hand over the exact crop that was on screen.
  var submitting = false;
  form.addEventListener('submit', function (e) {
    // Save the crop whenever the framing was touched — including when the
    // picture is the avatar you already had. Requiring a newly chosen file
    // meant zooming your existing avatar silently saved nothing.
    if (submitting || !img || !dirty) return;
    if (typeof DataTransfer === 'undefined' || !canvas.toBlob) return;  // let the raw file go

    e.preventDefault();
    var OUT = 512;
    var out = document.createElement('canvas');
    out.width = OUT; out.height = OUT;
    var octx = out.getContext('2d');
    var k = OUT / SIZE;
    var w = img.naturalWidth * base * zoomVal * k;
    var h = img.naturalHeight * base * zoomVal * k;
    octx.save();
    octx.beginPath();
    octx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
    octx.clip();
    octx.drawImage(img, (OUT - w) / 2 + ox * k, (OUT - h) / 2 + oy * k, w, h);
    octx.restore();

    out.toBlob(function (blob) {
      if (blob) {
        try {
          var dt = new DataTransfer();
          dt.items.add(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
          input.files = dt.files;
        } catch (err) { /* fall through with the original file */ }
      }
      submitting = true;
      form.submit();
    }, 'image/jpeg', 0.9);
  });
})();

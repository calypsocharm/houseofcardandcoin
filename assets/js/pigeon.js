/* Sending a pigeon should look like sending a pigeon.

   The form posts to the server and comes back with ?sent=1, which is fine and
   invisible. This puts the moment in between on the screen: the bird lifts off
   the page, climbs, and is gone — then the form goes through as it always did.

   Progressive enhancement throughout. With scripting off, or with the flight
   skipped for anyone who has asked for less motion, the form submits exactly
   as before and the plain confirmation still appears. Nothing here is load
   bearing; it is a second and a half of theatre in front of a normal POST.

   The bird is drawn rather than fetched — an image would be another request
   for something on screen for a second. */
(function () {
  var form = document.querySelector('form[action="/pigeon"]');
  var slot = document.getElementById('pigeon-msg');
  if (!form) return;

  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  // Drawn in profile, facing right, on a 100 x 72 field. Paint order is the
  // order a bird occludes itself: far wing behind, then tail and body, then
  // head and beak, then the near wing crossing in front.
  var BIRD =
    '<svg class="fly__bird" viewBox="0 0 100 72" aria-hidden="true">' +
      '<path class="fly__wing fly__wing--far" d="M48 32 C42 18, 28 8, 12 11 C21 23, 34 32, 46 38 Z"/>' +
      '<path class="fly__tail" d="M20 42 C12 38, 5 40, 0 46 C8 49, 15 47, 22 45 Z"/>' +
      '<path class="fly__body" d="M20 42 C25 27, 46 20, 65 24 C76 27, 78 35, 69 41 C56 49, 32 51, 20 42 Z"/>' +
      '<circle class="fly__head" cx="70" cy="27" r="9"/>' +
      '<path class="fly__beak" d="M78 25 L92 29 L78 32 Z"/>' +
      '<circle class="fly__eye" cx="73" cy="24" r="1.7"/>' +
      '<path class="fly__wing fly__wing--near" d="M50 31 C46 15, 34 3, 17 4 C24 18, 38 29, 48 37 Z"/>' +
    '</svg>';

  /* ── the confirmation, once the bird is away ──────────────────────────── */
  var q = new URLSearchParams(location.search);

  /* The headwind. This used to live in an inline script that I replaced with
     this file, and dropping it would have meant a failed send saying nothing
     at all — the worst possible outcome for a contact form. */
  if (slot && q.get('e') === '1') {
    slot.innerHTML =
      '<div class="alert alert--bad">The pigeon hit a headwind and turned back. ' +
      'Please try again, or email ' +
      '<a href="mailto:houseofcardandcoin@gmail.com">houseofcardandcoin@gmail.com</a>.</div>';
  }

  if (slot && q.get('sent') === '1') {
    slot.innerHTML =
      '<div class="wing">' + BIRD +
        '<p class="wing__say">Your message is on the wing.</p>' +
        '<p class="wing__note">The House will answer in due course.</p>' +
      '</div>';
    slot.querySelector('.fly__bird').classList.add('is-away');
  }

  /* ── the departure ─────────────────────────────────────────────────────── */
  if (calm) return;            // no flight for anyone who asked for stillness

  var sending = false;
  form.addEventListener('submit', function (e) {
    if (sending) return;       // the real submit, let it through
    if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;
    e.preventDefault();
    sending = true;

    var stage = document.createElement('div');
    stage.className = 'fly';
    stage.setAttribute('aria-hidden', 'true');
    /* The wake. Sparkles are placed along the line the bird actually
       travels — up and to the right — and lit in turn as it passes, so they
       read as something it left behind rather than decoration sprinkled on
       the screen. The swoosh is one streak drawn along the same line. */
    var SPARKS = 9;
    var wake = '<span class="fly__swoosh"></span>';
    for (var n = 0; n < SPARKS; n++) {
      var t = 0.12 + (n / SPARKS) * 0.8;          // how far along the path
      var x = t * 46, y = t * -88;                 // matches the flyOff keyframes
      var drift = (n % 3 - 1) * 3;                 // a little scatter off the line
      wake += '<i class="fly__spark" style="' +
                'transform:translate3d(calc(' + (x + drift) + 'vw),calc(' + y + 'vh),0);' +
                'animation-delay:' + (t * 1.05).toFixed(2) + 's' +
              '"></i>';
    }
    stage.innerHTML = BIRD + '<span class="fly__puff"></span>' + wake;
    document.body.appendChild(stage);

    // Off it goes. The timer is the backstop — if the animation never fires
    // (a background tab, say) the form still submits.
    setTimeout(function () { form.submit(); }, 1250);
  });
})();

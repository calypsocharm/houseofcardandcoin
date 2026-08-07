/* Days until the gates open, for the static pages.
   index.html and friends are built by build.js and have no server rendering,
   so the count is worked out in the browser. The tavern does the same sum
   server-side in countdown(); keep the date here in step with that one.
   Gates open 10:00, Friday 9 October 2026; the faire ends 22:00 on the 11th. */
(function () {
  var slot = document.getElementById('gatesCountdown');
  if (!slot) return;

  var open  = new Date(2026, 9, 9, 10, 0, 0);   // month is 0-based: 9 = October
  var close = new Date(2026, 9, 11, 22, 0, 0);
  var now   = new Date();

  var text;
  if (now >= close) {
    text = 'The faire has ended — until next year';
  } else if (now >= open) {
    text = 'The gates are open';
  } else {
    var days = Math.ceil((open - now) / 86400000);
    text = days === 1
      ? '<b>1</b> day until the gates open'
      : '<b>' + days + '</b> days until the gates open';
  }
  slot.innerHTML = text;
  slot.hidden = false;
})();

/* Days until the gates open, for the static pages.
   index.html and friends have no server rendering, so the count is worked out
   in the browser. The tavern does the same sum server-side in countdown();
   keep the two in step.

   The gates open 10:00 Friday 9 October 2026 and the faire ends 22:00 on the
   11th — Las Vegas time, which in October is PDT, seven hours behind UTC. That
   is written here as an absolute instant rather than as "10 o'clock wherever
   you happen to be": the old version used local time, so the VPS (which keeps
   Mountain time) counted to an hour earlier than the faire actually opens, and
   a guildmate reading from another state would have got a different number
   again.

   Counting down whole days that have not yet elapsed, so this reads the same
   as the festival's own clock. It used to round up, which showed 62 where
   theirs showed 61 days and 23 hours. */
(function () {
  var slot = document.getElementById('gatesCountdown');
  if (!slot) return;

  var open  = new Date(Date.UTC(2026, 9, 9, 17, 0, 0));   // 10:00 PDT
  var close = new Date(Date.UTC(2026, 9, 12, 5, 0, 0));   // 22:00 PDT on the 11th
  var now   = new Date();

  var text;
  if (now >= close) {
    text = 'The faire has ended — until next year';
  } else if (now >= open) {
    text = 'The gates are open';
  } else {
    var days = Math.floor((open - now) / 86400000);
    text = days === 0
      ? 'The gates open tomorrow'
      : days === 1
        ? '<b>1</b> day until the gates open'
        : '<b>' + days + '</b> days until the gates open';
  }
  slot.innerHTML = text;
  slot.hidden = false;
})();

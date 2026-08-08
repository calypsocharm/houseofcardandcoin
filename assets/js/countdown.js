/* The clock until the gates open.

   The gates open 10:00 Friday 9 October 2026 and the faire ends 17:00 on the
   11th — Las Vegas time, which in October is PDT, seven hours behind UTC. That
   is written as an absolute instant rather than "10 o'clock wherever this
   happens to be running": the old version used local time, so the VPS (which
   keeps Mountain time) counted to an hour before the gates actually open, and a
   guildmate reading from another state got a different number again.

   Days, hours, minutes and seconds, ticking, to read the same as the festival's
   own counter at lvrenfair.com. It used to show whole days rounded up, which
   put 62 against their 61 days and 23 hours.

   Fills both the chip on the built pages and the line in the tavern strip. The
   tavern's is rendered by the server first so it says something sensible before
   this runs, or if it never does. */
(function () {
  var open  = new Date(Date.UTC(2026, 9, 9, 17, 0, 0));   // 10:00 PDT
  var close = new Date(Date.UTC(2026, 9, 12, 0, 0, 0));   // 17:00 PDT on the 11th

  var slots = [];
  var chip = document.getElementById('gatesCountdown');
  if (chip) slots.push(chip);
  Array.prototype.forEach.call(document.querySelectorAll('.tav-gates'), function (n) { slots.push(n); });
  if (!slots.length) return;

  function part(n, word) {
    return '<b>' + n + '</b> ' + word + (n === 1 ? '' : 's');
  }

  /* A word that changes as the date comes on, so the countdown says something
     at the moments worth marking rather than only ever counting down. Filled
     into any [data-gates-note]; pages without one are unaffected. */
  var notes = document.querySelectorAll("[data-gates-note]");
  function milestone(d) {
    if (d > 30) return "";
    if (d > 14) return "Under a month. Time to think about garb.";
    if (d > 7)  return "A fortnight out. Claim a bunk before they go.";
    if (d > 3)  return "A week to go. Check your kit and your hand.";
    if (d > 1)  return "Days away now. Pack the small logs.";
    if (d === 1) return "Tomorrow. The fire is nearly lit.";
    return "Today. See you at the gates.";
  }

  function tick() {
    var now = new Date();
    var text;

    if (now >= close) {
      text = 'The faire has ended — until next year';
    } else if (now >= open) {
      text = '<b>The gates are open.</b>';
    } else {
      var ms = open - now;
      var d = Math.floor(ms / 86400000); ms -= d * 86400000;
      var h = Math.floor(ms / 3600000);  ms -= h * 3600000;
      var m = Math.floor(ms / 60000);    ms -= m * 60000;
      var s = Math.floor(ms / 1000);
      text = part(d, 'Day') + ' ' + part(h, 'Hour') + ' ' +
             part(m, 'Minute') + ' ' + part(s, 'Second');
    }

    slots.forEach(function (el) {
      el.innerHTML = text;
      el.hidden = false;
    });

    if (notes.length) {
      var say = (now >= close) ? "" : (now >= open) ? "The gates are open."
              : milestone(Math.floor((open - now) / 86400000));
      Array.prototype.forEach.call(notes, function (n) {
        n.textContent = say;
        n.hidden = !say;
      });
    }
  }

  tick();
  setInterval(tick, 1000);
})();

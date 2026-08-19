/* The forecast for the three faire days, filled in wherever a page asks for it.

   The camp page carries twenty-six years of history: that weekend has run 78°F
   to 97°F, and one year it rained on the Friday. That is the right thing to say
   in August. It is the wrong thing to say on the 6th of October, when there is
   a real forecast and everybody is deciding what to pack.

   So the history stays exactly where it is and this appears above it, but only
   once there is something true to put there — the source looks sixteen days
   ahead, so nothing shows until late September. Nothing appears if the source
   cannot be reached either. A page that draws an empty box labelled "forecast"
   is worse than a page that never mentions one. */
(function () {
  var slot = document.querySelector('[data-forecast]');
  if (!slot) return;

  function dayName(iso) {
    // Built from the parts rather than parsed, so the browser's own timezone
    // cannot slide the date to the evening before.
    var p = iso.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  }

  fetch('/api/weather')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (w) {
      if (!w || !w.inRange || !w.days.length) return;   // nothing true to say yet

      var hottest = w.days.reduce(function (a, b) { return b.high > a.high ? b : a; });
      var wettest = w.days.reduce(function (a, b) {
        return (b.rain || 0) > (a.rain || 0) ? b : a;
      });

      var h = '<p class="fc__lede"><b>The forecast for the weekend</b>'
            + '<span class="fc__note">updated a few times a day</span></p>'
            + '<ul class="fc__days">';

      w.days.forEach(function (d) {
        h += '<li class="fc__day">'
           + '<span class="fc__when">' + dayName(d.date) + '</span>'
           + '<span class="fc__temp"><b>' + d.high + '&deg;</b>'
           + '<small>' + d.low + '&deg; overnight</small></span>'
           + '<span class="fc__sky">' + (d.sky || '')
           + (d.rain != null && d.rain >= 20
               ? '<b class="fc__rain">' + d.rain + '% rain</b>' : '')
           + '</span></li>';
      });
      h += '</ul>';

      /* One line of advice, drawn from the numbers rather than written in
         advance, because "bring shade" and "bring a coat" are different
         weekends and the page should say which one is coming. */
      var says = [];
      if (hottest.high >= 90) {
        says.push('<b>' + hottest.high + '&deg; on the ' + dayName(hottest.date)
          + '</b> — that is a shade-and-water weekend, and the asphalt will read hotter still.');
      } else if (hottest.high >= 80) {
        says.push('Warm rather than punishing, but our spot is pavement, so bring the shade anyway.');
      } else {
        says.push('Milder than that weekend usually runs — bring something warm for after dark.');
      }
      if (wettest.rain != null && wettest.rain >= 30) {
        says.push('Rain is a real possibility on the ' + dayName(wettest.date)
          + ' (' + wettest.rain + '%). Something waterproof over the tent, and over you.');
      }
      h += '<p class="fc__says">' + says.join(' ') + '</p>';

      slot.innerHTML = h;
      slot.hidden = false;
    })
    .catch(function () { /* no forecast; the history below stands on its own */ });
})();

# 20 things between here and an amazing experience

Updated 2026-08-07, **63 days before the gates open**. This replaces the
earlier 30 — same thinking, cut to what actually matters, with the items
already done removed.

✅ **verified** means I checked it against the live site today. The rest are
judgement calls.

The deadline shapes the order. Anything that helps someone *get to the faire*
or *arrive prepared* beats anything that polishes the site, because after
11 October it stops mattering until next year.

---

## Getting people there (the whole point)

**1. Nobody can reset their own password.** ✅ verified — there is no "forgot
password" anywhere, and only the Guild Elder can reset one. Someone locked out
the night before the faire stays locked out until you answer. This is the
quietest way a person gives up.

**2. The site cannot send email at all.** No welcome, no reset, no reminder.
Formspree forwards the contact form and nothing else. Items 1, 3 and 4 all
depend on this — Resend is free to 3,000/month, needs an API key and one DNS
record.

**3. Nothing tells a Pledge they were accepted.** You promote them and they
find out only if they happen to visit again. That is the moment someone feels
they've joined something, and it currently passes in silence.

**4. No reminder as the faire nears.** Sixty-three days is a long time to
remember something you signed up for in August. A month out, a week out, and
the night before with what to bring — that does more for turnout than any
feature here.

**5. The dinner show has no time on the site.** ✅ verified — `camp.html` says
"Saturday evening", the Scroll of Events lists an evening Guild Dinner, and no
clock time appears anywhere. If you give away tickets, people need to know when
to be there.

**6. No map or directions.** Sunset Park is named and the address is in the
footer. No map link, no parking guidance, nothing about where you actually walk
in. First-timers need this most and have it least.

**7. No packing list for individuals.** The bring-list covers communal camp
kit. Nothing tells a newcomer to bring a chair, water, sunscreen and something
warm — which Lady Liz ends up explaining in the tavern every time.

**8. No calendar export.** ✅ verified — no `.ics` anywhere. One "add to
calendar" button puts the weekend in someone's phone, where it reminds them
for you.

**9. Carpooling has a tag but no structure.** "Rides & Lodging" is a tavern
category. Who has seats, who needs one, leaving from where — a small form, and
for some people it decides whether they come at all.

**10. Phone numbers are barely captured.** Contact details are optional, so the
new "who is bringing what" admin table often shows a dash where a contact
should be. Ask when someone claims an item or RSVPs — at the moment they are
committing to something.

---

## Not losing things

**11. No rate limiting on sign-in.** ✅ verified — passwords can be guessed as
fast as a script can post them. Ten minutes of work.

**12. No CSRF protection** on login, registration or posting. Low likelihood at
this size, real all the same.

**13. Backups sit on the server they protect.** The nightly tarball of member
data lives in `/var/www/hocc-backups`. Lose the VPS, lose the backups too. They
should copy somewhere else — even to your own machine on a schedule.

**14. The 404 page is a raw error.** ✅ verified — a wrong URL returns Express's
default `Cannot GET /whatever` on a white page with no way back.

---

## The tavern, once people are in it

**15. Coins still buy nothing.** They accumulate, they earn titles, and there
is nowhere to spend them. The poker hand gave the *cards* a destination; the
coins still need one.

**16. Nobody can edit or delete their own post.** Only the leader can strike
anything, so a typo is permanent unless someone asks you.

**17. No notification when someone whispers you.** You would only find out by
opening the page, which kills the feature.

**18. Bunks can be hoarded.** The code stops you taking two bunks *on the same
night*, but one person can hold all three nights while others wait. Nine beds,
a growing roster — that is the October argument.

---

## Speed and feel

**19. The homepage loads 4.2 MB of video.** Two autoplaying mp4s. On
faire-ground cell service that is the difference between a page that loads and
one that doesn't — and the faire is exactly when people pull it up on a phone.

**20. The room is still drawn with CSS.** The card backs are now your own
damask and the difference is obvious. The tavern itself — timber, firelight,
the figures — is still gradients pretending. A collaged tavern interior and a
deck of your own card faces would carry the whole page, and it is the one thing
on this list only you can do.

---

## Worth knowing, didn't make the twenty

**Analytics.** ✅ verified — none at all. You have no idea how many people
visit or where they give up, so every decision here is made blind.

**`style.css` is 93% duplicate text** — the base stylesheet appears sixteen
times in one file. gzip hides the cost on the wire; it is still the wrong file.

**The tavern has no pagination or search.** Fine at four threads. Not fine at
two hundred, which is plausible by October.

---

## If you only do four

1. **Email + password reset** (1, 2) — the lockout is the silent killer
2. **Tell people they're accepted, then remind them** (3, 4) — turnout
3. **Dinner time, map, packing list** (5, 6, 7) — arriving prepared
4. **Your artwork** (20) — the thing that makes it unmistakably the House

Everything else can wait until after 11 October.

# 30 things between here and an amazing experience

Written 2026-08-07, **63 days before the gates open**. Ordered by what actually
moves the needle, not by effort. Everything marked ✅ **verified** was checked
against the live site today; the rest are judgement calls.

The deadline shapes this list. Anything that helps people *get to the faire* or
*show up prepared* is worth more than anything that polishes the site itself,
because after 11 October it stops mattering until next year.

---

## The ones that cost you people right now

**1. Nobody can reset their own password.** ✅ verified — there is no "forgot
password" anywhere, and only the Guild Elder can reset one. A guildmate who
forgets theirs at 11pm the night before the faire is simply locked out until
you answer. This is the single most likely way someone silently gives up.

**2. The site cannot send email at all.** No welcome, no "you're accepted into
the House", no password reset, no reminder as the gates approach. Formspree
forwards the contact form and nothing else. Everything below that involves
telling someone something depends on fixing this first — Resend is free to
3,000/month and needs an API key and one DNS record.

**3. Nothing tells a Pledge they were accepted.** You promote them in the admin
panel and they find out only if they happen to visit again. That is the moment
someone feels like they've joined something, and it currently passes in silence.

**4. No reminder as the faire nears.** Sixty-three days is a long time to
remember a thing you signed up for in August. Three emails — a month out, a
week out, the night before with what to bring — would do more for turnout than
any feature on this list.

**5. The 404 page is a raw error.** ✅ verified — a wrong URL returns Express's
default `Cannot GET /whatever` on a white page, with no navigation back. Any
mistyped or stale link dead-ends there.

---

## Trust, safety and not losing anything

**6. No rate limiting on sign-in.** ✅ verified — passwords can be guessed as
fast as a script can post. With real accounts and a public member list, that is
worth ten minutes of work.

**7. No CSRF protection** on login, registration, or posting. A malicious page
could act as a signed-in member. Real, though low likelihood at this size.

**8. Backups live on the same server they protect.** The nightly tarball of
member data sits in `/var/www/hocc-backups`. If that VPS is lost, so are the
backups. They should copy somewhere else — even your own machine on a schedule.

**9. `X-Powered-By: Express` is still advertised.** One line to remove.

**10. No audit trail on admin actions.** You can free a bunk, reset a password,
or strike a post, and nothing records who did what. With one leader that's
fine; the moment Caberk gets admin it isn't.

---

## Getting people to the faire prepared

**11. The dinner show has no time on the site.** ✅ verified — `camp.html` says
"Saturday evening" and the Scroll of Events lists an evening Guild Dinner, but
no clock time appears anywhere. If you're giving away tickets, people need to
know when to be there.

**12. No map or directions.** Sunset Park is named, the address appears in the
footer, and there's no map link, no parking guidance, no "where do I actually
walk in". First-timers need this most and have it least.

**13. No packing list for individuals.** The bring-list covers communal camp
kit. Nothing tells a first-timer to bring a chair, water, sunscreen, and
something warm for after dark — which Lady Liz has to explain in the tavern
every time.

**14. No calendar export.** ✅ verified — no `.ics` anywhere. One "add to
calendar" button on the Scroll of Events puts the weekend in someone's phone,
where it will remind them for you.

**15. Carpooling has a category but no structure.** "Rides & Lodging" is a
tavern tag. Who has seats, who needs one, leaving from where — that's a small
form, and it's the thing that decides whether some people come at all.

**16. Nothing captures phone numbers reliably.** Contact details are optional in
the profile, so the new "who is bringing what" admin table often shows a dash
where the contact should be. Ask for a number when someone claims an item, or
when they RSVP — at the moment they're committing to something.

**17. No weather note.** Sunset Park in October swings hot to cold. A line
pulled from a forecast in the last week would be genuinely useful, and is the
kind of small touch that makes a site feel cared for.

**18. Bunks can be hoarded.** The code stops you taking two bunks *on the same
night*, but one person can hold all three nights while others wait. With nine
beds and a growing roster, that is the argument you'll have in October.

---

## The tavern, once people are actually in it

**19. Coins still buy nothing.** They accumulate, they earn titles, and there is
nowhere to spend them. A currency with no sink stops motivating quickly. The
poker hand gave the *cards* a destination; the coins still need one.

**20. Nobody can edit or delete their own post.** Only the leader can strike
anything. A typo is permanent unless they ask you.

**21. No notification when someone whispers you.** Whispers exist, and you'd
only discover one by opening the page. That kills the feature.

**22. No @mentions.** No way to get a specific person's attention in a thread,
which is exactly what camp logistics need.

**23. No photos in the tavern.** For a guild built on costume and craft, being
unable to post a picture of your new doublet is a real miss.

**24. The tavern will not survive success.** Every thread renders on one page
with no pagination and no search. Fine at four threads; unusable at two hundred,
and by October it may well be two hundred.

**25. No sense of who is around.** The room shows recent posters, but there is
no "last seen", no check-in, nothing that says the place is alive when you
arrive at a quiet hour.

---

## Craft and speed

**26. `style.css` is 93% duplicate text.** The base stylesheet appears sixteen
times in one file — 462 KB, of which about 30 KB is unique. gzip hides the cost
on the wire now, but it's still the wrong file and it makes every edit riskier.

**27. The homepage loads 4.2 MB of video.** Two mp4s that autoplay. On faire-
ground cell service that is the difference between a page that loads and one
that doesn't — and the faire is exactly when people will pull it up on a phone.

**28. No analytics of any kind.** ✅ verified — you have no idea how many people
visit, what they look at, or where they give up. You're making decisions blind.
Something light and privacy-respecting would tell you whether any of this works.

**29. Accessibility gaps.** ✅ verified — no skip-to-content link. Alt text and
heading structure are good, but keyboard and screen-reader users hit the full
navigation on every page.

**30. Everything is drawn with CSS.** The tavern room, the fire, the playing
cards. It reads as *stylised*, and it always will. **You make collage tarot
decks.** One painted tavern interior and a deck of your own card faces would do
more for how this feels than the previous twenty-nine items combined — and it's
the one thing on this list only you can do.

---

## If you only do five

1. **Password reset + email** (1, 2) — the lockout is the quiet killer
2. **Tell people they've been accepted** (3) — the moment they feel let in
3. **Reminders as the faire nears** (4) — turnout, which is the actual goal
4. **Dinner show time, map, packing list** (11, 12, 13) — people arriving ready
5. **Your artwork in the tavern** (30) — the thing that makes it yours

Everything else can wait until after 11 October.

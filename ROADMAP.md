# Roadmap

Last true as of **2026-08-08**, 62 days before the gates open.

This file was closed on 2026-08-07 as "nothing outstanding". A second round of
work followed the same day, so it had gone stale — it still listed the
`style.css` duplication as *deliberately not doing* when that had been done.
It is rewritten here to say what is actually true.

---

## Open

Nothing. The 15-item brainstorm of 2026-08-07 is closed — thirteen built, two
struck by her on 2026-08-08 (below).

---

## Done since the file was last closed

Reactions wired to a button · the Scroll of Events' link to itself removed ·
champion tally on the Roll of Hands · marks on the character sheet · the photo
wall · the Tavern warming as October nears · countdown milestones · the
`/weekend` page · "still wanted" instead of "who claimed what" · new-since-you-
last-looked in the Tavern · Tavern search · `style.css` deduped 484 KB → 72 KB ·
an accessibility pass · MySpace-style profile pages with an on-page customiser ·
the tavern entry animation · post editing for seven days · nudge bubbles ·
pledge vouching · the sellsword folded into the four classes · colour, icons and
the map on the weekend page.

---

## Settled, deliberately not doing

**Email of any kind.** No sender was set up, by her choice. The part that
needed automating — telling a Pledge they were accepted — the site handles
itself with an in-page notice and a header badge. Reminders mean messaging ten
people directly, which is fine at this size.

**Packing list, carpool matching, map and directions, calendar export,
analytics, tavern pagination, phone-number capture.** All struck at her call.
They assumed strangers arriving at a large public event. This is ten people in
Las Vegas who know each other and have camped before.

**The dinner show time and the tavern artwork.** Both raised, both declined.
Do not raise them again unasked.

**Nothing on the site about kids or smoking.** Her call, standing.

**Guild tales.** A page for the stories — the year it rained sideways, who did
what. Struck 2026-08-08. It was the one item that needed her to write rather
than me to build, and she does not want it.

**The camp page surviving no signal.** A service worker keeping the gate times
and map readable without reception at Sunset Park. Struck 2026-08-08.

**Rewriting the four specialist cards.** Their copy is the original marketing
voice, now sitting above real names. Raised twice, declined. Leave it.

---

## Rules that are load-bearing

Changing these changes the guild, not just the code.

- **Registration is open.** `GUILD_INVITE_CODE` is blank in production, which
  switches the invite requirement off. Put a value back to turn it on again.
- **Signing up makes you a Pledge**, not a guildmate. The Guild Leader accepts
  by hand from Administration.
- **Vouching is one-way.** A guildmate can vouch for a Pledge's character; the
  Pledge sees only that they were vouched for and by whom, never what was
  written. That was her explicit call — "I don't think it should be shared 3
  ways."
- **Bunks need a faire already camped.** Nine beds across three nights, one bed
  per person per night, first come first served. Acceptance alone does not
  earn one.
- **The four classes are the cast** — Dealer, Reader, Broker, Sellsword. They
  are the specialist cards on the Guild page and the class you pick in your
  tabard; they are the same list in both places, from `CLASSES` in `server.js`.
- **Five-card stud.** One card a night, no trading, and 15 coins buys the next
  one early — capped at four purchases because a hand is five cards.
- **Hands are public** and the deal uses crypto randomness, because people can
  compare them.

---

## Verified 2026-08-08

Crawled every reachable page and asset from the homepage — 50 URLs, no broken
links, nothing missing. `pm2` shows the app online with no unstable restarts;
the error log's last entry is from 2026-08-07 and predates the current build.
Member data, source and build scripts still 404.

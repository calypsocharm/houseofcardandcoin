# Roadmap — closed

Closed 2026-08-07, 63 days before the gates open.

Nothing is outstanding. What follows is a record of what was decided, so a
future session does not reopen questions that were already settled.

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

**`style.css` is 93% duplicate text** — 459 KB raw, 17 KB over the wire once
gzip has it. A tidiness matter, invisible to anyone using the site.

---

## Rules that are load-bearing

Changing these changes the guild, not just the code.

- **Registration is open.** `GUILD_INVITE_CODE` is blank in production, which
  switches the invite requirement off. Put a value back to turn it on again.
- **Signing up makes you a Pledge**, not a guildmate. The Guild Leader accepts
  by hand from Administration.
- **Bunks need a faire already camped.** Nine beds across three nights, one bed
  per person per night, first come first served. Acceptance alone does not
  earn one.
- **Five-card stud.** One card a night, no trading, and 15 coins buys the next
  one early — capped at four purchases because a hand is five cards.
- **Hands are public** and the deal uses crypto randomness, because people can
  compare them.

---

## Verified at close

25 pages and assets return 200. Member data, source, and build scripts all
404. Cross-site POSTs are refused. The 404 is a real page. Four security
headers present. Hero videos load on laptops and never on phones — the
homepage went 4.2 MB to 475 KB, the Scroll of Events 5.3 MB to 2 KB.

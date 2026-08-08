# What's left

Updated 2026-08-07, **63 days before the gates open**.
Nine of the twenty are done. Eleven remain.

---

## ✅ Done

| # | Was | Now |
|---|---|---|
| 1 | Nobody could reset their own password | "Forgotten your password?" on the sign-in card routes to the Carrier Pigeon, which already reaches your inbox. You reset from Administration. No email service needed. |
| 3 | Nothing told a Pledge they were accepted | Promotion writes them a notice; a red **✦ new** badge shows in the header on every page, including static ones. The welcome page tells them in advance that this is how they'll find out. |
| 11 | No rate limiting on sign-in | Five wrong answers from an address in fifteen minutes and it stops listening — including for the right password. |
| 12 | No CSRF protection | Session cookie was already SameSite=lax; added an origin check as a second lock. All 46 forms untouched and verified working. |
| 13 | Backups sat on the server they protect | **Download the roster** in Administration — a dated JSON for your own machine. |
| 14 | Raw `Cannot GET /whatever` | A proper page in the House's voice, with a way back and the countdown. |
| 15 | Coins bought nothing | 15 coins buys your next card early. Bounded at four purchases ever; buys a sooner card, never a better one. |
| 16 | Only the leader could strike a post | You can edit or remove your own posts and replies. Edits carry an "edited" mark. |
| 18 | One person could take all three bunk nights | Your rule: bunks need a faire already camped, one bed per night, first come first served. |

**Item 17 was wrong.** Whispers already notified — the route always called `notify()`. The real gap was that notices were only visible inside the tavern, which the header badge fixed.

---

## Left, and I can just do these

**7. No packing list for individuals.** The bring-list covers communal camp kit. Nothing tells a first-timer to bring a chair, water, sunscreen, something warm.

**8. No calendar export.** One "add to calendar" button puts the weekend in someone's phone, where it reminds them for you.

**9. Carpooling has a tag but no structure.** Who has seats, who needs one, leaving from where.

**10. Phone numbers barely captured.** Contact details are optional, so the admin contact column is often a dash. Ask at the moment someone claims an item or RSVPs.

**19. The homepage loads 4.2 MB of video.** Two autoplaying mp4s. On faire-ground cell service that's the difference between a page that loads and one that doesn't.

**Analytics.** None at all — you have no idea who visits or where they give up.

**`style.css` is 93% duplicate.** The base stylesheet appears sixteen times in one file. gzip hides the cost; it's still the wrong file.

**The tavern has no pagination or search.** Fine at four threads, not at two hundred.

---

## Left, but needs you first

**5. The dinner show has no time on the site.** I can't invent it — you need the actual showtime from the Age of Chivalry organisers. Worth having regardless of the prize, since guildies buying their own passes will look for it.

**6. No map or directions.** I can add a map link and the address, but you know where people actually park and walk in.

**2 + 4. Email, and reminders as the faire nears.** You didn't want the setup, which is fair. Without it, reminders mean you messaging ten people directly. That's genuinely fine at this size — the site now handles "you're accepted" on its own, which was the part that needed automating.

**20. The room is still drawn with CSS.** The card backs are your damask now and the difference is obvious. The tavern itself — timber, firelight, the figures — is still gradients pretending. One collaged interior would carry the whole page.

---

## What I'd do next

1. **Packing list, calendar export, carpool** — the three that get people to the faire prepared, and none need anything from you
2. **Phone numbers at the moment of claiming** — so the admin table you asked for actually has contacts in it
3. **The homepage video** — before October, not after

The rest can wait until after 11 October.

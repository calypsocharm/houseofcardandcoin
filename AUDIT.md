# Site Audit — houseofcardandcoin.com

Audited 2026-08-07 against the live site. Every finding below was verified against
production, not inferred. Pages covered: `index`, `guild`, `sellsword`, `events`,
`camp`, `pigeon`, `board`, `members/login`.

## Health summary

| Check | Result |
| --- | --- |
| All pages reachable | ✅ 8/8 return 200 |
| Broken links / assets | ✅ none (34 unique URLs checked) |
| Console errors | ✅ none |
| `/api/announcements` | ✅ 200, returns `[]` |
| HTTP → HTTPS redirect | ✅ 301 |
| `<html lang>` | ✅ set on every page |
| `alt` text on images | ✅ 100% coverage |
| Heading structure | ✅ exactly one `<h1>` per page |
| Mobile navigation | ❌ **broken on every phone** |
| Social share previews | ❌ broken (relative `og:image`) |
| CSS payload | ❌ 93% duplicated |
| Compression / caching | ❌ absent |

---

## P1 — Mobile navigation is completely unreachable

**The single most serious issue on the site.** On any viewport narrower than
~450px — which is every phone — the site has no working navigation at all.

**Root cause.** The header is a flex row:

```css
.nav          { display:flex; align-items:center; gap:26px; padding:0 28px }
.brand        { display:flex; …; flex-shrink:0 }   /* ← the problem */
.menu-toggle  { display:none; …; margin-left:auto } /* becomes flex on mobile */
```

At 375px the `.nav` content box is 319px wide, but `.brand` is 360px and carries
`flex-shrink:0`, so it refuses to compress. It overflows to x=388, and the
hamburger button — pushed along by `margin-left:auto` — lands at x=414–450,
entirely outside the viewport.

Meanwhile `.nav-links` is `display:none` below 980px. So the links are hidden and
the only control that reveals them is off-screen.

**Measured across widths** (button right edge vs. viewport):

| Viewport | Button right | Off-screen? | Nav links |
| ---: | ---: | :---: | :---: |
| 360px | 450px | ❌ yes | hidden |
| 375px (iPhone SE/13 mini) | 450px | ❌ yes | hidden |
| 390px (iPhone 14/15/16) | 450px | ❌ yes | hidden |
| 414px | 450px | ❌ yes | hidden |
| 430px (16 Pro Max) | 450px | ❌ yes | hidden |
| 480px | 452px | ✅ no | hidden |
| 1024px | — | n/a | ✅ shown |

A hit test at the button's centre point returns *nothing* at all phone widths —
it is not merely clipped, it is unclickable.

**Fix.** Let the brand shrink and drop the tagline on small screens:

```css
@media (max-width: 479px){
  .brand{ flex-shrink:1; min-width:0 }
  .brand small{ display:none }
}
```

**Verified on the live page.** Injecting the above:

- at 430px — brand 360px → 312px, button right 450px → 402px, on-screen, hit test passes
- at 375px — brand → 257px, button right → 347px, hit test passes, and clicking it
  opens the menu (`display:flex`) with all 8 links present

---

## P2 — Social share previews are broken

Every page sets `og:image` / `twitter:image` as a **root-relative path**:

```html
<meta property="og:image" content="/assets/img/og/index.jpg">
```

The Open Graph spec requires an absolute URL. Facebook, Discord, iMessage, and X
will not resolve a relative one, so every link shared anywhere renders with no
image — for a faire guild that recruits by link-sharing, that's a real cost.

The image files themselves are fine (all six return 200). Only the URLs are wrong.

**Fix** — prefix with the origin on all six pages:

```html
<meta property="og:image" content="https://houseofcardandcoin.com/assets/img/og/index.jpg">
```

**Also:** `guild.html` has only `twitter:card` and is missing `twitter:title`,
`twitter:description`, and `twitter:image`. The other five pages have the full set.

**Minor:** `events.jpg` and `camp.jpg` are byte-identical (99,299 b) — likely an
unintended copy/paste.

---

## P3 — `style.css` is 442 KB, and 93% of it is duplicate text

The stylesheet is served at **442,445 bytes** on every page load.

| Measure | Bytes |
| --- | ---: |
| Total | 442,445 |
| Unique | 29,571 |
| **Duplicated** | **412,874 (93%)** |

The entire base stylesheet is repeated **16 times** in the same file — `body`,
`header`, `footer`, the typography block, and a 1,358-character `@media
(max-width:980px)` block each appear 16 times verbatim. This is the signature of
per-page stylesheets concatenated without de-duplication.

Deduplicating alone takes it to ~30 KB — a **15× reduction**, with no visual change.

---

## P4 — No compression, no caching

```
Content-Length: 442445
Cache-Control: public, max-age=0
```

- **No gzip or brotli.** Requesting `style.css` with `Accept-Encoding: gzip, br`
  returns the full 442 KB uncompressed. Enabling gzip in nginx would cut it ~90%
  on its own; combined with P3, 442 KB → roughly 8 KB.
- **`max-age=0` on every static asset** — CSS, images, everything. Nothing is
  cached, so returning visitors and page-to-page navigation re-fetch it all.
  Fingerprinted assets should be `max-age=31536000, immutable`; images at minimum
  a few days.

**Also on payload:** the homepage loads two videos, `vid.mp4` (2.0 MB) and
`vid-space.mp4` (2.2 MB) — **4.2 MB of video**. On faire-ground cell service this
is the difference between a page that loads and one that doesn't. Worth
`preload="none"` with a poster image, or a static hero image below ~768px.

---

## P5 — Missing security headers

The response carries none of the standard headers:

| Header | Status |
| --- | --- |
| `Strict-Transport-Security` | ❌ missing |
| `X-Content-Type-Options` | ❌ missing |
| `X-Frame-Options` | ❌ missing |
| `Referrer-Policy` | ❌ missing |
| `Content-Security-Policy` | ❌ missing |
| `X-Powered-By: Express` | ⚠️ present — should be removed (`app.disable('x-powered-by')`) |

This matters more than usual because the site has real auth (`/members/login`,
`/members/register`) and a public posting surface (`/board`).

Suggested nginx block:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

---

## P6 — Auth form details

On `/members/login`, both forms declare the email field as plain text:

```html
<input type="text" name="email" required>
```

`type="email"` gives phone users the right keyboard and free browser validation.
Neither form sets `autocomplete`, so password managers won't reliably offer to
fill or save — add `autocomplete="email"` and `autocomplete="current-password"`
(`"new-password"` on register).

**To verify with the server source (not visible from outside):** neither POST form
carries a CSRF token. If the server doesn't check `Origin`/`Referer` or use
`SameSite` cookies, login, register, and board posting are open to cross-site
request forgery. Worth confirming once the source is in the repo.

**Working well:** the Carrier Pigeon form has a `_gotcha` honeypot — good,
low-friction spam defence. The register form is invite-gated. The Tavern board
being publicly readable appears intentional ("Anyone can read — to post, claim a
seat").

---

## P7 — SEO gaps

| Item | Status |
| --- | --- |
| `robots.txt` | ❌ 404 |
| `sitemap.xml` | ❌ 404 |
| `<link rel="canonical">` | ❌ absent on all pages |
| `www` subdomain | ⚠️ serves 200 directly, no redirect to apex |

`www` and apex both returning 200 with no canonical means search engines see two
complete copies of the site and split ranking between them. Either 301 `www` →
apex, or add canonical tags.

**Credit where due:** titles, meta descriptions, `og:title`/`description`/`type`/
`site_name`, and `twitter:card` are present and well-written across all six public
pages. This is a small gap on an otherwise solid foundation.

---

## Content

One rendering bug, on `index.html` only:

```html
<img src="/assets/img/002.jpg" alt="Parchment &amp;amp; the Rogue's Watermark">
<figcaption>Parchment &amp;amp; the Rogue's Watermark…
```

Double-escaped, so it renders literally on the page as
"Parchment **&amp;** the Rogue's Watermark". Two occurrences (the `alt` and the
caption). Should be `&amp;` or a bare `&`. The other five pages are clean.

---

## Suggested order of work

1. **Mobile nav** (P1) — 4 lines of CSS; the site is currently unusable on phones
2. **`&amp;amp;`** — one-line content fix, visible on the homepage
3. **`og:image` absolute URLs** (P2) — 12 lines; restores every shared link
4. **gzip + cache headers** (P4) — nginx config, no code change, biggest speed win
5. **Deduplicate the CSS** (P3) — 442 KB → ~30 KB
6. **Security headers** (P5) and **`robots.txt` / `sitemap.xml` / canonicals** (P7)
7. **Form attributes** (P6), video weight, and the duplicate OG image

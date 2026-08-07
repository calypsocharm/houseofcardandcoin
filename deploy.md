# House of Card and Coin — Deploy & Ops Runbook

Live site: <https://houseofcardandcoin.com>
Repo: `git@github.com:calypsocharm/houseofcardandcoin.git`
Domain DNS: `@` A record → `187.124.235.109`, `www` CNAME → `houseofcardandcoin.com`

> **No credentials in this file.** Member logins live in `.hocc-members-secret`,
> the VPS root password in `.hocc-vps-secret` — both gitignored, both local-only.
> Keep it that way; this repo is on GitHub.

---

## 0. The repo

The site used to live inside the **stardraw** repo (`New project/`), sharing history
with the Calypso Star files. As of 2026-08-07 it has its own repo.

| | |
|---|---|
| **Remote** | `git@github.com:calypsocharm/houseofcardandcoin.git` |
| **Branch** | `main` |
| **Working copy** | `C:\Users\Calyp\Downloads\houseofcardandcoin` |
| **Original source** | `C:\Users\Calyp\OneDrive\Documents\New project\houseofcardandcoin-site` (still tracked by stardraw — see caution below) |

```powershell
cd C:\Users\Calyp\Downloads\houseofcardandcoin
git add -A; git commit -m "your message"; git push
```

> ⚠️ **Two copies exist.** The OneDrive folder is still inside the stardraw working
> tree. Edit in **one place only** — the Downloads working copy — or the two will
> drift. When you're confident the new repo is good, delete the HOCC files from
> stardraw so there's a single source of truth.

**Pushing to GitHub does not deploy.** Unlike Calypso Star Studio (which
auto-deploys via cron), this site has no autodeploy. Deploying is a separate,
manual step — see §5.

---

## 1. The VPS

| | |
|---|---|
| **Host / IP** | `187.124.235.109` |
| **Hostname** | `srv1511458` |
| **User** | `root` |
| **Auth** | **SSH key** (preferred). Password fallback in `.hocc-vps-secret` |
| **OS** | Ubuntu 24.04 LTS (installed 2025-12-13) |
| **Software** | Node v20.20.1, npm, nginx 1.24, pm2, certbot, ffmpeg |

**Shared box.** Also runs Daily Stars (`atmosphereengine.com`), BotCash Trader,
Calypso Radio, futures-friend, and YOLO. Restarting *your* pm2 app is fine;
never `pm2 restart all` or reboot without checking what else is running.

> **Host keys rotated 2026-07-07.** All three SSH host keys were regenerated when
> the box rebooted (snapshot restore or provider migration — the OS install date
> is unchanged and all data survived). If SSH ever again refuses with
> "REMOTE HOST IDENTIFICATION HAS CHANGED", that's what happened. Verify before
> trusting: `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` from the Hostinger
> hPanel browser terminal, then `ssh-keygen -R 187.124.235.109` locally.
> Current ED25519 fingerprint: `SHA256:MXbGdZfl/sa+LTYuQBTp4xiT4q1RhHzOTI0jv1YSeGg`

---

## 2. SSH in

### Preferred — key auth (no password needed)

```powershell
ssh root@187.124.235.109
```

Your SSH key is already authorized on this box. This is what the deploy commands
below assume.

### Fallback — password via the askpass helper

Only needed if key auth ever stops working. `askpass.cs` / `askpass.exe` read the
password from `.hocc-vps-secret` (it is **not** embedded in the binary).

```powershell
$root = "C:\Users\Calyp\Downloads\houseofcardandcoin"
$env:SSH_ASKPASS = "$root\askpass.exe"
$env:SSH_ASKPASS_REQUIRE = "force"
$env:DISPLAY = ":0"
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@187.124.235.109 "uname -a"
```

> Don't use `-o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL` (as the old
> runbook did). That disables the check that caught the July key rotation.

---

## 3. What lives where on the VPS

| Path | Purpose |
|---|---|
| `/var/www/hocc` | The whole site + members app |
| `/var/www/hocc/app/server.js` | Express members app (roster, login, bunks, RSVP, announcements, admin, tavern) |
| `/var/www/hocc/app/data/guild.json` | **Live member data** — DO NOT overwrite |
| `/var/www/hocc/app/uploads/` | Member avatar uploads — DO NOT overwrite |
| `/var/www/hocc/app/views/` | EJS templates |
| `/etc/nginx/sites-available/hocc` | nginx server block (symlinked into `sites-enabled/`) |
| `/etc/letsencrypt/live/houseofcardandcoin.com/` | TLS cert (auto-renewing) |
| `/var/www/hocc-backup.sh` | Nightly backup (cron 3:17am, keeps 7) |
| `/var/www/hocc-backups/` | Backup tarballs |
| `/var/www/hocc-healthcheck.sh` | Watchdog (cron every 5 min) |
| `/var/log/hocc-health.log`, `/var/log/hocc-backup.log` | Logs |

### Process model

- Node app under **pm2**, process name **`hocc`** (id 6), on **port 3000**
- Script `/var/www/hocc/app/server.js`, cwd `/var/www/hocc/app`, Node 20.20.1
- **nginx** terminates HTTPS on 443 and proxies everything to `127.0.0.1:3000`;
  port 80 returns 301 to HTTPS. `client_max_body_size 30M` (avatar uploads)

### Build model

`build.js` generates the static pages (`index.html`, `guild.html`, …) from the
fragments in `content/`. **Edit `content/` and `build.js`, not the generated HTML** —
a rebuild overwrites the root `.html` files.

> `build.js` line 2 hardcodes an absolute Windows path:
> `const ROOT="C:/Users/Calyp/OneDrive/Documents/New project/houseofcardandcoin-site"`.
> It still writes to the **old OneDrive folder**. Change it to `__dirname` (or to the
> Downloads path) before running a build from this repo, or your output lands in
> the wrong place.

`serve.js` is a tiny local static server (port 4200) for previewing built pages
without the members app.

---

## 4. pm2 / nginx commands (on the VPS)

```bash
pm2 status                       # all pm2 apps on the shared box
pm2 logs hocc --lines 50         # app logs
pm2 restart hocc --update-env    # restart, picking up env + code
pm2 save                         # persist across reboots
pm2 env $(pm2 id hocc)           # show the hocc process env

nginx -t                         # test nginx config
systemctl reload nginx           # apply nginx changes
certbot certificates             # list certs / expiry
```

### Environment variables the app reads

| Var | Default in code | Set in production? |
|---|---|---|
| `PORT` | `3000` | ✅ yes — `3000` |
| `SESSION_SECRET` | `guild-faire-secret-change` | ✅ yes — a real random value |
| `GUILD_INVITE_CODE` | `COIN-2026` | ✅ yes — `COIN-2026` |
| `FORMSPREE_ENDPOINT` | *(none — form is dropped if unset)* | ✅ yes (set 2026-08-07) |

All four are set and persisted via `pm2 save`, so they survive a restart.

> **Reading the env correctly:** `pm2 env <id>` prints `KEY: value`, **not** `KEY=value`.
> Grepping for `'^KEY='` matches nothing and makes every var look unset.
> Use `pm2 env $(pm2 id hocc | tr -d '[] ') | grep -i KEY`.

```bash
SESSION_SECRET='<long-random>' GUILD_INVITE_CODE='<new-code>' \
  pm2 restart hocc --update-env && pm2 save
```

---

## 5. Deploying changes

Source of truth: `C:\Users\Calyp\Downloads\houseofcardandcoin`.
**Commit first, then deploy** — git and deploy are separate steps.

### Quick — push a few changed files

```powershell
$root = "C:\Users\Calyp\Downloads\houseofcardandcoin"
scp "$root\index.html"            root@187.124.235.109:/var/www/hocc/index.html
scp "$root\assets\css\style.css"  root@187.124.235.109:/var/www/hocc/assets/css/style.css
scp "$root\app\views\guild.ejs"   root@187.124.235.109:/var/www/hocc/app/views/guild.ejs
# only if server.js or a view changed:
ssh root@187.124.235.109 "pm2 restart hocc --update-env"
```

### Full redeploy — site + app code, preserving live member data

```powershell
$root = "C:\Users\Calyp\Downloads\houseofcardandcoin"
$tmp  = "$env:TEMP\hocc.tar.gz"
tar -czf $tmp --exclude=node_modules --exclude=app/uploads --exclude=app/data --exclude=.git -C $root .

ssh root@187.124.235.109 "rm -rf /var/www/hocc/assets /var/www/hocc/*.html"
scp $tmp root@187.124.235.109:/var/www/hocc/
ssh root@187.124.235.109 "cd /var/www/hocc && tar -xzf hocc.tar.gz && rm -f hocc.tar.gz && npm install --prefix app --omit=dev && pm2 restart hocc --update-env && pm2 save"
```

> The tarball **excludes `app/data` and `app/uploads`**, so members, bunks, and
> avatars are never clobbered. Take a backup first anyway (§7) — the `rm -rf` step
> is destructive and there is no undo.

### Verify after deploying

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://houseofcardandcoin.com/
ssh root@187.124.235.109 "pm2 status hocc && pm2 logs hocc --err --lines 20 --nostream"
```

---

## 6. Member logins

Members sign in at <https://houseofcardandcoin.com/members/login> with their
**login handle** (not an email address) + password.

🔑 **The handle/password list is in `.hocc-members-secret`** — local only,
gitignored, never committed.

New members self-register at the login page with the invite code
(`GUILD_INVITE_CODE`; see §4 and §11). Members can change their own password in
the Guild Hall; the Guild Elder can reset anyone's from the Administration panel.

To reset a password on the VPS:

```bash
cd /var/www/hocc/app
node -e "const fs=require('fs'),b=require('bcryptjs');const f='data/guild.json';const d=JSON.parse(fs.readFileSync(f));const u=d.users.find(x=>x.email==='HANDLE');u.passhash=b.hashSync(process.env.NEWPW,10);fs.writeFileSync(f,JSON.stringify(d,null,2));console.log('reset')"
pm2 restart hocc --update-env
```

Pass the new password as `NEWPW=...` rather than typing it inline, so it doesn't
land in shell history.

---

## 7. Health, backups, recovery

- **Watchdog** — `hocc-healthcheck.sh` every 5 min: curls `127.0.0.1:3000/health`
  and the public site, restarts pm2/nginx if either is down.
  Public endpoint: <https://houseofcardandcoin.com/health>
- **Backups** — nightly ~3:17am, tarball of `app/data` + `app/uploads` into
  `/var/www/hocc-backups/` (keeps the latest 7)

Take a backup on demand (do this before any full redeploy):

```bash
ssh root@187.124.235.109 "/var/www/hocc-backup.sh && ls -lt /var/www/hocc-backups | head -3"
```

Restore:

```bash
cd /var/www/hocc
tar -xzf /var/www/hocc-backups/hocc-YYYYMMDD-HHMMSS.tgz
pm2 restart hocc --update-env
```

> Backups cover **member data only** — not site code. Site code recovery is
> `git clone` + §5.

---

## 8. HTTPS / DNS

Cert for `houseofcardandcoin.com` + `www` at
`/etc/letsencrypt/live/houseofcardandcoin.com/`, auto-renewing (current cert
issued 2026-08-05, expires 2026-11-03).

```bash
certbot --nginx -d houseofcardandcoin.com -d www.houseofcardandcoin.com \
  --non-interactive --agree-tos -m houseofcardandcoin@gmail.com --redirect
```

---

## 9. Contact form / Formspree

The Carrier Pigeon form (`/pigeon.html`) posts to the app's `/pigeon` route, which
forwards to Formspree. It currently reuses the calypsostar form
(`https://formspree.io/f/mojgjwqg`) — submissions arrive with the subject
"New pigeon — House of Card and Coin." To give the House its own inbox:

```bash
FORMSPREE_ENDPOINT=https://formspree.io/f/NEWID pm2 restart hocc --update-env && pm2 save
```

The form has a `_gotcha` honeypot field for spam.

---

## 10. Local dev

```powershell
cd C:\Users\Calyp\Downloads\houseofcardandcoin\app
npm install
$env:PORT="8080"; $env:SESSION_SECRET="local-test"
node server.js
# → http://localhost:8080 (static site + members app)
```

`app/data/` and `app/uploads/` are gitignored, so a fresh clone starts with no
members. Seed a local dev database with `node seed.js` (see §11 first).

---

## 11. Known issues

Full findings, with measurements and fixes, in [`AUDIT.md`](AUDIT.md).
The security-relevant ones:

1. ✅ **FIXED 2026-08-07 — public file exposure.** `express.static` was mounted on
   `/var/www/hocc`, so `/app/data/guild.json` (every member record including
   bcrypt hashes), `/app/server.js`, `/app/seed.js`, `/build.js` and
   `/content/content.json` were publicly downloadable. A path guard in
   `server.js` now 404s them. **Do not regress this** — redeploying an older
   `server.js` reopens it. Members should still rotate passwords, since the
   hashes were exposed for an unknown period.
2. **`SESSION_SECRET` and `GUILD_INVITE_CODE` are both properly set** in
   production (see §4) — an earlier note here claimed otherwise and was wrong.
   Remaining nit: `express-session` uses the default `MemoryStore`, which drops
   every session on restart and leaks memory. A file/SQLite store would fix it.
3. **`app/seed.js` no longer hardcodes a password** — it reads `SEED_PASSWORD`
   from the environment and refuses to run without it. Seed with:
   `SEED_PASSWORD='...' node seed.js`
4. **No security headers** on responses (HSTS, CSP, `X-Frame-Options`,
   `nosniff`), and `X-Powered-By: Express` is exposed. Fix in the nginx block
   plus `app.disable('x-powered-by')`.
5. **No CSRF protection** on the login/register/board POST routes — worth
   reviewing given the app has real auth and public posting.

✅ **Fixed and deployed 2026-08-07:**

6. **Mobile navigation** — `.brand{flex-shrink:0}` pushed the hamburger to x=450,
   off-screen on every phone, while `.nav-links` stayed hidden below 980px. A
   `@media (max-width:479px)` block at the end of `style.css` lets the brand
   shrink and drops its tagline. Verified reachable at 320–479px.
7. **gzip** — `gzip on` was set globally but `gzip_proxied` was commented out,
   and everything here is proxied to Express, so only HTML was compressed.
   Now set in the `hocc` server block: **style.css 443 KB → 11.8 KB (97.3%)**.
8. **Caching** — was `max-age=0` on everything. Now 30 days for media, 1 day for
   css/js. Deliberately not a year: filenames aren't fingerprinted, so a long
   TTL would strand edits.
9. **`og:image`** — was root-relative, so every shared link previewed blank.
   Absolute now, on the static pages and in `_top.ejs`, which also gained the
   missing `twitter:title`/`description`/`image`.
10. **`robots.txt`, `sitemap.xml`, canonical tags** — all added; `www` now 301s
    to the apex instead of serving a duplicate site.
11. **Security headers** — HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`.
12. **`&amp;amp;`** on the homepage — rendered as a literal `&amp;`; fixed.

Still open:

13. **`style.css` is 93% duplicate text** — the base stylesheet appears 16× in
    the file (29.5 KB unique of 443 KB). gzip hides most of the cost now, but
    deduplicating is still the right fix.
14. **4.2 MB of video on the homepage** (`vid.mp4` + `vid-space.mp4`). Worth
    `preload="none"` with a poster, or a static hero below 768px.
15. **No CSRF protection** on the login/register/board POST routes.
16. `X-Powered-By: Express` still exposed — `app.disable('x-powered-by')`.

> **nginx note:** the `hocc` server block now carries gzip, caching and security
> headers, and there is a separate `www` → apex redirect server. Config backed up
> to `/root/hocc-nginx.bak-*` before the change. The other eight sites on the box
> share `nginx.conf` but not this file — the changes are scoped here.

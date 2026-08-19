# If the server dies

These are nightly copies of the House of Card and Coin's guild data — every
member, their hands, the bunks, the talk in the Tavern, the Roll, and everyone's
uploaded faces. One file per night, kept on the VPS in two places.

Each one holds `app/data/guild.json` and the whole `app/uploads` folder. Nothing
else in the site matters: the code is all in the git repo, only this is
irreplaceable.

**Verified working on 19 August 2026** — an archive was written, read back,
and extracted, and the restored file checked: 10 members, every one with a
login, 4 threads, the 9-event schedule, 9 avatars.

## Restoring onto a working server

```bash
scp hocc-YYYYMMDD-HHMMSS.tgz root@187.124.235.109:/tmp/
ssh root@187.124.235.109
```

Then, on the server — **stop the app first**, or it will write its in-memory
copy back over whatever you restore:

```bash
pm2 stop hocc
cp -r /var/www/hocc/app/data /var/www/hocc/app/data.before-restore
tar -xzf /tmp/hocc-YYYYMMDD-HHMMSS.tgz -C /var/www/hocc
pm2 start hocc
```

Check it came back before you do anything else:

```bash
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/
node -e "const d=require('/var/www/hocc/app/data/guild.json');console.log(d.users.length,'members')"
```

If it went wrong, `app/data.before-restore` is still there.

## Just reading one without restoring anything

```bash
mkdir peek && tar -xzf hocc-YYYYMMDD-HHMMSS.tgz -C peek
node -e "const d=require('./peek/app/data/guild.json');console.log(d.users.map(u=>u.name))"
```

## Where they are

Both on the VPS, in two places, so clearing the web root by accident does not
take them with it:

- `/var/www/hocc-backups/` &mdash; the working set
- `/var/backups/hocc/` &mdash; a mirror of each one, outside the web root

Kept every night for a month, then Sundays for three months, then the first of
each month for two years. About forty megabytes at full stretch, on a disk with
seventy-six gigabytes free.

## How you know they are working

Administration shows it. A green line means last night was written and read
back clean; anything else says what went wrong, or that the job has stopped
running. Nothing to remember and nothing to check by hand.

The script reads every new archive back before it deletes a single old one, so a
failed night can never take the good copies with it. If it cannot read what it
just wrote, it throws that away, keeps everything, and says so.

## If you ever want one on your own machine

```bash
scp root@187.124.235.109:/var/www/hocc-backups/hocc-*.tgz .
```

Worth doing once after the faire, when the weekend&rsquo;s photographs and the
final Roll are the part you would most hate to lose to a dead server.

#!/usr/bin/env node
/* Show somebody the "You're in" welcome again.

   The Guild Hall draws that panel once, for a quarter of an hour from the
   moment it is first seen, and then never again. Which is right — but it makes
   the thing impossible to look at on purpose. This re-arms it for one member,
   so the next time their account opens the Guild Hall the welcome is there.

     node tools/rearm-welcome.js            # list everyone, change nothing
     node tools/rearm-welcome.js 25         # arm it for that member
     node tools/rearm-welcome.js 25 --clear # take it back off

   IMPORTANT — the app keeps guild.json in memory and writes the whole thing
   back on every save, so an edit made while it is running is thrown away
   within seconds. Stop it, edit, start it again:

     pm2 stop hocc && node tools/rearm-welcome.js 25 && pm2 start hocc

   Keep that window short. The watchdog runs every five minutes and will
   restart the app on its own if it finds the site down, which would load the
   old data straight back over the top of the edit. */
const fs = require('fs');
const path = require('path');

const DB = path.join(__dirname, '..', 'app', 'data', 'guild.json');
const db = JSON.parse(fs.readFileSync(DB, 'utf8'));

const id = process.argv[2] ? parseInt(process.argv[2], 10) : null;
const CLEAR = process.argv.includes('--clear');

if (id === null || Number.isNaN(id)) {
  console.log('Who? Give a member id:\n');
  db.users.forEach(function (u) {
    const state = u.pledge ? 'a pledge — accept them properly instead'
      : !u.sworn ? '—'
      : u.swornShown ? 'welcomed, and they have seen it'
      : 'welcome armed, not seen yet';
    console.log('  ' + String(u.id).padStart(4) + '  ' + u.name.padEnd(20) + state);
  });
  console.log('\n  node tools/rearm-welcome.js <id>');
  process.exit(0);
}

const u = db.users.find(function (x) { return x.id === id; });
if (!u) { console.error('No member with id ' + id + '.'); process.exit(1); }
if (u.pledge && !CLEAR) {
  console.error(u.name + ' is still a pledge. Accept them from the Administration panel — '
    + 'that sends the notice as well, which this does not.');
  process.exit(1);
}

if (CLEAR) {
  delete u.sworn;
  delete u.swornShown;
  fs.writeFileSync(DB, JSON.stringify(db, null, 2));
  console.log('Taken back off ' + u.name + '. They will not see the welcome again.');
} else {
  u.sworn = Date.now();
  delete u.swornShown;            // not drawn yet, so the clock has not started
  fs.writeFileSync(DB, JSON.stringify(db, null, 2));
  console.log('Armed for ' + u.name + '.');
  console.log('The welcome appears the next time that account opens the Guild Hall,');
  console.log('and stays for fifteen minutes from that first look.');
}

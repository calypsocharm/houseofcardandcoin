#!/usr/bin/env node
/* Bring the portraits already on file out of the shade.

   From now on the House lifts a dark portrait as it is uploaded. This does the
   same to the ones that went up before that — it walks every avatar named in
   guild.json, measures it, and rewrites only the ones genuinely in shadow. A
   well-lit face is left byte for byte alone.

   It touches picture files only. guild.json is never opened for writing, so it
   is safe to run with the app up: nothing here can be undone by the copy of the
   database the server holds in memory.

     node tools/lift-avatars.js          # say what it would do, change nothing
     node tools/lift-avatars.js --write  # actually do it

   Run it from the site root — the folder holding app/. Every picture it
   rewrites gets its original kept in app/data/preshade/, so a call you disagree
   with is one mv away from undone. That folder is out of the web root, unlike
   app/uploads. */
const fs = require('fs');
const path = require('path');
const sharp = require(path.join(__dirname, '..', 'app', 'node_modules', 'sharp'));

const WRITE   = process.argv.includes('--write');
const ROOT    = path.join(__dirname, '..', 'app');
const UPLOADS = path.join(ROOT, 'uploads');
const DB      = path.join(ROOT, 'data', 'guild.json');
const KEPT    = path.join(ROOT, 'data', 'preshade');   // originals, out of the web root

/* The same numbers and the same method the server uses on upload. Deliberately
   copied rather than imported — importing server.js would start a second copy
   of the site. If you change them there, change them here. */
const FACE_FLOOR = 104;
const FACE_TARGET = 118;
const FACE_MOST = 30;

async function faceLuma(buf) {
  try {
    const d = await sharp(buf).removeAlpha().raw().toBuffer();
    if (!d.length) return null;
    let s = 0;
    for (let n = 0; n < d.length; n += 3) s += d[n] * 0.299 + d[n + 1] * 0.587 + d[n + 2] * 0.114;
    return s / (d.length / 3);
  } catch (e) { return null; }
}

async function liftShade(buf) {
  const dark = await faceLuma(buf);
  if (dark === null || dark >= FACE_FLOOR) return null;   // null = leave it alone
  let lo = 0, hi = FACE_MOST, best = null, at = 0, got = dark;
  for (let n = 0; n < 6; n++) {
    const mid = (lo + hi) / 2;
    const out = await sharp(buf)
      .modulate({ lightness: mid, saturation: 1 + Math.min(mid / FACE_MOST, 1) * 0.12 })
      .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    const now = await faceLuma(out);
    if (now === null) break;
    best = out; at = mid; got = now;
    if (now < FACE_TARGET) lo = mid; else hi = mid;
  }
  return best && { buf: best, from: dark, to: got, lift: at };
}

/* Every avatar named anywhere in the database, whoever it belongs to —
   guildmates, tavern regulars, anyone added later. */
function avatarsIn(node, found) {
  if (!node || typeof node !== 'object') return found;
  if (Array.isArray(node)) { node.forEach(n => avatarsIn(n, found)); return found; }
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (k === 'avatar' && typeof v === 'string' && v.startsWith('/uploads/')) found.add(v);
    else avatarsIn(v, found);
  }
  return found;
}

(async () => {
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const list = [...avatarsIn(db, new Set())];
  if (!list.length) { console.log('No avatars on file.'); return; }

  if (WRITE && !fs.existsSync(KEPT)) fs.mkdirSync(KEPT, { recursive: true });
  console.log(WRITE ? 'Lifting shaded portraits.' : 'Dry run — nothing will be written.');
  let touched = 0;

  for (const ref of list) {
    const file = path.join(UPLOADS, ref.replace('/uploads/', ''));
    let buf;
    try { buf = fs.readFileSync(file); }
    catch (e) { console.log('  ' + ref + '  MISSING'); continue; }

    const r = await liftShade(buf);
    if (!r) {
      const was = await faceLuma(buf);
      console.log('  ' + ref + '  ' + (was === null ? 'unreadable' : Math.round(was) + ' — already well lit') + ', left alone');
      continue;
    }

    if (WRITE) {
      // The original is kept, but under app/data — NOT beside the picture in
      // app/uploads, which is a public mount: a copy left there is a second
      // downloadable URL for the same photograph. app/data is blocked from the
      // web and swept up by the nightly backup.
      const keep = path.join(KEPT, path.basename(file) + '.preshade');
      if (!fs.existsSync(keep)) fs.copyFileSync(file, keep);   // never clobber the first copy
      fs.writeFileSync(file, r.buf);
    }
    touched++;
    console.log('  ' + ref + '  ' + Math.round(r.from) + ' -> ' + Math.round(r.to) +
                '  (lightness +' + r.lift.toFixed(1) + ')' + (WRITE ? '' : '  — would'));
  }

  console.log('\n' + touched + ' of ' + list.length + ' ' + (WRITE ? 'lifted' : 'would be lifted') + '.');
  if (!WRITE && touched) console.log('Run again with --write to keep it.');
})().catch(e => { console.error(e); process.exit(1); });

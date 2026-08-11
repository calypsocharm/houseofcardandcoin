/* Cuts a seamless hover loop out of a longer recording.

   Hover sounds have to loop while the pointer sits on a tent, so the join has
   to be inaudible. A plain trim clicks at the seam. This takes half a second
   more than asked for and crossfades that tail back over the head, which
   leaves a loop with no edge in it.

   Levels are normalised too, so a quiet recording and a loud one do not end
   up wildly different once they are behind the music.

   For a one-shot — a card flick, a latch — pass "once" as a fifth argument.
   Those are not looped, so there is no seam to hide; they just get a short
   fade at the tail so the end does not click.

   Usage: node tools/make-hover-loop.js <source> <out.mp3> <start> <length> [once]  */
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

const [src, out, startArg, lenArg, mode] = process.argv.slice(2);
const once = mode === 'once';
if (!src || !out) {
  console.error('usage: node tools/make-hover-loop.js <source> <out.mp3> <start> <length>');
  process.exit(1);
}
const start = parseFloat(startArg || '0');
const len = parseFloat(lenArg || '5');
const XF = 0.5;                       // crossfade at the seam

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hoverloop-'));
const raw = path.join(tmp, 'raw.wav');
const loop = path.join(tmp, 'loop.wav');
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', ...args, '-y'], { stdio: 'inherit' });

try {
  if (once) {
    // one-shot: trim, level, and a 60ms tail so the cut does not click
    ff(['-ss', String(start), '-t', String(len), '-i', src,
        '-ac', '1', '-ar', '32000',
        '-af', `loudnorm=I=-20:TP=-3,afade=t=out:st=${(len - 0.06).toFixed(2)}:d=0.06`,
        '-b:a', '48k', '-f', 'mp3', out]);
  } else {
  // take the window, plus the crossfade tail, in mono at a modest rate
  ff(['-ss', String(start), '-t', String(len + XF), '-i', src,
      '-ac', '1', '-ar', '32000', '-af', 'loudnorm=I=-20:TP=-3', '-f', 'wav', raw]);

  // fold the tail back over the head
  ff(['-i', raw, '-filter_complex',
      `[0]atrim=0:${len},asetpts=N/SR/TB[a];` +
      `[0]atrim=${len},asetpts=N/SR/TB[b];` +
      `[a][b]acrossfade=d=${XF}:c1=tri:c2=tri`,
      '-f', 'wav', loop]);

  ff(['-i', loop, '-ac', '1', '-ar', '32000', '-b:a', '48k', '-f', 'mp3', out]);
  }

  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=nk=1:nw=1', out]).toString().trim();
  console.log(`  ${path.basename(out).padEnd(14)} ${kb.padStart(4)} KB   ${(+dur).toFixed(2)} s   ${once ? 'one-shot' : 'seamless loop'}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

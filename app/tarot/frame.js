/* The furniture of a card: the border, the corners, the medallion at its head
   and the cartouche at its foot.

   Kept in its own file because the site is going to want exactly this and
   nothing else from the generator — the photograph is hers, the card parts are
   built, and this is the parts. Everything is drawn from the trim size passed
   in, so the same code makes a card at any scale: a 300dpi print plate, or a
   thumbnail for a page. */

const GOLD = '#c8ab63', GOLD_L = '#e8d5a2', GOLD_D = '#8e743a', DARK = '#0d0b09';

/* ── the suit marks ─────────────────────────────────────────────────────── */
const MARKS = {
  swords: g => '<path d="M20 2 L23.2 10 L23.2 39 L16.8 39 L16.8 10 Z" fill="' + g.l + '"/>'
    + '<rect x="6" y="39" width="28" height="3.4" rx="1.5" fill="' + g.m + '"/>'
    + '<rect x="17.7" y="42.4" width="4.6" height="12" rx="1.5" fill="' + g.m + '"/>'
    + '<circle cx="20" cy="57" r="3.8" fill="' + g.l + '"/>',
  cups: g => '<path d="M7 4 H33 A13 13 0 0 1 20 30 A13 13 0 0 1 7 4 Z" fill="' + g.l + '"/>'
    + '<rect x="18.2" y="30" width="3.6" height="15" fill="' + g.m + '"/>'
    + '<path d="M9 51 H31 A3.6 3.6 0 0 0 31 45 H9 A3.6 3.6 0 0 0 9 51 Z" fill="' + g.m + '"/>',
  wands: g => '<rect x="17.4" y="8" width="5.2" height="48" rx="2.6" fill="' + g.m + '"/>'
    + '<path d="M20 2 L26 11 L20 8.6 L14 11 Z" fill="' + g.l + '"/>'
    + '<path d="M11 25 Q20 18 29 25" fill="none" stroke="' + g.l + '" stroke-width="2.2"/>',
  pentacles: g => '<circle cx="20" cy="29" r="18" fill="none" stroke="' + g.l + '" stroke-width="3.2"/>'
    + '<path d="M20 14 V44 M5 29 H35" stroke="' + g.m + '" stroke-width="2.4"/>'
    + '<circle cx="20" cy="29" r="5.6" fill="none" stroke="' + g.m + '" stroke-width="2"/>',
  major: g => '<path d="M20 2 L24.4 15.6 L38.6 15.6 L27.1 24 L31.5 37.6 L20 29.2 L8.5 37.6 '
    + 'L12.9 24 L1.4 15.6 L15.6 15.6 Z" fill="' + g.l + '"/>',
};

/* ── one corner, drawn once and turned four times ───────────────────────────
   A quarter of scrollwork: the rule turning the corner, a lighter line inside
   it, a pin at the very corner and a small leaf on the diagonal. Geometric
   rather than florid on purpose — at two and three quarter inches wide,
   anything fussier turns to mud on a press. */
function corner(k) {
  return '<g>'
    + '<path d="M0 ' + (58 * k) + ' Q0 0 ' + (58 * k) + ' 0" fill="none" stroke="' + GOLD + '" stroke-width="' + (2.6 * k) + '"/>'
    + '<path d="M0 ' + (34 * k) + ' Q0 0 ' + (34 * k) + ' 0" fill="none" stroke="' + GOLD_L + '" stroke-width="' + (1.1 * k) + '" opacity="0.75"/>'
    + '<circle cx="0" cy="0" r="' + (4.6 * k) + '" fill="' + GOLD_L + '"/>'
    + '<circle cx="0" cy="0" r="' + (8.4 * k) + '" fill="none" stroke="' + GOLD + '" stroke-width="' + (1 * k) + '" opacity="0.7"/>'
    + '<path d="M' + (17 * k) + ' ' + (17 * k) + ' l' + (11 * k) + ' ' + (-3.5 * k) + ' l' + (-3.5 * k) + ' ' + (11 * k) + ' z" fill="' + GOLD + '" opacity="0.92"/>'
    + '</g>';
}

/* ── the whole face ─────────────────────────────────────────────────────── */
function face(opts) {
  const W = opts.width, H = opts.height, bleed = opts.bleed || 0;
  const k = W / 825;                                  // everything scales off the trim
  const tw = W - bleed * 2, th = H - bleed * 2;       // the trimmed area
  const inset = 30 * k;
  const x0 = bleed + inset, y0 = bleed + inset;
  const x1 = bleed + tw - inset, y1 = bleed + th - inset;
  const cx = W / 2;

  const g = { m: GOLD, l: GOLD_L };
  const mark = (MARKS[opts.suit] || MARKS.major)(g);
  const title = String(opts.title || '').toUpperCase();

  /* The lettering shrinks to fit rather than running into the cartouche —
     "KNIGHT OF PENTACLES" is half again as long as "THE FOOL". */
  const size = Math.max(30, Math.min(58, 1180 / Math.max(title.length, 8))) * k;
  const track = (title.length > 16 ? 2.5 : 4.5) * k;

  const medalR = 29 * k;                              // the plate at the head
  // far enough in that the whole medallion survives the trim, and still
  // sitting across the rule rather than politely below it
  const medalY = Math.max(y0, bleed + medalR + 12 * k);
  const cartW = Math.min(tw - 150 * k, (title.length * size * 0.60) + 78 * k);
  const cartH = 74 * k;
  const cartY = Math.min(y1 - cartH / 2, bleed + th - cartH - 12 * k);
  const nick = 22 * k;                                // the angled ends

  return ''
    + '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">'
    + '<defs>'
      + '<linearGradient id="foot" x1="0" y1="0" x2="0" y2="1">'
        + '<stop offset="0%" stop-color="' + DARK + '" stop-opacity="0"/>'
        + '<stop offset="52%" stop-color="' + DARK + '" stop-opacity="0.7"/>'
        + '<stop offset="100%" stop-color="' + DARK + '" stop-opacity="0.95"/>'
      + '</linearGradient>'
      + '<linearGradient id="head" x1="0" y1="0" x2="0" y2="1">'
        + '<stop offset="0%" stop-color="' + DARK + '" stop-opacity="0.85"/>'
        + '<stop offset="100%" stop-color="' + DARK + '" stop-opacity="0"/>'
      + '</linearGradient>'
      + '<linearGradient id="plate" x1="0" y1="0" x2="0" y2="1">'
        + '<stop offset="0%" stop-color="#1b1611" stop-opacity="0.97"/>'
        + '<stop offset="100%" stop-color="#0b0908" stop-opacity="0.99"/>'
      + '</linearGradient>'
    + '</defs>'

    // ground for the lettering, whatever the photograph is doing down there
    + '<rect x="0" y="' + (H - 380 * k) + '" width="' + W + '" height="' + (380 * k) + '" fill="url(#foot)"/>'
    + '<rect x="0" y="0" width="' + W + '" height="' + (240 * k) + '" fill="url(#head)"/>'

    // the rule: heavy outside, hairline within
    + '<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '" '
      + 'fill="none" stroke="' + GOLD + '" stroke-width="' + (2.8 * k) + '" opacity="0.95"/>'
    + '<rect x="' + (x0 + 10 * k) + '" y="' + (y0 + 10 * k) + '" width="' + (x1 - x0 - 20 * k) + '" '
      + 'height="' + (y1 - y0 - 20 * k) + '" fill="none" stroke="' + GOLD_L + '" '
      + 'stroke-width="' + (1 * k) + '" opacity="0.55"/>'

    // four corners of scrollwork
    + '<g transform="translate(' + x0 + ',' + y0 + ')">' + corner(k) + '</g>'
    + '<g transform="translate(' + x1 + ',' + y0 + ') scale(-1,1)">' + corner(k) + '</g>'
    + '<g transform="translate(' + x0 + ',' + y1 + ') scale(1,-1)">' + corner(k) + '</g>'
    + '<g transform="translate(' + x1 + ',' + y1 + ') scale(-1,-1)">' + corner(k) + '</g>'

    // the suit, on a medallion that breaks the rule at the head
    + '<circle cx="' + cx + '" cy="' + medalY + '" r="' + medalR + '" fill="url(#plate)" '
      + 'stroke="' + GOLD + '" stroke-width="' + (2.2 * k) + '"/>'
    + '<circle cx="' + cx + '" cy="' + medalY + '" r="' + (medalR - 6 * k) + '" fill="none" '
      + 'stroke="' + GOLD_D + '" stroke-width="' + (0.9 * k) + '" opacity="0.8"/>'
    + '<g transform="translate(' + (cx - 20 * k * 0.86) + ',' + (medalY - 30 * k * 0.86) + ') scale(' + (k * 0.86) + ')">'
      + mark + '</g>'

    // and the name, on a cartouche that breaks it at the foot
    + '<path d="M' + (cx - cartW / 2) + ' ' + (cartY + cartH / 2) + ' '
      + 'L' + (cx - cartW / 2 + nick) + ' ' + cartY + ' '
      + 'H' + (cx + cartW / 2 - nick) + ' '
      + 'L' + (cx + cartW / 2) + ' ' + (cartY + cartH / 2) + ' '
      + 'L' + (cx + cartW / 2 - nick) + ' ' + (cartY + cartH) + ' '
      + 'H' + (cx - cartW / 2 + nick) + ' Z" '
      + 'fill="url(#plate)" stroke="' + GOLD + '" stroke-width="' + (2.2 * k) + '"/>'
    + '<path d="M' + (cx - cartW / 2 + 9 * k) + ' ' + (cartY + cartH / 2) + ' '
      + 'L' + (cx - cartW / 2 + nick + 5 * k) + ' ' + (cartY + 6 * k) + ' '
      + 'H' + (cx + cartW / 2 - nick - 5 * k) + ' '
      + 'L' + (cx + cartW / 2 - 9 * k) + ' ' + (cartY + cartH / 2) + ' '
      + 'L' + (cx + cartW / 2 - nick - 5 * k) + ' ' + (cartY + cartH - 6 * k) + ' '
      + 'H' + (cx - cartW / 2 + nick + 5 * k) + ' Z" '
      + 'fill="none" stroke="' + GOLD_D + '" stroke-width="' + (0.9 * k) + '" opacity="0.85"/>'
    + '<text x="' + cx + '" y="' + (cartY + cartH / 2 + size * 0.35) + '" text-anchor="middle" '
      + 'font-family="Georgia, \'Bookman Old Style\', serif" font-size="' + size + '" '
      + 'letter-spacing="' + track + '" fill="' + GOLD_L + '">' + title + '</text>'
    + '</svg>';
}

module.exports = { face, MARKS, GOLD, GOLD_L, GOLD_D, DARK };

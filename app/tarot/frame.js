/* The card itself: the ground it is printed on, the arched window the
   photograph shows through, the rules, the numeral, the name, and the grain
   over the whole of it.

   The first version framed a photograph. This one builds a card and lets a
   photograph show through it, which is a different thing and the reason it
   looks different. Three changes carry nearly all of it:

     · an ARCHED APERTURE. The picture no longer runs to the edges with
       darkness painted over the corners; it sits in a round-headed window cut
       out of the card's own ground, the way almost every tarot card since the
       Marseille has been built. It also gives an upright sword somewhere to
       rise into.
     · a NUMERAL. Decks number their cards — V on the Five, XVIII on The Moon —
       and courts take their suit's mark instead. Without it a card reads as a
       poster.
     · GRAIN. The photograph was crisp digital and the frame crisp vector, and
       they plainly came from different worlds. One sheet of paper over
       everything puts them on the same surface, and is most of why this reads
       as printed rather than rendered.

   Everything is drawn from the trim passed in, so the same code makes a 300dpi
   plate and a thumbnail. */

/* Gold, shifted a little by suit, so a Swords card and a Wands card do not
   feel identical in the hand. The shift is small on purpose — it should be
   felt rather than noticed. */
/* An ink per suit, taken from the wash already on the photograph, so the
   colour in the frame and the colour in the picture are the same colour.
   Swords are steel-blue, wands ember-red, cups a deep water-green, pentacles
   an old bronze-green, the majors wine. --ink overrides any of them. */
const INK = {
  swords:    { line: '#4a7ab5', deep: '#24456f' },
  cups:      { line: '#3f8f93', deep: '#1d4b4f' },
  wands:     { line: '#b5462a', deep: '#6e2413' },
  pentacles: { line: '#5f8a3c', deep: '#31501f' },
  major:     { line: '#8f3550', deep: '#4d1a2a' },
  red:       { line: '#b03a3a', deep: '#5f1a1a' },
  blue:      { line: '#4a7ab5', deep: '#24456f' },
};

const METAL = {
  swords:    { m: '#b9ae7e', l: '#e2e0c2', d: '#7d7a55', ground: '#0c0e11' },
  cups:      { m: '#b8a878', l: '#e6dcbb', d: '#7a7050', ground: '#0b0f10' },
  wands:     { m: '#c9a557', l: '#efd79a', d: '#8b6f31', ground: '#120c08' },
  pentacles: { m: '#c2ac5c', l: '#ecdb9d', d: '#857437', ground: '#0e0f09' },
  major:     { m: '#c8ab63', l: '#f0dda8', d: '#8e743a', ground: '#0f0b12' },
};

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

/* Pips carry a numeral, courts carry their suit. A deck that numbers some of
   its cards and not others looks like a deck that was not finished. */
const ROMAN = { ace: 'I', one: 'I', two: 'II', three: 'III', four: 'IV', five: 'V', six: 'VI',
  seven: 'VII', eight: 'VIII', nine: 'IX', ten: 'X' };
function numeralFor(rank, given) {
  if (given != null && given !== '') return String(given);
  return ROMAN[String(rank || '').trim().toLowerCase()] || '';
}

/* A small diamond, in ink with a gold heart. The deck's punctuation. */
function pip(k, g, ink) {
  return '<path d="M0 ' + (-5.2 * k) + ' L' + (5.2 * k) + ' 0 L0 ' + (5.2 * k) + ' L' + (-5.2 * k) + ' 0 Z" fill="' + ink.line + '"/>'
    + '<path d="M0 ' + (-2.2 * k) + ' L' + (2.2 * k) + ' 0 L0 ' + (2.2 * k) + ' L' + (-2.2 * k) + ' 0 Z" fill="' + g.l + '"/>';
}

/* ── filigree ───────────────────────────────────────────────────────────────
   A scroll: a stem that curls back on itself, a leaf on the outside of the
   curl, and a berry at the tip. Drawn once facing right and mirrored for the
   left, so the pair either side of a title are actually a pair.

   In ink rather than gold, and this is the point of it — the frame had been
   one metal from corner to corner, and a card wants a second colour somewhere
   or the eye has nothing to catch on. It is kept to hairlines: colour in a
   thin line reads as ornament, colour in a mass reads as a mistake. */
function scroll(k, g, ink) {
  /* A long horizontal stem that tapers away from the lettering and finishes in
     a curl, with a leaf springing off it and a gold berry in the eye of the
     curl. Horizontal because it sits beside a line of type and has to agree
     with it — the first attempt curled upward and read, correctly, as a
     tadpole. */
  return '<g>'
    + '<path d="M0 0 C' + (18 * k) + ' 0 ' + (30 * k) + ' ' + (-2 * k) + ' ' + (40 * k) + ' ' + (-7 * k) + '" '
      + 'fill="none" stroke="' + ink.line + '" stroke-width="' + (2.1 * k) + '" stroke-linecap="round"/>'
    + '<path d="M' + (40 * k) + ' ' + (-7 * k) + ' C' + (48 * k) + ' ' + (-11 * k) + ' ' + (50 * k) + ' ' + (-2 * k) + ' '
      + (43 * k) + ' ' + (-1 * k) + ' C' + (38 * k) + ' ' + (-0.4 * k) + ' ' + (37 * k) + ' ' + (-5 * k) + ' ' + (41 * k) + ' ' + (-6 * k) + '" '
      + 'fill="none" stroke="' + ink.line + '" stroke-width="' + (1.7 * k) + '" stroke-linecap="round"/>'
    + '<path d="M' + (16 * k) + ' ' + (-0.5 * k) + ' C' + (20 * k) + ' ' + (-9 * k) + ' ' + (30 * k) + ' ' + (-11 * k) + ' '
      + (34 * k) + ' ' + (-8 * k) + ' C' + (28 * k) + ' ' + (-3 * k) + ' ' + (21 * k) + ' ' + (-1 * k) + ' ' + (16 * k) + ' ' + (-0.5 * k) + ' Z" '
      + 'fill="' + ink.deep + '" stroke="' + ink.line + '" stroke-width="' + (0.9 * k) + '"/>'
    + '<circle cx="' + (44.5 * k) + '" cy="' + (-4 * k) + '" r="' + (1.9 * k) + '" fill="' + g.l + '"/>'
    + '</g>';
}

/* A spray of three, for under the numeral: two scrolls facing out from a
   diamond. */
function spray(k, g, ink) {
  return '<g>'
    + '<g transform="translate(' + (11 * k) + ',0) scale(0.82)">' + scroll(k, g, ink) + '</g>'
    + '<g transform="translate(' + (-11 * k) + ',0) scale(-0.82,0.82)">' + scroll(k, g, ink) + '</g>'
    + pip(k, g, ink)
    + '</g>';
}

/* One corner of scrollwork, drawn once and turned four times. Geometric rather
   than florid: at two and three quarter inches wide, anything fussier turns to
   mud on a press. */
function corner(k, g) {
  return '<g>'
    + '<path d="M0 ' + (46 * k) + ' Q0 0 ' + (46 * k) + ' 0" fill="none" stroke="' + g.m + '" stroke-width="' + (2.4 * k) + '"/>'
    + '<path d="M0 ' + (27 * k) + ' Q0 0 ' + (27 * k) + ' 0" fill="none" stroke="' + g.l + '" stroke-width="' + (1 * k) + '" opacity="0.7"/>'
    + '<circle cx="0" cy="0" r="' + (3.8 * k) + '" fill="' + g.l + '"/>'
    + '<path d="M' + (14 * k) + ' ' + (14 * k) + ' l' + (9 * k) + ' ' + (-3 * k) + ' l' + (-3 * k) + ' ' + (9 * k) + ' z" fill="' + g.m + '" opacity="0.9"/>'
    + '</g>';
}

/* ── the aperture ───────────────────────────────────────────────────────────
   A round-headed window: straight sides, a shouldered arch across the top, and
   a straight sill. Returned as a path so it can be both the hole punched in
   the ground and the line drawn round it. */
function aperturePath(a) {
  return 'M' + a.x0 + ' ' + a.sill
    + ' L' + a.x0 + ' ' + a.spring
    + ' Q' + a.x0 + ' ' + a.crown + ' ' + ((a.x0 + a.x1) / 2) + ' ' + a.crown
    + ' Q' + a.x1 + ' ' + a.crown + ' ' + a.x1 + ' ' + a.spring
    + ' L' + a.x1 + ' ' + a.sill + ' Z';
}

function face(opts) {
  const W = opts.width, H = opts.height, bleed = opts.bleed || 0;
  const k = W / 825;
  const tw = W - bleed * 2, th = H - bleed * 2;
  const cx = W / 2;
  const suit = opts.suit || 'major';
  const g = METAL[suit] || METAL.major;
  const mark = (MARKS[suit] || MARKS.major)(g);
  const ink = INK[opts.ink] || INK[suit] || INK.major;
  const title = String(opts.title || '').toUpperCase();
  const num = numeralFor(opts.rank, opts.numeral);

  /* The radius the card will be cut to, so the frame can follow it. A rule
     that ignores the die runs straight into a curve and gets bitten off at
     both ends, which is what the first rounded card did to its own corners. */
  const round = Math.max(0, Math.min(50, Number(opts.round) || 0));
  const cardR = tw * round / 100;
  const ruleR = Math.max(0, cardR - 22 * k);
  // Scrollwork needs a corner to sit in. Past about a tenth there is not one.
  const scrolled = round < 9;

  // the outer rule, close to the trim
  const o0 = bleed + 22 * k, o1x = bleed + tw - 22 * k, o1y = bleed + th - 22 * k;

  /* The window. Its head leaves room for the numeral above it and its sill
     leaves room for the name below — the ground between them is the card, and
     the card is what the frame is made of. */
  const a = {
    x0: bleed + 56 * k, x1: bleed + tw - 56 * k,
    crown: bleed + 150 * k, spring: bleed + 268 * k,
    sill: bleed + th - 208 * k,
  };

  const size = Math.max(26, Math.min(46, 900 / Math.max(title.length, 9))) * k;
  const track = (title.length > 16 ? 3 : 5) * k;
  const nameY = a.sill + 84 * k;
  // Georgia caps run about 0.62 of the point size, plus whatever tracking
  // is on. Near enough to put a diamond just clear of the last letter.
  const setW = title.length * (size * 0.62 + track);
  const half = setW / 2 + 30 * k;                      // where the flanking pips go

  return ''
    + '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">'
    + '<defs>'
      // the ground: not flat black — a card has a colour even where it is dark
      + '<linearGradient id="gr" x1="0" y1="0" x2="0.3" y2="1">'
        + '<stop offset="0%" stop-color="' + g.ground + '"/>'
        + '<stop offset="46%" stop-color="#1a1512"/>'
        + '<stop offset="100%" stop-color="' + g.ground + '"/>'
      + '</linearGradient>'
      // and a breath of light off the head of the window, so the ground is lit
      + '<radialGradient id="glow" cx="50%" cy="' + (100 * (a.crown / H)) + '%" r="60%">'
        + '<stop offset="0%" stop-color="' + g.m + '" stop-opacity="0.16"/>'
        + '<stop offset="100%" stop-color="' + g.m + '" stop-opacity="0"/>'
      + '</radialGradient>'
      + '<clipPath id="win"><path d="' + aperturePath(a) + '"/></clipPath>'
    + '</defs>'

    /* The ground, with the window cut out of it. evenodd: the outer rectangle
       is filled, the aperture inside it is not, so the photograph beneath
       shows through the window and nowhere else. This is the whole trick — the
       picture is inside the card rather than behind a frame laid on top. */
    + '<path fill-rule="evenodd" fill="url(#gr)" d="M0 0 H' + W + ' V' + H + ' H0 Z '
      + aperturePath(a) + '"/>'
    + '<path fill-rule="evenodd" fill="url(#glow)" d="M0 0 H' + W + ' V' + H + ' H0 Z '
      + aperturePath(a) + '"/>'

    // the window's own edge: a shadow inside it, then the metal line around it
    + '<g clip-path="url(#win)">'
      + '<path d="' + aperturePath(a) + '" fill="none" stroke="#000" stroke-width="' + (16 * k) + '" opacity="0.45"/>'
    + '</g>'
    + '<path d="' + aperturePath(a) + '" fill="none" stroke="' + g.m + '" stroke-width="' + (2.6 * k) + '"/>'
    + '<path d="' + aperturePath(a) + '" fill="none" stroke="' + g.l + '" stroke-width="' + (0.9 * k) + '" '
      + 'opacity="0.55" transform="translate(0,' + (3.4 * k) + ') scale(1,' + (1 - 6.8 * k / H) + ')"/>'

    // the outer rule and its corners
    + '<rect x="' + o0 + '" y="' + o0 + '" width="' + (o1x - o0) + '" height="' + (o1y - o0) + '" '      + 'rx="' + ruleR + '" ry="' + ruleR + '" '
      + 'fill="none" stroke="' + g.m + '" stroke-width="' + (2 * k) + '" opacity="0.9"/>'
    + '<rect x="' + (o0 + 7 * k) + '" y="' + (o0 + 7 * k) + '" width="' + (o1x - o0 - 14 * k) + '" '      + 'height="' + (o1y - o0 - 14 * k) + '" rx="' + Math.max(0, ruleR - 7 * k) + '" '      + 'ry="' + Math.max(0, ruleR - 7 * k) + '" fill="none" stroke="' + ink.line + '" '      + 'stroke-width="' + (1.1 * k) + '" opacity="0.62"/>'    + (scrolled ? '<g transform="translate(' + o0 + ',' + o0 + ')">' + corner(k, g) + '</g>'
    + '<g transform="translate(' + o1x + ',' + o0 + ') scale(-1,1)">' + corner(k, g) + '</g>'
    + '<g transform="translate(' + o0 + ',' + o1y + ') scale(1,-1)">' + corner(k, g) + '</g>'
    + '<g transform="translate(' + o1x + ',' + o1y + ') scale(-1,-1)">' + corner(k, g) + '</g>' : '')

    /* At the head: the numeral if the card has one, the suit's mark if it does
       not. Courts and the Fool have no number, and pretending otherwise is how
       a deck ends up with a II of Kings. */
    + (num
      ? '<text x="' + cx + '" y="' + (bleed + 108 * k) + '" text-anchor="middle" '
        + 'font-family="Georgia, serif" font-size="' + (54 * k) + '" letter-spacing="' + (5 * k) + '" '
        + 'fill="' + g.l + '">' + num + '</text>'
      : '<g transform="translate(' + (cx - 20 * k * 1.05) + ',' + (bleed + 52 * k) + ') scale(' + (k * 1.05) + ')">'
        + mark + '</g>')
    + '<g transform="translate(' + cx + ',' + (bleed + 128 * k) + ')">' + spray(k, g, ink) + '</g>'

    // and at the foot: the name, flanked, on the ground rather than on a plate
    + '<text x="' + cx + '" y="' + nameY + '" text-anchor="middle" '
      + 'font-family="Georgia, \'Bookman Old Style\', serif" font-size="' + size + '" '
      + 'letter-spacing="' + track + '" fill="' + g.l + '">' + title + '</text>'
    + '<g transform="translate(' + (cx - half) + ',' + (nameY - size * 0.34) + ') scale(-1,1)">' + scroll(k, g, ink) + '</g>'
    + '<g transform="translate(' + (cx + half) + ',' + (nameY - size * 0.34) + ')">' + scroll(k, g, ink) + '</g>'
    + '</svg>';
}

/* ── the sheet it is printed on ─────────────────────────────────────────────
   Grain, laid over everything at the very end — photograph, ground and metal
   together. It is the cheapest change on this card and the one that does the
   most: two crisp things from two different worlds stop looking like two
   things once they share a surface.

   Seeded off the card's own name, so re-cutting the same card gives the same
   sheet rather than a new one every render. */
function grain(W, H, title) {
  let seed = 2166136261;
  for (let i = 0; i < String(title).length; i++) {
    seed ^= String(title).charCodeAt(i); seed = Math.imul(seed, 16777619);
  }
  const rand = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 1000) / 1000; };

  const buf = Buffer.alloc(W * H * 4);
  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i += 4) {
      // fine tooth, plus a slow swell across the sheet so it is not a flat hiss
      const fine = rand();
      const swell = 0.5 + 0.5 * Math.sin(x / 190 + y / 260) * Math.sin(y / 150);
      const v = Math.max(0, Math.min(255, Math.round(128 + (fine - 0.5) * 46 + (swell - 0.5) * 12)));
      buf[i] = buf[i + 1] = buf[i + 2] = v;
      buf[i + 3] = 40;                       // laid on lightly; it should be felt, not seen
    }
  }
  return buf;
}

module.exports = { face, grain, MARKS, METAL, INK, numeralFor };

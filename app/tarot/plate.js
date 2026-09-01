/* The photograph, cropped and given the weather of its suit.

   Split out from the command line so the site can call exactly the same code:
   she uploads a picture, this makes the plate, frame.js makes the card parts,
   and the two are composited. One set of rules, two front doors. */
const sharp = require('sharp');

/* A photograph deck holds together by tone before anything else. Each suit
   gets its own weather — change a number here and every card of that suit
   moves with it, which is the whole reason for doing this as a generator. */
const SUITS = {
  swords:    { label: 'Swords',    wash: '#33506e', washOpacity: 0.32, sat: 0.24, contrast: 1.20, lift: -12,
               burn: 0.28, tame: 0.88, tameAbove: 196, tameNeutral: 14, tameSoft: 4 },
  cups:      { label: 'Cups',      wash: '#2f5f6b', washOpacity: 0.28, sat: 0.54, contrast: 1.06, lift: -6,
               burn: 0.18, tame: 0.72, tameAbove: 205, tameNeutral: 12, tameSoft: 4 },
  wands:     { label: 'Wands',     wash: '#7a3c14', washOpacity: 0.32, sat: 0.76, contrast: 1.12, lift: -8,
               burn: 0.24, tame: 0.70, tameAbove: 208, tameNeutral: 10, tameSoft: 4 },
  pentacles: { label: 'Pentacles', wash: '#4a4a1e', washOpacity: 0.28, sat: 0.72, contrast: 1.08, lift: -8,
               burn: 0.22, tame: 0.70, tameAbove: 208, tameNeutral: 10, tameSoft: 4 },
  major:     { label: '',          wash: '#3a2352', washOpacity: 0.34, sat: 0.62, contrast: 1.14, lift: -10,
               burn: 0.26, tame: 0.76, tameAbove: 200, tameNeutral: 12, tameSoft: 4 },
};

/* Where the window sits on the photograph.

   zoom 1 fits the whole of the shorter side; above that it moves in. x and y
   run 0 to 1 and say where the middle of the window sits, so 0.5 / 0.5 is dead
   centre — which is what "it is not centred" actually needs, rather than one
   number that could only slide sideways. */
function windowOn(meta, W, H, view) {
  const zoom = Math.max(1, Number(view.zoom) || 1);
  const want = W / H;

  // the largest window of the card's shape that fits, then closed in by zoom
  let w = Math.min(meta.width, meta.height * want);
  let h = w / want;
  if (h > meta.height) { h = meta.height; w = h * want; }
  w = Math.round(w / zoom); h = Math.round(h / zoom);

  const fx = view.x == null ? 0.5 : Math.min(1, Math.max(0, Number(view.x)));
  const fy = view.y == null ? 0.5 : Math.min(1, Math.max(0, Number(view.y)));
  const left = Math.round((meta.width - w) * fx);
  const top = Math.round((meta.height - h) * fy);
  return { left: Math.max(0, left), top: Math.max(0, top), width: w, height: h };
}

async function plate(photo, suitKey, W, H, view) {
  const s = SUITS[suitKey] || SUITS.major;
  const meta = await sharp(photo).metadata();
  const win = windowOn(meta, W, H, view || {});

  const cut = sharp(photo).extract(win).resize(W, H, { fit: 'cover' });

  // The untreated window, because the mask below reads colour and desaturating
  // first is exactly what would blind it.
  const plain = await cut.clone().removeAlpha().raw().toBuffer();

  let buf = await cut.clone()
    .modulate({ saturation: s.sat })
    .linear(s.contrast, s.lift)
    .png().toBuffer();

  /* Blown highlights are where a faire photograph gives away the century: a
     white tent, a plastic chair, a paper cup, the peace-tie knotted round a
     blade. They are always the brightest thing in the frame, so they are
     always what the eye finds first.

     Brightness alone will not find them. Skin in sunlight is as bright as
     white cloth, so every threshold that catches a ribbon also bleaches the
     hands and leaves the wearer looking drowned.

     Colour separates them. Measured on the first photograph in this deck: the
     peace-tie is neutral, red minus blue of -10; the white chairs +8; his hand
     +34, his forearm +47, his cheek +54. Skin is warm and cloth is not. So the
     mask is bright AND neutral, and cannot touch a face however sunlit — which
     is the property that matters, because every card here is a person. */
  if (s.tame) {
    const raw = Buffer.alloc(W * H);
    for (let i = 0, p = 0; i < raw.length; i++, p += 3) {
      const R = plain[p], G = plain[p + 1], B = plain[p + 2];
      const L = R * 0.299 + G * 0.587 + B * 0.114;
      raw[i] = (L > s.tameAbove && (R - B) < s.tameNeutral) ? 255 : 0;
    }
    /* How hard to press is baked into the mask by scaling it: sharp's
       composite has no opacity of its own — it accepts the key and silently
       ignores it, which is a quiet way to spend an afternoon. */
    const mask = await sharp(raw, { raw: { width: W, height: H, channels: 1 } })
      .blur(s.tameSoft).linear(s.tame, 0).toColourspace('b-w').raw().toBuffer();
    const shade = await sharp({ create: { width: W, height: H, channels: 3, background: s.wash } })
      .joinChannel(mask, { raw: { width: W, height: H, channels: 1 } })
      .png().toBuffer();
    buf = await sharp(buf).composite([{ input: shade, blend: 'over' }]).png().toBuffer();
  }

  const rect = c => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H
    + '"><rect width="' + W + '" height="' + H + '" fill="' + c[0] + '" opacity="' + c[1] + '"/></svg>');

  /* A vignette heavy enough to put a modern afternoon back into shadow, and
     heavier still at the head of the card, which is where every photograph
     taken at a faire keeps its car park. */
  const vignette = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">'
    + '<defs><radialGradient id="v" cx="50%" cy="44%" r="74%">'
    + '<stop offset="30%" stop-color="#000" stop-opacity="0"/>'
    + '<stop offset="70%" stop-color="#000" stop-opacity="0.56"/>'
    + '<stop offset="100%" stop-color="#000" stop-opacity="0.97"/></radialGradient>'
    + '<linearGradient id="t" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#000" stop-opacity="0.86"/>'
    + '<stop offset="34%" stop-color="#000" stop-opacity="0"/></linearGradient></defs>'
    + '<rect width="' + W + '" height="' + H + '" fill="url(#v)"/>'
    + '<rect width="' + W + '" height="' + H + '" fill="url(#t)"/></svg>');

  return sharp(buf).composite([
    { input: rect([s.wash, s.washOpacity]), blend: 'soft-light' },
    { input: rect(['#8d8d8d', s.burn]), blend: 'colour-burn' },
    { input: vignette },
  ]).png().toBuffer();
}

module.exports = { plate, SUITS, windowOn };

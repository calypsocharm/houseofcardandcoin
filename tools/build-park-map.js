/* Draws assets/img/sunset-park-parking.svg from tools/park-geo.json.
   Every lot, road and shoreline on it is traced from OpenStreetMap survey
   data, so the shapes and positions are real — nothing here is drawn by eye.

   What the map deliberately does NOT show: which lots the faire opens, where
   the shuttles run, or where the overflow is. The faire had not published any
   of that for 2026 as of 2026-08-10 ("Information Coming Soon"), and the
   arrangement demonstrably changes year to year. Guessing would send people
   to the wrong gate. Re-run this once they publish and add a highlight layer.

   Usage: node tools/build-park-map.js   */
const fs = require('fs'), path = require('path');

const geo = JSON.parse(fs.readFileSync(path.join(__dirname, 'park-geo.json'), 'utf8'));
const park = geo.elements.find(e => e.tags.leisure === 'park');
if (!park) throw new Error('no park polygon in park-geo.json');

// ── projection ─────────────────────────────────────────────────────────────
const pts = park.rings.flat();
const lat = pts.map(p => p[0]), lon = pts.map(p => p[1]);
const B = { s: Math.min(...lat), n: Math.max(...lat), w: Math.min(...lon), e: Math.max(...lon) };
const PAD = 0.0009;                                   // ~100 m of context
B.s -= PAD; B.n += PAD; B.w -= PAD; B.e += PAD;

const midLat = (B.s + B.n) / 2;
const kx = Math.cos(midLat * Math.PI / 180);           // longitude shrinks with latitude
const W = 1000;
const H = Math.round(W * ((B.n - B.s) / ((B.e - B.w) * kx)));
const X = lo => ((lo - B.w) / (B.e - B.w)) * W;
const Y = la => H - ((la - B.s) / (B.n - B.s)) * H;
const metresPerX = ((B.e - B.w) * kx * 111320) / W;

const inBox = r => r.some(p => p[0] >= B.s && p[0] <= B.n && p[1] >= B.w && p[1] <= B.e);
const d = ring => ring.map((p, i) => (i ? 'L' : 'M') + X(p[1]).toFixed(1) + ' ' + Y(p[0]).toFixed(1)).join(' ');
const poly = e => e.rings.filter(inBox).map(r => d(r) + ' Z').join(' ');
const line = e => e.rings.filter(inBox).map(d).join(' ');

// ── layers ─────────────────────────────────────────────────────────────────
const water = geo.elements.filter(e => e.tags.natural === 'water' || e.tags.landuse === 'reservoir').filter(e => e.rings.some(inBox));
const lots  = geo.elements.filter(e => e.tags.amenity === 'parking').filter(e => e.rings.some(inBox));
const MAJOR = /^(motorway|trunk|primary|secondary)$/;
const roadsBig   = geo.elements.filter(e => MAJOR.test(e.tags.highway || '')).filter(e => e.rings.some(inBox));
const roadsSmall = geo.elements.filter(e => /^(tertiary|residential|service)$/.test(e.tags.highway || '')).filter(e => e.rings.some(inBox));

// Lot area, in real square metres, via the shoelace formula on projected metres.
function areaM2(e) {
  const r = e.rings[0]; if (!r || r.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    const x1 = r[i][1] * 111320 * kx, y1 = r[i][0] * 111320;
    const x2 = r[j][1] * 111320 * kx, y2 = r[j][0] * 111320;
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
}
function centre(e) {
  const r = e.rings[0], la = r.map(p => p[0]), lo = r.map(p => p[1]);
  return [ (Math.min(...lo) + Math.max(...lo)) / 2, (Math.min(...la) + Math.max(...la)) / 2 ];
}
// ~28 m² per stall once aisles are counted — a planning rule of thumb, so the
// figure is shown rounded and described as approximate.
const stalls = e => Math.round(areaM2(e) / 28 / 5) * 5;

const named = lots.map(e => ({ e, a: areaM2(e) })).sort((x, y) => y.a - x.a);
const bigOnes = named.filter(x => x.a > 3000);

/* Our camp. Mama Bear placed it on 2026-08-10: across the road from the
   ~165-car lot near Eastern Avenue, in the square unlabelled lot. That is
   way/305179040 — 53 x 58 m, the only square one anywhere near it; its
   neighbours are the two crescents, which are nothing like square.
   Held as an id rather than a hand-placed pin so it survives a redraw. */
const CAMP_LOT = 'way/305179040';
const camp = lots.find(e => e.id === CAMP_LOT);
if (!camp) console.warn('  ! camp lot ' + CAMP_LOT + ' not found — the X will be missing');

// ── road labels ────────────────────────────────────────────────────────────
// One label per named road, placed on its longest visible run.
const labels = {};
roadsBig.forEach(e => {
  const n = e.tags.name; if (!n) return;
  e.rings.filter(inBox).forEach(r => {
    if (!labels[n] || r.length > labels[n].r.length) labels[n] = { r, e };
  });
});

// ── scale bar ──────────────────────────────────────────────────────────────
const barM = 200, barPx = barM / metresPerX;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t desc">
<title id="t">Parking at Sunset Park</title>
<desc id="desc">Every public parking lot in Sunset Park, Las Vegas, drawn from OpenStreetMap survey data. The faire has not yet published which lots it opens for 2026.</desc>
<defs>
  <style>
    .ground{fill:#e8e0c6}
    .park{fill:#cfdcbc;stroke:#a8bb90;stroke-width:2}
    .water{fill:#b9d3dd;stroke:#8fb3c0;stroke-width:1.5}
    .road{fill:none;stroke:#f6efdd;stroke-linecap:round;stroke-linejoin:round}
    .road-case{fill:none;stroke:#cbb98f;stroke-linecap:round;stroke-linejoin:round}
    .lot{fill:#c2a14d;fill-opacity:.55;stroke:#8a6d2a;stroke-width:1.6}
    .lot-big{fill-opacity:.8}
    /* Sized to survive the map being shown about 700 px wide on the camp
       page, not for reading at full resolution. */
    .rd-label{font:600 21px Georgia,serif;fill:#6b5a33}
    .lot-label{font:700 26px Georgia,serif;fill:#4a3a12}
    .lot-sub{font:400 17px Georgia,serif;fill:#5c4b28}
    .key{font:400 19px Georgia,serif;fill:#3a2c17}
    .key-h{font:700 18px Georgia,serif;fill:#6e1a1a;letter-spacing:.08em}
    .cred{font:400 15px Georgia,serif;fill:#7a6749}
    .halo{paint-order:stroke;stroke:#fbf6e9;stroke-width:4px;stroke-linejoin:round}
    /* Same red as the X on the faire's illustrated map, so the two maps
       agree about which mark means "us". */
    .camp{fill:#e23b2e;fill-opacity:.3;stroke:#e23b2e;stroke-width:4}
    .camp-x{stroke:#e23b2e;stroke-width:11;stroke-linecap:round}
    .camp-label{font:700 22px Georgia,serif;fill:#fff;letter-spacing:.05em}
  </style>
</defs>

<rect class="ground" x="0" y="0" width="${W}" height="${H}"/>
<path class="park" d="${poly(park)}"/>
${water.map(e => `<path class="water" d="${poly(e)}"/>`).join('\n')}

<g class="road-case" stroke-width="13">${roadsBig.map(e => `<path d="${line(e)}"/>`).join('')}</g>
<g class="road-case" stroke-width="6">${roadsSmall.map(e => `<path d="${line(e)}"/>`).join('')}</g>
<g class="road" stroke-width="10">${roadsBig.map(e => `<path d="${line(e)}"/>`).join('')}</g>
<g class="road" stroke-width="4">${roadsSmall.map(e => `<path d="${line(e)}"/>`).join('')}</g>

${lots.map(e => `<path class="lot${areaM2(e) > 3000 ? ' lot-big' : ''}" d="${poly(e)}"/>`).join('\n')}

${bigOnes.map(({ e, a }) => {
  const [lo, la] = centre(e);
  return `<text class="lot-label halo" x="${X(lo).toFixed(0)}" y="${Y(la).toFixed(0)}" text-anchor="middle">P</text>` +
         `<text class="lot-sub halo" x="${X(lo).toFixed(0)}" y="${(Y(la) + 20).toFixed(0)}" text-anchor="middle">~${stalls(e)} cars</text>`;
}).join('\n')}

${camp ? (() => {
  const [lo, la] = centre(camp);
  const cx = X(lo), cy = Y(la);
  // Size the X to the lot rather than fixing it, so it marks the square
  // instead of swamping it.
  const cr = camp.rings[0];
  const lw = Math.abs(X(Math.max(...cr.map(p => p[1]))) - X(Math.min(...cr.map(p => p[1]))));
  const lh = Math.abs(Y(Math.max(...cr.map(p => p[0]))) - Y(Math.min(...cr.map(p => p[0]))));
  const r = Math.max(16, Math.min(lw, lh) * 0.36);
  // Below the X, not above: above puts it straight on top of the ~165-car
  // lot's own label, which sits just to the north. Below is open ground.
  const w = 250, lx = Math.min(Math.max(cx, w / 2 + 8), W - w / 2 - 8), ly = cy + 76;
  return `<path class="camp" d="${poly(camp)}"/>
<g class="camp-x"><line x1="${(cx - r).toFixed(0)}" y1="${(cy - r).toFixed(0)}" x2="${(cx + r).toFixed(0)}" y2="${(cy + r).toFixed(0)}"/><line x1="${(cx + r).toFixed(0)}" y1="${(cy - r).toFixed(0)}" x2="${(cx - r).toFixed(0)}" y2="${(cy + r).toFixed(0)}"/></g>
<g transform="translate(${lx.toFixed(0)} ${ly.toFixed(0)})">
  <rect x="${(-w / 2).toFixed(0)}" y="-23" width="${w}" height="33" rx="4" fill="#e23b2e"/>
  <text class="camp-label" x="0" y="0" text-anchor="middle">OUR CAMP SITE</text>
</g>`;
})() : ''}

${Object.keys(labels).map(n => {
  const r = labels[n].r, m = r[Math.floor(r.length / 2)];
  const a = r[Math.max(0, Math.floor(r.length / 2) - 3)], b = r[Math.min(r.length - 1, Math.floor(r.length / 2) + 3)];
  let ang = Math.atan2(Y(b[0]) - Y(a[0]), X(b[1]) - X(a[1])) * 180 / Math.PI;
  if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
  return `<text class="rd-label halo" x="${X(m[1]).toFixed(0)}" y="${Y(m[0]).toFixed(0)}" text-anchor="middle" transform="rotate(${ang.toFixed(1)} ${X(m[1]).toFixed(0)} ${Y(m[0]).toFixed(0)})" dy="-8">${esc(n.replace(/^(East|South|West|North) /, ''))}</text>`;
}).join('\n')}

<g transform="translate(${W - 92} 46)">
  <circle r="30" fill="#fbf6e9" stroke="#8a6d2a" stroke-width="1.5"/>
  <path d="M0 -21 L7 6 L0 1 L-7 6 Z" fill="#6e1a1a"/>
  <text y="22" text-anchor="middle" class="key-h">N</text>
</g>

<g transform="translate(28 ${H - 34})">
  <rect x="-6" y="-20" width="${barPx + 74}" height="30" fill="#fbf6e9" fill-opacity=".85" stroke="#cbb98f"/>
  <line x1="0" y1="0" x2="${barPx.toFixed(0)}" y2="0" stroke="#3a2c17" stroke-width="3"/>
  <line x1="0" y1="-5" x2="0" y2="5" stroke="#3a2c17" stroke-width="3"/>
  <line x1="${barPx.toFixed(0)}" y1="-5" x2="${barPx.toFixed(0)}" y2="5" stroke="#3a2c17" stroke-width="3"/>
  <text class="key" x="${(barPx + 8).toFixed(0)}" y="5">${barM} m</text>
</g>

<g transform="translate(30 34)">
  <rect x="-16" y="-26" width="430" height="158" fill="#fbf6e9" fill-opacity=".94" stroke="#cbb98f" stroke-width="1.5"/>
  <text class="key-h" x="0" y="0">PARKING AT SUNSET PARK</text>
  <rect x="0" y="16" width="28" height="19" class="lot lot-big"/>
  <text class="key" x="38" y="32">Public lot &#8212; capacity approximate</text>
  <rect x="0" y="46" width="28" height="19" class="camp"/>
  <text class="key" x="38" y="62">Our camp site</text>
  <text class="cred" x="0" y="96">The faire has not published which lots it opens</text>
  <text class="cred" x="0" y="116">for 2026. Map data &#169; OpenStreetMap contributors.</text>
</g>
</svg>
`;

const out = path.join(__dirname, '..', 'assets', 'img', 'sunset-park-parking.svg');
fs.writeFileSync(out, svg);
console.log('wrote assets/img/sunset-park-parking.svg  ' + W + 'x' + H +
  '  (' + Math.round(svg.length / 1024) + ' KB)');
console.log('  lots drawn: ' + lots.length + ', labelled: ' + bigOnes.length +
  ', roads: ' + (roadsBig.length + roadsSmall.length));
console.log('  biggest: ' + bigOnes.slice(0, 5).map(x => '~' + stalls(x.e) + ' cars').join(', '));

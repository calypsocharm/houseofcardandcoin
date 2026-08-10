/* Pulls the real geography of Sunset Park from OpenStreetMap so the guild's
   parking map is traced from survey data rather than drawn from memory.
   Output: tools/park-geo.json — run again to refresh.

   OSM data is ODbL; the rendered map credits it.  */
const fs = require('fs'), path = require('path');
const EP = 'https://overpass.kumi.systems/api/interpreter';
const UA = 'houseofcardandcoin-guild-map/1.0 (https://houseofcardandcoin.com)';

// Sunset Park, Las Vegas — a generous box around 2601 E Sunset Rd.
const BOX = '36.055,-115.135,36.085,-115.085';

const Q = `[out:json][timeout:120];
(
  way["leisure"="park"]["name"~"Sunset Park",i](${BOX});
  relation["leisure"="park"]["name"~"Sunset Park",i](${BOX});
  way["amenity"="parking"](${BOX});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|service)$"](${BOX});
  way["natural"="water"](${BOX});
  // Sunset Lake is a multipolygon relation, not a way — asking only for ways
  // silently dropped the biggest landmark in the park.
  relation["natural"="water"](${BOX});
  way["landuse"="reservoir"](${BOX});
);
out geom;`;

function post(q) {
  return fetch(EP, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(q),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA }
  }).then(r => r.text()).then(t => {
    if (t.trim()[0] !== '{') throw new Error('overpass said: ' + t.slice(0, 200));
    return JSON.parse(t);
  });
}

post(Q).then(j => {
  const out = { fetched: new Date().toISOString(), box: BOX, elements: [] };
  j.elements.forEach(e => {
    let rings = [];
    if (e.geometry) rings = [e.geometry];
    else if (e.members) rings = e.members.map(m => m.geometry).filter(Boolean);
    if (!rings.length) return;
    out.elements.push({
      id: e.type + '/' + e.id,
      tags: e.tags || {},
      rings: rings.map(r => r.map(p => [ +p.lat.toFixed(6), +p.lon.toFixed(6) ]))
    });
  });
  fs.writeFileSync(path.join(__dirname, 'park-geo.json'), JSON.stringify(out));
  const by = {};
  out.elements.forEach(e => {
    const k = e.tags.amenity === 'parking' ? 'parking'
            : e.tags.leisure === 'park' ? 'park'
            : e.tags.highway ? 'road'
            : (e.tags.natural === 'water' || e.tags.landuse === 'reservoir') ? 'water' : 'other';
    by[k] = (by[k] || 0) + 1;
  });
  console.log('saved tools/park-geo.json —', out.elements.length, 'elements', JSON.stringify(by));
}).catch(e => { console.error('FAILED:', e.message); process.exit(1); });

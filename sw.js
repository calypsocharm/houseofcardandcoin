/* The House, kept on a phone.

   The point of this is one weekend a year: a park with a festival hanging off
   one cell tower, where the camp page and the FAQ are what people open and the
   connection is the enemy. Everything here is in service of that.

   What it will and will not keep is the whole design, and the rule is simple:
   it caches things that are the same for everybody, and never anything that
   knows who you are.

     · pictures, stylesheets, scripts, sound  — kept, served from the phone
       first, and quietly replaced in the background when the network answers
     · a handful of public pages               — network first, so a change on
       the site always wins; the copy is only there for when there is no signal
     · anything under /members, /board, /api,
       /uploads, or any response the House has
       marked private                          — never kept, never served from
       a cache, no exceptions

   That last rule is why the FAQ is safe to keep offline: the version showing
   the Elder's number to a signed-in guildmate comes back marked private and is
   thrown away, so the copy on the phone is always the public one.

   Bumping CACHE retires everything from the version before it. */
const CACHE = 'hocc-v2';

/* The pages worth having when there is no signal. Deliberately short — these
   are the ones somebody opens standing in the park. */
const PAGES = ['/', '/camp.html', '/faq', '/events.html', '/weekend', '/map', '/offline'];

/* Never touched by the cache, in either direction. */
const PRIVATE = /^\/(members|board|api|uploads|tavern|guild\/|join)/;

self.addEventListener('install', function (e) {
  // The offline page is the only thing fetched up front. Everything else
  // arrives as it is used, so installing costs a few kilobytes rather than
  // the whole site.
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.add('/offline'); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
                               .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

// A response the House has marked as personal, or that a cache should not hold.
function personal(res) {
  if (!res) return true;
  if (res.headers.get('X-Private') === '1') return true;
  const cc = res.headers.get('Cache-Control') || '';
  return /no-store|private/.test(cc);
}

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // somebody else's server
  if (PRIVATE.test(url.pathname)) return;               // the House's own business

  const isPage = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  /* Pages: the network first, always. A cached page is a last resort, never a
     shortcut — the schedule can change on the Saturday and a phone showing
     yesterday's is worse than a phone showing nothing. */
  if (isPage) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res.ok && !personal(res) && PAGES.indexOf(url.pathname) > -1) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('/offline');
        });
      })
    );
    return;
  }

  /* Everything else — pictures, stylesheets, scripts, sound. These carry a
     version stamp in their address, so a cached one is never the wrong one:
     when a file changes its address changes with it. Served from the phone
     first, and refreshed behind your back. */
  e.respondWith(
    caches.match(req).then(function (hit) {
      const live = fetch(req).then(function (res) {
        /* A page asked for by a script rather than by the address bar arrives
           down here, where the allowlist above has not been applied. Judge it
           by what came back rather than by what was asked for, or any page
           fetched in the background would quietly end up on the phone. */
        const type = res.headers.get('Content-Type') || '';
        const html = type.indexOf('text/html') > -1;
        if (res.ok && !personal(res) && (!html || PAGES.indexOf(url.pathname) > -1)) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || live;
    })
  );
});

const CACHE = 'scotland-guide-v10';

const PRECACHE = [
  '/scotland-guide/',
  '/scotland-guide/index.html',
  '/scotland-guide/region.html',
  '/scotland-guide/poi.html',
  '/scotland-guide/style.css',
  '/scotland-guide/compass.js',
  '/scotland-guide/manifest.json',
  '/scotland-guide/map.html',
  '/scotland-guide/data/edinburgh.json',
  '/scotland-guide/data/glasgow.json',
  '/scotland-guide/data/oban.json',
  '/scotland-guide/data/fort-william.json',
  '/scotland-guide/data/inverness.json',
  '/scotland-guide/data/skye.json',
  '/scotland-guide/data/scenic-rail.json',
  '/scotland-guide/data/antwerp.json',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

// Install — cache all core files
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// Activate — delete old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — smart caching strategy
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // HTML navigations — always network first, never serve stale HTML
  // This ensures ?region= and ?id= params are always respected
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Map tiles — network first, cache as fallback
  if (url.hostname.includes('cartocdn.com') || url.hostname.includes('basemaps')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // External images (Unsplash etc) — network only, don't cache
  if (!url.hostname.includes('github.io') && !url.hostname.includes('unpkg.com') &&
      !url.hostname.includes('fonts.g') && url.pathname.match(/\.(jpg|jpeg|png|webp)$/i)) {
    e.respondWith(fetch(e.request).catch(() => new Response('')));
    return;
  }

  // Everything else (JS, CSS, JSON data) — cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
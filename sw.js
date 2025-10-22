/* Trip Tracker — Service Worker (2025-10-23) */
const CACHE_VERSION = 'TT_CACHE_v1_2025-10-23';
const STATIC_ASSETS = [
  '/', '/index.html',
  '/style.css', '/app.js', '/utils.js',
  '/manifest.json',
  '/reports.html','/reports.js',
  '/analytics.html','/analytics.js',
  '/settings.html','/settings.js',
  '/offline.html', '/privacy.html',
  '/assets/icons/icon-192.png', '/assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_VERSION ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

async function networkFirst(req, timeoutMs = 4000) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const fresh = await fetch(req, { signal: controller.signal });
    clearTimeout(id);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    if (req.mode === 'navigate') return caches.match('/offline.html');
    throw new Error('Network & cache failed');
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  if (fresh && fresh.ok) cache.put(req, fresh.clone());
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (isSameOrigin && STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', () => {
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) client.postMessage({ type: 'NEW_VERSION_AVAILABLE' });
  });
});

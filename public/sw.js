// Simplified Service Worker for PWA + basic caching
const APP_CACHE = 'app-shell-v1';
const RUNTIME_CATALOG = 'runtime-catalog-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(APP_CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === APP_CACHE || k === RUNTIME_CATALOG ? null : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

function isCatalogRequest(req) {
  try {
    const url = new URL(req.url);
    return url.pathname.startsWith(`${self.registration.scope}catalog`);
  } catch (_) {
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Catalog: Stale-While-Revalidate
  if (isCatalogRequest(request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CATALOG);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => undefined);
        return cached || (await network) || fetch(request);
      })()
    );
    return;
  }

  // App shell: Cache First for navigations/assets
  const dest = request.destination;
  if (['document', 'style', 'script', 'image', 'font'].includes(dest)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(APP_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const res = await fetch(request).catch(() => undefined);
        if (res && res.ok) cache.put(request, res.clone());
        return res || fetch(request);
      })()
    );
  }
});


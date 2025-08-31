// Simplified Service Worker for PWA + caching strategies
// バージョンを更新すると古いキャッシュを自動破棄し、更新が反映されやすくなります。
// キャッシュ名を更新して旧版のHTML/CSS/JSを確実に破棄する
// 例: basePath やアセットパスが変わったときに旧ドキュメントが残ると、CSSが読めず「素のUI」に見えることがある
const APP_CACHE = 'app-shell-v5';
const RUNTIME_CATALOG = 'runtime-catalog-v5';

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
    const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");
    return url.pathname.startsWith(`${scopePath}/catalog`);
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

  const dest = request.destination;

  // Documents (HTML): Network First to avoid stale pages
  if (dest === 'document') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(APP_CACHE);
        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(request, { signal: controller.signal });
          clearTimeout(t);
          if (res && res.ok) cache.put(request, res.clone());
          return res;
        } catch (_) {
          const cached = await cache.match(request);
          return cached || fetch(request);
        }
      })()
    );
    return;
  }

  // Next.js assets: prefer fresh (Network First with fallback)
  if (urlIsNextAsset(request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(APP_CACHE);
        try {
          const res = await fetch(request);
          if (res && res.ok) cache.put(request, res.clone());
          return res;
        } catch (_) {
          const cached = await cache.match(request);
          return cached || fetch(request);
        }
      })()
    );
    return;
  }

  // Other assets: Cache First
  if (['style', 'script', 'image', 'font'].includes(dest)) {
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

function urlIsNextAsset(request) {
  try {
    const u = new URL(request.url);
    const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");
    return u.pathname.startsWith(`${scopePath}/_next/`);
  } catch (_) {
    return false;
  }
}

/* Offline helper ("service worker"). Keeps a copy of the app and of the free
   open-source AI helpers on the phone, so the studio opens without internet.
   It never touches your recordings. Change VERSION to push an app update. */
const VERSION = 'studio-v2'; // Phase 2
const CDN = /(^|\.)cdn\.jsdelivr\.net$|(^|\.)unpkg\.com$|(^|\.)storage\.googleapis\.com$/;

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(['./', './index.html'])).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('studio-v') && k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // app files: use the newest when online, the saved copy when offline
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))));
    return;
  }
  if (CDN.test(url.hostname)) {
    // AI helpers never change at a fixed version: saved copy first
    e.respondWith(caches.open('studio-cdn-v1').then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
  }
});

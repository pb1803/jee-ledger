// PWA service worker for JEE Track.
// Strategy (single-user, mobile-first):
//  - Static assets (/_next/static, icons, manifest, sw, offline page): cache-first
//    with background refresh, so the app shell paints fast and offline.
//  - Navigations + other same-origin GET: network-first, falling back to cache,
//    then to the offline page. Fresh data is preferred; stale cache is only used
//    when the network is unavailable.
//  - Cross-origin requests (Supabase REST/Storage, CDNs) are NEVER touched here,
//    so auth tokens and private API/private image responses are not cached by SW.
//  - On activate we delete old caches so a stale worker can't trap the user.

const CACHE = "jee-track-v2";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icon.svg",
  "/offline.html",
];
const STATIC_PREFIXES = [
  "/_next/static/",
  "/icon.svg",
  "/file.svg",
  "/globe.svg",
  "/next.svg",
  "/vercel.svg",
  "/window.svg",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline.html",
];

function isStatic(url) {
  const p = url.pathname;
  return STATIC_PREFIXES.some((s) => p.startsWith(s));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.allSettled(STATIC_ASSETS.map((a) => cache.add(a)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never cache Supabase/cross-origin

  // 1) Static assets: cache-first, refresh in background.
  if (isStatic(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.ok) {
              caches.open(CACHE).then((c) => c.put(request, res.clone()));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })(),
    );
    return;
  }

  // 2) Navigations: network-first, offline page fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        } catch {
          const cached = await caches.match(request);
          return cached || (await caches.match("/offline.html"));
        }
      })(),
    );
    return;
  }

  // 3) Other same-origin GET (RSC payloads, etc.): network-first + cache fallback.
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(request);
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      } catch {
        return (await caches.match(request)) || Response.error();
      }
    })(),
  );
});

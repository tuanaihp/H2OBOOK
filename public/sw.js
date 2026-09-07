const PRECACHE = "h2obook-precache-v5";
const PUBLIC_PAGES = "h2obook-public-pages-v5";
const STATIC_ASSETS = "h2obook-static-assets-v5";
const CORE = ["/offline", "/manifest.webmanifest", "/icons/icon.svg"];
const ACTIVE_CACHES = new Set([PRECACHE, PUBLIC_PAGES, STATIC_ASSETS]);

async function putBounded(cacheName, request, response, maxEntries) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key)));
}

function isPublicPage(pathname) {
  return pathname === "/" || pathname === "/academy" || pathname.startsWith("/academy/");
}

function canCache(response) {
  const directive = response.headers.get("cache-control") || "";
  return response.ok && !/private|no-store/i.test(directive);
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PRECACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !ACTIVE_CACHES.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        if (isPublicPage(url.pathname) && canCache(response)) {
          await putBounded(PUBLIC_PAGES, event.request, response.clone(), 20);
        }
        return response;
      } catch {
        return (await caches.match(event.request)) || (await caches.match("/offline"));
      }
    })());
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith((async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (canCache(response)) await putBounded(STATIC_ASSETS, event.request, response.clone(), 120);
      return response;
    })());
  }
});

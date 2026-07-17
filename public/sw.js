/**
 * CoachClip Service Worker for offline support.
 */

const CACHE_NAME = "coachclip-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json"
];

self.addEventListener("install", (event) => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Safe fail in local/dev environments where assets might be dynamically bundled
      });
    })
  );
});

self.addEventListener("activate", (event) => {
  // Claim clients and clear old caches if any
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Let browser handle standard non-GET requests, video assets, or external API calls directly
  if (
    event.request.method !== "GET" ||
    event.request.url.includes("/api/") ||
    event.request.url.endsWith(".mp4") ||
    event.request.url.endsWith(".mov")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Fail gracefully or return cached index.html for navigation requests
        if (event.request.mode === "navigate") {
          return caches.match("/index.html");
        }
        return new Response("Offline content not available", { status: 503 });
      });
    })
  );
});

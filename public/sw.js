/**
 * CoachClip Service Worker for offline support with Network-First strategy for app shell navigation.
 */

const CACHE_NAME = "coachclip-v2";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Safe fail in local/dev environments where assets might be dynamically bundled
      });
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Direct network handling for non-GET requests, API routes, video files, download endpoints, and Range requests
  if (
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.endsWith(".mp4") ||
    url.pathname.endsWith(".mov") ||
    url.pathname.includes("/download") ||
    event.request.headers.has("range")
  ) {
    return;
  }

  const isNavigation =
    event.request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname === "/index.html";

  // Requirement 1: Network-First for navigation requests and index.html
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback: return cached index.html or root
          return caches.match("/index.html").then((cachedIndex) => {
            if (cachedIndex) {
              return cachedIndex;
            }
            return caches.match("/").then((cachedRoot) => {
              return cachedRoot || new Response("Offline content not available", { status: 503 });
            });
          });
        })
    );
    return;
  }

  // Requirement 6: Static assets (.js, .css, etc.) - Cache-first with background revalidation
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith("http")) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            /* ignore background fetch errors */
          });
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith("http")) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});

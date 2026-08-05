/**
 * CoachClip Network-Only Service Worker
 * Version: coachclip-v3
 * Purges old stale PWA caches and delegates all requests directly to network.
 */

const CACHE_NAME = "coachclip-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith("coachclip-")) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Network-only: do not intercept or serve from caches.
  // API requests, video files, downloads, and app shell assets are fetched live via network.
  return;
});

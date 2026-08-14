const CACHE_NAME = "animus-cache-cleanup-20260810";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.delete(CACHE_NAME));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", () => {
  // Network-only. ANIMUS data now belongs in Google Drive, not browser cache.
});

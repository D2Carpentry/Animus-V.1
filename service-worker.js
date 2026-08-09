const CACHE_NAME = "d2-estimate-studio-v116-mobile-estimator-menu";
const APP_FILES = [
  "./",
  "./index.html",
  "./crm.html",
  "./mobile.html",
  "./styles.css",
  "./mobile.css",
  "./app.js",
  "./crm.js",
  "./mobile.js",
  "./dashboard-restore-data.js",
  "./revenue-data.js",
  "./materials-database.js",
  "./vendor/jspdf.umd.min.js",
  "./vendor/html2canvas.min.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./assets/d2-logo.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});

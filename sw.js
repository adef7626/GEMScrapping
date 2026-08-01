const CACHE_NAME = "gem-bid-intel-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./main.js",
  "./styles.css",
  "./icon.svg",
  "./manifest.json"
];

// Install Event
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event (Bypass cache for API streaming endpoints)
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  
  // Directly fetch streaming APIs to avoid caching stream chunks
  if (url.pathname.includes("/api/")) {
    e.respondWith(fetch(e.request));
    return;
  }
  
  // Cache-first strategy for static assets
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});

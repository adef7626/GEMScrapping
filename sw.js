/**
 * ==========================================================================
 * ADRENALINE FORGE - OFFLINE SERVICE WORKER
 * ==========================================================================
 */

const CACHE_NAME = "adrenaline-cache-v40";

const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js",
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// Install Event - Pre-cache critical application resources
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("[Service Worker] Pre-caching application core shell assets");
        // Use allSettled to ensure that even if some external font assets fail to resolve, installer proceeds
        return Promise.allSettled(
          ASSETS_TO_CACHE.map(url => {
            return cache.add(url).catch(err => {
              console.warn(`[Service Worker] Failed to cache asset: ${url}`, err);
            });
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Clear obsolete historical cache objects
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing deprecated cache block:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper to determine if a dynamic network response is safe to cache
function isSafeToCache(request, response) {
  if (!response || response.status !== 200) return false;
  
  // Prevent caching of redirects (e.g. captive portal logins / server-fallback pages) which would overwrite static css/js
  if (response.redirected) return false;
  
  const url = request.url;
  const contentType = response.headers.get("content-type") || "";
  
  // Guard CSS and JS files from being corruptly overwritten by HTML responses
  if (url.endsWith(".css") && contentType.includes("text/html")) return false;
  if (url.endsWith(".js") && contentType.includes("text/html")) return false;
  if (url.endsWith(".json") && contentType.includes("text/html")) return false;
  
  return true;
}

// Fetch Event - Dynamic cache intercept with Cache-First strategy for static shells
self.addEventListener("fetch", event => {
  // Exclude non-GET and non-HTTP requests (e.g. chrome-extension://, safari-extension://) to prevent protocol errors
  if (event.request.method !== "GET" || !event.request.url.startsWith("http")) return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Fetch updated version silently in background to update cache (stale-while-revalidate)
          fetch(event.request)
            .then(networkResponse => {
              if (isSafeToCache(event.request, networkResponse)) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
              }
            })
            .catch(() => { /* Ignore offline fetch errors during validation */ });

          return cachedResponse;
        }

        // Offline Fallback for dynamic assets
        return fetch(event.request)
          .then(networkResponse => {
            if (!isSafeToCache(event.request, networkResponse)) {
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });

            return networkResponse;
          })
          .catch(() => {
            // Return index.html for navigation requests offline
            if (event.request.mode === "navigate") {
              return caches.match("./index.html");
            }
          });
      })
  );
});

const CACHE_VERSION = "v2-" + new Date().getTime();
const CACHE_NAME = `neurality-cache-${CACHE_VERSION}`;
const OFFLINE_URL = "/index.html";

const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// Install Event - Pre-cache essential assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Network first falling back to cache
self.addEventListener("fetch", (event) => {
  // Only handle GET requests and exclude dynamic API calls/Socket requests
  if (
    event.request.method !== "GET" ||
    event.request.url.includes("/api/") ||
    event.request.url.includes("socket.io")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Validation for MIME type and successful response
        if (response.status === 200 && response.type === "basic") {
          const contentType = response.headers.get("content-type");
          
          // CRITICAL: Reject caching HTML for JS/CSS requests (Vercel SPA fallback bug)
          const isJsRequest = event.request.url.match(/\.js$/i);
          const isCssRequest = event.request.url.match(/\.css$/i);
          
          if (isJsRequest && contentType && !contentType.includes("javascript")) {
             return response; // Do not cache
          }
          if (isCssRequest && contentType && !contentType.includes("css")) {
             return response; // Do not cache
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If seeking the main page offline, serve standard index.html
          if (event.request.mode === "navigate") {
            return caches.match(OFFLINE_URL);
          }
        });
      })
  );
});

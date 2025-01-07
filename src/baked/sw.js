const CACHE_VERSION = 9;
const CACHE_NAME = `bakedsite-v${CACHE_VERSION}`;

// Add this at the top of the file
const IS_DEVELOPMENT = location.hostname === 'localhost' || location.hostname === '127.0.0.1';


const ASSETS = [
  '/',
  '/baked/bakedClient.js',
  '/baked/baked.worker.js',
  '/baked/site.db',
  '/baked/offline.html',
  '/manifest.json',
  '/baked/sqlite-wasm/sqlite3.mjs',
  '/baked/sqlite-wasm/sqlite3.wasm'
];

// Cache all HTML pages that are accessed
async function cacheHTML(request, response) {
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Caching app shell and CDN assets...');
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Delete old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all pages immediately
      clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  // Skip caching in development mode
  if (IS_DEVELOPMENT) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Try to get the response from cache first
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) {
        // Return cached response and fetch update in background
        if (event.request.headers.get('accept').includes('text/html')) {
          event.waitUntil(
            fetch(event.request)
              .then((response) => cacheHTML(event.request, response))
              .catch(() => {
                /* ignore */
              })
          );
        }
        return cachedResponse;
      }

      // If not in cache, try to fetch it
      try {
        const response = await fetch(event.request);

        // Cache HTML responses for offline access
        if (event.request.headers.get('accept').includes('text/html')) {
          await cacheHTML(event.request, response);
        }

        return response;
      } catch (error) {
        // If fetch fails and we don't have a cached response, return offline page
        if (event.request.headers.get('accept').includes('text/html')) {
          return cache.match('/offline.html') || new Response('Offline');
        }
        throw error;
      }
    })()
  );
});

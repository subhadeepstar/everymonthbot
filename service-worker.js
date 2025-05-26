// service-worker.js

const CACHE_NAME = 'smart-budget-wallet-cache-v1';
const urlsToCache = [
  '/', // Alias for index.html
  '/index.html',
  // Add paths to your CSS files if they are separate
  // e.g., '/css/style.css',
  // Add paths to your JS files if they are separate (excluding this service worker itself)
  // e.g., '/js/app.js',
  // Add paths to your icons specified in manifest.json
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png'
  // Add any other critical assets like fonts or images needed for the offline experience
];

// Install event: Cache the core assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting(); // Activate the new service worker immediately
      })
      .catch(error => {
        console.error('Service Worker: Caching failed', error);
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activation complete');
      return self.clients.claim(); // Take control of uncontrolled clients
    })
  );
});

// Fetch event: Serve cached content when offline, or fetch from network
self.addEventListener('fetch', event => {
  console.log('Service Worker: Fetching', event.request.url);
  // For navigation requests (HTML pages), try network first, then cache (Network falling back to cache)
  // This ensures users get the latest version if online, but still have an offline fallback.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            // If network fails or returns an error, try to serve from cache
            return caches.match(event.request)
              .then(cachedResponse => {
                if (cachedResponse) {
                  console.log('Service Worker: Serving from cache (network failed)', event.request.url);
                  return cachedResponse;
                }
                // If not in cache and network failed, this will result in a browser error page
                // You could return a custom offline page here if you have one:
                // return caches.match('/offline.html');
              });
          }

          // IMPORTANT: Clone the response. A response is a stream
          // and because we want the browser to consume the response
          // as well as the cache consuming the response, we need
          // to clone it so we have two streams.
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              console.log('Service Worker: Caching new response from network', event.request.url);
              cache.put(event.request, responseToCache);
            });

          return response;
        })
        .catch(() => {
          // Network request failed, try to serve from cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                console.log('Service Worker: Serving from cache (network totally failed)', event.request.url);
                return cachedResponse;
              }
              // If not in cache and network failed, this will result in a browser error page
              // You could return a custom offline page here if you have one:
              // return caches.match('/offline.html');
            });
        })
    );
  } else {
    // For non-navigation requests (CSS, JS, images), use Cache falling back to Network strategy
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // Cache hit - return response
          if (response) {
            console.log('Service Worker: Serving from cache', event.request.url);
            return response;
          }

          // Not in cache - fetch from network, then cache it
          return fetch(event.request).then(
            networkResponse => {
              // Check if we received a valid response
              if (!networkResponse || networkResponse.status !== 200) { // Don't cache error responses or opaque responses unless necessary
                return networkResponse;
              }

              // IMPORTANT: Clone the response.
              const responseToCache = networkResponse.clone();

              caches.open(CACHE_NAME)
                .then(cache => {
                  console.log('Service Worker: Caching new asset from network', event.request.url);
                  cache.put(event.request, responseToCache);
                });

              return networkResponse;
            }
          ).catch(error => {
            console.error('Service Worker: Fetching asset failed', event.request.url, error);
            // You could return a fallback asset here if appropriate
            // e.g., if (event.request.destination === 'image') return caches.match('/fallback-image.png');
          });
        })
    );
  }
});

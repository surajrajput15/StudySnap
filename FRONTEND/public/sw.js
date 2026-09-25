const CACHE_NAME = 'studysnap-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
  '/window.svg',
  '/favicon.svg',
  '/studysnap-logo.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/globe.svg',
  '/next.svg',
  '/vercel.svg',
  '/file.svg'
];

// Phase B P2: bound the runtime cache so unbounded cache.put on every
// same-origin GET can never grow storage without limit (mobile quota).
const MAX_RUNTIME_ENTRIES = 80;

async function trimRuntimeCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    // Precached shell assets are re-added on install; trim oldest-first down
    // to the cap. keys() returns in insertion order (oldest first).
    if (keys.length > MAX_RUNTIME_ENTRIES + ASSETS_TO_CACHE.length) {
      const excess = keys.length - (MAX_RUNTIME_ENTRIES + ASSETS_TO_CACHE.length);
      await Promise.all(keys.slice(0, excess).map((req) => cache.delete(req)));
    }
  } catch {
    // Cache API unavailable — ignore.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Phase B P2: per-asset add with individual catch. cache.addAll rejects
      // the WHOLE install when a single entry 404s (e.g. /sitemap.xml is an
      // App route, not a static file in some environments) — one missing
      // asset must never break offline support entirely.
      await Promise.all(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch(() => {
            // Best-effort precache; runtime fetch handler covers misses.
          })
        )
      );
    })()
  );
  self.skipWaiting();
});

// Phase B P2: honor the update prompt's SKIP_WAITING message (lets a waiting
// worker activate on user consent instead of waiting for all tabs to close).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request)
          .then((response) => {
            if (response.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response);
                void trimRuntimeCache();
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
              void trimRuntimeCache();
            });
          }
          return response;
        })
        .catch(async () => {
          if (event.request.headers.get('accept')?.includes('text/html')) {
            const cachedRoot = await caches.match('/');
            if (cachedRoot) return cachedRoot;
          }
          return new Response('Offline: Resource not cached.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          });
        });
    })
  );
});

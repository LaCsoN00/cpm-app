self.importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js')

workbox.loadModule('workbox-strategies')
workbox.loadModule('workbox-expiration')
workbox.loadModule('workbox-routing')
workbox.loadModule('workbox-precaching')

const CACHE_NAME = 'my-app-cache-v1';
const URLs_TO_CACHE = [
  '/',
  '/scripts.js',
  '/icon.png',
  '/app',
  '/lib',
  '/prisma',
  '/public',
  '/types',
  '/middleware.ts',
  '/tailwind.config.ts',
  '/offline.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Mise en cache des fichiers essentiels');
      return cache.addAll(URLs_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Service Worker: Suppression de l\'ancien cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

const createCacheFirstStrategy = ({ items, maxAgeSeconds, maxEntries }) => {
  items.forEach((item) => {
    workbox.routing.registerRoute(
      new RegExp(`/api/v1/${item}`),
      new workbox.strategies.CacheFirst({
        cacheName: item,
        plugins: [
          new workbox.expiration.ExpirationPlugin({
            maxAgeSeconds,
            maxEntries,
          }),
        ],
      })
    );
  });
};

createCacheFirstStrategy({
  items: ['segments', 'entities', 'units'],
  maxAgeSeconds: 12 * 60 * 60,
  maxEntries: 15,
});

createCacheFirstStrategy({
  items: ['metrics'],
  maxAgeSeconds: 2 * 60 * 60,
  maxEntries: 10,
});

self.addEventListener('fetch', (event) => {
  const { request } = event
  const { pathname } = new URL(event.request.url)

  if (pathname.endsWith('.pdf')) {
    event.respondWith(
      new workbox.strategies.CacheFirst({
        cacheName: 'pdfs',
        plugins: [
          new workbox.expiration.ExpirationPlugin({
            maxEntries: 50,
          }),
        ],
      }).handle({ event, request }),
    );
    return;
  }

  if (pathname.includes('/api/v1/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            return caches.match('/offline.html');
          });
      })
    );
  }
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/offline.html');
        });
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'syncData') {
    event.waitUntil(syncData());
  }
});

function syncData() {
  console.log('Synchronisation des données...');
}
workbox.routing.registerRoute(
  ({ request }) => request.mode === 'navigate', 
  new workbox.strategies.NetworkFirst({
    cacheName: 'pages',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50, 
        maxAgeSeconds: 24 * 60 * 60, 
      }),
    ],
  })
);

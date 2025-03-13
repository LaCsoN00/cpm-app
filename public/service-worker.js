self.importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

workbox.loadModule('workbox-strategies');
workbox.loadModule('workbox-expiration');
workbox.loadModule('workbox-routing');
workbox.loadModule('workbox-precaching');

const CACHE_NAME = 'cpmapp-cache-v1';
const OFFLINE_PAGE = '/offline.html';

// 📌 Liste des fichiers statiques à mettre en cache
const STATIC_FILES = [
  '/',
  OFFLINE_PAGE,
  '/styles.css',
  '/scripts.js',
  '/favicon.svg',
  '/icon.png',
  '/logo.svg',
  '/manifest.json'
];

// 📌 Mise en cache complète lors de l'installation
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Mise en cache des fichiers essentiels');
      return cache.addAll(STATIC_FILES);
    })
  );
});

// 📌 Suppression des anciens caches lors de l'activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('🗑 Suppression du cache obsolète', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// 📌 Mise en cache des images et icônes
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'image',
  new workbox.strategies.CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60 // Conserver 30 jours
      }),
    ],
  })
);

// 📌 Mise en cache des fichiers CSS et JS
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'style' || request.destination === 'script',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'assets-cache',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60 // Conserver 7 jours
      }),
    ],
  })
);

// 📌 Mise en cache des données dynamiques (projets, tâches, etc.)
workbox.routing.registerRoute(
  new RegExp('/api/v1/(projects|tasks|metrics|segments|entities|units)'),
  new workbox.strategies.NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 12 * 60 * 60, // Conserver 12 heures
      }),
    ],
  })
);

// 📌 Gestion des requêtes hors ligne
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request)
          .then((cachedResponse) => {
            return cachedResponse || caches.match(OFFLINE_PAGE);
          });
      })
  );
});

// 📌 Synchronisation des données hors ligne
self.addEventListener('sync', (event) => {
  if (event.tag === 'syncData') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  console.log('🔄 Synchronisation des données en arrière-plan...');
  // 🔹 Ici, tu peux envoyer les requêtes stockées en offline vers le serveur
}

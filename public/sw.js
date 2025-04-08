const CACHE_NAME = 'cpmapp-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/offline.html',
];

self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Intercepter les requêtes fetch
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return (
        cachedResponse ||
        fetch(event.request).then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }).catch(() => {
          if (event.request.destination === 'document') {
            return caches.match('/offline.html');
          }
        })
      );
    })
  );
});

// Utiliser la synchronisation en arrière-plan pour envoyer les données locales quand l'utilisateur revient en ligne
self.addEventListener('sync', event => {
  if (event.tag === 'syncPendingChanges') {
    event.waitUntil(syncPendingChanges());
  }
});

async function syncPendingChanges() {
  // Récupérer les projets stockés localement
  const db = await getDB();
  const pendingChanges = await db.getAll('pendingChanges');

  if (pendingChanges.length > 0) {
    // Envoyer les changements en attente au serveur
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pendingChanges),
    });

    if (response.ok) {
      console.log('✅ Synchronisation réussie !');
      // Supprimer les données synchronisées de l'IndexedDB
      pendingChanges.forEach(async change => {
        await db.delete('pendingChanges', change.id);
      });
    } else {
      console.error('Erreur lors de la synchronisation');
    }
  }
}

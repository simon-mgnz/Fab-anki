// Fab Anki Service Worker
// Version management for cache busting
const VERSION = '2.0.87';
const CACHE_NAME = `fabanki-v${VERSION}`;
const DECKS_CACHE = `fabanki-decks-v${VERSION}`;
const RUNTIME_CACHE = `fabanki-runtime-v${VERSION}`;

// Assets to cache on install (URLs must match index.html query strings)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  `/styles.css?v=${VERSION}`,
  `/js/app.js?v=${VERSION}`,
  '/config.js',
  '/decks/manifest.json',
  '/fabankiapp.png',
  '/fabankilogoblack.png',
  '/fabankilogowhite.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  // console.log('[ServiceWorker] Install version:', VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // console.log('[ServiceWorker] Static assets cached successfully');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[ServiceWorker] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  // console.log('[ServiceWorker] Activate version:', VERSION);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches that don't match current version
          if (cacheName.startsWith('fabanki-') && cacheName !== CACHE_NAME && cacheName !== DECKS_CACHE && cacheName !== RUNTIME_CACHE) {
            // console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      // console.log('[ServiceWorker] Old caches cleaned');
      return self.clients.claim(); // Take control immediately
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Strategy 1: Network-first for app shell (always fetch latest when online)
  if (isAppShell(url.pathname)) {
    event.respondWith(networkFirstAppShell(request));
    return;
  }

  // Strategy 2: Cache-first for other static assets and decks (offline decks)
  if (isStaticAsset(url.pathname) || isDeckFile(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // Strategy 3: Network-first for API/sync requests
  if (isSyncRequest(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // Strategy 4: Stale-while-revalidate for everything else
  event.respondWith(staleWhileRevalidate(request));
});

// Helper: App shell files that must always update when online
function isAppShell(pathname) {
  return pathname === '/' ||
         pathname.endsWith('/index.html') ||
         pathname.endsWith('/js/app.js') ||
         pathname.endsWith('/styles.css') ||
         pathname.endsWith('/config.js') ||
         pathname.endsWith('/service-worker.js');
}

// Helper: Check if request is for static asset
function isStaticAsset(pathname) {
  return pathname.endsWith('.css') || 
         pathname.endsWith('.js') || 
         pathname.endsWith('.html') ||
         pathname.endsWith('.png') ||
         pathname.endsWith('.jpg') ||
         pathname.endsWith('.svg') ||
         pathname.endsWith('.ico') ||
         pathname === '/';
}

// Helper: Check if request is for deck file
function isDeckFile(pathname) {
  return pathname.includes('/decks/') && 
         (pathname.endsWith('.xml') || pathname.endsWith('.json'));
}

// Helper: Check if request is for sync
function isSyncRequest(pathname) {
  return pathname.includes('/sync') || 
         pathname.includes('/api/') ||
         pathname.includes('firebase') ||
         pathname.includes('supabase');
}

// Strategy: Network-first for app shell (fresh updates; cache fallback offline)
async function networkFirstAppShell(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (request.mode === 'navigate') {
      const offlinePage = await cache.match('/index.html');
      if (offlinePage) return offlinePage;
    }

    throw error;
  }
}

// Strategy: Cache-first (for assets and decks)
async function cacheFirst(request) {
  const cache = await caches.open(isDeckFile(new URL(request.url).pathname) ? DECKS_CACHE : CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    // Silently return cached response
    return cached;
  }
  
  try {
    // console.log('[ServiceWorker] Cache miss, fetching:', request.url);
    const response = await fetch(request);
    
    // Cache successful responses
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('[ServiceWorker] Fetch failed:', error);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineCache = await caches.open(CACHE_NAME);
      return offlineCache.match('/index.html');
    }
    
    throw error;
  }
}

// Strategy: Network-first (for sync/API requests)
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  try {
    console.log('[ServiceWorker] Network-first:', request.url);
    const response = await fetch(request);
    
    // Cache successful responses
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[ServiceWorker] Network failed, checking cache:', request.url);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    // Queue request for later sync
    await queueOfflineRequest(request);
    
    // Return a custom offline response
    return new Response(JSON.stringify({ 
      offline: true, 
      queued: true,
      message: 'Requête mise en file d\'attente pour synchronisation' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Strategy: Stale-while-revalidate
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  
  // Fetch in background and update cache
  const fetchPromise = fetch(request).then((response) => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);
  
  // Return cached version immediately if available
  return cached || fetchPromise;
}

// Queue offline requests for later sync
async function queueOfflineRequest(request) {
  try {
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: request.method !== 'GET' ? await request.text() : null,
      timestamp: Date.now()
    };
    
    // Store in IndexedDB (we'll send this to the client for proper storage)
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'QUEUE_OFFLINE_REQUEST',
          data: requestData
        });
      });
    });
    
    console.log('[ServiceWorker] Queued offline request:', request.url);
  } catch (error) {
    console.error('[ServiceWorker] Failed to queue request:', error);
  }
}

// ===== WEB PUSH NOTIFICATIONS =====

// Receive a push from the server → show notification
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}

  const title = data.title || 'Fab\'Anki';
  const options = {
    body:    data.body    || 'Des cartes t\'attendent !',
    icon:    data.icon    || '/fabankiapp.png',
    badge:   data.badge   || '/fabankiapp.png',
    tag:     data.tag     || 'fabanki-push',
    renotify: !!data.renotify,
    data:    { url: data.url || '/', deckUrl: data.deckUrl || null },
    actions: data.actions || [],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// User taps notification → open app (or specific deck)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.deckUrl
    ? ('/?deck=' + encodeURIComponent(event.notification.data.deckUrl))
    : (event.notification.data?.url || '/');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If app already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'PUSH_NAVIGATE', url: targetUrl });
          return;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls;
    caches.open(DECKS_CACHE).then((cache) => {
      cache.addAll(urls);
    });
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: VERSION });
  }
});

// Background sync for offline requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-requests') {
    console.log('[ServiceWorker] Background sync triggered');
    event.waitUntil(syncOfflineRequests());
  }
});

async function syncOfflineRequests() {
  // Notify clients to handle sync
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_OFFLINE_REQUESTS'
    });
  });
}

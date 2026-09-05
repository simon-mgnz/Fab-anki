// Fab Anki Service Worker
// Version management for cache busting
const VERSION = '2.0.136';
const CACHE_NAME = `fabanki-v${VERSION}`;
const DECKS_CACHE = `fabanki-decks-v${VERSION}`;
const RUNTIME_CACHE = `fabanki-runtime-v${VERSION}`;

// Assets to cache on install (URLs must match index.html query strings)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  `/styles.css?v=${VERSION}`,
  `/js/schoolCalendar.js?v=${VERSION}`,
  `/js/app.js?v=${VERSION}`,
  '/config.js',
  '/app-manifest.json',
  '/assets/icons/fabankiapp.png',
  '/assets/icons/fabankifavicon.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('[ServiceWorker] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('fabanki-') && cacheName !== CACHE_NAME && cacheName !== DECKS_CACHE && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Never intercept Firebase / Google APIs — sync must not be cached
  if (isNetworkOnlyUrl(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Network-first for app shell (always fetch latest when online)
  if (isAppShell(url.pathname)) {
    event.respondWith(networkFirstAppShell(request));
    return;
  }

  // Deck manifest: network-first so new decks appear without stale cache
  if (isDeckManifest(url.pathname)) {
    event.respondWith(networkFirstDeckManifest(request));
    return;
  }

  // Cache-first for deck XML and images (offline decks)
  if (isStaticAsset(url.pathname) || isDeckXml(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isSyncRequest(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

function isNetworkOnlyUrl(url) {
  const h = url.hostname;
  return h.includes('googleapis.com') ||
         h.includes('firebaseio.com') ||
         h.includes('cloudfunctions.net') ||
         h.includes('firebaseapp.com') ||
         h.includes('identitytoolkit.googleapis.com') ||
         h.includes('securetoken.googleapis.com');
}

function isAppShell(pathname) {
  return pathname === '/' ||
         pathname.endsWith('/index.html') ||
         pathname.endsWith('/js/app.js') ||
         pathname.endsWith('/js/schoolCalendar.js') ||
         pathname.endsWith('/styles.css') ||
         pathname.endsWith('/config.js') ||
         pathname.endsWith('/service-worker.js') ||
         pathname.endsWith('/app-manifest.json');
}

function isStaticAsset(pathname) {
  return pathname.endsWith('.png') ||
         pathname.endsWith('.jpg') ||
         pathname.endsWith('.svg') ||
         pathname.endsWith('.ico') ||
         pathname.endsWith('.webp');
}

function isDeckManifest(pathname) {
  return pathname.includes('/decks/') && pathname.endsWith('/manifest.json');
}

function isDeckXml(pathname) {
  return pathname.includes('/decks/') && pathname.endsWith('.xml');
}

function isSyncRequest(pathname) {
  return pathname.includes('/sync') ||
         pathname.includes('/api/') ||
         pathname.includes('firebase') ||
         pathname.includes('supabase');
}

function cacheKeyWithoutQuery(request) {
  const url = new URL(request.url);
  return url.origin + url.pathname;
}

async function networkFirstAppShell(request) {
  const cache = await caches.open(CACHE_NAME);
  const normalizedKey = cacheKeyWithoutQuery(request);

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      await cache.put(request, response.clone());
      if (normalizedKey !== request.url) {
        await cache.put(normalizedKey, response.clone());
      }
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request) || await cache.match(normalizedKey);
    if (cached) return cached;

    if (request.mode === 'navigate') {
      const offlinePage = await cache.match('/index.html');
      if (offlinePage) return offlinePage;
    }

    throw error;
  }
}

async function networkFirstDeckManifest(request) {
  const cache = await caches.open(DECKS_CACHE);

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const pathname = new URL(request.url).pathname;
  const cache = await caches.open(isDeckXml(pathname) ? DECKS_CACHE : CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error('[ServiceWorker] Fetch failed:', error);

    if (request.mode === 'navigate') {
      const offlineCache = await caches.open(CACHE_NAME);
      return offlineCache.match('/index.html');
    }

    throw error;
  }
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    await queueOfflineRequest(request);

    return new Response(JSON.stringify({
      offline: true,
      queued: true,
      message: 'Requête mise en file d\'attente pour synchronisation'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(request) {
  const url = new URL(request.url);
  if (isNetworkOnlyUrl(url)) {
    return fetch(request);
  }

  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

async function queueOfflineRequest(request) {
  try {
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: request.method !== 'GET' ? await request.text() : null,
      timestamp: Date.now()
    };

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

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}

  const title = data.title || 'Fab\'Anki';
  const options = {
    body:    data.body    || 'Des cartes t\'attendent !',
    icon:    data.icon    || '/assets/icons/fabankiapp.png',
    badge:   data.badge   || '/assets/icons/fabankiapp.png',
    tag:     data.tag     || 'fabanki-push',
    renotify: !!data.renotify,
    data:    { url: data.url || '/', deckUrl: data.deckUrl || null },
    actions: data.actions || [],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.deckUrl
    ? ('/?deck=' + encodeURIComponent(event.notification.data.deckUrl))
    : (event.notification.data?.url || '/');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'PUSH_NAVIGATE', url: targetUrl });
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

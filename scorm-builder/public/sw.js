// Service Worker for SCORM Builder
const CACHE_NAME = 'scorm-builder-v1'
const RUNTIME_CACHE = 'runtime-cache-v1'

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets')
      return cache.addAll(STATIC_ASSETS)
    }).then(() => {
      console.log('[SW] Static assets cached')
      return self.skipWaiting()
    })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    }).then(() => {
      console.log('[SW] Old caches deleted')
      return self.clients.claim()
    })
  )
})

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Skip API requests (let them go to network)
  if (url.pathname.startsWith('/api/')) {
    return
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Serve from cache but update in background
        fetchAndCache(request)
        return cachedResponse
      }

      // Not in cache, fetch from network
      return fetchAndCache(request).catch(() => {
        // Network failed, return offline page if it's a navigation request
        if (request.mode === 'navigate') {
          return caches.match('/index.html')
        }
        throw new Error('Network request failed')
      })
    })
  )
})

// Helper function to fetch and cache
async function fetchAndCache(request) {
  const response = await fetch(request)
  
  // Don't cache non-successful responses
  if (!response || response.status !== 200 || response.type !== 'basic') {
    return response
  }

  // Clone the response
  const responseToCache = response.clone()

  // Determine which cache to use
  const cacheName = isStaticAsset(request.url) ? CACHE_NAME : RUNTIME_CACHE

  caches.open(cacheName).then((cache) => {
    cache.put(request, responseToCache)
  })

  return response
}

// Helper function to determine if asset is static
function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.otf']
  return staticExtensions.some(ext => url.endsWith(ext))
}

// Message handling
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.addAll(event.data.urls)
      })
    )
  }
})

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-projects') {
    event.waitUntil(syncProjects())
  }
})

async function syncProjects() {
  // Implement project syncing logic here
  console.log('[SW] Syncing projects...')
}
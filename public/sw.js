const TILE_CACHE = 'mappsly-tiles-v1'
const APP_CACHE = 'mappsly-app-v1'
const TILE_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days
const TILE_MAX_ENTRIES = 2000

const TILE_HOSTS = [
  'basemaps.cartocdn.com',
  'tile.openstreetmap.org',
  'server.arcgisonline.com',
]

function isTileRequest(url) {
  return TILE_HOSTS.some(h => url.hostname.includes(h))
}

function isAppAsset(url) {
  return url.origin === self.location.origin &&
    /\.(js|css|woff2?|svg|png|jpg|ico)$/.test(url.pathname)
}

// Cache-first for tiles, stale-while-revalidate for app assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  if (isTileRequest(url)) {
    event.respondWith(tileFirst(event.request))
  } else if (isAppAsset(url)) {
    event.respondWith(staleWhileRevalidate(event.request, APP_CACHE))
  }
})

async function tileFirst(request) {
  const cache = await caches.open(TILE_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
      trimCache(TILE_CACHE, TILE_MAX_ENTRIES)
    }
    return response
  } catch {
    return new Response('', { status: 408 })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone())
    return response
  }).catch(() => cached)

  return cached || fetchPromise
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length > maxEntries) {
    // Delete oldest entries (FIFO)
    const toDelete = keys.slice(0, keys.length - maxEntries)
    await Promise.all(toDelete.map(k => cache.delete(k)))
  }
}

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
  const keep = [TILE_CACHE, APP_CACHE]
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => !keep.includes(n)).map(n => caches.delete(n)))
    )
  )
  self.clients.claim()
})

self.addEventListener('install', () => {
  self.skipWaiting()
})

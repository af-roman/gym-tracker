const CACHE_NAME = 'gym-tracker-v2'

function asset(path) {
  return new URL(path, self.location).href
}

const ASSETS = [
  './',
  './index.html',
  './404.html',
  './manifest.webmanifest',
  './icon.svg',
  './illustrations/goblet-squat.svg',
  './illustrations/dumbbell-bench-press.svg',
  './illustrations/dumbbell-row.svg',
  './illustrations/dumbbell-shoulder-press.svg',
  './illustrations/plank.svg',
  './illustrations/romanian-deadlift.svg',
  './illustrations/incline-dumbbell-press.svg',
  './illustrations/lat-pulldown.svg',
  './illustrations/walking-lunges.svg',
  './illustrations/dead-bug.svg',
  './illustrations/placeholder.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS.map((path) => asset(path))),
    ),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response.ok && event.request.url.startsWith(self.location.origin)) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => cached)

      return cached || fetchPromise
    }),
  )
})

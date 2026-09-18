// Service worker mínimo: cachea lo que se va visitando (network-first con
// respaldo en caché) para que la app abra aunque no haya internet en ese
// momento. Fase 8 del roadmap lo puede volver más completo (precache del
// app shell) cuando haga falta.
const CACHE_NAME = 'organizador-gastos-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      fetch(event.request)
        .then((response) => {
          if (response.ok) cache.put(event.request, response.clone())
          return response
        })
        .catch(() => cache.match(event.request))
    )
  )
})

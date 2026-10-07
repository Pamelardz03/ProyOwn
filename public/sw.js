// Service worker mínimo: cachea lo que se va visitando (network-first con
// respaldo en caché) para que la app abra aunque no haya internet en ese
// momento. Fase 8 del roadmap lo puede volver más completo (precache del
// app shell) cuando haga falta.
const CACHE_NAME = 'organizador-gastos-v3'
const ESPERA_RED_MS = 4000 // con red lenta o a medias, a los 4 s se usa lo guardado en vez de quedarse esperando

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
      // { cache: 'no-store' } evita que el navegador conteste con su propio
      // caché HTTP (lo que dejaba servido un index.html/JS viejo aunque el
      // deploy ya tuviera la versión nueva) — siempre se pide de verdad al
      // servidor primero, y solo se usa el respaldo de caches.match si de
      // verdad no hay conexión.
      Promise.race([
        fetch(event.request, { cache: 'no-store' }).then((response) => {
          if (response.ok) cache.put(event.request, response.clone())
          return response
        }),
        new Promise((_, rechazar) => setTimeout(rechazar, ESPERA_RED_MS)),
      ]).catch(() => cache.match(event.request).then((guardado) => guardado || fetch(event.request)))
    )
  )
})

// Al tocar una notificación se enfoca la app (o se abre) en la URL indicada,
// p.ej. el formulario de gasto. Solo actúa si algo llegó a mostrar una notificación.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const ventana of ventanas) {
        if ('focus' in ventana) {
          if ('navigate' in ventana) ventana.navigate(destino)
          return ventana.focus()
        }
      }
      return self.clients.openWindow(destino)
    })
  )
})

// Push de FCM (mensajes solo con `data`). Si la app está a la vista, el aviso ya sale
// dentro de la app y no se duplica; si no, se muestra la notificación del sistema.
self.addEventListener('push', (event) => {
  let carga = {}
  try {
    carga = event.data ? event.data.json() : {}
  } catch {
    carga = {}
  }
  const d = carga.data || carga
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      if (ventanas.some((v) => v.visibilityState === 'visible')) return undefined
      return self.registration.showNotification(d.title || 'Whital', {
        body: d.body || '',
        tag: d.tag || 'whital',
        icon: new URL('icon-192.png', self.registration.scope).href,
        data: { url: d.url || './' },
      })
    })
  )
})

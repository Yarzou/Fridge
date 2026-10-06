// Service worker de Fridge.
//
// Volontairement minimal : aucun cache et aucun gestionnaire `fetch`, le réseau
// est toujours disponible près du congélateur (choix du 2026-10-05). Il ne sert
// qu'aux rappels sur le téléphone (Web Push, voir lib/push.ts et
// lib/push-server.ts).

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

// Contenu envoyé par le serveur : { title, body, url, tag } (lib/reminders.ts).
self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Fridge'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || undefined,
      icon: '/icon/192',
      data: { url: data.url || '/congelateur' },
    }),
  )
})

// Toucher la notification : on revient dans l'appli déjà ouverte, sinon on l'ouvre.
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/congelateur', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then(focused => (focused && 'navigate' in focused ? focused.navigate(url) : focused))
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})

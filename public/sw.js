// Service worker de Fridge.
//
// Volontairement minimal : aucun cache et aucun gestionnaire `fetch`, le réseau
// est toujours disponible près du congélateur (choix du 2026-10-05). Les
// gestionnaires `push` et `notificationclick` des rappels s'ajouteront ici.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

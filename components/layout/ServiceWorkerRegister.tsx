'use client'

import { useEffect } from 'react'

/**
 * Enregistre public/sw.js, qui reçoit les rappels (Web Push). Pas de cache,
 * pas de gestionnaire `fetch`. En production seulement, pour ne pas mêler un
 * service worker au rechargement du dev ; lib/push.ts l'enregistre à la
 * demande quand on active les rappels en dev.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(err => {
      console.error('[SW] enregistrement impossible :', err)
    })
  }, [])
  return null
}

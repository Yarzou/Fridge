'use client'

import { useEffect } from 'react'

/**
 * Enregistre public/sw.js. Il ne fait rien pour l'instant (pas de cache, pas
 * de gestionnaire `fetch`) : il recevra les notifications web des rappels.
 * En production seulement, pour ne pas mêler un service worker au rechargement du dev.
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

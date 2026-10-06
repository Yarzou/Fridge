'use client'

import { useSyncExternalStore } from 'react'
import { toIsoDate } from '@/lib/dates'

/**
 * Date du jour (AAAA-MM-JJ, fuseau du téléphone), qui change à minuit et au
 * retour de l'appli au premier plan. Chaîne vide au rendu serveur : les écrans
 * qui datent des produits les chargent côté client de toute façon.
 */
function subscribe(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>
  const arm = () => {
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    timer = setTimeout(() => {
      onChange()
      arm()
    }, midnight.getTime() - now.getTime() + 1000)
  }
  arm()
  document.addEventListener('visibilitychange', onChange)
  return () => {
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onChange)
  }
}

export function useToday(): string {
  return useSyncExternalStore(subscribe, () => toIsoDate(new Date()), () => '')
}

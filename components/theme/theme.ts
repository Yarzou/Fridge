'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'

/**
 * Thème clair / sombre / automatique, mémorisé dans `localStorage.theme`.
 * La classe `dark` est posée avant le premier rendu par le script inline de
 * app/layout.tsx (anti-flash) ; ce module la tient à jour ensuite.
 *
 * Pas de Context ni de `setState` dans un effet : un petit magasin externe lu
 * par `useSyncExternalStore`.
 */

export type ThemeChoice = 'light' | 'dark' | 'system'

export const THEME_LABELS: Record<ThemeChoice, string> = {
  system: 'Automatique',
  light: 'Clair',
  dark: 'Sombre',
}

const listeners = new Set<() => void>()

function readChoice(): ThemeChoice {
  try {
    const value = localStorage.getItem('theme')
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

function applyChoice(choice: ThemeChoice) {
  const dark =
    choice === 'dark' ||
    (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useTheme() {
  const theme = useSyncExternalStore<ThemeChoice>(subscribe, readChoice, () => 'system')

  const setTheme = useCallback((choice: ThemeChoice) => {
    try {
      localStorage.setItem('theme', choice)
    } catch {}
    applyChoice(choice)
    listeners.forEach(l => l())
  }, [])

  return { theme, setTheme }
}

/** Suit le réglage du téléphone quand le choix est « Automatique ». Monté une fois, dans le layout. */
export function ThemeSync() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyChoice(readChoice())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return null
}

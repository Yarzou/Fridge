import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge ne connaît pas l'échelle typographique iOS de
 * tailwind.config.ts : il prenait `text-caption` ou `text-body` pour des
 * couleurs, et les supprimait dès qu'une couleur suivait (`text-accent`). Les
 * libellés de la barre d'onglets passaient ainsi de 11 à 16 px. On lui déclare
 * ces tailles.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['large-title', 'title', 'body', 'subhead', 'footnote', 'caption'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Chemin de redirection interne sûr : refuse les URL absolues et `//site.com`
 * (open redirect). `fallback` si la valeur est absente ou suspecte.
 */
export function safeInternalPath(value: string | null | undefined, fallback = '/congelateur'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback
  if (value.startsWith('/auth/')) return fallback
  return value
}

/** « 3 tiroirs », « 1 tiroir » — accord simple en nombre. */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

/** Date courte française : « 12 oct. 2026 ». */
export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Initiale d'avatar : première lettre du nom affiché. */
export function initial(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim()
  return trimmed ? trimmed[0].toLocaleUpperCase('fr-FR') : '?'
}

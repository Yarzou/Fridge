/**
 * Dates « calendaires » des produits (colonnes `date` : frozen_on, best_before),
 * manipulées en chaînes AAAA-MM-JJ dans le fuseau du téléphone. Jamais de
 * `new Date('2026-10-05')` : il serait lu en UTC et pourrait reculer d'un jour.
 */

/** Seuil de « À consommer bientôt » : dans les 30 jours, ou dépassé. */
export const SOON_DAYS = 30

export function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Ajoute des mois, en restant au dernier jour du mois si besoin (31 janv. + 1 mois = 28 févr.). */
export function addMonths(iso: string, months: number): string {
  const date = parseIsoDate(iso)
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, last))
  return toIsoDate(date)
}

/** Jours entre aujourd'hui et `iso` : négatif si la date est passée. */
export function daysBetween(fromIso: string, toIso: string): number {
  const ms = parseIsoDate(toIso).getTime() - parseIsoDate(fromIso).getTime()
  return Math.round(ms / 86_400_000)
}

const SHORT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const SHORT_YEAR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const MONTH_YEAR = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const LONG = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

/** « 2 sept. », avec l'année si ce n'est pas celle d'aujourd'hui : « 3 mai 2025 ». */
export function formatShortDate(iso: string, todayIso: string): string {
  const date = parseIsoDate(iso)
  const sameYear = iso.slice(0, 4) === todayIso.slice(0, 4)
  return (sameYear ? SHORT : SHORT_YEAR).format(date).replace(/^1 /, '1er ')
}

/** « mars 2027 » */
export function formatMonthYear(iso: string): string {
  return MONTH_YEAR.format(parseIsoDate(iso))
}

/** « 12 octobre 2026 » */
export function formatLongDate(iso: string): string {
  return LONG.format(parseIsoDate(iso)).replace(/^1 /, '1er ')
}

/** « congelé aujourd’hui », « congelé hier », « congelé le 2 sept. » */
export function frozenLabel(frozenOn: string, todayIso: string, capitalize = false): string {
  const days = daysBetween(frozenOn, todayIso)
  const text =
    days === 0 ? 'congelé aujourd’hui' : days === 1 ? 'congelé hier' : `congelé le ${formatShortDate(frozenOn, todayIso)}`
  return capitalize ? text[0].toUpperCase() + text.slice(1) : text
}

export type DueStatus = 'late' | 'soon' | 'ok' | 'none'

export interface Due {
  status: DueStatus
  /** Jours restants (négatif : dépassé). null sans date. */
  days: number | null
  /** « Dépassé de 5 j », « Aujourd’hui », « Dans 9 jours », « Dans 3 semaines »… */
  label: string
}

/** État de la date « à consommer avant » d'un produit. */
export function dueOf(bestBefore: string | null, todayIso: string): Due {
  if (!bestBefore || !todayIso) return { status: 'none', days: null, label: '' }
  const days = daysBetween(todayIso, bestBefore)
  let label: string
  if (days < 0) {
    const late = -days
    label = late < 60 ? `Dépassé de ${late} j` : `Dépassé de ${Math.round(late / 30)} mois`
  } else if (days === 0) label = 'Aujourd’hui'
  else if (days === 1) label = 'Demain'
  else if (days < 14) label = `Dans ${days} jours`
  else if (days < 60) label = `Dans ${Math.round(days / 7)} semaines`
  else label = `Dans ${Math.round(days / 30)} mois`
  return { status: days < 0 ? 'late' : days <= SOON_DAYS ? 'soon' : 'ok', days, label }
}

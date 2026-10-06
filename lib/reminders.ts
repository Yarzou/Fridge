import { addDays, dueOf } from '@/lib/dates'
import { plural } from '@/lib/utils'

/**
 * Rappels sur le téléphone : quand les envoyer et quoi y dire. Fonctions pures,
 * partagées par l'écran de réglages et par /api/rappels (lib/reminders-server.ts).
 *
 * Deux rappels, réglés par chaque personne (table reminder_settings, 003) :
 * - « Produits à consommer » : chaque jour à l'heure choisie, les produits qui
 *   arrivent à N jours de leur date. Un produit n'est annoncé qu'une fois : on
 *   retient jusqu'à quelle date on a déjà prévenu (expiry_announced_until).
 * - « Récapitulatif » : une fois par semaine, le jour et l'heure choisis.
 */

export interface ReminderSettings {
  expiry_enabled: boolean
  expiry_days_before: number
  expiry_hour: number
  recap_enabled: boolean
  /** 1 = lundi … 7 = dimanche (ISO) */
  recap_weekday: number
  recap_hour: number
  timezone: string
  expiry_last_sent_on: string
  expiry_announced_until: string
  recap_last_sent_on: string
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  expiry_enabled: true,
  expiry_days_before: 3,
  expiry_hour: 18,
  recap_enabled: true,
  recap_weekday: 1,
  recap_hour: 18,
  timezone: 'Europe/Paris',
  expiry_last_sent_on: '1970-01-01',
  expiry_announced_until: '1970-01-01',
  recap_last_sent_on: '1970-01-01',
}

export const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const

/** Choix proposés : le jour même, la veille… deux semaines avant. */
export const DAYS_BEFORE_OPTIONS = [0, 1, 2, 3, 5, 7, 14] as const

/**
 * Heures proposées. Les crons Vercel passent de 05 à 21 h UTC (vercel.json),
 * soit de 7 h à 22 h à Paris en été comme en hiver. Élargir cette liste
 * demande d'ajouter des crons.
 */
export const HOUR_OPTIONS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] as const

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

export function daysBeforeLabel(days: number): string {
  if (days === 0) return 'Le jour même'
  if (days === 1) return 'La veille'
  return `${days} jours avant`
}

export interface LocalClock {
  /** AAAA-MM-JJ dans le fuseau de la personne */
  date: string
  hour: number
  /** 1 = lundi … 7 = dimanche */
  weekday: number
}

const WEEKDAY_INDEX: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

/** Date, heure et jour de la semaine à l'instant `now`, dans le fuseau donné (Paris si inconnu). */
export function localClock(timezone: string, now: Date): LocalClock {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    }).formatToParts(now)
  } catch {
    return localClock('Europe/Paris', now)
  }
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? ''
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 1,
  }
}

/** Le rappel « Produits à consommer » du jour reste-t-il à envoyer ? */
export function isExpiryDue(s: ReminderSettings, clock: LocalClock): boolean {
  return s.expiry_enabled && clock.hour >= s.expiry_hour && s.expiry_last_sent_on < clock.date
}

/** Le récapitulatif de la semaine reste-t-il à envoyer ? (pas de rattrapage le lendemain) */
export function isRecapDue(s: ReminderSettings, clock: LocalClock): boolean {
  return s.recap_enabled && clock.weekday === s.recap_weekday && clock.hour >= s.recap_hour && s.recap_last_sent_on < clock.date
}

/**
 * Produits à annoncer aujourd'hui : date « à consommer avant » dans
 * ]déjà annoncé, aujourd'hui + N]. Au premier envoi (1970), cela comprend les
 * produits déjà dépassés. Si N baisse, la fenêtre reste vide le temps de rattraper.
 */
export function expiryWindow(s: ReminderSettings, clock: LocalClock): { after: string; until: string } {
  const until = addDays(clock.date, s.expiry_days_before)
  return { after: s.expiry_announced_until, until: until > s.expiry_announced_until ? until : s.expiry_announced_until }
}

/** Contenu d'une notification, lu par public/sw.js. */
export interface PushPayload {
  title: string
  body: string
  /** Page ouverte au toucher */
  url: string
  /** Une notification du même tag remplace la précédente */
  tag: string
}

function withHousehold(title: string, household?: string) {
  return household ? `${title} · ${household}` : title
}

/** « Filets de cabillaud (dans 3 jours), Framboises (demain) et 2 autres. » — null s'il n'y a rien. */
export function expiryMessage(
  items: { name: string; best_before: string }[],
  today: string,
  household?: string,
): PushPayload | null {
  if (items.length === 0) return null
  const sorted = [...items].sort((a, b) => a.best_before.localeCompare(b.best_before))
  const shown = sorted.slice(0, 3).map(i => `${i.name} (${dueOf(i.best_before, today).label.toLocaleLowerCase('fr-FR')})`)
  const more = sorted.length - shown.length
  const body = `${shown.join(', ')}${more > 0 ? ` et ${plural(more, 'autre')}` : ''}.`
  const title = sorted.length === 1 ? 'À consommer bientôt' : `${sorted.length} produits à consommer`
  return { title: withHousehold(title, household), body, url: '/congelateur', tag: 'fridge-expiry' }
}

export interface RecapCounts {
  /** En stock, date dépassée */
  late: number
  /** En stock, à consommer dans les 7 jours */
  soon: number
  /** Produits en stock */
  total: number
  /** Articles non cochés de la liste de courses */
  toBuy: number
}

/** « 1 produit dépassé, 2 à consommer dans les 7 jours · 24 produits au congélateur · 5 articles à acheter. » */
export function recapMessage(counts: RecapCounts, household?: string): PushPayload {
  const urgent: string[] = []
  if (counts.late > 0) urgent.push(`${plural(counts.late, 'produit')} ${counts.late > 1 ? 'dépassés' : 'dépassé'}`)
  if (counts.soon > 0) urgent.push(`${counts.soon} à consommer dans les 7 jours`)
  const parts = [
    urgent.length > 0 ? urgent.join(', ') : 'Rien ne presse',
    counts.total > 0 ? `${plural(counts.total, 'produit')} au congélateur` : 'congélateur vide',
  ]
  if (counts.toBuy > 0) parts.push(`${plural(counts.toBuy, 'article')} à acheter`)
  return {
    title: withHousehold('Le congélateur cette semaine', household),
    body: `${parts.join(' · ')}.`,
    url: '/congelateur',
    tag: 'fridge-recap',
  }
}

/** Notification envoyée par le bouton « Envoyer un rappel de test ». */
export const TEST_PAYLOAD: PushPayload = {
  title: 'Rappel de test',
  body: 'Les rappels de Fridge arrivent bien sur cet appareil.',
  url: '/foyer',
  tag: 'fridge-test',
}

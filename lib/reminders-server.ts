import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays } from '@/lib/dates'
import { sendPush, type StoredSubscription } from '@/lib/push-server'
import {
  DEFAULT_REMINDER_SETTINGS,
  expiryMessage,
  expiryWindow,
  isExpiryDue,
  isRecapDue,
  localClock,
  recapMessage,
  type PushPayload,
  type ReminderSettings,
} from '@/lib/reminders'

/**
 * Tournée des rappels, lancée par /api/rappels (crons Vercel, un par heure de
 * la journée). Elle n'envoie que ce qui est dû et pas encore envoyé : on peut
 * l'appeler aussi souvent qu'on veut, ou en retard, sans doublon.
 *
 * Avant d'envoyer, chaque rappel est « réservé » par un update conditionnel
 * (date du dernier envoi < aujourd'hui) : deux tournées simultanées ne
 * préviennent pas deux fois. Si l'envoi échoue ensuite, le rappel du jour est
 * perdu plutôt que répété.
 *
 * `admin` est un client à clé serveur (sb_secret_…) : il lit les abonnements
 * de tout le monde. Jamais exposé au navigateur.
 */

export interface RoundStats {
  people: number
  expiry: number
  recap: number
  sent: number
  removed: number
  skipped?: string
}

interface MembershipRow {
  user_id: string
  household_id: string
  households: { name: string } | null
}

interface ItemRow {
  household_id: string
  name: string
  best_before: string | null
}

export async function runReminderRound(admin: SupabaseClient, now: Date): Promise<RoundStats> {
  const stats: RoundStats = { people: 0, expiry: 0, recap: 0, sent: 0, removed: 0 }

  const { data: subRows, error: subError } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
  if (subError) return { ...stats, skipped: 'migration 003 absente' }

  const subsByUser = new Map<string, StoredSubscription[]>()
  for (const row of (subRows ?? []) as (StoredSubscription & { user_id: string })[]) {
    subsByUser.set(row.user_id, [...(subsByUser.get(row.user_id) ?? []), row])
  }
  const userIds = [...subsByUser.keys()]
  if (userIds.length === 0) return stats

  // Une personne abonnée sans réglages reçoit les réglages par défaut
  await admin
    .from('reminder_settings')
    .upsert(userIds.map(user_id => ({ user_id })), { onConflict: 'user_id', ignoreDuplicates: true })
  const { data: settingsRows } = await admin.from('reminder_settings').select('*').in('user_id', userIds)
  const settingsByUser = new Map(
    ((settingsRows ?? []) as (ReminderSettings & { user_id: string })[]).map(s => [s.user_id, { ...DEFAULT_REMINDER_SETTINGS, ...s }]),
  )

  const { data: memberRows } = await admin
    .from('household_members')
    .select('user_id, household_id, households ( name )')
    .in('user_id', userIds)
  const members = (memberRows ?? []) as unknown as MembershipRow[]

  // Produits et courses lus une fois par foyer, même s'il a plusieurs membres
  const itemsCache = new Map<string, Promise<ItemRow[]>>()
  const itemsOf = (householdId: string) => {
    if (!itemsCache.has(householdId)) {
      itemsCache.set(
        householdId,
        Promise.resolve(
          admin.from('items').select('household_id, name, best_before').eq('household_id', householdId).gt('quantity', 0),
        ).then(({ data }) => (data ?? []) as ItemRow[]),
      )
    }
    return itemsCache.get(householdId)!
  }
  const toBuyOf = async (householdId: string) => {
    const { count } = await admin
      .from('shopping_items')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .eq('checked', false)
    return count ?? 0
  }

  for (const userId of userIds) {
    const settings = settingsByUser.get(userId) ?? DEFAULT_REMINDER_SETTINGS
    const clock = localClock(settings.timezone, now)
    const expiryDue = isExpiryDue(settings, clock)
    const recapDue = isRecapDue(settings, clock)
    if (!expiryDue && !recapDue) continue
    stats.people += 1

    const households = members.filter(m => m.user_id === userId)
    const label = (m: MembershipRow) => (households.length > 1 ? m.households?.name : undefined)
    const payloads: PushPayload[] = []

    if (expiryDue) {
      const window = expiryWindow(settings, clock)
      const { data: claimed } = await admin
        .from('reminder_settings')
        .update({ expiry_last_sent_on: clock.date, expiry_announced_until: window.until })
        .eq('user_id', userId)
        .lt('expiry_last_sent_on', clock.date)
        .select('user_id')
      if (claimed?.length) {
        stats.expiry += 1
        for (const m of households) {
          const due = (await itemsOf(m.household_id)).filter(
            (i): i is ItemRow & { best_before: string } =>
              !!i.best_before && i.best_before > window.after && i.best_before <= window.until,
          )
          const message = expiryMessage(due, clock.date, label(m))
          if (message) payloads.push(message)
        }
      }
    }

    if (recapDue) {
      const { data: claimed } = await admin
        .from('reminder_settings')
        .update({ recap_last_sent_on: clock.date })
        .eq('user_id', userId)
        .lt('recap_last_sent_on', clock.date)
        .select('user_id')
      if (claimed?.length) {
        stats.recap += 1
        const weekEnd = addDays(clock.date, 7)
        for (const m of households) {
          const items = await itemsOf(m.household_id)
          payloads.push(
            recapMessage(
              {
                late: items.filter(i => i.best_before && i.best_before < clock.date).length,
                soon: items.filter(i => i.best_before && i.best_before >= clock.date && i.best_before <= weekEnd).length,
                total: items.length,
                toBuy: await toBuyOf(m.household_id),
              },
              label(m),
            ),
          )
        }
      }
    }

    const gone = new Set<string>()
    for (const payload of payloads) {
      for (const sub of subsByUser.get(userId) ?? []) {
        if (gone.has(sub.id)) continue
        const result = await sendPush(sub, payload)
        if (result === 'ok') stats.sent += 1
        if (result === 'gone') gone.add(sub.id)
      }
    }
    if (gone.size > 0) {
      await admin.from('push_subscriptions').delete().in('id', [...gone])
      stats.removed += gone.size
    }
  }

  return stats
}

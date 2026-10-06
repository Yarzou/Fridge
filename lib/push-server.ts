import webpush from 'web-push'
import type { PushPayload } from '@/lib/reminders'

/**
 * Envoi Web Push (VAPID), côté serveur uniquement : la clé privée ne quitte
 * jamais le serveur. Équivalent de lib/fcm-admin.ts de neighborshare, sans
 * Firebase : le navigateur fournit lui-même l'adresse de son service push
 * (Apple, Google, Mozilla).
 *
 * Dégradable : sans NEXT_PUBLIC_VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY, rien
 * n'est envoyé et rien n'échoue.
 */

let configured = false

export function pushConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

/**
 * « Sujet » VAPID : un contact pour les services push. Apple refuse un sujet
 * qui n'est ni mailto: ni https:, d'où les replis.
 */
function vapidSubject(): string {
  if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT
  if (process.env.GMAIL_USER) return `mailto:${process.env.GMAIL_USER}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl?.startsWith('https://')) return appUrl
  return 'mailto:rappels@example.com'
}

function configure() {
  if (configured) return
  webpush.setVapidDetails(vapidSubject(), process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
  configured = true
}

export interface StoredSubscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * 'gone' : l'appareil s'est désabonné, ou l'abonnement a expiré (404, 410).
 * L'appelant supprime alors la ligne, comme neighborshare pour ses tokens FCM.
 */
export async function sendPush(sub: StoredSubscription, payload: PushPayload): Promise<'ok' | 'gone' | 'error'> {
  configure()
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      // Un rappel de 18 h n'a plus d'intérêt le lendemain matin
      { TTL: 12 * 3600, urgency: 'normal', timeout: 10_000 },
    )
    return 'ok'
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) return 'gone'
    console.error('[push] envoi impossible :', status ?? '', (err as Error).message)
    return 'error'
  }
}

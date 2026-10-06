import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Rappels sur le téléphone, côté navigateur (Web Push standard, VAPID).
 * Repris de lib/pushNotifications.ts de neighborshare, sans Firebase : le
 * navigateur s'abonne lui-même et l'abonnement est enregistré en base par la
 * RPC save_push_subscription (migration 003).
 *
 * Sur iPhone, les notifications n'existent que pour une appli installée sur
 * l'écran d'accueil, avec iOS 16.4 ou plus.
 */

/** 'install' : iPhone ou iPad dans Safari, il faut d'abord installer l'appli. */
export type PushSupport = 'ok' | 'install' | 'unsupported'

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported'
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'ok'
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return ios ? 'install' : 'unsupported'
}

/** Nom affiché de l'appareil, pour s'y retrouver dans la base. */
function deviceLabel(): string {
  const ua = navigator.userAgent
  if (/iphone/i.test(ua)) return 'iPhone'
  if (/ipad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad'
  if (/android/i.test(ua)) return 'Android'
  return 'Ordinateur'
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/**
 * Le service worker (public/sw.js) n'est enregistré d'office qu'en production :
 * on l'enregistre ici à la demande, pour pouvoir activer les rappels en dev.
 */
async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (!existing) await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  return navigator.serviceWorker.ready
}

/** Abonnement de cet appareil, s'il en a un. */
export async function deviceSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok') return null
  const reg = await navigator.serviceWorker.getRegistration('/')
  return reg ? reg.pushManager.getSubscription() : null
}

/** Enregistre (ou rattache au compte courant) l'abonnement de cet appareil. */
export async function saveSubscription(supabase: SupabaseClient, sub: PushSubscription): Promise<void> {
  const json = sub.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_device_label: deviceLabel(),
  })
  if (error) throw new Error('Enregistrement de l’appareil impossible. Réessayez.')
}

function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const current = sub.options.applicationServerKey
  if (!current) return false
  const bytes = new Uint8Array(current)
  return bytes.length === key.length && bytes.every((b, i) => b === key[i])
}

/**
 * Demande la permission, abonne l'appareil et l'enregistre. La permission est
 * demandée en tout premier, sans attente avant : Safari exige qu'elle suive
 * directement le geste de l'utilisateur.
 */
export async function enablePush(supabase: SupabaseClient): Promise<void> {
  if (!VAPID_PUBLIC_KEY) throw new Error('Les rappels ne sont pas encore configurés sur le serveur.')
  const permission = await Notification.requestPermission()
  if (permission === 'denied') {
    throw new Error('Notifications refusées. Autorisez-les pour Fridge dans les réglages du téléphone, puis réessayez.')
  }
  if (permission !== 'granted') throw new Error('Notifications non autorisées.')

  const key = base64UrlToBytes(VAPID_PUBLIC_KEY)
  const reg = await registration()
  let sub = await reg.pushManager.getSubscription()
  // Abonnement fait avec une autre clé serveur (clés changées) : on le refait.
  if (sub && !sameKey(sub, key)) {
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  await saveSubscription(supabase, sub)
}

/** Désabonne cet appareil et l'oublie en base. Les autres appareils gardent leurs rappels. */
export async function disablePush(supabase: SupabaseClient): Promise<void> {
  const sub = await deviceSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe().catch(() => {})
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

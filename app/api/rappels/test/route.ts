import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pushConfigured, sendPush, type StoredSubscription } from '@/lib/push-server'
import { TEST_PAYLOAD } from '@/lib/reminders'

/**
 * « Envoyer un rappel de test » (onglet Foyer) : une notification vers les
 * appareils de la personne connectée, et d'elle seule. Le RLS de
 * push_subscriptions ne lui montre que ses propres abonnements.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  if (!pushConfigured()) {
    return NextResponse.json({ error: 'Les rappels ne sont pas encore configurés sur le serveur.' }, { status: 503 })
  }

  const { data, error } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth')
  if (error) return NextResponse.json({ error: 'Les rappels ne sont pas encore disponibles.' }, { status: 503 })
  const subs = (data ?? []) as StoredSubscription[]
  if (subs.length === 0) {
    return NextResponse.json({ error: 'Aucun appareil n’a activé les rappels.' }, { status: 404 })
  }

  let sent = 0
  for (const sub of subs) {
    const result = await sendPush(sub, TEST_PAYLOAD)
    if (result === 'ok') sent += 1
    if (result === 'gone') await supabase.from('push_subscriptions').delete().eq('id', sub.id)
  }
  if (sent === 0) {
    return NextResponse.json({ error: 'L’envoi a échoué. Désactivez puis réactivez les rappels sur ce téléphone.' }, { status: 502 })
  }
  return NextResponse.json({ sent })
}

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { deviceSubscription, pushSupport, saveSubscription } from '@/lib/push'

/**
 * À chaque ouverture de l'appli, rattache l'abonnement de cet appareil au
 * compte connecté. Cela couvre le téléphone partagé, où l'on change de compte,
 * et l'abonnement renouvelé par le navigateur. Silencieux : sans abonnement ou
 * sans la migration 003, ne fait rien.
 */
export default function PushSync() {
  const [supabase] = useState(() => createClient())
  useEffect(() => {
    if (pushSupport() !== 'ok' || Notification.permission !== 'granted') return
    void deviceSubscription()
      .then(sub => (sub ? saveSubscription(supabase, sub) : undefined))
      .catch(() => {})
  }, [supabase])
  return null
}

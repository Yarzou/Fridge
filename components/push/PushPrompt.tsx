'use client'

import { useEffect, useState } from 'react'
import { BellRing, LoaderCircle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { VAPID_PUBLIC_KEY, enablePush, pushSupport } from '@/lib/push'
import { useHousehold } from '@/components/household/HouseholdProvider'
import { useHouseholdData } from '@/components/household/HouseholdData'

const DISMISSED_KEY = (userId: string) => `rappels_invite_masquee_jusqu_au:${userId}`
const DISMISS_DAYS = 30

/**
 * Invitation à activer les rappels, sur l'onglet Congélateur (reprise de
 * PushNotificationBanner de neighborshare). Montrée seulement si le téléphone
 * sait recevoir des notifications, si on ne les a jamais ni accordées ni
 * refusées, et si la base a les tables des rappels. « Plus tard » la masque
 * 30 jours, sur cet appareil.
 */
export default function PushPrompt() {
  const { userId } = useHousehold()
  const { showToast } = useHouseholdData()
  const [supabase] = useState(() => createClient())
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (pushSupport() !== 'ok' || !VAPID_PUBLIC_KEY || Notification.permission !== 'default') return
    try {
      const until = localStorage.getItem(DISMISSED_KEY(userId))
      if (until && Date.now() < Number(until)) return
    } catch {}
    let cancelled = false
    // Sans la migration 003, rien à activer : l'invitation ne s'affiche pas.
    void supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .then(({ error }) => {
        if (!cancelled && !error) setVisible(true)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, userId])

  const dismiss = (days = DISMISS_DAYS) => {
    try {
      localStorage.setItem(DISMISSED_KEY(userId), String(Date.now() + days * 86_400_000))
    } catch {}
    setVisible(false)
  }

  const activate = async () => {
    setBusy(true)
    setError(null)
    try {
      await enablePush(supabase)
      setVisible(false)
      showToast({ text: 'Rappels activés. Réglez-les dans l’onglet Foyer.' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation impossible.')
      if (Notification.permission === 'denied') dismiss(1)
    }
    setBusy(false)
  }

  if (!visible) return null

  return (
    <section className="mt-6 flex flex-col gap-3 rounded-xl bg-card p-3.5" aria-labelledby="invite-rappels">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-tile-bell text-white">
          <BellRing size={20} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id="invite-rappels" className="text-subhead font-semibold">
            Être prévenu à temps
          </h2>
          <p className="text-footnote text-ink-muted">
            Une notification sur ce téléphone avant qu’un produit ne passe sa date, et un récapitulatif chaque semaine.
          </p>
        </div>
        <button
          type="button"
          onClick={() => dismiss()}
          aria-label="Plus tard"
          className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center text-ink-faint"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {error && <p className="text-footnote text-danger">{error}</p>}
      <button
        type="button"
        onClick={activate}
        disabled={busy}
        className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent-fill text-subhead font-semibold text-white disabled:opacity-60"
      >
        {busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
        Activer les rappels
      </button>
    </section>
  )
}

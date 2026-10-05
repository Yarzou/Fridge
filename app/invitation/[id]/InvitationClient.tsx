'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { InvitationPreview } from '@/lib/types'
import AuthShell from '@/components/auth/AuthShell'
import Button, { buttonClass } from '@/components/ui/Button'
import Notice from '@/components/ui/Notice'

export default function InvitationClient({
  id,
  preview,
  loggedIn,
}: {
  id: string
  preview: InvitationPreview | null
  loggedIn: boolean
}) {
  const [supabase] = useState(() => createClient())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(!preview || !preview.is_valid)

  const back = `/invitation/${id}`

  const accept = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.rpc('accept_invitation', { p_invitation: id })
    if (error) {
      console.error('[invitation] accept', error)
      // P0002 : invitation expirée ou supprimée entre l'affichage et le clic
      if (error.code === 'P0002') setExpired(true)
      else setError('Impossible de rejoindre le foyer. Réessayez dans un instant.')
      setLoading(false)
      return
    }
    // Navigation complète : le layout serveur relit le foyer actif
    window.location.href = '/congelateur'
  }

  if (expired || !preview) {
    return (
      <AuthShell title="Lien expiré" subtitle="Ce lien d’invitation n’est plus valable. Demandez-en un nouveau à la personne qui vous l’a envoyé.">
        <Link href="/" className={buttonClass('secondary')}>Ouvrir l’appli</Link>
      </AuthShell>
    )
  }

  const inviter = preview.invited_by ?? 'Un membre du foyer'

  return (
    <AuthShell
      title={`Rejoindre « ${preview.household_name} »`}
      subtitle={`${inviter} vous invite à partager le congélateur et la liste de courses.`}
    >
      {error && <Notice tone="danger">{error}</Notice>}

      {loggedIn ? (
        <Button onClick={accept} loading={loading}>Rejoindre le foyer</Button>
      ) : (
        <>
          <Link href={`/auth/register?redirect=${encodeURIComponent(back)}`} className={buttonClass('primary')}>
            Créer un compte
          </Link>
          <Link href={`/auth/login?redirect=${encodeURIComponent(back)}`} className={buttonClass('secondary')}>
            J’ai déjà un compte
          </Link>
        </>
      )}
    </AuthShell>
  )
}

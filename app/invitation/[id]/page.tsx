import { createClient } from '@/lib/supabase/server'
import type { InvitationPreview } from '@/lib/types'
import InvitationClient from './InvitationClient'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Lien d'invitation /invitation/{id}. Ouvert sans session (proxy.ts le laisse
 * passer) : invitation_preview() montre le nom du foyer et de qui invite, puis
 * on propose de créer un compte ou de se connecter, avec retour ici.
 */
export default async function InvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: { user } }, preview] = await Promise.all([
    supabase.auth.getUser(),
    UUID_RE.test(id)
      ? supabase.rpc('invitation_preview', { p_invitation: id })
      : Promise.resolve({ data: null, error: null }),
  ])

  if (preview.error) console.error('[invitation] preview', preview.error)
  const row = (preview.data as InvitationPreview[] | null)?.[0] ?? null

  return <InvitationClient id={id} preview={row} loggedIn={!!user} />
}

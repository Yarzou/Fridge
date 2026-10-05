import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveHousehold } from '@/lib/household'
import BienvenueClient from './BienvenueClient'

/** Premier passage d'un compte sans foyer : créer le sien, ou attendre une invitation. */
export default async function BienvenuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirect=/bienvenue')

  if (await getActiveHousehold(supabase, user.id)) redirect('/congelateur')

  const displayName = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : null
  return <BienvenueClient displayName={displayName} />
}

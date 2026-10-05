import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActiveHousehold, HouseholdRole } from '@/lib/types'

interface MembershipRow {
  role: HouseholdRole
  households: { id: string; name: string } | null
}

/**
 * Foyer actif d'un compte : le plus récemment rejoint. Accepter une invitation
 * fait donc basculer sur le nouveau foyer. Le schéma accepte plusieurs foyers
 * par compte, l'UI n'en montre qu'un (pas de sélecteur pour l'instant).
 *
 * Renvoie null sans foyer, et aussi si la base n'a pas encore la migration 001 :
 * l'appelant envoie alors vers /bienvenue, qui affiche l'erreur de création.
 */
export async function getActiveHousehold(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActiveHousehold | null> {
  const { data, error } = await supabase
    .from('household_members')
    .select('role, households ( id, name )')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[household] lecture du foyer impossible :', error.code, error.message)
    return null
  }
  const row = data as unknown as MembershipRow | null
  if (!row?.households) return null
  return { id: row.households.id, name: row.households.name, role: row.role }
}

/** Code PostgREST d'une fonction RPC absente du cache de schéma (migration non passée). */
export const PGRST_FUNCTION_NOT_FOUND = 'PGRST202'

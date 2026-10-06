import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveHousehold } from '@/lib/household'
import { HouseholdProvider } from '@/components/household/HouseholdProvider'
import { HouseholdDataProvider } from '@/components/household/HouseholdData'
import PushSync from '@/components/push/PushSync'

/**
 * Coquille de tous les écrans du foyer. Garde serveur : session (proxy.ts l'a
 * déjà vérifiée sur cookie, getClaims la valide), puis foyer — sans foyer,
 * direction /bienvenue. Le foyer lu ici est transmis aux pages clientes par
 * contexte, avec ses données (HouseholdDataProvider), chargées une fois pour
 * les onglets comme pour les feuilles (ajouter, scanner, étiquettes).
 *
 * getClaims plutôt que getUser : il vérifie la signature du jeton sur place
 * (clés asymétriques du projet, clé publique gardée en cache), sans aller-retour
 * au serveur d'auth à chaque ouverture. Avec l'ancien secret partagé (HS256),
 * il appelle getUser de lui-même. Le verrou reste le RLS.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub
  if (!userId) redirect('/auth/login')

  const household = await getActiveHousehold(supabase, userId)
  if (!household) redirect('/bienvenue')

  return (
    <HouseholdProvider value={{ household, userId }}>
      <HouseholdDataProvider>{children}</HouseholdDataProvider>
      <PushSync />
    </HouseholdProvider>
  )
}

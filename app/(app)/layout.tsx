import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveHousehold } from '@/lib/household'
import { HouseholdProvider } from '@/components/household/HouseholdProvider'
import { HouseholdDataProvider } from '@/components/household/HouseholdData'
import PushSync from '@/components/push/PushSync'

/**
 * Coquille de tous les écrans du foyer. Garde serveur : session (proxy.ts l'a
 * déjà vérifiée sur cookie, getUser la valide), puis foyer — sans foyer,
 * direction /bienvenue. Le foyer lu ici est transmis aux pages clientes par
 * contexte, avec ses données (HouseholdDataProvider), chargées une fois pour
 * les onglets comme pour les feuilles (ajouter, scanner, étiquettes).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const household = await getActiveHousehold(supabase, user.id)
  if (!household) redirect('/bienvenue')

  return (
    <HouseholdProvider value={{ household, userId: user.id }}>
      <HouseholdDataProvider>{children}</HouseholdDataProvider>
      <PushSync />
    </HouseholdProvider>
  )
}

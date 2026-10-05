import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveHousehold } from '@/lib/household'
import { HouseholdProvider } from '@/components/household/HouseholdProvider'
import TabBar from '@/components/layout/TabBar'

/**
 * Coquille des écrans à onglets. Garde serveur : session (proxy.ts l'a déjà
 * vérifiée sur cookie, getUser la valide), puis foyer — sans foyer, direction
 * /bienvenue. Le foyer lu ici est transmis aux pages clientes par contexte.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const household = await getActiveHousehold(supabase, user.id)
  if (!household) redirect('/bienvenue')

  return (
    <HouseholdProvider value={{ household, userId: user.id }}>
      <main className="pt-safe pb-tabbar mx-auto w-full max-w-md px-4">{children}</main>
      <TabBar />
    </HouseholdProvider>
  )
}

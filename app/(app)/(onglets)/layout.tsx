import StatusBarShield from '@/components/layout/StatusBarShield'
import TabBar from '@/components/layout/TabBar'
import UndoToast from '@/components/ui/UndoToast'

/**
 * Écrans à onglets : grand titre, barre flottante en bas, toast « Annuler »
 * au-dessus, et une bande opaque sous la barre d'état (pas de flou iOS en haut).
 */
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StatusBarShield />
      <main className="pt-safe pb-tabbar mx-auto w-full max-w-md px-4">{children}</main>
      <UndoToast />
      <TabBar />
    </>
  )
}

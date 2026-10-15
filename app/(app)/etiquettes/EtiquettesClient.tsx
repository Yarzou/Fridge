'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ChevronLeft, LoaderCircle, Printer } from 'lucide-react'
import { APP_NAME } from '@/lib/app'
import { plural } from '@/lib/utils'
import { useHouseholdData } from '@/components/household/HouseholdData'
import QrCodeSvg from '@/components/inventory/QrCodeSvg'
import { buttonClass } from '@/components/ui/Button'
import Notice from '@/components/ui/Notice'
import { glassButton } from '@/components/ui/glass'
import StatusBarShield from '@/components/layout/StatusBarShield'

const noop = () => () => {}

/**
 * Étiquettes QR des tiroirs, à imprimer sur une page A4 et à coller sur chaque
 * tiroir. Le QR mène à /tiroir/{id}?qr=1 sur le domaine d'où l'on imprime.
 * Toutes, ou celles d'un congélateur (`freezerId`), ou de quelques tiroirs
 * (`drawerIds`). Avec plusieurs congélateurs, chaque étiquette porte le nom du sien.
 *
 * Exception assumée aux tokens : l'étiquette est noire sur blanc, même en mode
 * sombre, puisqu'elle finit sur du papier.
 */
export default function EtiquettesClient({
  freezerId,
  drawerIds,
  returnTo,
}: {
  freezerId?: string
  drawerIds: string[]
  returnTo: string
}) {
  const data = useHouseholdData()
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => '')
  const freezers = freezerId ? data.freezers.filter(f => f.id === freezerId) : data.freezers
  const drawers = freezers
    .flatMap(f => f.compartments.map(c => ({ ...c, freezerName: f.name })))
    .filter(c => drawerIds.length === 0 || drawerIds.includes(c.id))
  const several = data.freezers.length > 1
  // Ce qui est imprimé, quand ce n'est pas tout
  const scope =
    drawerIds.length > 0
      ? drawers.map(c => (several ? `${c.name} (${c.freezerName})` : c.name)).join(', ')
      : freezerId && freezers[0]
        ? `${freezers[0].name} · ${plural(drawers.length, 'étiquette')}`
        : null

  return (
    <main className="pt-safe pb-safe mx-auto w-full max-w-3xl px-4 print:max-w-none print:p-0">
      <StatusBarShield />
      <header className="flex flex-col print:hidden">
        <div className="flex h-11 items-center">
          <Link href={returnTo} aria-label="Retour" className={glassButton('round', 'text-accent')}>
            <ChevronLeft size={24} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </div>
        <h1 className="mt-1.5 text-large-title">Étiquettes des tiroirs</h1>
        <p className="mt-0.5 text-subhead text-ink-muted">
          Imprimez la page, découpez les étiquettes et collez chacune sur son tiroir. Scannée depuis le bouton
          Scanner de l’appli, elle ouvre le tiroir.
        </p>
        {data.status === 'ready' && scope && <p className="mt-2 text-subhead font-semibold">{scope}</p>}
        <button
          type="button"
          onClick={() => window.print()}
          disabled={data.status !== 'ready' || drawers.length === 0}
          className={buttonClass('primary', 'mt-4 sm:max-w-xs')}
        >
          <Printer size={20} aria-hidden="true" />
          Imprimer
        </button>
      </header>

      {(data.status === 'loading' || !origin) && (
        <div className="flex justify-center py-10 text-ink-muted print:hidden">
          <LoaderCircle size={24} className="animate-spin" aria-label="Chargement" />
        </div>
      )}

      {data.status === 'ready' && drawers.length === 0 && (
        <Notice tone="warn" className="mt-6 print:hidden">
          Aucun tiroir à imprimer : il a peut-être été supprimé.
        </Notice>
      )}

      {data.status === 'ready' && origin && (
        <div className="mt-6 grid grid-cols-2 gap-3 print:mt-0 print:gap-0">
          {drawers.map(d => (
            <div
              key={d.id}
              className="flex break-inside-avoid flex-col items-center gap-2 rounded-xl border border-dashed border-black/30 bg-white p-4 text-center text-black print:rounded-none"
            >
              <QrCodeSvg value={`${origin}/tiroir/${d.id}?qr=1`} size={148} />
              <span className="text-title">{d.name}</span>
              {several && <span className="text-subhead">{d.freezerName}</span>}
              <span className="text-footnote">Scannez avec {APP_NAME} pour sortir un produit</span>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

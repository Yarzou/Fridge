'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, LoaderCircle, QrCode } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { plural } from '@/lib/utils'
import type { Item } from '@/lib/types'
import PageHeader from '@/components/ui/PageHeader'
import Notice from '@/components/ui/Notice'
import { ListRow, ListSection } from '@/components/ui/List'

type DrawerItem = Pick<Item, 'id' | 'name' | 'quantity' | 'unit'>

interface Loaded {
  name: string
  freezerName: string
  items: DrawerItem[]
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Un tiroir et ce qu'il contient. La sortie en un tap (−1, Annuler) arrive avec le lot « inventaire ». */
export default function TiroirClient({ id, fromQr }: { id: string; fromQr: boolean }) {
  const [supabase] = useState(() => createClient())
  const [data, setData] = useState<Loaded | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'not-found' | 'error'>(UUID_RE.test(id) ? 'loading' : 'not-found')

  useEffect(() => {
    if (!UUID_RE.test(id)) return
    let cancelled = false
    Promise.all([
      supabase.from('compartments').select('name, freezers ( name )').eq('id', id).maybeSingle(),
      supabase
        .from('items')
        .select('id, name, quantity, unit')
        .eq('compartment_id', id)
        .gt('quantity', 0)
        .order('name'),
    ]).then(([drawerRes, itemsRes]) => {
      if (cancelled) return
      if (drawerRes.error || itemsRes.error) {
        console.error('[tiroir]', drawerRes.error ?? itemsRes.error)
        setState('error')
        return
      }
      const drawer = drawerRes.data as unknown as { name: string; freezers: { name: string } | null } | null
      if (!drawer) {
        setState('not-found')
        return
      }
      setData({ name: drawer.name, freezerName: drawer.freezers?.name ?? '', items: itemsRes.data as DrawerItem[] })
      setState('ready')
    })
    return () => { cancelled = true }
  }, [supabase, id])

  const back = (
    <Link href="/congelateur" className="-ml-1.5 flex h-11 items-center gap-0.5 text-body text-accent">
      <ChevronLeft size={26} strokeWidth={2.2} aria-hidden="true" />
      Congélateur
    </Link>
  )

  if (state === 'not-found' || state === 'error') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader leading={back} title="Tiroir introuvable" />
        <Notice tone={state === 'error' ? 'danger' : 'warn'}>
          {state === 'error'
            ? 'Impossible de charger ce tiroir. Vérifiez votre connexion.'
            : 'Ce tiroir n’existe plus, ou il appartient à un autre foyer.'}
        </Notice>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader leading={back} title="Tiroir" />
        <div className="flex justify-center py-10 text-ink-muted">
          <LoaderCircle size={24} className="animate-spin" aria-label="Chargement" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        leading={back}
        badge={fromQr && (
          <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-accent-soft px-2.5 text-footnote font-semibold text-accent">
            <QrCode size={14} aria-hidden="true" /> Ouvert par le QR du tiroir
          </span>
        )}
        title={data.name}
        subtitle={`${data.freezerName} · ${data.items.length === 0 ? 'vide' : plural(data.items.length, 'produit')}`}
      />

      {data.items.length === 0 ? (
        <div className="rounded-xl bg-card px-5 py-6 text-center">
          <p className="text-body font-semibold">Ce tiroir est vide</p>
          <p className="mt-1 text-subhead text-ink-muted">Les produits rangés ici s’afficheront avec leur quantité.</p>
        </div>
      ) : (
        <ListSection>
          {data.items.map(item => (
            <ListRow
              key={item.id}
              title={item.name}
              trailing={
                <span className="text-body font-semibold tabular-nums">
                  ×{item.quantity}{item.unit ? ` ${item.unit}` : ''}
                </span>
              }
            />
          ))}
        </ListSection>
      )}
    </div>
  )
}

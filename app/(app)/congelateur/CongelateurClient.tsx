'use client'

import { useEffect, useState } from 'react'
import { LoaderCircle, Snowflake } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { plural } from '@/lib/utils'
import type { Freezer } from '@/lib/types'
import { useHousehold } from '@/components/household/HouseholdProvider'
import PageHeader from '@/components/ui/PageHeader'
import Notice from '@/components/ui/Notice'
import { ListRow, ListSection } from '@/components/ui/List'

interface Loaded {
  freezers: Freezer[]
  /** Nombre de produits en stock par tiroir (clé : id du tiroir, '' = sans tiroir). */
  counts: Record<string, number>
  total: number
}

/**
 * Onglet Congélateur. Pour l'instant : les congélateurs du foyer et leurs
 * tiroirs, avec le nombre de produits de chacun. La liste par catégorie,
 * l'ajout et la sortie arrivent avec le lot « inventaire ».
 */
export default function CongelateurClient() {
  const { household } = useHousehold()
  const [supabase] = useState(() => createClient())
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase
        .from('freezers')
        .select('id, name, position, compartments ( id, freezer_id, name, position )')
        .eq('household_id', household.id)
        .order('position'),
      supabase
        .from('items')
        .select('compartment_id')
        .eq('household_id', household.id)
        .gt('quantity', 0),
    ]).then(([freezersRes, itemsRes]) => {
      if (cancelled) return
      if (freezersRes.error || itemsRes.error) {
        console.error('[congelateur]', freezersRes.error ?? itemsRes.error)
        setError('Impossible de charger le congélateur. Vérifiez votre connexion.')
        return
      }
      const freezers = (freezersRes.data as unknown as Freezer[]).map(f => ({
        ...f,
        compartments: [...f.compartments].sort((a, b) => a.position - b.position),
      }))
      const counts: Record<string, number> = {}
      for (const row of itemsRes.data as { compartment_id: string | null }[]) {
        const key = row.compartment_id ?? ''
        counts[key] = (counts[key] ?? 0) + 1
      }
      setData({ freezers, counts, total: itemsRes.data.length })
    })
    return () => { cancelled = true }
  }, [supabase, household.id])

  const subtitle = data ? (data.total === 0 ? 'Vide pour l’instant' : plural(data.total, 'produit')) : undefined

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Congélateur" subtitle={subtitle} />

      {error && <Notice tone="danger">{error}</Notice>}

      {!data && !error && (
        <div className="flex justify-center py-10 text-ink-muted">
          <LoaderCircle size={24} className="animate-spin" aria-label="Chargement" />
        </div>
      )}

      {data && data.total === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-card px-5 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Snowflake size={24} aria-hidden="true" />
          </span>
          <p className="text-body font-semibold">Le congélateur est vide</p>
          <p className="text-subhead text-ink-muted">
            Les produits rangés apparaîtront ici, triés par catégorie, ceux à consommer en premier en tête.
          </p>
        </div>
      )}

      {data?.freezers.map(freezer => (
        <ListSection key={freezer.id} header={freezer.name}>
          {freezer.compartments.length === 0 ? (
            <ListRow title="Aucun tiroir" subtitle="Les produits sont rangés en vrac." />
          ) : (
            freezer.compartments.map(c => {
              const count = data.counts[c.id] ?? 0
              return (
                <ListRow
                  key={c.id}
                  href={`/tiroir/${c.id}`}
                  title={c.name}
                  trailing={<span className="text-body text-ink-muted">{count === 0 ? 'Vide' : plural(count, 'produit')}</span>}
                />
              )
            })
          )}
        </ListSection>
      ))}
    </div>
  )
}

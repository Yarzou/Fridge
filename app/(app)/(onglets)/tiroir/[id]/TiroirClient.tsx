'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, CircleCheck, CirclePlus, LoaderCircle, Minus, QrCode, ShoppingCart } from 'lucide-react'
import { aisleForFreezerItem } from '@/lib/aisles'
import { dueOf, frozenLabel } from '@/lib/dates'
import { useToday } from '@/lib/useToday'
import { cn, plural } from '@/lib/utils'
import type { Item } from '@/lib/types'
import { useHouseholdData } from '@/components/household/HouseholdData'
import { CategoryTile, DueBadge } from '@/components/inventory/CategoryTile'
import PageHeader from '@/components/ui/PageHeader'
import Notice from '@/components/ui/Notice'

/**
 * Un tiroir, ouvert depuis l'onglet Congélateur ou par son QR code (maquette
 * « Tiroir — sortie rapide ») : − sort un produit en un tap, « Annuler » dans
 * le toast. Un produit fini propose d'aller sur la liste de courses.
 */
export default function TiroirClient({ id, fromQr }: { id: string; fromQr: boolean }) {
  const data = useHouseholdData()
  const today = useToday()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState('')
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [lastTaken, setLastTaken] = useState<string | null>(null)

  const freezer = data.freezers.find(f => f.compartments.some(c => c.id === id))
  const drawer = freezer?.compartments.find(c => c.id === id)

  const back = (
    <Link href="/congelateur" className="-ml-1.5 flex h-11 items-center gap-0.5 text-body text-accent">
      <ChevronLeft size={24} strokeWidth={2.4} aria-hidden="true" />
      Congélateur
    </Link>
  )

  if (data.status === 'loading') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader leading={back} title="Tiroir" />
        <div className="flex justify-center py-10 text-ink-muted">
          <LoaderCircle size={24} className="animate-spin" aria-label="Chargement" />
        </div>
      </div>
    )
  }

  if (!freezer || !drawer) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader leading={back} title="Tiroir introuvable" />
        <Notice tone={data.status === 'error' ? 'danger' : 'warn'}>
          {data.status === 'error'
            ? 'Impossible de charger ce tiroir. Vérifiez votre connexion.'
            : 'Ce tiroir n’existe plus, ou il appartient à un autre foyer.'}
        </Notice>
      </div>
    )
  }

  const rows = data.items
    .filter(i => i.compartment_id === id && (i.quantity > 0 || (data.finished.has(i.id) && !dismissed.has(i.id))))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const inStock = rows.filter(i => i.quantity > 0).length
  const onList = new Set(data.shopping.map(s => s.from_item_id).filter(Boolean))

  const take = (item: Item) => {
    setLastTaken(item.id)
    void data.takeOut(item, 1)
  }

  const addToList = (item: Item) => {
    void data.addShopping({
      name: item.name,
      aisle_slug: aisleForFreezerItem(item, data.terms),
      from_item_id: item.id,
    })
  }

  const saveName = async () => {
    if (draft.trim() && draft.trim() !== drawer.name) await data.renameCompartment(drawer.id, draft)
    setRenaming(false)
  }

  const meta = (item: Item) =>
    `${frozenLabel(item.frozen_on, today, true)}${item.unit ? ` · par ${item.unit}` : ''}`

  return (
    <div className="flex flex-col">
      <header className="flex flex-col">
        <div className="flex h-11 items-center justify-between gap-3">
          {back}
          {renaming ? (
            <button type="button" onClick={saveName} className="h-11 text-body font-semibold text-accent">
              OK
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(drawer.name)
                setRenaming(true)
              }}
              className="h-11 text-body text-accent"
            >
              Modifier
            </button>
          )}
        </div>
        {fromQr && (
          <span className="mt-1.5 inline-flex h-[26px] items-center gap-1.5 self-start rounded-full bg-accent-soft px-2.5 text-footnote font-semibold text-accent">
            <QrCode size={14} aria-hidden="true" /> Ouvert par le QR du tiroir
          </span>
        )}
        {renaming ? (
          <form
            onSubmit={e => {
              e.preventDefault()
              void saveName()
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              maxLength={40}
              aria-label="Nom du tiroir"
              enterKeyHint="done"
              className="-mx-2 mt-1.5 h-[41px] w-[calc(100%+16px)] rounded-lg bg-card px-2 text-large-title outline-none"
            />
          </form>
        ) : (
          <h1 className="mt-1.5 text-large-title">{drawer.name}</h1>
        )}
        <p className="mt-0.5 text-subhead text-ink-muted">
          {renaming
            ? 'Le QR collé sur le tiroir reste valable.'
            : `${freezer.name} · ${inStock === 0 ? 'vide.' : `${plural(inStock, 'produit')}. Touchez − pour sortir un produit.`}`}
        </p>
      </header>

      <div className="mt-[18px] overflow-hidden rounded-xl bg-card">
        {rows.length === 0 && (
          <p className="px-4 py-5 text-center text-subhead text-ink-muted">Ce tiroir est vide.</p>
        )}
        {rows.map((item, index) => {
          const due = dueOf(item.best_before, today)
          return (
            <div key={item.id} className="relative">
              {index > 0 && <div className="absolute left-[62px] right-0 top-0 h-px bg-separator" />}

              {item.quantity > 0 ? (
                <div
                  className={cn(
                    'flex min-h-[66px] items-center gap-3 py-2.5 pl-4 pr-3 transition-colors',
                    lastTaken === item.id && data.toast ? 'bg-accent-wash' : 'bg-card',
                  )}
                >
                  <CategoryTile slug={item.category_slug} size="lg" />
                  <Link href={`/produit/${item.id}?retour=/tiroir/${id}`} className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="text-body">{item.name}</span>
                    <span className="text-footnote text-ink-muted">{meta(item)}</span>
                    <DueBadge due={due} />
                  </Link>
                  <span className="min-w-6 text-right text-title font-semibold tabular-nums">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => take(item)}
                    aria-label={`Sortir 1 · ${item.name}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent active:opacity-70"
                  >
                    <Minus size={22} strokeWidth={2.6} aria-hidden="true" />
                  </button>
                </div>
              ) : onList.has(item.id) ? (
                <div className="flex min-h-[52px] items-center gap-2.5 px-4 py-2 text-subhead text-ink-muted">
                  <CircleCheck size={20} strokeWidth={2.4} className="shrink-0 text-accent" aria-hidden="true" />
                  <span>Ajouté aux courses : {item.name}</span>
                </div>
              ) : (
                <div className="m-2 flex flex-col gap-2.5 rounded-xl bg-accent-wash p-3.5">
                  <div className="flex items-start gap-2.5">
                    <ShoppingCart size={20} className="mt-px shrink-0 text-accent" aria-hidden="true" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-subhead font-semibold">{item.name} : plus rien en stock</span>
                      <span className="text-subhead">Ajouter à la liste de courses ?</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pl-[30px]">
                    <button
                      type="button"
                      onClick={() => addToList(item)}
                      className="h-11 rounded-full bg-accent-fill px-3.5 text-subhead font-semibold text-white"
                    >
                      Ajouter aux courses
                    </button>
                    <button
                      type="button"
                      onClick={() => setDismissed(prev => new Set(prev).add(item.id))}
                      className="h-11 rounded-full px-3 text-subhead text-accent"
                    >
                      Non merci
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <Link
          href={`/ajouter?tiroir=${id}&retour=/tiroir/${id}`}
          className="flex min-h-[52px] items-center gap-3 border-t border-separator px-4 text-body text-accent first:border-t-0"
        >
          <CirclePlus size={22} aria-hidden="true" />
          Ajouter dans ce tiroir
        </Link>
      </div>
    </div>
  )
}

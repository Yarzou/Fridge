'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Check,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Minus,
  Plus,
  QrCode,
  ScanLine,
  Search,
  Share,
  Snowflake,
  X,
} from 'lucide-react'
import { CATEGORIES } from '@/lib/categories'
import { normalizeTerm } from '@/lib/aisles'
import { dueOf, formatMonthYear, frozenLabel } from '@/lib/dates'
import { useToday } from '@/lib/useToday'
import { cn, plural } from '@/lib/utils'
import type { Item } from '@/lib/types'
import { useHouseholdData } from '@/components/household/HouseholdData'
import { CategoryTile, DueBadge } from '@/components/inventory/CategoryTile'
import Segmented from '@/components/ui/Segmented'
import SwipeRow from '@/components/ui/SwipeRow'
import Notice from '@/components/ui/Notice'
import { buttonClass } from '@/components/ui/Button'
import { GLASS, glassButton } from '@/components/ui/glass'
import PushPrompt from '@/components/push/PushPrompt'

type View = 'categories' | 'tiroirs' | 'dates'

const VIEWS: { value: View; label: string }[] = [
  { value: 'categories', label: 'Catégories' },
  { value: 'tiroirs', label: 'Tiroirs' },
  { value: 'dates', label: 'Dates' },
]

interface Group {
  key: string
  title: string
  tile?: React.ReactNode
  href?: string
  items: Item[]
}

/**
 * Onglet Congélateur (maquette « Congélateur ») : ce qu'il y a dedans, rangé
 * par catégorie, par tiroir ou par date, ce qu'il faut manger d'abord en tête.
 * Une ligne glissée vers la gauche propose « Sortir 1 » et « Tout sortir ».
 */
export default function CongelateurClient() {
  const data = useHouseholdData()
  const today = useToday()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('categories')
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const freezer = data.freezer
  const compartments = freezer?.compartments ?? []
  const drawerName = new Map(compartments.map(c => [c.id, c.name]))
  const where = (item: Item) => (item.compartment_id ? drawerName.get(item.compartment_id) ?? 'Tiroir' : 'Sans tiroir')

  const stock = data.items.filter(i => i.quantity > 0 && i.freezer_id === freezer?.id)
  const watch = stock
    .map(item => ({ item, due: dueOf(item.best_before, today) }))
    .filter(({ due }) => due.status === 'late' || due.status === 'soon')
    .sort((a, b) => (a.due.days ?? 0) - (b.due.days ?? 0))

  const needle = normalizeTerm(query)
  const shown = needle ? stock.filter(i => normalizeTerm(i.name).includes(needle)) : stock

  const byFrozenDesc = (a: Item, b: Item) => b.frozen_on.localeCompare(a.frozen_on) || a.name.localeCompare(b.name)
  let groups: Group[] = []
  if (view === 'categories') {
    groups = CATEGORIES.map(c => ({
      key: c.slug,
      title: c.label,
      tile: <CategoryTile slug={c.slug} size="sm" />,
      items: shown.filter(i => i.category_slug === c.slug).sort(byFrozenDesc),
    }))
    // Un slug ajouté en base après coup tombe dans « Autres »
    const known = new Set(CATEGORIES.map(c => c.slug))
    const orphans = shown.filter(i => !known.has(i.category_slug))
    if (orphans.length) groups.find(g => g.key === 'autres')!.items.push(...orphans)
  } else if (view === 'tiroirs') {
    groups = compartments.map(c => ({
      key: c.id,
      title: c.name,
      href: `/tiroir/${c.id}`,
      items: shown.filter(i => i.compartment_id === c.id).sort(byFrozenDesc),
    }))
    groups.push({ key: 'sans-tiroir', title: 'Sans tiroir', items: shown.filter(i => !i.compartment_id).sort(byFrozenDesc) })
  } else {
    groups = [
      {
        key: 'dates',
        title: '',
        items: [...shown].sort(
          (a, b) =>
            (a.best_before ?? '9999').localeCompare(b.best_before ?? '9999') || a.name.localeCompare(b.name),
        ),
      },
    ]
  }
  groups = groups.filter(g => g.items.length > 0)

  const meta = (item: Item) => {
    if (view === 'dates') {
      return item.best_before ? `${where(item)} · avant ${formatMonthYear(item.best_before)}` : `${where(item)} · sans date`
    }
    if (view === 'tiroirs') {
      const category = CATEGORIES.find(c => c.slug === item.category_slug)?.label ?? 'Autres'
      return `${category} · ${frozenLabel(item.frozen_on, today)}`
    }
    return `${where(item)} · ${frozenLabel(item.frozen_on, today)}`
  }

  const subtitle =
    data.status !== 'ready'
      ? undefined
      : stock.length === 0
        ? 'Vide pour l’instant'
        : `${plural(stock.length, 'produit')}${watch.length ? ` · ${watch.length} à surveiller` : ''}`

  const addHref = `/ajouter?retour=/congelateur${freezer ? `&congelateur=${freezer.id}` : ''}`

  return (
    <div className="flex flex-col">
      <header className="flex flex-col">
        <div className="relative flex h-11 items-center justify-between">
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className={glassButton('capsule', 'max-w-[70%] gap-1')}
          >
            <span className="truncate">{freezer?.name ?? 'Congélateur'}</span>
            <ChevronDown size={14} strokeWidth={2.6} className="shrink-0" aria-hidden="true" />
          </button>
          <Link
            href={addHref}
            prefetch
            aria-label="Ajouter un produit"
            className={glassButton('round', 'text-accent')}
          >
            <Plus size={22} strokeWidth={2.4} aria-hidden="true" />
          </Link>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Fermer le menu"
                className="fixed inset-0 z-20 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              {/* Menu en verre, qui sort du bouton */}
              <div
                role="menu"
                className={cn(
                  'absolute left-0 top-12 z-30 w-64 origin-top-left overflow-hidden rounded-[22px] motion-safe:animate-menu',
                  GLASS,
                )}
              >
                {data.freezers.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={f.id === freezer?.id}
                    onClick={() => {
                      data.selectFreezer(f.id)
                      setMenuOpen(false)
                    }}
                    className="flex min-h-11 w-full items-center gap-3 border-b border-separator px-4 text-left text-body"
                  >
                    <span className="w-4 text-accent">
                      {f.id === freezer?.id && <Check size={16} strokeWidth={2.6} aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  </button>
                ))}
                <Link
                  href="/etiquettes"
                  role="menuitem"
                  className="flex min-h-11 items-center gap-3 px-4 text-body text-accent"
                >
                  <QrCode size={16} aria-hidden="true" />
                  Étiquettes QR des tiroirs
                </Link>
              </div>
            </>
          )}
        </div>
        <h1 className="mt-1.5 text-large-title">Congélateur</h1>
        {subtitle && <p className="mt-0.5 text-subhead text-ink-muted">{subtitle}</p>}
      </header>

      <label className="mt-4 flex h-[38px] items-center gap-2 rounded-[11px] bg-fill px-2.5 text-ink-muted">
        <Search size={18} strokeWidth={2.2} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Rechercher un produit"
          placeholder="Rechercher un produit"
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Effacer la recherche"
            className="-mr-2 flex h-11 w-11 items-center justify-center"
          >
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ink-faint text-canvas">
              <X size={12} strokeWidth={3} aria-hidden="true" />
            </span>
          </button>
        )}
      </label>

      <Segmented label="Ranger par" options={VIEWS} value={view} onChange={setView} className="mt-3" />

      {data.status === 'loading' && (
        <div className="flex justify-center py-10 text-ink-muted">
          <LoaderCircle size={24} className="animate-spin" aria-label="Chargement" />
        </div>
      )}
      {data.status === 'error' && (
        <Notice tone="danger" className="mt-6">
          Impossible de charger le congélateur. Vérifiez votre connexion.
        </Notice>
      )}

      {data.status === 'ready' && !needle && watch.length > 0 && (
        <section className="mt-6" aria-labelledby="bientot">
          <div className="flex items-baseline justify-between">
            <h2 id="bientot" className="text-title">
              À consommer bientôt
            </h2>
            {view !== 'dates' && (
              <button type="button" onClick={() => setView('dates')} className="text-subhead text-accent">
                Tout voir
              </button>
            )}
          </div>
          <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2.5 overflow-x-auto px-4 pb-1">
            {watch.slice(0, 12).map(({ item, due }) => (
              <Link
                key={item.id}
                href={`/produit/${item.id}`}
                prefetch
                className="flex w-[150px] shrink-0 flex-col gap-2 rounded-2xl bg-card p-3"
              >
                <CategoryTile slug={item.category_slug} size="md" />
                <span className="line-clamp-2 min-h-10 text-subhead font-semibold">{item.name}</span>
                <DueBadge due={due} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.status === 'ready' && !needle && stock.length > 0 && <PushPrompt />}

      {data.status === 'ready' && stock.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-xl bg-card px-5 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Snowflake size={24} aria-hidden="true" />
          </span>
          <p className="text-body font-semibold">Le congélateur est vide</p>
          <p className="text-subhead text-ink-muted">
            Scannez un code-barres ou ajoutez un produit : sa date de congélation est notée toute seule.
          </p>
          <div className="mt-2 grid w-full grid-cols-2 gap-2.5">
            <Link href="/scanner" className={buttonClass('secondary')}>
              <ScanLine size={18} aria-hidden="true" /> Scanner
            </Link>
            <Link href={addHref} prefetch className={buttonClass('primary')}>
              <Plus size={18} aria-hidden="true" /> Ajouter
            </Link>
          </div>
        </div>
      )}

      {data.status === 'ready' && needle && shown.length === 0 && (
        <p className="mt-6 text-center text-subhead text-ink-muted">Aucun produit ne correspond à « {query.trim()} ».</p>
      )}

      {groups.map(group => (
        <section key={group.key} className="mt-6 flex flex-col gap-2">
          {group.title && (
            <div className="flex items-center gap-2.5">
              {group.tile}
              <h2 className="text-title">
                {group.href ? (
                  <Link href={group.href} prefetch className="inline-flex items-center gap-1">
                    {group.title}
                    <ChevronRight size={18} strokeWidth={2.6} className="text-ink-faint" aria-hidden="true" />
                  </Link>
                ) : (
                  group.title
                )}
              </h2>
              <span className="text-body text-ink-muted">{group.items.length}</span>
            </div>
          )}
          <div className="overflow-hidden rounded-xl bg-card">
            {group.items.map((item, index) => (
              <div key={item.id} className="relative">
                {index > 0 && <div className="absolute left-4 right-0 top-0 z-10 h-px bg-separator" />}
                <SwipeRow
                  open={openRow === item.id}
                  onOpenChange={open => setOpenRow(open ? item.id : null)}
                  actionsWidth={156}
                  actions={
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenRow(null)
                          void data.takeOut(item, 1)
                        }}
                        className="flex w-[78px] flex-col items-center justify-center gap-[3px] bg-accent-fill text-footnote font-semibold text-white"
                      >
                        <Minus size={20} strokeWidth={2.4} aria-hidden="true" />
                        Sortir 1<span className="sr-only"> · {item.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenRow(null)
                          void data.takeOut(item, item.quantity)
                        }}
                        className="flex w-[78px] flex-col items-center justify-center gap-[3px] bg-swipe text-footnote font-semibold text-white"
                      >
                        <Share size={20} strokeWidth={2.2} aria-hidden="true" />
                        Tout sortir<span className="sr-only"> · {item.name}</span>
                      </button>
                    </>
                  }
                >
                  <Link
                    href={`/produit/${item.id}`}
                    prefetch
                    draggable={false}
                    className={cn(
                      'flex min-h-[62px] items-center gap-3 px-4 py-2.5',
                      openRow === item.id && 'select-none',
                    )}
                  >
                    {view === 'dates' && <CategoryTile slug={item.category_slug} size="md" />}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-body">{item.name}</span>
                      <span className="truncate text-footnote text-ink-muted">{meta(item)}</span>
                      {view === 'dates' && <DueBadge due={dueOf(item.best_before, today)} className="mt-0.5" />}
                    </span>
                    <span className="text-body font-semibold tabular-nums">×{item.quantity}</span>
                  </Link>
                </SwipeRow>
              </div>
            ))}
          </div>
        </section>
      ))}

      {data.status === 'ready' && stock.length > 0 && (
        <p className="mx-4 mt-3 text-footnote text-ink-muted">Glissez une ligne vers la gauche pour sortir un produit.</p>
      )}
    </div>
  )
}

'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, LoaderCircle, Minus, Plus, ScanLine, Trash } from 'lucide-react'
import { CATEGORIES, getCategory, guessCategory } from '@/lib/categories'
import { addMonths, formatMonthYear, formatShortDate, daysBetween } from '@/lib/dates'
import { UNITS, quantityLabel } from '@/lib/units'
import { useToday } from '@/lib/useToday'
import { cn } from '@/lib/utils'
import type { Freezer, Item } from '@/lib/types'
import { useHouseholdData, type ItemInput } from '@/components/household/HouseholdData'
import { CategoryTile } from '@/components/inventory/CategoryTile'
import Sheet from '@/components/layout/Sheet'
import Segmented from '@/components/ui/Segmented'
import Notice from '@/components/ui/Notice'
import { buttonClass } from '@/components/ui/Button'

/** Ce que le scanner (ou un lien) sait déjà du produit à ranger. */
export interface ItemPrefill {
  barcode?: string
  name?: string
  /** « Sachet de 1 kg » : conditionnement lu sur Open Food Facts, affiché seulement. */
  format?: string
  image?: string
  category?: string
  freezer?: string
  compartment?: string
}

type ItemSheetProps =
  | { mode: 'add'; prefill: ItemPrefill; returnTo: string }
  | { mode: 'edit'; itemId: string; returnTo: string }

/**
 * Feuille « Nouveau produit » / « Modifier le produit » (maquette « Ajouter un
 * produit »). La date « À consommer avant » suit la catégorie tant qu'on ne
 * l'a pas choisie à la main.
 */
export default function ItemSheet(props: ItemSheetProps) {
  const router = useRouter()
  const data = useHouseholdData()
  const title = props.mode === 'add' ? 'Nouveau produit' : 'Modifier le produit'

  const close = () => {
    if (window.history.length > 1) router.back()
    else router.replace(props.returnTo)
  }
  const cancel = (
    <button type="button" onClick={close} className="h-11 text-body text-accent">
      Annuler
    </button>
  )

  if (data.status === 'loading') {
    return (
      <Sheet title={title} cancel={cancel}>
        <div className="flex justify-center py-10 text-ink-muted">
          <LoaderCircle size={24} className="animate-spin" aria-label="Chargement" />
        </div>
      </Sheet>
    )
  }

  const item = props.mode === 'edit' ? data.items.find(i => i.id === props.itemId) : undefined
  if (data.status === 'error' || data.freezers.length === 0 || (props.mode === 'edit' && !item)) {
    return (
      <Sheet title={title} cancel={cancel}>
        <Notice tone={data.status === 'error' ? 'danger' : 'warn'}>
          {data.status === 'error'
            ? 'Impossible de charger le congélateur. Vérifiez votre connexion.'
            : props.mode === 'edit'
              ? 'Ce produit n’existe plus : il a peut-être été supprimé par un autre membre du foyer.'
              : 'Le foyer n’a pas encore de congélateur.'}
        </Notice>
      </Sheet>
    )
  }

  return (
    <ItemForm
      key={item?.id ?? 'nouveau'}
      title={title}
      cancel={cancel}
      freezers={data.freezers}
      defaultFreezer={data.freezer}
      item={item}
      prefill={props.mode === 'add' ? props.prefill : {}}
      returnTo={props.returnTo}
    />
  )
}

function ItemForm({
  title,
  cancel,
  freezers,
  defaultFreezer,
  item,
  prefill,
  returnTo,
}: {
  title: string
  cancel: React.ReactNode
  freezers: Freezer[]
  defaultFreezer: Freezer | null
  item?: Item
  prefill: ItemPrefill
  returnTo: string
}) {
  const router = useRouter()
  const data = useHouseholdData()
  const today = useToday()
  const nameRef = useRef<HTMLInputElement>(null)
  const editing = !!item

  const [name, setName] = useState(item?.name ?? prefill.name ?? '')
  const [pickedCategory, setPickedCategory] = useState<string | null>(
    item?.category_slug ?? (prefill.category ? getCategory(prefill.category).slug : null),
  )
  const [quantity, setQuantity] = useState(item?.quantity ?? 1)
  const [unit, setUnit] = useState<string | null>(() => {
    if (item) return item.unit
    const guess = prefill.category ?? guessCategory([], prefill.name ?? '')
    return prefill.barcode && ['legumes', 'fruits', 'herbes', 'poissons', 'viandes'].includes(guess) ? 'sachet' : null
  })
  const [freezerId, setFreezerId] = useState(() => {
    const wanted = item?.freezer_id ?? prefill.freezer
    const fromDrawer = freezers.find(f => f.compartments.some(c => c.id === prefill.compartment))
    return (freezers.find(f => f.id === wanted) ?? fromDrawer ?? defaultFreezer ?? freezers[0]).id
  })
  const [compartmentId, setCompartmentId] = useState<string | null>(() => {
    if (item) return item.compartment_id
    const freezer = freezers.find(f => f.id === freezerId) ?? freezers[0]
    if (prefill.compartment && freezer.compartments.some(c => c.id === prefill.compartment)) return prefill.compartment
    // Même code-barres déjà rangé : même tiroir
    const twin = prefill.barcode ? data.items.find(i => i.barcode === prefill.barcode && i.freezer_id === freezer.id) : undefined
    return twin?.compartment_id ?? freezer.compartments[0]?.id ?? null
  })
  const [frozenOn, setFrozenOn] = useState<string | null>(item?.frozen_on ?? null)
  const [bestBeforeOverride, setBestBeforeOverride] = useState<string | null>(() => {
    if (!item?.best_before) return null
    const auto = addMonths(item.frozen_on, getCategory(item.category_slug).months)
    return item.best_before === auto ? null : item.best_before
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const category = getCategory(pickedCategory ?? guessCategory([], name))
  const freezer = freezers.find(f => f.id === freezerId) ?? freezers[0]
  const frozen = frozenOn ?? today
  const bestBefore = bestBeforeOverride ?? (frozen ? addMonths(frozen, category.months) : '')

  const frozenDisplay = !frozen
    ? ''
    : daysBetween(frozen, today) === 0
      ? 'Aujourd’hui'
      : daysBetween(frozen, today) === 1
        ? 'Hier'
        : formatShortDate(frozen, today)

  const drawers = freezer.compartments
  const shortNames = drawers.map(c => c.name.replace(/^tiroir\s+/i, ''))
  const useSegments = drawers.length > 0 && drawers.length <= 4 && shortNames.every(n => n.length <= 10)

  const submit = async (next: 'back' | 'scan') => {
    if (!name.trim()) {
      setError('Donnez un nom au produit.')
      nameRef.current?.focus()
      return
    }
    if (!frozen) return
    setSaving(true)
    setError(null)
    const input: ItemInput = {
      freezer_id: freezer.id,
      compartment_id: drawers.some(c => c.id === compartmentId) ? compartmentId : null,
      category_slug: category.slug,
      name: name.trim().slice(0, 80),
      quantity,
      unit,
      barcode: item?.barcode ?? prefill.barcode ?? null,
      image_url: item?.image_url ?? prefill.image ?? null,
      frozen_on: frozen,
      best_before: bestBefore || null,
    }
    const ok = item ? await data.updateItem(item.id, input) : await data.addItem(input)
    setSaving(false)
    if (!ok) {
      setError('Enregistrement impossible. Vérifiez votre connexion.')
      return
    }
    router.replace(next === 'scan' ? '/scanner' : returnTo)
  }

  const remove = async () => {
    if (!item) return
    await data.deleteItem(item)
    router.replace(returnTo)
  }

  const image = item?.image_url ?? prefill.image
  const barcode = item?.barcode ?? prefill.barcode
  const recognized = !!barcode && !!prefill.name

  const footer = editing ? (
    <button type="button" onClick={() => submit('back')} disabled={saving} className={buttonClass('primary')}>
      {saving && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
      Enregistrer
    </button>
  ) : (
    <>
      <button type="button" onClick={() => submit('back')} disabled={saving} className={buttonClass('primary')}>
        {saving && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
        Ajouter {quantityLabel(quantity, unit)}
      </button>
      <button type="button" onClick={() => submit('scan')} disabled={saving} className={buttonClass('secondary')}>
        <ScanLine size={20} strokeWidth={2.2} aria-hidden="true" />
        Ajouter et scanner le suivant
      </button>
    </>
  )

  return (
    <Sheet title={title} cancel={cancel} footer={footer}>
      <form
        onSubmit={e => {
          e.preventDefault()
          void submit('back')
        }}
        className="flex flex-col gap-[22px]"
      >
        <div className="flex items-center gap-3.5 rounded-[14px] bg-card p-3.5">
          {image ? (
            <Image
              src={image}
              alt=""
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 shrink-0 rounded-xl bg-fill-soft object-contain"
            />
          ) : (
            <CategoryTile slug={category.slug} size="xxl" soft />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <input
              ref={nameRef}
              value={name}
              onChange={e => {
                setName(e.target.value)
                setError(null)
              }}
              maxLength={80}
              placeholder="Nom du produit"
              aria-label="Nom du produit"
              enterKeyHint="done"
              className="w-full min-w-0 bg-transparent text-body font-semibold text-ink outline-none"
            />
            {prefill.format && !editing && <span className="text-subhead text-ink-muted">{prefill.format}</span>}
            {recognized && !editing ? (
              <span className="mt-0.5 inline-flex items-center gap-1 text-footnote text-accent">
                <Check size={14} strokeWidth={2.8} aria-hidden="true" />
                Reconnu par son code-barres
              </span>
            ) : barcode ? (
              <span className="mt-0.5 text-footnote text-ink-muted">Code-barres {barcode}</span>
            ) : null}
          </div>
        </div>
        {error && <Notice tone="danger">{error}</Notice>}

        <section className="flex flex-col gap-2">
          <h2 className="ml-4 text-footnote font-normal uppercase tracking-[0.3px] text-ink-muted">Catégorie</h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(c => {
              const active = c.slug === category.slug
              return (
                <button
                  key={c.slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPickedCategory(c.slug)}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-subhead',
                    active ? 'border-accent-fill bg-accent-fill font-semibold text-white' : 'border-chip-edge bg-card text-ink',
                  )}
                >
                  {active && <Check size={15} strokeWidth={3} aria-hidden="true" />}
                  {c.label}
                </button>
              )
            })}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <div className="overflow-hidden rounded-xl bg-card">
            <div className="flex min-h-[52px] items-center gap-3 px-4 py-2">
              <span className="flex-1 text-body">Quantité</span>
              <label className="relative flex items-center gap-0.5 text-body text-ink-muted tabular-nums">
                {quantityLabel(quantity, unit)}
                <ChevronDown size={14} strokeWidth={2.4} aria-hidden="true" />
                <select
                  value={unit ?? ''}
                  onChange={e => setUnit(e.target.value || null)}
                  aria-label="Conditionnement"
                  className="absolute inset-0 cursor-pointer opacity-0"
                >
                  <option value="">pièces</option>
                  {UNITS.map(u => (
                    <option key={u} value={u}>
                      {quantityLabel(2, u).slice(2)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex h-8 items-center rounded-lg bg-fill-soft">
                <button
                  type="button"
                  aria-label="Un de moins"
                  onClick={() => setQuantity(q => Math.max(q - 1, editing ? 0 : 1))}
                  className="relative flex h-8 w-[46px] items-center justify-center text-ink before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-['']"
                >
                  <Minus size={18} strokeWidth={2.4} aria-hidden="true" />
                </button>
                <span className="h-[18px] w-px bg-grabber" aria-hidden="true" />
                <button
                  type="button"
                  aria-label="Un de plus"
                  onClick={() => setQuantity(q => Math.min(q + 1, 99))}
                  className="relative flex h-8 w-[46px] items-center justify-center text-ink before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-['']"
                >
                  <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>
            </div>

            {freezers.length > 1 && (
              <div className="flex min-h-[52px] items-center gap-3 border-t border-separator px-4 py-2">
                <span className="flex-1 text-body">Congélateur</span>
                <select
                  value={freezer.id}
                  onChange={e => {
                    const next = freezers.find(f => f.id === e.target.value)
                    if (!next) return
                    setFreezerId(next.id)
                    setCompartmentId(next.compartments[0]?.id ?? null)
                  }}
                  aria-label="Congélateur"
                  className="h-[34px] rounded-lg bg-fill-soft px-2 text-body text-ink"
                >
                  {freezers.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {drawers.length > 0 && (
              <div className="flex min-h-[52px] items-center gap-3 border-t border-separator px-4 py-2">
                <span className="flex-1 text-body">Tiroir</span>
                {useSegments ? (
                  <Segmented
                    label="Tiroir"
                    value={compartmentId ?? ''}
                    onChange={setCompartmentId}
                    options={drawers.map((c, i) => ({ value: c.id, label: shortNames[i], ariaLabel: c.name }))}
                    className="bg-fill-soft"
                    itemClassName="h-[30px] text-subhead"
                    style={{ width: 46 * drawers.length }}
                  />
                ) : (
                  <select
                    value={compartmentId ?? ''}
                    onChange={e => setCompartmentId(e.target.value || null)}
                    aria-label="Tiroir"
                    className="h-[34px] max-w-[60%] rounded-lg bg-fill-soft px-2 text-body text-ink"
                  >
                    <option value="">Sans tiroir</option>
                    {drawers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="flex min-h-[52px] items-center gap-3 border-t border-separator px-4 py-2">
              <span className="flex-1 text-body">Congelé le</span>
              <DatePill
                label="Date de congélation"
                value={frozen}
                display={frozenDisplay}
                max={today}
                onChange={setFrozenOn}
              />
            </div>
            <div className="flex min-h-[52px] items-center gap-3 border-t border-separator px-4 py-2">
              <span className="flex-1 text-body">À consommer avant</span>
              <DatePill
                label="À consommer avant"
                value={bestBefore}
                display={bestBefore ? formatMonthYear(bestBefore) : ''}
                onChange={setBestBeforeOverride}
              />
            </div>
          </div>
          <p className="mx-4 text-footnote text-ink-muted">
            {category.label} : {category.months} mois conseillés par défaut.
            {bestBeforeOverride && (
              <>
                {' '}
                <button type="button" onClick={() => setBestBeforeOverride(null)} className="text-accent">
                  Revenir à cette durée
                </button>
              </>
            )}
          </p>
        </section>

        {editing && (
          <button
            type="button"
            onClick={remove}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-card text-body text-danger"
          >
            <Trash size={18} aria-hidden="true" />
            Supprimer ce produit
          </button>
        )}
      </form>
    </Sheet>
  )
}

/**
 * Date en pastille grise, comme le sélecteur de date d'iOS. Le vrai champ
 * `<input type="date">` est posé dessus, transparent : le téléphone ouvre son
 * propre sélecteur. Zone de touche portée à 44 px de haut.
 */
function DatePill({
  label,
  value,
  display,
  max,
  onChange,
}: {
  label: string
  value: string
  display: string
  max?: string
  onChange: (value: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <span className="relative">
      <span aria-hidden="true" className="flex h-[34px] items-center rounded-lg bg-fill-soft px-[11px] text-body">
        {display}
      </span>
      <input
        ref={ref}
        type="date"
        aria-label={label}
        value={value}
        max={max || undefined}
        onChange={e => e.target.value && onChange(e.target.value)}
        onClick={() => {
          try {
            ref.current?.showPicker()
          } catch {}
        }}
        className="absolute -inset-y-[5px] inset-x-0 cursor-pointer opacity-0"
      />
    </span>
  )
}

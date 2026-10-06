'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Check, CirclePlus, Ellipsis, LoaderCircle, Plus, ShoppingCart, Snowflake, Trash, Users } from 'lucide-react'
import { AISLES, getAisle, guessAisle, normalizeTerm, parseShoppingInput } from '@/lib/aisles'
import { cn, plural } from '@/lib/utils'
import type { ShoppingItem } from '@/lib/types'
import { useHouseholdData } from '@/components/household/HouseholdData'
import Notice from '@/components/ui/Notice'
import { buttonClass } from '@/components/ui/Button'

/**
 * Onglet Courses (maquette « Courses ») : une liste partagée par le foyer,
 * rangée par rayon dans l'ordre du magasin. Les surgelés cochés se rangent au
 * congélateur en un geste ; ce qui est fini au congélateur y arrive tout seul.
 */
export default function CoursesClient() {
  const data = useHouseholdData()
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState<ShoppingItem | null>(null)
  const [storing, setStoring] = useState(false)

  const list = data.shopping
  const toBuy = list.filter(s => !s.checked).length
  const inCart = list.length - toBuy

  const known = new Set(AISLES.map(a => a.slug))
  const groups = AISLES.map(aisle => ({
    aisle,
    items: list.filter(s => s.aisle_slug === aisle.slug || (aisle.slug === 'divers' && !known.has(s.aisle_slug))),
  })).filter(g => g.items.length > 0)

  const onList = new Set(list.map(s => normalizeTerm(s.name)))
  const suggestions = [...data.terms.values()]
    .filter(t => t.times_added >= 2 && !onList.has(t.term))
    .sort((a, b) => b.times_added - a.times_added || (b.last_added_at ?? '').localeCompare(a.last_added_at ?? ''))
    .slice(0, 4)

  const forFreezer = list.filter(s => s.checked && (s.aisle_slug === 'surgeles' || s.from_item_id))
  const allFrozenAisle = forFreezer.every(s => s.aisle_slug === 'surgeles')
  const freezerTitle = allFrozenAisle
    ? `${forFreezer.length} ${forFreezer.length > 1 ? 'surgelés' : 'surgelé'} dans le panier`
    : `${plural(forFreezer.length, 'produit')} pour le congélateur`

  const add = async () => {
    const { name, note } = parseShoppingInput(text)
    if (!name) return
    setText('')
    await data.addShopping({ name, note, aisle_slug: guessAisle(name, data.terms) })
    inputRef.current?.focus()
  }

  const store = async () => {
    setStoring(true)
    await data.storeFrozen(forFreezer.map(s => s.id))
    setStoring(false)
  }

  const members = data.members.length

  return (
    <div className={cn('flex flex-col', forFreezer.length > 0 && 'pb-20')}>
      <header className="flex flex-col">
        <div className="relative flex h-11 items-center justify-between">
          <Link
            href="/foyer"
            className="flex h-9 items-center gap-1.5 rounded-full bg-card px-3 text-subhead font-semibold shadow-lift"
          >
            <Users size={18} aria-hidden="true" />
            {members > 1 ? `Partagée · ${members}` : 'Partager'}
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Options de la liste"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-accent shadow-lift"
          >
            <Ellipsis size={22} aria-hidden="true" />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Fermer le menu"
                className="fixed inset-0 z-20 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div role="menu" className="absolute right-0 top-12 z-30 w-72 overflow-hidden rounded-xl bg-card shadow-float">
                <button
                  type="button"
                  role="menuitem"
                  disabled={inCart === 0}
                  onClick={() => {
                    setMenuOpen(false)
                    void data.removeShopping(list.filter(s => s.checked).map(s => s.id))
                  }}
                  className="flex min-h-11 w-full items-center gap-3 border-b border-separator px-4 text-left text-body text-danger disabled:opacity-40"
                >
                  <Trash size={18} aria-hidden="true" />
                  Retirer les articles cochés{inCart > 0 ? ` (${inCart})` : ''}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={inCart === 0}
                  onClick={() => {
                    setMenuOpen(false)
                    list.filter(s => s.checked).forEach(s => void data.toggleShopping(s))
                  }}
                  className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-body disabled:opacity-40"
                >
                  <CirclePlus size={18} className="text-accent" aria-hidden="true" />
                  Tout remettre à acheter
                </button>
              </div>
            </>
          )}
        </div>
        <h1 className="mt-1.5 text-large-title">Courses</h1>
        {data.status === 'ready' && (
          <p className="mt-0.5 text-subhead text-ink-muted">
            {list.length === 0
              ? 'Partagée avec le foyer'
              : `${plural(toBuy, 'article')} à acheter · ${inCart} dans le panier`}
          </p>
        )}
      </header>

      <form
        onSubmit={e => {
          e.preventDefault()
          void add()
        }}
      >
        <label className="mt-4 flex h-12 items-center gap-2.5 rounded-xl bg-card px-3.5 text-accent">
          <CirclePlus size={24} aria-hidden="true" />
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            aria-label="Ajouter un article"
            placeholder="Ajouter un article"
            enterKeyHint="done"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none"
          />
        </label>
      </form>

      {suggestions.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="text-footnote text-ink-muted">Souvent achetés</span>
          {suggestions.map(t => (
            <button
              key={t.term}
              type="button"
              onClick={() => void data.addShopping({ name: t.label ?? t.term, aisle_slug: t.aisle_slug })}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-chip-edge bg-card pl-2.5 pr-3 text-subhead"
            >
              <Plus size={14} strokeWidth={2.8} className="text-accent" aria-hidden="true" />
              {t.label ?? t.term}
            </button>
          ))}
        </div>
      )}

      {data.status === 'loading' && (
        <div className="flex justify-center py-10 text-ink-muted">
          <LoaderCircle size={24} className="animate-spin" aria-label="Chargement" />
        </div>
      )}
      {data.status === 'error' && (
        <Notice tone="danger" className="mt-6">
          Impossible de charger la liste. Vérifiez votre connexion.
        </Notice>
      )}

      {data.status === 'ready' && list.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-xl bg-card px-5 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ShoppingCart size={24} aria-hidden="true" />
          </span>
          <p className="text-body font-semibold">La liste est vide</p>
          <p className="text-subhead text-ink-muted">
            Les articles se rangent par rayon, dans l’ordre du magasin, surgelés en dernier. Ce qui est fini au
            congélateur peut y être ajouté depuis le tiroir.
          </p>
        </div>
      )}

      {groups.map(({ aisle, items }) => {
        const Icon = aisle.icon
        const left = items.filter(s => !s.checked).length
        return (
          <section key={aisle.slug} className="mt-[22px] flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg text-white', aisle.tile)}>
                <Icon size={18} aria-hidden="true" />
              </span>
              <h2 className="text-title">{aisle.label}</h2>
              {left > 0 && <span className="text-body text-ink-muted">{left}</span>}
            </div>
            <div className="overflow-hidden rounded-xl bg-card">
              {items.map((item, index) => (
                <div key={item.id} className="relative flex min-h-[52px] items-center gap-2.5 py-1 pl-[7px] pr-4">
                  {index > 0 && <div className="absolute left-[54px] right-0 top-0 h-px bg-separator" />}
                  <button
                    type="button"
                    aria-pressed={item.checked}
                    aria-label={`${item.checked ? 'Décocher' : 'Cocher'} ${item.name}`}
                    onClick={() => void data.toggleShopping(item)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center"
                  >
                    <span
                      className={cn(
                        'flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 text-white transition-colors',
                        item.checked ? 'border-accent-fill bg-accent-fill' : 'border-ink-faint',
                      )}
                    >
                      {item.checked && <Check size={15} strokeWidth={3.4} aria-hidden="true" />}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(item)}
                    className="flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-0.5 text-left"
                  >
                    <span className={cn('text-body', item.checked ? 'text-ink-muted line-through' : 'text-ink')}>
                      {item.name}
                    </span>
                    {item.from_item_id && (
                      <span className="inline-flex items-center gap-1 text-footnote text-accent">
                        <Snowflake size={12} strokeWidth={2.4} aria-hidden="true" />
                        Fini au congélateur
                      </span>
                    )}
                  </button>
                  {item.note && <span className="text-subhead text-ink-muted tabular-nums">{item.note}</span>}
                </div>
              ))}
            </div>
          </section>
        )
      })}

      {forFreezer.length > 0 && !data.toast && (
        <div className="bottom-toast fixed inset-x-0 z-30 flex justify-center px-4">
          <div className="flex w-full max-w-md items-center gap-3 rounded-[18px] border border-glass-edge bg-glass py-3 pl-3.5 pr-3 shadow-float backdrop-blur-xl">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-tile-ice text-white">
              <Snowflake size={20} aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-subhead font-semibold">{freezerTitle}</span>
              <span className="text-footnote text-ink-muted">Les ranger au congélateur en un geste</span>
            </div>
            <button
              type="button"
              onClick={store}
              disabled={storing}
              className="flex h-11 items-center gap-1.5 rounded-full bg-accent-fill px-3.5 text-subhead font-semibold text-white disabled:opacity-60"
            >
              {storing && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
              Ranger
            </button>
          </div>
        </div>
      )}

      {editing && <EditItemSheet key={editing.id} item={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** Feuille du bas pour corriger un article : nom, quantité, rayon (retenu pour la suite). */
function EditItemSheet({ item, onClose }: { item: ShoppingItem; onClose: () => void }) {
  const data = useHouseholdData()
  const [name, setName] = useState(item.name)
  const [note, setNote] = useState(item.note ?? '')
  const [aisle, setAisle] = useState(getAisle(item.aisle_slug).slug)

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onClose()
    await data.updateShopping(item, { name: trimmed.slice(0, 80), note: note.trim().slice(0, 40) || null, aisle_slug: aisle })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Modifier ${item.name}`}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Escape') onClose()
        }}
        className="pb-safe flex w-full max-w-md flex-col gap-4 rounded-t-[28px] bg-canvas px-4 pt-2"
      >
        <div className="mx-auto h-[5px] w-9 rounded-full bg-grabber" aria-hidden="true" />
        <form
          onSubmit={e => {
            e.preventDefault()
            void save()
          }}
          className="flex flex-col gap-4"
        >
          <div className="overflow-hidden rounded-xl bg-card">
            <label className="flex min-h-[52px] items-center gap-3 px-4">
              <span className="w-[88px] shrink-0 text-body">Article</span>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={80}
                className="h-[52px] min-w-0 flex-1 bg-transparent text-body text-ink outline-none"
              />
            </label>
            <label className="flex min-h-[52px] items-center gap-3 border-t border-separator px-4">
              <span className="w-[88px] shrink-0 text-body">Quantité</span>
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                maxLength={40}
                placeholder="×2, 500 g…"
                className="h-[52px] min-w-0 flex-1 bg-transparent text-body text-ink outline-none"
              />
            </label>
            <label className="flex min-h-[52px] items-center gap-3 border-t border-separator px-4">
              <span className="w-[88px] shrink-0 text-body">Rayon</span>
              <select
                value={aisle}
                onChange={e => setAisle(e.target.value)}
                className="h-[52px] min-w-0 flex-1 bg-transparent text-body text-ink outline-none"
              >
                {AISLES.map(a => (
                  <option key={a.slug} value={a.slug}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {aisle !== item.aisle_slug && (
            <p className="-mt-2 mx-4 text-footnote text-ink-muted">
              « {name.trim() || item.name} » ira désormais au rayon {getAisle(aisle).label.toLowerCase()}.
            </p>
          )}
          <button type="submit" className={buttonClass('primary')}>
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => {
              onClose()
              void data.removeShopping([item.id])
            }}
            className={buttonClass('plain', 'text-danger')}
          >
            Retirer de la liste
          </button>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useRef, useState, type MouseEvent } from 'react'
import { Check, CircleAlert, CirclePlus, History, LoaderCircle, Plus } from 'lucide-react'
import { AISLES, getAisle, normalizeTerm, parseShoppingInput } from '@/lib/aisles'
import { byUse, hasLabel, searchTerms, type LabelledTerm } from '@/lib/suggestions'
import { cn } from '@/lib/utils'
import type { ShoppingItem } from '@/lib/types'
import { useHouseholdData } from '@/components/household/HouseholdData'
import { IconTile } from '@/components/ui/List'
import SwipeRow from '@/components/ui/SwipeRow'

/** « Souvent achetés » en tête du panneau. */
const FREQUENT = 6
const FORGET_WIDTH = 96

/** Toucher une ligne ne retire pas le focus du champ : le clavier reste ouvert, on enchaîne. */
const keepFocus = (e: MouseEvent) => e.preventDefault()

interface Row {
  term: LabelledTerm
  /** Avant, correspondance (en gras), après. */
  parts?: [string, string, string]
}

/**
 * Le toast « Annuler » sous le champ, tant que « Déjà achetés » est ouvert : le
 * clavier cacherait celui du bas (`data-toast-inline` le masque, voir
 * `.undo-toast` dans globals.css). Sa place reste réservée : les lignes ne
 * bougent pas sous le doigt quand il apparaît.
 */
export function InlineToast() {
  const { toast, dismissToast } = useHouseholdData()
  return (
    <div
      data-toast-inline=""
      role="status"
      aria-live="polite"
      className="mt-1 flex h-9 items-center gap-1.5 px-1 text-subhead text-ink-muted"
    >
      {toast && (
        <>
          {toast.tone === 'error' ? (
            <CircleAlert size={16} className="shrink-0 text-danger" aria-hidden="true" />
          ) : (
            <Check size={16} strokeWidth={2.6} className="shrink-0 text-accent" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1 truncate">{toast.text}</span>
          {toast.undo && (
            <button
              type="button"
              onMouseDown={keepFocus}
              onClick={() => {
                toast.undo?.()
                dismissToast()
              }}
              className="flex h-11 shrink-0 items-center px-1 font-semibold text-accent"
            >
              Annuler
            </button>
          )}
        </>
      )}
    </div>
  )
}

/**
 * « Déjà achetés » (champ d'ajout touché, comme une recherche d'iOS) : tout ce
 * que le foyer a déjà mis sur la liste, pour le reprendre en un toucher.
 * - Champ vide : les plus achetés, puis le reste rayon par rayon, dans l'ordre du magasin.
 * - Saisie : filtre sans réseau (début de n'importe quel mot, sans accents,
 *   une faute tolérée), et en dernier la saisie telle quelle.
 * - Ce qui est déjà à acheter porte ✓ ; le retoucher le retire.
 * - Glisser une ligne : « Oublier » (une faute retenue).
 */
export default function HistoryPanel({
  text,
  onPicked,
  onAddTyped,
  onDrag,
}: {
  /** Saisie brute du champ (« 2 cac » : ×2 sur l'article choisi). */
  text: string
  /** Un article a été repris : le champ se vide. */
  onPicked: () => void
  /** « Ajouter « … » » : la saisie telle quelle, comme la touche Entrée. */
  onAddTyped: () => void
  /** Le doigt fait défiler la liste : on range le clavier, comme sur iOS. */
  onDrag: () => void
}) {
  const data = useHouseholdData()
  const [open, setOpen] = useState<string | null>(null)
  const [pending, setPending] = useState<Set<string>>(() => new Set())
  const touchY = useRef<number | null>(null)

  const { name, note } = parseShoppingInput(text)
  const query = normalizeTerm(name)

  const listed = new Map<string, ShoppingItem>()
  for (const s of data.shopping) if (!s.checked) listed.set(normalizeTerm(s.name), s)

  const known = [...data.terms.values()].filter(hasLabel)
  let sections: { title: string; rows: Row[] }[]
  if (query) {
    const found = searchTerms(known, query)
    sections = found.length > 0 ? [{ title: 'Déjà achetés', rows: found.map(m => ({ term: m.term, parts: [m.before, m.hit, m.after] })) }] : []
  } else {
    const frequent = known.filter(t => t.times_added >= 2).sort(byUse).slice(0, FREQUENT)
    const rest = known.filter(t => !frequent.includes(t)).sort(byUse)
    sections = [
      { title: 'Souvent achetés', rows: frequent.map(term => ({ term })) },
      ...AISLES.map(aisle => ({
        title: aisle.label,
        rows: rest.filter(t => getAisle(t.aisle_slug).slug === aisle.slug).map(term => ({ term })),
      })),
    ].filter(s => s.rows.length > 0)
  }
  // La saisie est déjà un article connu : pas de ligne « Ajouter « … » » en double
  const exact = query ? data.terms.get(query)?.label : undefined

  const pick = async (term: LabelledTerm) => {
    if (pending.has(term.term)) return
    const onList = listed.get(term.term)
    if (onList) {
      void data.removeShopping([onList.id])
      return
    }
    setPending(prev => new Set(prev).add(term.term))
    onPicked()
    await data.addShopping({ name: term.label, note, aisle_slug: term.aisle_slug }, { undoable: true })
    setPending(prev => {
      const next = new Set(prev)
      next.delete(term.term)
      return next
    })
  }

  return (
    <div
      className="flex flex-col"
      onTouchStart={e => {
        touchY.current = e.touches[0].clientY
      }}
      onTouchMove={e => {
        if (touchY.current !== null && Math.abs(e.touches[0].clientY - touchY.current) > 10) {
          touchY.current = null
          onDrag()
        }
      }}
    >
      {data.status === 'loading' && (
        <div className="flex justify-center py-10 text-ink-muted">
          <LoaderCircle size={24} className="animate-spin" aria-label="Chargement" />
        </div>
      )}

      {data.status === 'ready' && !query && known.length === 0 && (
        <div className="mt-2 flex flex-col items-center gap-2 rounded-xl bg-card px-5 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <History size={24} aria-hidden="true" />
          </span>
          <p className="text-body font-semibold">Rien d’acheté pour l’instant</p>
          <p className="text-subhead text-ink-muted">
            Chaque article ajouté à la liste s’affichera ici : la prochaine fois, un toucher suffira.
          </p>
        </div>
      )}

      {sections.map((section, sectionIndex) => (
        <section key={section.title} className={cn('flex flex-col', sectionIndex > 0 && 'mt-5')}>
          <h2 className="mb-1.5 ml-1 text-subhead font-semibold text-ink-muted">{section.title}</h2>
          <div className="overflow-hidden rounded-xl bg-card">
            {section.rows.map(({ term, parts }, index) => {
              const aisle = getAisle(term.aisle_slug)
              const Icon = aisle.icon
              const onList = listed.get(term.term)
              return (
                <SwipeRow
                  key={term.term}
                  open={open === term.term}
                  onOpenChange={isOpen => setOpen(isOpen ? term.term : null)}
                  actionsWidth={FORGET_WIDTH}
                  actions={
                    <button
                      type="button"
                      onMouseDown={keepFocus}
                      onClick={() => {
                        setOpen(null)
                        void data.forgetTerm(term)
                      }}
                      className="flex-1 bg-danger-fill text-subhead font-semibold text-white"
                    >
                      Oublier
                    </button>
                  }
                >
                  <button
                    type="button"
                    onMouseDown={keepFocus}
                    onClick={() => void pick(term)}
                    aria-label={onList ? `Retirer ${term.label} de la liste` : `Ajouter ${term.label}`}
                    className="flex w-full items-stretch gap-3 pl-3 text-left active:bg-fill-soft"
                  >
                    <IconTile className={aisle.tile}>
                      <Icon size={18} aria-hidden="true" />
                    </IconTile>
                    <span
                      className={cn(
                        'flex min-h-[52px] min-w-0 flex-1 items-center gap-3 py-2 pr-3.5',
                        index > 0 && 'border-t border-separator',
                      )}
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-body">
                          {parts ? (
                            <>
                              {parts[0]}
                              <span className="font-semibold">{parts[1]}</span>
                              {parts[2]}
                            </>
                          ) : (
                            term.label
                          )}
                        </span>
                        {onList && (
                          <span className="text-footnote text-ink-muted">
                            Sur la liste{onList.note ? ` · ${onList.note}` : ''}
                          </span>
                        )}
                      </span>
                      {note && !onList && <span className="text-subhead tabular-nums text-ink-muted">{note}</span>}
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors',
                          onList ? 'bg-accent-fill text-white' : 'bg-accent-soft text-accent',
                        )}
                      >
                        {onList ? (
                          <Check size={16} strokeWidth={3.2} aria-hidden="true" />
                        ) : (
                          <Plus size={16} strokeWidth={2.8} aria-hidden="true" />
                        )}
                      </span>
                    </span>
                  </button>
                </SwipeRow>
              )
            })}
          </div>
        </section>
      ))}

      {query && !exact && (
        <div className={cn('overflow-hidden rounded-xl bg-card', sections.length > 0 && 'mt-3')}>
          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={onAddTyped}
            className="flex min-h-[52px] w-full items-center gap-3 px-3 text-left text-accent active:bg-fill-soft"
          >
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center">
              <CirclePlus size={26} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 text-body">Ajouter «&nbsp;{name}&nbsp;»</span>
            {note && <span className="text-subhead tabular-nums text-ink-muted">{note}</span>}
          </button>
        </div>
      )}
    </div>
  )
}

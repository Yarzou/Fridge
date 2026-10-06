'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { House, ScanLine, ShoppingCart, Snowflake, type LucideIcon } from 'lucide-react'
import { useHouseholdData } from '@/components/household/HouseholdData'
import { cn } from '@/lib/utils'

interface Tab {
  href: string
  label: string
  icon: LucideIcon
  /** Autres préfixes d'URL qui allument l'onglet (un tiroir est dans « Congélateur »). */
  also?: string[]
}

const TABS: Tab[] = [
  { href: '/congelateur', label: 'Congélateur', icon: Snowflake, also: ['/tiroir/'] },
  { href: '/courses', label: 'Courses', icon: ShoppingCart },
  { href: '/foyer', label: 'Foyer', icon: House },
]

/** Marge intérieure de la barre (p-1), en px : la bulle ne la franchit pas. */
const INSET = 4
/** Marge de la bulle autour de l'icône et du libellé, de chaque côté. */
const PAD_X = 14

interface Slot {
  /** Bord gauche du contenu (icône + libellé), depuis le bord de la barre */
  left: number
  width: number
}

/**
 * Barre d'onglets flottante en verre très transparent, façon « Liquid Glass »
 * d'Apple, et à sa droite le bouton rond du scanner. L'onglet Courses porte le
 * nombre d'articles qui restent à acheter.
 *
 * L'onglet choisi est marqué par une bulle de verre taillée sur mesure : elle
 * entoure l'icône et le libellé de l'onglet (plus large pour « Congélateur »
 * que pour « Foyer »), mesurés par un ResizeObserver.
 * - Au toucher, elle glisse jusqu'à l'onglet en changeant de largeur et
 *   s'étire comme une goutte d'eau, sans attendre le chargement de la page.
 * - Si l'on fait glisser le doigt sur la barre, elle le suit en grossissant ;
 *   au lâcher, elle se pose sur l'onglet le plus proche, qui s'ouvre.
 * Avec « Réduire les animations », elle se déplace sans effet.
 */
export default function TabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { shopping } = useHouseholdData()
  const toBuy = shopping.filter(s => !s.checked).length

  const barRef = useRef<HTMLDivElement>(null)
  const contentRefs = useRef<(HTMLSpanElement | null)[]>([])
  const gesture = useRef<{ startX: number; dragging: boolean } | null>(null)
  const swallowClick = useRef(false)
  // Onglet visé au toucher, valable tant que l'URL n'a pas changé
  const [pending, setPending] = useState<{ index: number; from: string } | null>(null)
  const [drag, setDrag] = useState<number | null>(null)
  // La goutte ne se déforme qu'après un premier geste, pas à l'ouverture de l'appli
  const [touched, setTouched] = useState(false)
  const [bar, setBar] = useState<{ width: number; slots: Slot[] } | null>(null)

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const box = el.getBoundingClientRect()
      setBar({
        width: box.width,
        slots: contentRefs.current.map(content => {
          const r = content?.getBoundingClientRect()
          return r ? { left: r.left - box.left, width: r.width } : { left: 0, width: 0 }
        }),
      })
    })
    observer.observe(el)
    contentRefs.current.forEach(content => content && observer.observe(content))
    return () => observer.disconnect()
  }, [])

  const activeIndex = TABS.findIndex(
    ({ href, also }) => pathname.startsWith(href) || (also ?? []).some(p => pathname.startsWith(p)),
  )
  const index = pending && pending.from === pathname ? pending.index : activeIndex

  /** Onglet sous un point de la barre (abscisse depuis son bord gauche, largeur de la barre). */
  const tabAt = (x: number, width: number) =>
    Math.min(TABS.length - 1, Math.max(0, Math.floor(((x - INSET) / (width - INSET * 2)) * TABS.length)))
  const localX = (clientX: number) => clientX - barRef.current!.getBoundingClientRect().left

  /** La bulle part tout de suite vers l'onglet, sans attendre la page. */
  const mark = (next: number) => {
    setTouched(true)
    setPending({ index: next, from: pathname })
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    gesture.current = { startX: e.clientX, dragging: false }
    swallowClick.current = false
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    if (!g.dragging) {
      if (Math.abs(e.clientX - g.startX) < 8) return
      g.dragging = true
      setTouched(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setDrag(localX(e.clientX))
  }

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    gesture.current = null
    if (!g?.dragging) return
    swallowClick.current = true
    setDrag(null)
    const next = tabAt(localX(e.clientX), barRef.current!.getBoundingClientRect().width)
    mark(next)
    if (next !== activeIndex) router.push(TABS[next].href)
  }

  // Bulle : autour du contenu de l'onglet choisi, ou centrée sous le doigt
  // pendant un glissé (avec la largeur de l'onglet survolé), sans sortir de la barre.
  let bubble: { left: number; width: number } | null = null
  if (bar && index >= 0) {
    const slot = bar.slots[drag !== null ? tabAt(drag, bar.width) : index]
    const width = Math.min(slot.width + PAD_X * 2, bar.width - INSET * 2)
    const center = drag !== null ? drag : slot.left + slot.width / 2
    const left = Math.min(Math.max(center - width / 2, INSET), bar.width - INSET - width)
    bubble = { left, width }
  }

  return (
    <nav aria-label="Navigation principale" className="bottom-tabbar fixed inset-x-0 z-40 flex justify-center px-4">
      <div className="flex w-full max-w-md items-center gap-2.5">
        <div
          ref={barRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onClickCapture={e => {
            // Fin d'un glissé : la navigation est déjà partie, pas de second clic
            if (swallowClick.current) {
              e.preventDefault()
              e.stopPropagation()
              swallowClick.current = false
            }
          }}
          className="relative grid h-[62px] flex-1 touch-none select-none grid-cols-3 rounded-full border border-tabbar-edge bg-tabbar p-1 shadow-glass backdrop-blur-2xl backdrop-saturate-[1.8]"
        >
          {bubble && (
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute inset-y-1 left-0',
                drag === null &&
                  'transition-[transform,width] duration-500 ease-[cubic-bezier(0.34,1.4,0.5,1)] motion-reduce:transition-none',
              )}
              style={{ transform: `translateX(${bubble.left}px)`, width: bubble.width }}
            >
              <span
                key={touched ? index : 'repos'}
                className={cn(
                  'block h-full w-full rounded-full bg-bubble shadow-bubble transition-transform duration-200',
                  touched && drag === null && 'motion-safe:animate-bubble',
                  drag !== null && 'scale-[1.12]',
                )}
              />
            </span>
          )}

          {TABS.map(({ href, label, icon: Icon }, i) => {
            const active = i === index
            const badge = href === '/courses' && toBuy > 0 ? toBuy : 0
            return (
              <Link
                key={href}
                href={href}
                draggable={false}
                onClick={() => mark(i)}
                aria-current={i === activeIndex ? 'page' : undefined}
                className={cn(
                  'relative z-10 flex items-center justify-center rounded-full transition-colors duration-300',
                  active ? 'text-accent' : 'text-ink-muted',
                )}
              >
                <span
                  ref={el => {
                    contentRefs.current[i] = el
                  }}
                  className="relative flex flex-col items-center gap-0.5 text-caption font-semibold"
                >
                  <span className="relative">
                    <Icon size={24} strokeWidth={2} aria-hidden="true" />
                    {/* Pastille sur le coin de l'icône : hors mesure de la bulle */}
                    {badge > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute -right-3 -top-1.5 h-[18px] min-w-[18px] rounded-full border-2 border-card bg-badge px-[5px] text-center text-[11px] font-bold leading-[14px] text-white"
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </span>
                  {label}
                  {badge > 0 && <span className="sr-only">, {badge} à acheter</span>}
                </span>
              </Link>
            )
          })}
        </div>
        <Link
          href="/scanner"
          aria-label="Scanner"
          className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full bg-accent-fill text-white shadow-float"
        >
          <ScanLine size={26} strokeWidth={2.2} aria-hidden="true" />
        </Link>
      </div>
    </nav>
  )
}

'use client'

import { useRef, useState, type PointerEvent } from 'react'
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

/** Marge intérieure de la barre (p-1), en px : la bulle s'y loge. */
const INSET = 4

/**
 * Barre d'onglets flottante en verre très transparent, façon « Liquid Glass »
 * d'Apple, et à sa droite le bouton rond du scanner. L'onglet Courses porte le
 * nombre d'articles qui restent à acheter.
 *
 * L'onglet choisi est marqué par une bulle de verre :
 * - au toucher, elle glisse jusqu'à l'onglet en s'étirant comme une goutte
 *   d'eau, sans attendre le chargement de la page ;
 * - si l'on fait glisser le doigt sur la barre, elle le suit en grossissant ;
 *   au lâcher, elle se pose sur l'onglet le plus proche, qui s'ouvre.
 * Avec « Réduire les animations », elle se déplace sans effet.
 */
export default function TabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { shopping } = useHouseholdData()
  const toBuy = shopping.filter(s => !s.checked).length

  const barRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ startX: number; dragging: boolean } | null>(null)
  const swallowClick = useRef(false)
  // Onglet visé au toucher, valable tant que l'URL n'a pas changé
  const [pending, setPending] = useState<{ index: number; from: string } | null>(null)
  const [drag, setDrag] = useState<{ x: number; width: number } | null>(null)
  // La goutte ne se déforme qu'après un premier geste, pas à l'ouverture de l'appli
  const [touched, setTouched] = useState(false)

  const activeIndex = TABS.findIndex(
    ({ href, also }) => pathname.startsWith(href) || (also ?? []).some(p => pathname.startsWith(p)),
  )
  const index = pending && pending.from === pathname ? pending.index : activeIndex

  /** Position du doigt dans la barre, et largeur d'un onglet. */
  const measure = (clientX: number) => {
    const rect = barRef.current!.getBoundingClientRect()
    const width = (rect.width - INSET * 2) / TABS.length
    return { x: clientX - rect.left - INSET, width }
  }

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
    setDrag(measure(e.clientX))
  }

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    gesture.current = null
    if (!g?.dragging) return
    swallowClick.current = true
    const { x, width } = measure(e.clientX)
    setDrag(null)
    const next = Math.min(TABS.length - 1, Math.max(0, Math.floor(x / width)))
    mark(next)
    if (next !== activeIndex) router.push(TABS[next].href)
  }

  // Bulle : posée sur un onglet (en %), ou sous le doigt pendant un glissé (en px)
  const bubbleStyle = drag
    ? { transform: `translateX(${Math.min(Math.max(drag.x - drag.width / 2, 0), drag.width * (TABS.length - 1))}px)` }
    : { transform: `translateX(${Math.max(index, 0) * 100}%)` }

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
          {index >= 0 && (
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-8px)/3)]',
                !drag && 'transition-transform duration-500 ease-[cubic-bezier(0.34,1.4,0.5,1)] motion-reduce:transition-none',
              )}
              style={bubbleStyle}
            >
              <span
                key={touched ? index : 'repos'}
                className={cn(
                  'block h-full w-full rounded-full bg-bubble shadow-bubble transition-transform duration-200',
                  touched && !drag && 'motion-safe:animate-bubble',
                  drag && 'scale-[1.14]',
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
                  'relative z-10 flex flex-col items-center justify-center gap-0.5 rounded-full text-caption font-semibold transition-colors duration-300',
                  active ? 'text-accent' : 'text-ink-muted',
                )}
              >
                <Icon size={24} strokeWidth={2} aria-hidden="true" />
                {label}
                {badge > 0 && (
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute right-[18px] top-[3px] h-[18px] min-w-[18px] rounded-full border-2 border-card bg-badge px-[5px] text-center text-[11px] font-bold leading-[14px] text-white"
                    >
                      {badge > 99 ? '99+' : badge}
                    </span>
                    <span className="sr-only">, {badge} à acheter</span>
                  </>
                )}
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

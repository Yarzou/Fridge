'use client'

import { useEffect, useRef, useState, type PointerEvent, type Ref } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { House, ScanLine, ShoppingCart, Snowflake, type LucideIcon } from 'lucide-react'
import { useHouseholdData } from '@/components/household/HouseholdData'
import { LIFT, MAGNIFY, magnifyOrigin, useLoupe, type Lens } from '@/components/ui/useLoupe'
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

/** Pages préchargées en entier : changer d'onglet ou ouvrir le scanner part du cache. */
const PREFETCHED = [...TABS.map(tab => tab.href), '/scanner']

/** Marge intérieure de la barre (p-1), en px : la bulle ne la franchit pas. */
const INSET = 4
/** Marge de la bulle autour de l'icône et du libellé, de chaque côté. */
const PAD_X = 14
interface Slot {
  /** Bord gauche du contenu (icône + libellé), depuis le bord intérieur de la barre */
  left: number
  width: number
}

interface Bar {
  /** Largeur intérieure (sans la bordure) */
  width: number
  slots: Slot[]
}

/** Onglet sous un point de la barre (abscisse depuis son bord intérieur gauche). */
function tabAt(x: number, bar: Bar) {
  return Math.min(TABS.length - 1, Math.max(0, Math.floor(((x - INSET) / (bar.width - INSET * 2)) * TABS.length)))
}

/** Largeur de la bulle autour du contenu d'un onglet. */
function bubbleWidth(bar: Bar, i: number) {
  return Math.min(bar.slots[i].width + PAD_X * 2, bar.width - INSET * 2)
}

/** Bord gauche d'une bulle centrée sur `center`, sans sortir de la barre. */
function bubbleLeft(bar: Bar, center: number, width: number) {
  return Math.min(Math.max(center - width / 2, INSET), bar.width - INSET - width)
}

/** Icône, pastille et libellé d'un onglet : dans la barre, et agrandis dans la loupe. */
function TabContent({ tab, toBuy, ref }: { tab: Tab; toBuy: number; ref?: Ref<HTMLSpanElement> }) {
  const { href, label, icon: Icon } = tab
  const badge = href === '/courses' ? toBuy : 0
  return (
    <span ref={ref} className="relative flex flex-col items-center gap-0.5 text-caption font-semibold">
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
  )
}

/**
 * Barre d'onglets flottante en verre, façon « Liquid Glass » d'iOS 26, et à
 * sa droite le bouton rond du scanner. L'onglet Courses porte le nombre
 * d'articles qui restent à acheter.
 *
 * Au repos, la barre est très transparente et peu floutée : on devine la liste
 * qui défile dessous. Elle devient presque opaque dès que le doigt s'y pose.
 *
 * L'onglet choisi est marqué par une bulle taillée sur mesure : elle entoure
 * l'icône et le libellé de l'onglet (plus large pour « Congélateur » que pour
 * « Foyer »), mesurés par un ResizeObserver.
 * - Doigt posé, la bulle se soulève en loupe : elle rejoint le doigt, le suit
 *   d'un onglet à l'autre et agrandit vraiment les icônes et les libellés
 *   qu'elle couvre (une copie des onglets, agrandie autour de son centre).
 * - Au lâcher, elle se pose sur l'onglet touché, ou sur le plus proche après
 *   un glissé, en s'étirant comme une goutte d'eau, sans attendre la page.
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
  const { lens, grab, follow, drop } = useLoupe()
  // La goutte ne se déforme qu'après un premier geste, pas à l'ouverture de l'appli
  const [touched, setTouched] = useState(false)
  const [bar, setBar] = useState<Bar | null>(null)

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const box = el.getBoundingClientRect()
      setBar({
        width: el.clientWidth,
        slots: contentRefs.current.map(content => {
          const r = content?.getBoundingClientRect()
          return r ? { left: r.left - box.left - el.clientLeft, width: r.width } : { left: 0, width: 0 }
        }),
      })
    })
    observer.observe(el)
    contentRefs.current.forEach(content => content && observer.observe(content))
    return () => observer.disconnect()
  }, [])

  // Les liens préchargent les onglets et le scanner à l'ouverture (prefetch,
  // en production). Au retour au premier plan, le cache du routeur a pu
  // expirer pendant la veille : on le remplit de nouveau, pour que le
  // prochain toucher n'attende pas le serveur.
  useEffect(() => {
    const warm = () => {
      if (document.visibilityState === 'visible') PREFETCHED.forEach(href => router.prefetch(href))
    }
    document.addEventListener('visibilitychange', warm)
    return () => document.removeEventListener('visibilitychange', warm)
  }, [router])

  const activeIndex = TABS.findIndex(
    ({ href, also }) => pathname.startsWith(href) || (also ?? []).some(p => pathname.startsWith(p)),
  )
  const index = pending && pending.from === pathname ? pending.index : activeIndex
  const lifted = lens !== null && bar !== null
  // Doigt posé : l'onglet sous la loupe prend la couleur de l'onglet choisi
  const highlighted = lifted ? tabAt(lens.center, bar) : index

  const localX = (clientX: number) => {
    const el = barRef.current!
    return clientX - el.getBoundingClientRect().left - el.clientLeft
  }

  /** La loupe vise le doigt, avec la largeur de l'onglet survolé. */
  const aim = (x: number): Lens => ({ center: x, width: bar ? bubbleWidth(bar, tabAt(x, bar)) : 0 })

  /** La bulle part tout de suite vers l'onglet, sans attendre la page. */
  const mark = (next: number) => {
    setTouched(true)
    setPending({ index: next, from: pathname })
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (!bar) return
    gesture.current = { startX: e.clientX, dragging: false }
    swallowClick.current = false
    setTouched(true)
    // La loupe part de la bulle de l'onglet choisi pour rejoindre le doigt.
    const x = localX(e.clientX)
    const start = index >= 0 ? index : tabAt(x, bar)
    const width = bubbleWidth(bar, start)
    grab({ center: bubbleLeft(bar, bar.slots[start].left + bar.slots[start].width / 2, width) + width / 2, width }, aim(x))
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    if (!g.dragging && Math.abs(e.clientX - g.startX) >= 8) {
      g.dragging = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    follow(aim(localX(e.clientX)))
  }

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    gesture.current = null
    drop()
    if (!g || !bar) return
    if (g.dragging) {
      swallowClick.current = true
      const next = tabAt(localX(e.clientX), bar)
      mark(next)
      if (next !== activeIndex) router.push(TABS[next].href)
      return
    }
    // Simple toucher : la bulle se pose sur l'onglet touché dès le lâcher, le
    // clic qui suit ouvre la page.
    const tab = e.type === 'pointerup' ? (e.target as Element).closest<HTMLElement>('[data-tab]') : null
    if (tab) mark(Number(tab.dataset.tab))
  }

  // Bulle : autour du contenu de l'onglet choisi, ou loupe sous le doigt.
  let bubble: { left: number; width: number } | null = null
  if (lifted) {
    bubble = { left: bubbleLeft(bar, lens.center, lens.width), width: lens.width }
  } else if (bar && index >= 0) {
    const width = bubbleWidth(bar, index)
    bubble = { left: bubbleLeft(bar, bar.slots[index].left + bar.slots[index].width / 2, width), width }
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
            // Fin d'un glissé : la navigation est déjà partie, pas de second clic.
            // Le clic du clavier (detail 0) n'est jamais celui d'un glissé.
            if (swallowClick.current && e.detail !== 0) {
              e.preventDefault()
              e.stopPropagation()
              swallowClick.current = false
            }
          }}
          className={cn(
            // Verre léger et peu flouté (components/ui/glass.ts), même arête que le reste du verre
            'relative grid h-[62px] flex-1 touch-none select-none grid-cols-3 rounded-full border border-glass-rim p-1 shadow-sheen backdrop-blur-[10px] backdrop-saturate-[1.8] transition-colors duration-200',
            lifted ? 'bg-glass-pressed' : 'bg-glass-thin',
          )}
        >
          {bubble && (
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute inset-y-1 left-0',
                // Loupe : au-dessus des onglets, qu'elle cache et remplace par leur copie agrandie.
                // Elle suit le doigt image par image, sans transition.
                lifted
                  ? 'z-20'
                  : 'transition-[transform,width] duration-500 ease-[cubic-bezier(0.34,1.4,0.5,1)] motion-reduce:transition-none',
              )}
              style={{ transform: `translateX(${bubble.left}px)`, width: bubble.width }}
            >
              <span
                key={touched ? index : 'repos'}
                className={cn(
                  'relative block h-full w-full overflow-hidden rounded-full transition-[transform,background-color,box-shadow] duration-200',
                  lifted ? 'bg-loupe shadow-lifted' : 'bg-bubble shadow-bubble',
                  touched && !lifted && 'motion-safe:animate-bubble',
                )}
                style={lifted ? { transform: `scale(${LIFT})` } : undefined}
              >
                {lifted && (
                  // Copie des onglets, posée exactement sur l'originale puis agrandie
                  // autour du centre de la loupe : elle grossit ce qui est dessous.
                  <span
                    className="absolute inset-y-0 grid grid-cols-3"
                    style={{
                      left: INSET - bubble.left,
                      width: bar.width - INSET * 2,
                      transform: `scale(${MAGNIFY})`,
                      transformOrigin: `${magnifyOrigin(lens.center, bubble.left + bubble.width / 2) - INSET}px 50%`,
                    }}
                  >
                    {TABS.map((tab, i) => (
                      <span
                        key={tab.href}
                        className={cn(
                          'flex items-center justify-center',
                          i === highlighted ? 'text-accent' : 'text-ink-muted',
                        )}
                      >
                        <TabContent tab={tab} toBuy={toBuy} />
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </span>
          )}

          {TABS.map((tab, i) => (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch
              draggable={false}
              data-tab={i}
              onClick={() => mark(i)}
              aria-current={i === activeIndex ? 'page' : undefined}
              className={cn(
                'relative z-10 flex items-center justify-center rounded-full transition-colors duration-300',
                i === highlighted ? 'text-accent' : 'text-ink-muted',
              )}
            >
              <TabContent
                tab={tab}
                toBuy={toBuy}
                ref={el => {
                  contentRefs.current[i] = el
                }}
              />
            </Link>
          ))}
        </div>
        {/* Verre teinté (« prominent glass ») : la couleur d'accent, avec le reflet du verre */}
        <Link
          href="/scanner"
          prefetch
          aria-label="Scanner"
          className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full bg-accent-fill text-white shadow-sheen"
        >
          <ScanLine size={26} strokeWidth={2.2} aria-hidden="true" />
        </Link>
      </div>
    </nav>
  )
}

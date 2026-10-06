'use client'

import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'

interface SegmentedProps<T extends string> {
  options: { value: T; label: string; ariaLabel?: string }[]
  value: T
  onChange: (value: T) => void
  /** Libellé du groupe pour les lecteurs d'écran. */
  label: string
  className?: string
  /** Classes de chaque segment (hauteur, taille du texte). */
  itemClassName?: string
  style?: CSSProperties
}

/** Marge intérieure du contrôle (p-0.5) et écart entre segments (gap-0.5), en px. */
const INSET = 2
const GAP = 2

/**
 * Contrôle segmenté iOS : fond gris, segment choisi en relief. Le relief est
 * une pastille qui se déplace, comme la bulle de la barre d'onglets (iOS 26) :
 * - au toucher d'un autre segment, elle y glisse en s'étirant comme une goutte ;
 * - doigt posé sur le segment choisi, elle se soulève en verre ;
 * - si l'on fait glisser le doigt, elle le suit, puis se pose sur le segment
 *   le plus proche, qui est choisi.
 * Le défilement vertical de la page reste libre (`touch-pan-y`). Avec
 * « Réduire les animations », la pastille se déplace sans effet.
 */
export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  itemClassName = 'h-[30px] text-footnote',
  style,
}: SegmentedProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ startX: number; dragging: boolean } | null>(null)
  const swallowClick = useRef(false)
  // Doigt posé sur le segment choisi : la pastille se soulève
  const [pressed, setPressed] = useState(false)
  // Pendant un glissé : abscisse du doigt et largeur du contrôle, en px
  const [drag, setDrag] = useState<{ x: number; width: number } | null>(null)
  // La goutte ne se déforme qu'après un premier geste, pas à l'affichage
  const [touched, setTouched] = useState(false)

  const count = options.length
  const index = options.findIndex(option => option.value === value)
  const segmentWidth = (width: number) => (width - INSET * 2 - GAP * (count - 1)) / count
  const segmentAt = (x: number, width: number) =>
    Math.min(count - 1, Math.max(0, Math.floor((x - INSET + GAP / 2) / (segmentWidth(width) + GAP))))
  const measure = (clientX: number) => {
    const box = rootRef.current!.getBoundingClientRect()
    return { x: clientX - box.left, width: box.width }
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    gesture.current = { startX: e.clientX, dragging: false }
    swallowClick.current = false
    const { x, width } = measure(e.clientX)
    if (segmentAt(x, width) === index) setPressed(true)
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

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    gesture.current = null
    setPressed(false)
    if (!g?.dragging) return
    swallowClick.current = true
    setDrag(null)
    const { x, width } = measure(e.clientX)
    const next = segmentAt(x, width)
    if (next !== index) onChange(options[next].value)
  }

  // Le navigateur a pris le geste (défilement) : rien n'est choisi
  const onPointerCancel = () => {
    gesture.current = null
    setPressed(false)
    setDrag(null)
  }

  // Au repos, la pastille se place en pourcentages (aucune mesure) ; pendant un
  // glissé, elle est centrée sous le doigt, sans sortir du contrôle.
  let transform = `translateX(calc(${index} * (100% + ${GAP}px)))`
  if (drag) {
    const w = segmentWidth(drag.width)
    const left = Math.min(Math.max(drag.x - w / 2, INSET), drag.width - INSET - w)
    transform = `translateX(${left - INSET}px)`
  }
  const shown = drag ? segmentAt(drag.x, drag.width) : index
  const lifted = pressed || drag !== null

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={() => {
        // Souris sortie sans glisser : la pastille se repose
        if (!gesture.current?.dragging) onPointerCancel()
      }}
      onClickCapture={e => {
        // Fin d'un glissé : le choix est déjà fait, pas de second clic. Le
        // clic du clavier (detail 0) n'est jamais celui d'un glissé.
        if (swallowClick.current && e.detail !== 0) {
          e.preventDefault()
          e.stopPropagation()
          swallowClick.current = false
        }
      }}
      className={cn('relative grid touch-pan-y select-none gap-0.5 rounded-[9px] bg-fill p-0.5', className)}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`, ...style }}
    >
      {(index >= 0 || drag) && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-y-0.5 left-0.5',
            !drag && 'transition-transform duration-500 ease-[cubic-bezier(0.34,1.4,0.5,1)] motion-reduce:transition-none',
          )}
          style={{ width: `calc((100% - ${INSET * 2 + GAP * (count - 1)}px) / ${count})`, transform }}
        >
          <span
            key={touched ? index : 'repos'}
            className={cn(
              'block h-full w-full rounded-[7px] transition-[transform,background-color,box-shadow] duration-200',
              lifted ? 'bg-lens shadow-lifted motion-safe:scale-[1.12]' : 'bg-seg shadow-lift',
              touched && !lifted && 'motion-safe:animate-bubble',
            )}
          />
        </span>
      )}

      {options.map((option, i) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            draggable={false}
            aria-pressed={active}
            aria-label={option.ariaLabel}
            onClick={() => {
              setTouched(true)
              onChange(option.value)
            }}
            className={cn(
              'relative z-10 min-w-0 truncate rounded-[7px] px-1 text-ink',
              i === shown && 'font-semibold',
              itemClassName,
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

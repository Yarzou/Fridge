'use client'

import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SwipeRowProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Boutons révélés à droite quand on glisse la ligne vers la gauche. */
  actions: ReactNode
  /** Largeur totale des boutons, en px. */
  actionsWidth: number
  children: ReactNode
}

/**
 * Ligne qui se glisse vers la gauche, comme dans Mail. Le geste vertical reste
 * au navigateur (`touch-action: pan-y`) : on ne prend la main que si le doigt
 * part franchement à l'horizontale.
 *
 * Accessibilité : les boutons d'action restent dans le DOM sous la ligne. Les
 * atteindre au clavier ou au lecteur d'écran ouvre la ligne.
 */
export default function SwipeRow({ open, onOpenChange, actions, actionsWidth, children }: SwipeRowProps) {
  const [drag, setDrag] = useState<number | null>(null)
  const gesture = useRef<{ x: number; y: number; base: number; axis: 'x' | 'y' | null } | null>(null)
  const swallowClick = useRef(false)

  const offset = drag ?? (open ? -actionsWidth : 0)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    gesture.current = { x: e.clientX, y: e.clientY, base: open ? -actionsWidth : 0, axis: null }
    swallowClick.current = false
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (!g.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (g.axis === 'x') e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (g.axis !== 'x') return
    swallowClick.current = true
    setDrag(Math.max(-actionsWidth - 24, Math.min(0, g.base + dx)))
  }

  const onPointerEnd = () => {
    gesture.current = null
    if (drag === null) return
    setDrag(null)
    onOpenChange(drag < -actionsWidth / 3)
  }

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: actionsWidth }} onFocus={() => onOpenChange(true)}>
        {actions}
      </div>
      <div
        className={cn('relative touch-pan-y bg-card', drag === null && 'transition-transform duration-200 ease-out')}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={e => {
          // Fin d'un glissement : le clic qui suit n'ouvre pas le lien.
          if (swallowClick.current) {
            e.preventDefault()
            e.stopPropagation()
            swallowClick.current = false
            return
          }
          // Tape sur une ligne ouverte : on la referme.
          if (open) {
            e.preventDefault()
            e.stopPropagation()
            onOpenChange(false)
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}

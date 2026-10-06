'use client'

import type { CSSProperties } from 'react'
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

/** Contrôle segmenté iOS : fond gris, segment choisi en relief. */
export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  itemClassName = 'h-[30px] text-footnote',
  style,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('grid gap-0.5 rounded-[9px] bg-fill p-0.5', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, ...style }}
    >
      {options.map(option => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            aria-label={option.ariaLabel}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-w-0 truncate rounded-[7px] px-1 text-ink',
              active && 'bg-seg font-semibold shadow-lift',
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

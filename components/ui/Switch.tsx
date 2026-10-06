'use client'

import { cn } from '@/lib/utils'

/**
 * Interrupteur iOS (51 × 31). Le bouton fait 44 px de haut : la zone de
 * touche dépasse la piste.
 */
export default function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Libellé lu par les lecteurs d'écran (le bouton n'a pas de texte). */
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex h-11 shrink-0 items-center disabled:opacity-40"
    >
      <span
        className={cn(
          'relative h-[31px] w-[51px] rounded-full transition-colors duration-200',
          checked ? 'bg-accent-fill' : 'bg-fill',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-[27px] w-[27px] rounded-full bg-knob shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-transform duration-200',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  )
}

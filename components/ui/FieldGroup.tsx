import type { InputHTMLAttributes, ReactNode } from 'react'

/**
 * Champs de formulaire groupés dans une carte, libellé à gauche et saisie à
 * droite, comme dans Réglages. Police de 17 px : en dessous de 16 px, Safari
 * zoome la page au focus.
 */
export function FieldGroup({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-xl bg-card">{children}</div>
}

interface FieldRowProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function FieldRow({ label, ...input }: FieldRowProps) {
  return (
    <label className="flex min-h-[52px] items-center gap-3 border-t border-separator px-4 first:border-t-0">
      <span className="w-[112px] shrink-0 text-body">{label}</span>
      <input
        {...input}
        className="h-[52px] min-w-0 flex-1 bg-transparent text-body text-ink outline-none"
      />
    </label>
  )
}

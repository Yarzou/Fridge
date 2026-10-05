import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  /** Rangée de 44 px au-dessus du titre : retour, sélecteur, bouton rond… */
  leading?: ReactNode
  trailing?: ReactNode
  /** Élément entre la rangée et le titre (pastille « Ouvert par le QR du tiroir »). */
  badge?: ReactNode
}

/** Grand titre façon iOS : rangée d'actions, titre 34 px, sous-titre. */
export default function PageHeader({ title, subtitle, leading, trailing, badge }: PageHeaderProps) {
  return (
    <header className="flex flex-col">
      <div className="flex h-11 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center">{leading}</div>
        <div className="flex items-center gap-2">{trailing}</div>
      </div>
      {badge && <div className="mt-1.5">{badge}</div>}
      <h1 className="mt-1.5 text-large-title">{title}</h1>
      {subtitle && <p className="mt-0.5 text-subhead text-ink-muted">{subtitle}</p>}
    </header>
  )
}

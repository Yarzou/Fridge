import type { ReactNode } from 'react'

/**
 * Feuille plein écran (ajouter, modifier un produit) : barre de titre avec
 * « Annuler », contenu qui défile et pied fixe pour les boutons.
 *
 * Pas d'imitation de la carte iOS qui dépasse derrière (bande grise en haut,
 * poignée) : sur un vrai écran, elle passait pour un double fond. La feuille
 * prend tout l'écran, sur le fond de page, encoche comprise.
 */
export default function Sheet({
  title,
  cancel,
  footer,
  children,
}: {
  title: string
  /** Bouton ou lien « Annuler », à gauche du titre. */
  cancel: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="pt-safe fixed inset-0 bg-canvas">
      <div className="mx-auto flex h-full max-w-md flex-col">
        <div className="relative flex h-12 shrink-0 items-center px-4">
          <div className="relative z-10">{cancel}</div>
          <h1 className="pointer-events-none absolute inset-x-0 text-center text-body font-semibold">{title}</h1>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">{children}</div>
        {footer && <div className="pb-safe flex shrink-0 flex-col gap-2.5 bg-canvas px-4 pt-3">{footer}</div>}
      </div>
    </div>
  )
}

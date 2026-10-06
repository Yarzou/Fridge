import type { ReactNode } from 'react'

/**
 * Feuille modale plein écran façon iOS (maquette « Ajouter un produit ») : la
 * carte du dessous dépasse en haut, poignée, barre de titre avec « Annuler »,
 * contenu qui défile et pied fixe pour les boutons.
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
    <div className="fixed inset-0 bg-black">
      <div className="mx-auto h-full max-w-md">
        <div className="relative h-full">
          <div className="top-sheet absolute inset-x-3 h-10 -translate-y-3 rounded-t-xl bg-sheet-band" aria-hidden="true" />
          <div className="top-sheet absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-xl bg-canvas">
            <div className="mx-auto mt-1.5 h-[5px] w-9 shrink-0 rounded-full bg-grabber" aria-hidden="true" />
            <div className="relative flex h-12 shrink-0 items-center px-4">
              <div className="relative z-10">{cancel}</div>
              <h1 className="pointer-events-none absolute inset-x-0 text-center text-body font-semibold">{title}</h1>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">{children}</div>
            {footer && <div className="pb-safe flex shrink-0 flex-col gap-2.5 bg-canvas px-4 pt-3">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

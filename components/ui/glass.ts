import { cn } from '@/lib/utils'

/**
 * Verre « Liquid Glass » d'iOS 26 : une seule matière pour tout ce qui flotte
 * au-dessus du contenu, jamais sur le contenu lui-même (listes, cartes).
 * - Liseré clair (`border-glass-rim`) et reflet sur l'arête haute (`shadow-sheen`).
 * - Flou et saturation : la couleur de ce qui passe dessous ressort.
 * - Verre épais (`bg-glass`, 88 %) dès qu'il porte du texte : menus, toast,
 *   encart, feuilles partielles, boutons du haut. La barre d'onglets, elle, est
 *   en verre léger (`bg-glass-thin`), avec la même arête.
 */
export const GLASS = 'border border-glass-rim bg-glass shadow-sheen backdrop-blur-xl backdrop-saturate-[1.8]'

/**
 * Bouton de verre du haut d'écran, 44 px de haut :
 * - `round` pour une icône seule (retour, annuler, ajouter, options), avec un
 *   `aria-label` ;
 * - `capsule` pour un libellé (choix du congélateur, « Modifier »).
 */
export function glassButton(shape: 'round' | 'capsule', className?: string) {
  return cn(
    'flex h-11 items-center justify-center rounded-full',
    GLASS,
    shape === 'round' ? 'w-11 shrink-0' : 'gap-1.5 px-4 text-subhead font-semibold',
    className,
  )
}

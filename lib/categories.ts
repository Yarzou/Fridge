import {
  Carrot,
  Cherry,
  Croissant,
  Drumstick,
  Fish,
  IceCreamCone,
  Leaf,
  Package,
  Soup,
  type LucideIcon,
} from 'lucide-react'

/**
 * Catégories du congélateur. Slugs, libellés, durées et ordre recopient la
 * table `categories` (migration 001) ; l'icône et la couleur ne vivent qu'ici.
 *
 * `tile` : tuile pleine, icône blanche. `soft` : tuile claire, icône colorée
 * (grande vignette d'un produit sans photo).
 */
export interface Category {
  slug: string
  label: string
  /** Durée de conservation conseillée, en mois (colonne shelf_months). */
  months: number
  icon: LucideIcon
  tile: string
  soft: string
}

export const CATEGORIES: Category[] = [
  { slug: 'viandes', label: 'Viandes', months: 6, icon: Drumstick, tile: 'bg-tile-red', soft: 'bg-tile-red/15 text-tile-red' },
  { slug: 'poissons', label: 'Poissons', months: 4, icon: Fish, tile: 'bg-tile-blue', soft: 'bg-tile-blue/15 text-tile-blue' },
  { slug: 'legumes', label: 'Légumes', months: 10, icon: Carrot, tile: 'bg-tile-green', soft: 'bg-tile-green/15 text-tile-green' },
  { slug: 'fruits', label: 'Fruits', months: 10, icon: Cherry, tile: 'bg-tile-pink', soft: 'bg-tile-pink/15 text-tile-pink' },
  { slug: 'plats-maison', label: 'Plats maison', months: 3, icon: Soup, tile: 'bg-tile-orange', soft: 'bg-tile-orange/15 text-tile-orange' },
  { slug: 'pain', label: 'Pain', months: 3, icon: Croissant, tile: 'bg-tile-brown', soft: 'bg-tile-brown/15 text-tile-brown' },
  { slug: 'glaces', label: 'Glaces', months: 3, icon: IceCreamCone, tile: 'bg-tile-ice', soft: 'bg-tile-ice/15 text-tile-ice' },
  { slug: 'herbes', label: 'Herbes', months: 6, icon: Leaf, tile: 'bg-tile-leaf', soft: 'bg-tile-leaf/15 text-tile-leaf' },
  { slug: 'autres', label: 'Autres', months: 6, icon: Package, tile: 'bg-tile-slate', soft: 'bg-tile-slate/15 text-tile-slate' },
]

const BY_SLUG = new Map(CATEGORIES.map(c => [c.slug, c]))

/** Catégorie d'un slug ; « Autres » pour un slug inconnu (ajouté en base après coup). */
export function getCategory(slug: string | null | undefined): Category {
  return BY_SLUG.get(slug ?? '') ?? BY_SLUG.get('autres')!
}

const GUESS_RULES: [RegExp, string][] = [
  [/ice-cream|glace|sorbet|frozen-desserts|esquimau|b[âa]tonnet/, 'glaces'],
  [/fish|seafood|poisson|cabillaud|saumon|colin|merlu|crevette|thon|moule|calamar|surimi/, 'poissons'],
  [/meat|poultr|sausage|viande|volaille|poulet|b[œoe]uf|porc|veau|agneau|dinde|steak|hach[ée]|saucisse|lardon|canard|jambon/, 'viandes'],
  [/herb|aromat|persil|basilic|ciboulette|coriandre|menthe|aneth|estragon/, 'herbes'],
  [/vegetable|\bpeas?\b|l[ée]gume|petits? pois|haricot|[ée]pinard|brocoli|chou|carotte|poivron|courgette|frite|potato|pommes?[- ]de[- ]terre|po[êe]l[ée]e|ratatouille/, 'legumes'],
  [/fruit|berr|framboise|fraise|myrtille|mangue|cerise|ananas|m[ûu]re|cassis|banane|pomme/, 'fruits'],
  [/bread|pain|viennoiser|croissant|baguette|brioche|pastr/, 'pain'],
  [/meal|plat|pizza|lasagne|gratin|quiche|soupe|soup|tarte|hachis|nugget|cordon|burger/, 'plats-maison'],
]

function matchCategory(text: string): string | null {
  for (const [re, slug] of GUESS_RULES) if (re.test(text)) return slug
  return null
}

/**
 * Catégorie probable d'un produit d'après les étiquettes Open Food Facts
 * (`categories_tags`, ex. « en:frozen-vegetables »), puis d'après son nom.
 * Open Food Facts range ses étiquettes de la plus générale à la plus précise :
 * on les lit à rebours, « en:frozen-fruits » passe avant
 * « en:fruits-and-vegetables-based-foods ».
 */
export function guessCategory(tags: string[], name: string): string {
  for (let i = tags.length - 1; i >= 0; i--) {
    const slug = matchCategory(tags[i].toLowerCase())
    if (slug) return slug
  }
  return matchCategory(name.toLowerCase()) ?? 'autres'
}

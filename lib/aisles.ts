import {
  Carrot,
  Cookie,
  Croissant,
  CupSoda,
  Drumstick,
  Fish,
  Milk,
  ShoppingBasket,
  Snowflake,
  Sparkles,
  SprayCan,
  Wheat,
  type LucideIcon,
} from 'lucide-react'

/**
 * Rayons de la liste de courses. Slugs, libellés et ordre recopient la table
 * `aisles` (migration 001) : l'ordre d'un parcours en magasin, surgelés en
 * dernier pour la chaîne du froid. Icône et couleur ne vivent qu'ici.
 */
export interface Aisle {
  slug: string
  label: string
  icon: LucideIcon
  tile: string
}

export const AISLES: Aisle[] = [
  { slug: 'fruits-legumes', label: 'Fruits et légumes', icon: Carrot, tile: 'bg-tile-green' },
  { slug: 'boulangerie', label: 'Boulangerie', icon: Croissant, tile: 'bg-tile-brown' },
  { slug: 'boucherie', label: 'Boucherie', icon: Drumstick, tile: 'bg-tile-red' },
  { slug: 'poissonnerie', label: 'Poissonnerie', icon: Fish, tile: 'bg-tile-blue' },
  { slug: 'cremerie', label: 'Crèmerie', icon: Milk, tile: 'bg-tile-dairy' },
  { slug: 'epicerie-salee', label: 'Épicerie salée', icon: Wheat, tile: 'bg-tile-amber' },
  { slug: 'epicerie-sucree', label: 'Épicerie sucrée', icon: Cookie, tile: 'bg-tile-pink' },
  { slug: 'boissons', label: 'Boissons', icon: CupSoda, tile: 'bg-tile-orange' },
  { slug: 'hygiene', label: 'Hygiène', icon: Sparkles, tile: 'bg-tile-purple' },
  { slug: 'entretien', label: 'Entretien', icon: SprayCan, tile: 'bg-tile-teal' },
  { slug: 'surgeles', label: 'Surgelés', icon: Snowflake, tile: 'bg-tile-ice' },
  { slug: 'divers', label: 'Divers', icon: ShoppingBasket, tile: 'bg-tile-slate' },
]

const BY_SLUG = new Map(AISLES.map(a => [a.slug, a]))

export function getAisle(slug: string | null | undefined): Aisle {
  return BY_SLUG.get(slug ?? '') ?? BY_SLUG.get('divers')!
}

/** Minuscules, sans accents ni ponctuation : « Œufs frais ! » → « oeufs frais ». */
export function normalizeTerm(value: string): string {
  return value
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Dictionnaire de départ, mots sans accents. Le foyer le complète : un article
 * changé de rayon une fois y reste (table household_aisle_terms).
 */
const DICTIONARY: Record<string, string[]> = {
  'fruits-legumes': [
    'pomme', 'poire', 'banane', 'orange', 'citron', 'clementine', 'mandarine', 'pamplemousse', 'kiwi', 'raisin',
    'fraise', 'framboise', 'myrtille', 'cerise', 'peche', 'nectarine', 'abricot', 'prune', 'melon', 'pasteque',
    'ananas', 'mangue', 'avocat', 'tomate', 'salade', 'laitue', 'mache', 'roquette', 'epinard', 'concombre',
    'courgette', 'aubergine', 'poivron', 'carotte', 'poireau', 'oignon', 'echalote', 'ail', 'chou', 'brocoli',
    'celeri', 'radis', 'navet', 'betterave', 'champignon', 'haricots verts', 'pomme de terre', 'patate', 'persil',
    'basilic', 'ciboulette', 'coriandre', 'menthe', 'gingembre', 'endive', 'fenouil', 'artichaut', 'asperge',
    'potiron', 'courge', 'butternut', 'legume', 'fruit',
  ],
  boulangerie: ['pain', 'baguette', 'croissant', 'brioche', 'pain de mie', 'viennoiserie', 'chocolatine', 'pain au chocolat', 'ficelle'],
  boucherie: [
    'viande', 'steak', 'boeuf', 'veau', 'porc', 'agneau', 'poulet', 'dinde', 'canard', 'saucisse', 'merguez',
    'chipolata', 'lardon', 'jambon', 'roti', 'escalope', 'cote de porc', 'filet mignon', 'steak hache', 'bacon',
    'chorizo', 'saucisson', 'charcuterie', 'volaille', 'cuisse de poulet', 'blanc de poulet',
  ],
  poissonnerie: [
    'poisson', 'saumon', 'cabillaud', 'colin', 'merlu', 'crevette', 'moule', 'huitre', 'crabe', 'truite', 'dorade',
    'lieu', 'sole', 'calamar', 'surimi', 'filet de poisson',
  ],
  cremerie: [
    'lait', 'beurre', 'creme', 'creme fraiche', 'yaourt', 'fromage', 'comte', 'emmental', 'gruyere', 'mozzarella',
    'camembert', 'brie', 'chevre', 'roquefort', 'parmesan', 'raclette', 'oeuf', 'fromage blanc', 'skyr',
    'petit suisse', 'margarine', 'feta', 'ricotta', 'mascarpone',
  ],
  'epicerie-salee': [
    'pates', 'spaghetti', 'riz', 'semoule', 'quinoa', 'lentille', 'farine', 'huile', 'vinaigre', 'sel', 'poivre',
    'moutarde', 'mayonnaise', 'ketchup', 'sauce', 'sauce tomate', 'conserve', 'thon', 'sardine', 'mais', 'olive',
    'chips', 'cube', 'bouillon', 'epice', 'cornichon', 'soupe', 'puree', 'couscous', 'nouilles', 'pois chiches',
  ],
  'epicerie-sucree': [
    'sucre', 'chocolat', 'cafe', 'the', 'tisane', 'confiture', 'miel', 'pate a tartiner', 'cereales', 'biscuit',
    'gateau', 'compote', 'bonbon', 'levure', 'cacao', 'madeleine', 'sirop', 'chocolat en poudre',
  ],
  boissons: ['eau', 'eau gazeuse', 'jus', 'jus d orange', 'soda', 'coca', 'biere', 'vin', 'champagne', 'limonade', 'cidre'],
  hygiene: [
    'dentifrice', 'brosse a dents', 'shampoing', 'shampooing', 'savon', 'gel douche', 'deodorant', 'papier toilette',
    'coton', 'mouchoir', 'rasoir', 'couche', 'creme solaire',
  ],
  entretien: [
    'lessive', 'liquide vaisselle', 'eponge', 'sac poubelle', 'sacs poubelle', 'javel', 'nettoyant', 'essuie tout',
    'sopalin', 'papier aluminium', 'papier cuisson', 'film alimentaire', 'pastilles lave vaisselle', 'adoucissant',
  ],
  surgeles: ['surgele', 'glace', 'sorbet', 'frites', 'esquimau', 'batonnet', 'petits pois', 'pizza surgelee'],
}

// Expressions les plus longues d'abord : « pomme de terre » passe avant « pomme ».
const MATCHERS: { re: RegExp; aisle: string; length: number }[] = Object.entries(DICTIONARY)
  .flatMap(([aisle, words]) =>
    words.map(word => ({ re: new RegExp(`(^| )${word}(s|x)?( |$)`), aisle, length: word.length })),
  )
  .sort((a, b) => b.length - a.length)

type HouseholdTerms = Map<string, { aisle_slug: string }>

/**
 * Rayon d'un article : d'abord ce que le foyer a retenu (`householdTerms`,
 * terme normalisé → rayon), puis le dictionnaire, sinon « Divers ».
 */
export function guessAisle(name: string, householdTerms?: HouseholdTerms): string {
  const term = normalizeTerm(name)
  const own = householdTerms?.get(term)?.aisle_slug
  if (own && BY_SLUG.has(own)) return own
  for (const m of MATCHERS) if (m.re.test(term)) return m.aisle
  return 'divers'
}

/**
 * Rayon où racheter un produit fini au congélateur. Un produit à code-barres
 * ou une glace a été acheté surgelé ; le reste (viande, pain, plats maison) a
 * été congelé à la maison et se rachète au rayon frais.
 */
export function aisleForFreezerItem(
  item: { name: string; barcode: string | null; category_slug: string },
  householdTerms?: HouseholdTerms,
): string {
  if (householdTerms?.has(normalizeTerm(item.name))) return guessAisle(item.name, householdTerms)
  if (item.barcode || item.category_slug === 'glaces') return 'surgeles'
  const aisle = guessAisle(item.name, householdTerms)
  return aisle === 'divers' ? 'surgeles' : aisle
}

/**
 * Saisie libre de la liste : « 2 avocats » → Avocats, « ×2 » ; « yaourts x8 »
 * → Yaourts, « ×8 » ; « 500 g de comté » → Comté, « 500 g ».
 */
export function parseShoppingInput(raw: string): { name: string; note: string | null } {
  let text = raw.trim().replace(/\s+/g, ' ')
  let note: string | null = null

  const leading = text.match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|l|cl|ml)?\s+(?:(?:de |d’|d')\s*)?(.+)$/i)
  const trailing = text.match(/^(.+?)\s*[x×*]\s*(\d+)$/i)
  if (leading) {
    note = leading[2] ? `${leading[1]} ${leading[2].toLowerCase()}` : `×${leading[1]}`
    text = leading[3]
  } else if (trailing) {
    note = `×${trailing[2]}`
    text = trailing[1]
  }
  const name = text ? text[0].toLocaleUpperCase('fr-FR') + text.slice(1) : ''
  return { name: name.slice(0, 80), note }
}

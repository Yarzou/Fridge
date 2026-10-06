/**
 * Conditionnements proposés à l'ajout d'un produit. La colonne `items.unit`
 * reste libre (20 caractères) ; null = des pièces (« ×4 »).
 */
export const UNITS = ['sachet', 'portion', 'barquette', 'boîte', 'pot'] as const

/** « 2 sachets », « 1 portion », « 3 pièces ». */
export function quantityLabel(count: number, unit: string | null | undefined): string {
  const word = unit || 'pièce'
  return `${count} ${count > 1 && !/[sx]$/.test(word) ? `${word}s` : word}`
}

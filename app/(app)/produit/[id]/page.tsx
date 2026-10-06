import ItemSheet from '@/components/inventory/ItemSheet'
import { safeInternalPath } from '@/lib/utils'

/** Feuille « Modifier le produit » : quantité, catégorie, tiroir, dates, suppression. */
export default async function ProduitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ retour?: string }>
}) {
  const { id } = await params
  const { retour } = await searchParams
  return <ItemSheet mode="edit" itemId={id} returnTo={safeInternalPath(retour, '/congelateur')} />
}

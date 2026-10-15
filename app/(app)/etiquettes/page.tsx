import EtiquettesClient from './EtiquettesClient'
import { isUuid, safeInternalPath } from '@/lib/utils'

type Params = Record<string, string | string[] | undefined>

/**
 * Étiquettes QR des tiroirs. Toutes par défaut ; ?congelateur={id} pour un
 * seul congélateur, ?tiroirs={id},{id} pour quelques tiroirs (ceux qu'on vient
 * d'ajouter). ?retour : où mène le bouton retour.
 */
export default async function EtiquettesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  const congelateur = typeof params.congelateur === 'string' && isUuid(params.congelateur) ? params.congelateur : undefined
  const tiroirs = typeof params.tiroirs === 'string' ? params.tiroirs.split(',').filter(isUuid).slice(0, 50) : []
  const retour = typeof params.retour === 'string' ? params.retour.slice(0, 200) : undefined
  return <EtiquettesClient freezerId={congelateur} drawerIds={tiroirs} returnTo={safeInternalPath(retour, '/foyer')} />
}

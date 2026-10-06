import ItemSheet from '@/components/inventory/ItemSheet'
import { safeInternalPath } from '@/lib/utils'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Params = Record<string, string | string[] | undefined>

function text(params: Params, key: string, max = 80): string | undefined {
  const value = params[key]
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined
}

/** Seules les photos d'Open Food Facts sont reprises (et la CSP n'autorise qu'elles). */
function offImage(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'images.openfoodfacts.org' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

/**
 * Feuille « Nouveau produit ». Le scanner y envoie ce qu'il a reconnu :
 * ?code, nom, format, image, categorie ; un tiroir y envoie ?tiroir.
 * ?retour : où revenir après l'ajout.
 */
export default async function AjouterPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  const code = text(params, 'code', 14)
  const tiroir = text(params, 'tiroir', 36)
  const congelateur = text(params, 'congelateur', 36)
  return (
    <ItemSheet
      mode="add"
      returnTo={safeInternalPath(text(params, 'retour', 200), '/congelateur')}
      prefill={{
        barcode: code && /^[0-9]{6,14}$/.test(code) ? code : undefined,
        name: text(params, 'nom'),
        format: text(params, 'format', 60),
        image: offImage(text(params, 'image', 300)),
        category: text(params, 'categorie', 30),
        compartment: tiroir && UUID_RE.test(tiroir) ? tiroir : undefined,
        freezer: congelateur && UUID_RE.test(congelateur) ? congelateur : undefined,
      }}
    />
  )
}

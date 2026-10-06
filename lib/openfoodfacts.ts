import { guessCategory } from '@/lib/categories'

/**
 * Fiche produit Open Food Facts, lue depuis le téléphone (base ouverte, sans
 * clé). Domaines autorisés dans la CSP (next.config.js) :
 * world.openfoodfacts.org (connect-src) et images.openfoodfacts.org (img-src).
 */
export interface OffProduct {
  name: string
  /** « Picard · 1 kg » */
  format: string | null
  image: string | null
  category: string
}

interface OffResponse {
  status?: number
  product?: {
    product_name_fr?: string
    product_name?: string
    generic_name_fr?: string
    brands?: string
    quantity?: string
    image_front_small_url?: string
    categories_tags?: string[]
  }
}

const FIELDS = 'product_name_fr,product_name,generic_name_fr,brands,quantity,image_front_small_url,categories_tags'

/** null si le produit est inconnu, ou si Open Food Facts ne répond pas dans les 5 s. */
export async function lookupOpenFoodFacts(code: string): Promise<OffProduct | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}&lc=fr`, {
      signal: controller.signal,
    })
    if (!res.ok) return null
    const json = (await res.json()) as OffResponse
    const p = json.product
    if (json.status !== 1 || !p) return null
    const name = (p.product_name_fr || p.product_name || p.generic_name_fr || '').trim()
    if (!name) return null
    const brand = p.brands?.split(',')[0]?.trim()
    const format = [brand, p.quantity?.trim()].filter(Boolean).join(' · ') || null
    const image = p.image_front_small_url?.startsWith('https://images.openfoodfacts.org/') ? p.image_front_small_url : null
    return { name: name.slice(0, 80), format: format?.slice(0, 60) ?? null, image, category: guessCategory(p.categories_tags ?? [], name) }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Lecture des codes-barres et des QR codes, image par image, avec zxing en
 * WebAssembly : `BarcodeDetector` n'existe pas sur Safari iOS. Le module (≈ 1 Mo)
 * n'est chargé qu'à l'ouverture du scanner, et son .wasm est servi par l'appli
 * (/zxing/, copié par scripts/copy-zxing-wasm.js) plutôt que par un CDN.
 */

type ReadBarcodes = typeof import('zxing-wasm/reader').readBarcodes

let reader: Promise<ReadBarcodes> | null = null

function loadReader(): Promise<ReadBarcodes> {
  reader ??= import('zxing-wasm/reader').then(mod => {
    mod.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? `/zxing/${path}` : prefix + path),
      },
    })
    return mod.readBarcodes
  })
  return reader
}

/** Premier code lisible de l'image (EAN, UPC ou QR), ou null. */
export async function readCode(image: ImageData): Promise<string | null> {
  const readBarcodes = await loadReader()
  const results = await readBarcodes(image, {
    formats: ['EANUPC', 'QRCode'],
    tryHarder: true,
    maxNumberOfSymbols: 1,
  })
  const hit = results.find(r => r.isValid && r.text)
  return hit?.text ?? null
}

const DRAWER_RE = /\/tiroir\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

/**
 * Ce que désigne un code lu : le QR d'un tiroir (quel que soit le domaine
 * imprimé dessus), un code-barres produit, ou autre chose.
 */
export type ScannedCode = { kind: 'drawer'; id: string } | { kind: 'barcode'; code: string } | { kind: 'other' }

export function classifyCode(text: string): ScannedCode {
  const drawer = text.match(DRAWER_RE)
  if (drawer) return { kind: 'drawer', id: drawer[1].toLowerCase() }
  const digits = text.trim()
  if (/^[0-9]{6,14}$/.test(digits)) return { kind: 'barcode', code: digits }
  return { kind: 'other' }
}

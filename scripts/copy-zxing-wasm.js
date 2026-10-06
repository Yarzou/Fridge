// Copie le moteur de lecture des codes-barres (zxing-wasm) dans public/zxing/.
//
// Par défaut, zxing-wasm télécharge son .wasm depuis le CDN jsDelivr : la CSP
// le bloquerait, et l'appli dépendrait d'un tiers au moment du scan. On le sert
// donc nous-mêmes (/zxing/zxing_reader.wasm, voir lib/barcode.ts). Lancé par
// `postinstall` : le fichier n'est pas versionné (.gitignore).
const fs = require('fs')
const path = require('path')

const source = path.join(__dirname, '..', 'node_modules', 'zxing-wasm', 'dist', 'reader', 'zxing_reader.wasm')
const targetDir = path.join(__dirname, '..', 'public', 'zxing')

if (!fs.existsSync(source)) {
  console.warn('[zxing] zxing_reader.wasm introuvable : le scanner ne lira pas les codes-barres.')
  process.exit(0)
}
fs.mkdirSync(targetDir, { recursive: true })
fs.copyFileSync(source, path.join(targetDir, 'zxing_reader.wasm'))
console.log('[zxing] public/zxing/zxing_reader.wasm à jour')

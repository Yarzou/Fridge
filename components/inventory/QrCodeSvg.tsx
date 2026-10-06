import { encode } from 'uqr'

/**
 * QR code en SVG, dessiné en un seul chemin (un carré par module noir).
 * Correction d'erreur « M » : l'étiquette reste lisible un peu abîmée ou givrée.
 */
export default function QrCodeSvg({ value, size, className }: { value: string; size: number; className?: string }) {
  const { data, size: modules } = encode(value, { ecc: 'M', border: 2 })
  let path = ''
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`
    }),
  )
  return (
    <svg
      viewBox={`0 0 ${modules} ${modules}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      <rect width={modules} height={modules} fill="white" />
      <path d={path} fill="black" />
    </svg>
  )
}

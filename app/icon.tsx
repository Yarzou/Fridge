import { ImageResponse } from 'next/og'
import { AppIconArt } from '@/lib/app-icon'

// Deux tailles exigées par Chrome pour l'installation : /icon/192 et /icon/512.
const SIZES: Record<string, number> = { '192': 192, '512': 512 }

export function generateImageMetadata() {
  return Object.entries(SIZES).map(([id, size]) => ({
    id,
    size: { width: size, height: size },
    contentType: 'image/png',
  }))
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const size = SIZES[String(await id)] ?? 512
  return new ImageResponse(<AppIconArt size={size} />, { width: size, height: size })
}

import { ImageResponse } from 'next/og'
import { AppIconArt } from '@/lib/app-icon'

// Icône de l'écran d'accueil iPhone. iOS arrondit les coins lui-même.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(<AppIconArt size={180} />, size)
}

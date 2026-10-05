import type { MetadataRoute } from 'next'
import { APP_DESCRIPTION, APP_NAME, THEME_COLOR_LIGHT } from '@/lib/app'

// Servi en /manifest.webmanifest ; Next ajoute le <link rel="manifest"> tout seul.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    lang: 'fr',
    start_url: '/congelateur',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: THEME_COLOR_LIGHT,
    theme_color: THEME_COLOR_LIGHT,
    icons: [
      // Générées par app/icon.tsx. Fond bleu plein, flocon dans la zone sûre :
      // la même image sert d'icône normale et d'icône « maskable » (Android).
      { src: '/icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

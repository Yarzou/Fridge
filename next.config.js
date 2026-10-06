/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Caméra autorisée pour le scanner (code-barres, QR des tiroirs).
          // neighborshare la coupe (`camera=()`) : ne pas recopier sa valeur.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              // Photos des produits reconnus par le scanner (Open Food Facts)
              "img-src 'self' data: blob: https://*.supabase.co https://images.openfoodfacts.org",
              "media-src 'self' blob:",
              "font-src 'self'",
              // API produits d'Open Food Facts, interrogée par le scanner (lib/openfoodfacts.ts).
              // Le moteur zxing (.wasm) est servi par l'appli : 'self' suffit.
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://world.openfoodfacts.org",
              "worker-src 'self'",
              "manifest-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
      {
        // Le service worker doit toujours être revalidé, sinon une mise à jour
        // peut rester bloquée derrière le cache du navigateur.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

module.exports = nextConfig

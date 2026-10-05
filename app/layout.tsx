import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeSync } from '@/components/theme/theme'
import ServiceWorkerRegister from '@/components/layout/ServiceWorkerRegister'
import PWAInstallBanner from '@/components/layout/PWAInstallBanner'
import { APP_DESCRIPTION, APP_NAME, THEME_COLOR_DARK, THEME_COLOR_LIGHT } from '@/lib/app'

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // La page passe sous l'encoche : les zones sûres sont gérées par .pt-safe / .pb-safe
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLOR_LIGHT },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLOR_DARK },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Anti-flash : pose la classe dark avant le premier rendu (voir components/theme/theme.ts) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-dvh bg-canvas font-sans text-ink">
        <ThemeSync />
        <ServiceWorkerRegister />
        {children}
        <PWAInstallBanner />
      </body>
    </html>
  )
}

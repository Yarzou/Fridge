import type { Config } from 'tailwindcss'

/**
 * Système visuel « Givre » — validé sur les maquettes du 2026-10-05.
 *
 * Toutes les couleurs passent par les variables CSS de app/globals.css, qui
 * basculent seules en mode sombre. Contrairement à neighborshare, il n'y a
 * pas de bloc de surcharges `html.dark … !important` : n'utiliser que ces
 * tokens dans les composants (jamais `bg-white`, `text-gray-*`, ni de hex).
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        card: 'var(--card)',
        fill: {
          DEFAULT: 'var(--fill)',
          soft: 'var(--fill-soft)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          muted: 'var(--ink-muted)',
          // Chevrons et icônes seulement : 3,3:1 sur carte, insuffisant pour du texte.
          faint: 'var(--ink-faint)',
        },
        separator: 'var(--separator)',
        accent: {
          DEFAULT: 'var(--accent)',
          fill: 'var(--accent-fill)',
          soft: 'var(--accent-soft)',
        },
        warn: {
          DEFAULT: 'var(--warn)',
          soft: 'var(--warn-soft)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          fill: 'var(--danger-fill)',
          soft: 'var(--danger-soft)',
        },
        glass: {
          DEFAULT: 'var(--glass)',
          edge: 'var(--glass-edge)',
        },
      },
      fontFamily: {
        // Police système : SF Pro sur iPhone, Roboto sur Android. Aucun webfont à charger.
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Échelle typographique iOS (points = px CSS)
        'large-title': ['34px', { lineHeight: '41px', fontWeight: '700', letterSpacing: '0.2px' }],
        title: ['20px', { lineHeight: '25px', fontWeight: '700' }],
        body: ['17px', '22px'],
        subhead: ['15px', '20px'],
        footnote: ['13px', '18px'],
        caption: ['11px', '13px'],
      },
      boxShadow: {
        lift: 'var(--shadow-lift)',
        float: 'var(--shadow-float)',
      },
    },
  },
  plugins: [],
}
export default config

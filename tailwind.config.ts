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
        tabbar: {
          DEFAULT: 'var(--tabbar)',
          edge: 'var(--tabbar-edge)',
        },
        bubble: {
          DEFAULT: 'var(--bubble)',
          edge: 'var(--bubble-edge)',
        },
        seg: 'var(--seg)',
        'chip-edge': 'var(--chip-edge)',
        grabber: 'var(--grabber)',
        'accent-wash': 'var(--accent-wash)',
        swipe: 'var(--swipe)',
        toast: {
          DEFAULT: 'var(--toast)',
          action: 'var(--toast-action)',
        },
        badge: 'var(--badge)',
        knob: 'var(--knob)',
        lens: 'var(--lens)',
        // Tuiles d'icônes (catégories, rayons, avatars) : mêmes teintes en clair
        // et en sombre, icône ou initiale blanche dessus (≥ 4,5:1). En hex et non
        // en variables CSS pour garder les opacités (`bg-tile-green/15`).
        tile: {
          red: '#c2413a',
          blue: '#2f6fb3',
          green: '#3b8a3e',
          forest: '#2f7a33',
          leaf: '#4d7c0f',
          pink: '#b03a6e',
          orange: '#c46a12',
          brown: '#a65a0e',
          amber: '#b45309',
          ice: '#2f8fb8',
          dairy: '#3a6ea5',
          teal: '#0f766e',
          purple: '#6e56cf',
          slate: '#56657a',
          bell: '#c2410c',
          ink: 'var(--tile-ink)',
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
      // « Goutte d'eau » de la barre d'onglets : la bulle s'étire en partant, se tasse, se pose.
      keyframes: {
        bubble: {
          '0%': { transform: 'scale(1, 1)' },
          '30%': { transform: 'scale(1.24, 0.84)' },
          '62%': { transform: 'scale(0.95, 1.06)' },
          '100%': { transform: 'scale(1, 1)' },
        },
      },
      animation: {
        bubble: 'bubble 560ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      boxShadow: {
        glass: 'var(--shadow-float), inset 0 1px 0 var(--tabbar-highlight)',
        bubble: 'inset 0 0 0 0.5px var(--bubble-edge), 0 2px 10px rgba(0, 0, 0, 0.1)',
        // Pastille soulevée par le doigt : plus d'ombre, pour se détacher d'une piste grise
        lifted: 'inset 0 0 0 0.5px var(--bubble-edge), 0 3px 12px rgba(0, 0, 0, 0.2)',
        lift: 'var(--shadow-lift)',
        float: 'var(--shadow-float)',
      },
    },
  },
  plugins: [],
}
export default config

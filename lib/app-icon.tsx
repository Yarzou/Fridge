import { ACCENT_COLOR } from '@/lib/app'

/**
 * Dessin de l'icône (flocon blanc sur fond bleu), rendu en PNG par
 * app/icon.tsx et app/apple-icon.tsx via ImageResponse. Le flocon occupe
 * ~56 % du côté : il reste dans la zone sûre d'une icône « maskable ».
 */
export function AppIconArt({ size }: { size: number }) {
  const glyph = Math.round(size * 0.56)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: ACCENT_COLOR,
      }}
    >
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5" />
        <path d="M9.5 4l2.5 2 2.5-2M9.5 20l2.5-2 2.5 2" />
        <path d="M17.7 5.8L17.2 9l3 1.2M20.2 13.8L17.2 15l.5 3.2" />
        <path d="M6.3 18.2L6.8 15l-3-1.2M3.8 10.2L6.8 9l-.5-3.2" />
      </svg>
    </div>
  )
}

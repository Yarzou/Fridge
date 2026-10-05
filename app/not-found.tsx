import Link from 'next/link'
import { buttonClass } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-title">Page introuvable</h1>
      <p className="mb-4 text-subhead text-ink-muted">Ce lien ne mène nulle part, ou plus nulle part.</p>
      <Link href="/congelateur" className={buttonClass('primary')}>
        Retour au congélateur
      </Link>
    </main>
  )
}

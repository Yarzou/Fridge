'use client'

import { useEffect } from 'react'
import Button from '@/components/ui/Button'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-title">Quelque chose s&apos;est mal passé</h1>
      <p className="mb-4 text-subhead text-ink-muted">Vérifiez votre connexion, puis réessayez.</p>
      <Button onClick={reset}>Réessayer</Button>
    </main>
  )
}

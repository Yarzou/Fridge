'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthShell from '@/components/auth/AuthShell'
import Button, { buttonClass } from '@/components/ui/Button'
import Notice from '@/components/ui/Notice'
import { FieldGroup, FieldRow } from '@/components/ui/FieldGroup'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) setError(json?.error ?? 'La demande a échoué. Réessayez dans un instant.')
      else setSent(true)
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthShell
        title="Email envoyé"
        subtitle={<>Si un compte existe pour <strong className="text-ink">{email}</strong>, un lien pour choisir un nouveau mot de passe vient de lui être envoyé.</>}
      >
        <p className="text-center text-footnote text-ink-muted">
          Le lien est valable une heure. Rien reçu ? Regardez dans les indésirables, ou refaites la demande.
        </p>
        <Link href="/auth/login" className={buttonClass('secondary')}>Retour à la connexion</Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Mot de passe oublié" subtitle="Nous vous envoyons un lien pour en choisir un nouveau.">
      {error && <Notice tone="danger">{error}</Notice>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FieldGroup>
          <FieldRow
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            autoFocus
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="vous@exemple.fr"
          />
        </FieldGroup>
        <Button type="submit" loading={loading}>Envoyer le lien</Button>
      </form>
      <Link href="/auth/login" className="mt-2 text-center text-subhead text-accent">Retour à la connexion</Link>
    </AuthShell>
  )
}

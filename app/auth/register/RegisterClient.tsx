'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MailCheck } from 'lucide-react'
import { safeInternalPath } from '@/lib/utils'
import AuthShell from '@/components/auth/AuthShell'
import Button, { buttonClass } from '@/components/ui/Button'
import Notice from '@/components/ui/Notice'
import { FieldGroup, FieldRow } from '@/components/ui/FieldGroup'

export default function RegisterClient() {
  const searchParams = useSearchParams()
  // Arrivée depuis /invitation/{id} : on y revient après la confirmation de l'email
  const redirect = useMemo(() => safeInternalPath(searchParams.get('redirect')), [searchParams])
  const fromInvitation = redirect.startsWith('/invitation/')

  const [form, setForm] = useState({ display_name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    // Route serveur : c'est l'app qui envoie l'email (SMTP Gmail), pas Supabase.
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, redirect }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) setError(json?.error ?? "L'inscription a échoué. Réessayez dans un instant.")
      else setSuccess(true)
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthShell title="Vérifiez vos emails" subtitle={<>Un lien de confirmation vient d&apos;être envoyé à <strong className="text-ink">{form.email}</strong>.</>}>
        <div className="flex flex-col items-center gap-2 rounded-xl bg-card p-5 text-center">
          <MailCheck size={32} className="text-accent" aria-hidden="true" />
          <p className="text-subhead">
            Touchez le lien qu&apos;il contient pour activer votre compte
            {fromInvitation ? ' et rejoindre le foyer.' : '.'}
          </p>
          <p className="text-footnote text-ink-muted">
            Rien reçu après quelques minutes ? Regardez dans les indésirables, ou refaites l&apos;inscription avec les mêmes identifiants.
          </p>
        </div>
        <Link href="/auth/login" className={buttonClass('secondary')}>Aller à la connexion</Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Créer un compte"
      subtitle={fromInvitation ? 'Vous rejoindrez le foyer juste après.' : 'Pour suivre le congélateur à plusieurs.'}
    >
      {error && <Notice tone="danger">{error}</Notice>}

      <form onSubmit={handleRegister} className="flex flex-col gap-4">
        <FieldGroup>
          <FieldRow
            label="Prénom"
            autoComplete="given-name"
            required
            maxLength={40}
            value={form.display_name}
            onChange={set('display_name')}
            placeholder="Visible par le foyer"
          />
          <FieldRow
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={form.email}
            onChange={set('email')}
            placeholder="vous@exemple.fr"
          />
          <FieldRow
            label="Mot de passe"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={set('password')}
            placeholder="8 caractères minimum"
          />
        </FieldGroup>
        <Button type="submit" loading={loading}>Créer mon compte</Button>
      </form>

      <p className="mt-2 text-center text-subhead text-ink-muted">
        Déjà un compte ?{' '}
        <Link
          href={redirect !== '/congelateur' ? `/auth/login?redirect=${encodeURIComponent(redirect)}` : '/auth/login'}
          className="text-accent"
        >
          Se connecter
        </Link>
      </p>
    </AuthShell>
  )
}

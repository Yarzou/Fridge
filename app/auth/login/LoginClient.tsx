'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FingerprintPattern } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isPasskeyCancel, passkeyErrorMessage, usePasskeySupport } from '@/lib/passkeys'
import { safeInternalPath } from '@/lib/utils'
import AuthShell from '@/components/auth/AuthShell'
import Button from '@/components/ui/Button'
import Notice from '@/components/ui/Notice'
import { FieldGroup, FieldRow } from '@/components/ui/FieldGroup'

export default function LoginClient() {
  const searchParams = useSearchParams()
  const redirect = useMemo(() => safeInternalPath(searchParams.get('redirect')), [searchParams])
  // Posé par /auth/confirm quand le lien de confirmation est invalide ou expiré
  const confirmFailed = searchParams.get('erreur') === 'confirmation'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const passkeySupported = usePasskeySupport()

  const [supabase] = useState(() => createClient())

  // Déjà connecté (arrivée par un lien avec ?redirect=) : on file à destination.
  // L'abonnement est posé avant getUser(), sinon faux `null` juste après connexion.
  useEffect(() => {
    let cancelled = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!cancelled && session && event === 'SIGNED_IN') window.location.href = redirect
    })
    supabase.auth.getUser().then(({ data }) => {
      // Navigation complète : les Server Components relisent le cookie de session
      if (!cancelled && data.user) window.location.href = redirect
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase, redirect])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.code === 'email_not_confirmed') {
        setError("Votre email n'est pas encore confirmé. Cliquez sur le lien reçu à l'inscription, ou réinscrivez-vous pour en recevoir un nouveau.")
      } else if (error.code === 'invalid_credentials') {
        setError('Email ou mot de passe incorrect.')
      } else {
        setError(error.message || 'Email ou mot de passe incorrect.')
      }
      setLoading(false)
      return
    }
    window.location.href = redirect
  }

  // Passkey : pas d'email à saisir, l'appareil retrouve lui-même le compte
  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPasskey()
    if (error) {
      if (!isPasskeyCancel(error)) setError(passkeyErrorMessage(error))
      setPasskeyLoading(false)
      return
    }
    window.location.href = redirect
  }

  const registerHref = redirect !== '/congelateur'
    ? `/auth/register?redirect=${encodeURIComponent(redirect)}`
    : '/auth/register'

  return (
    <AuthShell title="Connexion" subtitle="Le congélateur et les courses du foyer">
      {confirmFailed && !error && (
        <Notice tone="warn">
          Ce lien de confirmation est invalide ou a expiré. Réinscrivez-vous avec la même adresse pour en recevoir un nouveau.
        </Notice>
      )}
      {error && <Notice tone="danger">{error}</Notice>}

      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <FieldGroup>
          <FieldRow
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="vous@exemple.fr"
          />
          <FieldRow
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Requis"
          />
        </FieldGroup>
        <Button type="submit" loading={loading} disabled={passkeyLoading}>
          Se connecter
        </Button>
      </form>

      {passkeySupported && (
        <Button variant="secondary" onClick={handlePasskeyLogin} loading={passkeyLoading} disabled={loading}>
          {!passkeyLoading && <FingerprintPattern size={20} aria-hidden="true" />}
          Empreinte ou Face ID
        </Button>
      )}

      <div className="mt-2 flex flex-col items-center gap-3 text-subhead">
        <Link href={registerHref} className="text-accent">Créer un compte</Link>
        <Link href="/auth/forgot-password" className="text-accent">Mot de passe oublié ?</Link>
      </div>
    </AuthShell>
  )
}

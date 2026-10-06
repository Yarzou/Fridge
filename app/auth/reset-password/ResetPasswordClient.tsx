'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { reloadTo } from '@/lib/utils'
import AuthShell from '@/components/auth/AuthShell'
import Button, { buttonClass } from '@/components/ui/Button'
import Notice from '@/components/ui/Notice'
import { FieldGroup, FieldRow } from '@/components/ui/FieldGroup'

/**
 * Formulaire d'arrivée du lien « mot de passe oublié » (repris de neighborshare).
 * Le token (`token_hash`) n'est consommé qu'à la soumission, par
 * POST /api/auth/reset-password qui valide puis change le mot de passe dans la
 * même requête. Aucune session tant que ce n'est pas fait.
 */
export default function ResetPasswordClient() {
  const searchParams = useSearchParams()
  // Remplacé par un token neuf quand Supabase refuse le mot de passe : le premier
  // a été consommé par la tentative, la resoumission en a besoin d'un autre.
  const [tokenHash, setTokenHash] = useState(() => searchParams.get('token_hash'))

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkDead, setLinkDead] = useState(!tokenHash)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_hash: tokenHash, password }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string; code?: string; token_hash?: string } | null
      if (!res.ok) {
        if (json?.token_hash) {
          setTokenHash(json.token_hash)
          setError(json.error ?? 'Mot de passe refusé. Essayez-en un autre.')
        } else if (json?.code) {
          // Token consommé ou invalide : seul un nouveau lien peut aboutir.
          setLinkDead(true)
        } else {
          setError(json?.error ?? 'La mise à jour a échoué. Réessayez.')
        }
        return
      }
      setDone(true)
      setTimeout(() => reloadTo('/congelateur'), 1500)
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.')
    } finally {
      setLoading(false)
    }
  }

  if (linkDead) {
    return (
      <AuthShell
        title="Lien expiré"
        subtitle="Ce lien a déjà servi, ou son délai d'une heure est dépassé."
      >
        <Link href="/auth/forgot-password" className={buttonClass('primary')}>Demander un nouveau lien</Link>
      </AuthShell>
    )
  }

  if (done) {
    return <AuthShell title="C'est fait" subtitle="Mot de passe mis à jour. Ouverture du congélateur…">{null}</AuthShell>
  }

  return (
    <AuthShell title="Nouveau mot de passe" subtitle="8 caractères minimum.">
      {error && <Notice tone="danger">{error}</Notice>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FieldGroup>
          <FieldRow
            label="Nouveau"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            autoFocus
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Mot de passe"
          />
          <FieldRow
            label="Confirmer"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Le même"
          />
        </FieldGroup>
        <Button type="submit" loading={loading}>Enregistrer</Button>
      </form>
      <p className="mt-2 text-center text-footnote text-ink-muted">
        Vous n&apos;avez rien demandé ? Ignorez ce lien, votre mot de passe reste inchangé.
      </p>
    </AuthShell>
  )
}

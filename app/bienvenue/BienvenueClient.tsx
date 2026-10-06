'use client'

import { useState } from 'react'
import { Link2, Minus, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PGRST_FUNCTION_NOT_FOUND } from '@/lib/household'
import { reloadTo } from '@/lib/utils'
import AuthShell from '@/components/auth/AuthShell'
import Button from '@/components/ui/Button'
import Notice from '@/components/ui/Notice'
import { FieldGroup, FieldRow } from '@/components/ui/FieldGroup'

const MAX_COMPARTMENTS = 12

export default function BienvenueClient({ displayName }: { displayName: string | null }) {
  const [supabase] = useState(() => createClient())
  const [name, setName] = useState('')
  const [freezerName, setFreezerName] = useState('Congélateur')
  const [compartments, setCompartments] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.rpc('create_household', {
      p_name: name.trim(),
      p_freezer_name: freezerName.trim(),
      p_compartments: compartments,
    })
    if (error) {
      console.error('[bienvenue] create_household', error)
      setError(
        error.code === PGRST_FUNCTION_NOT_FOUND
          ? 'La base de données n’est pas encore prête : la migration 001 n’a pas été appliquée.'
          : 'La création du foyer a échoué. Réessayez dans un instant.',
      )
      setLoading(false)
      return
    }
    // Navigation complète : le layout serveur relit le foyer
    reloadTo('/congelateur')
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    reloadTo('/auth/login')
  }

  return (
    <AuthShell
      title={displayName ? `Bienvenue, ${displayName}` : 'Bienvenue'}
      subtitle="Créez votre foyer : vous pourrez ensuite y inviter les autres."
    >
      {error && <Notice tone="danger">{error}</Notice>}

      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        <FieldGroup>
          <FieldRow
            label="Foyer"
            required
            maxLength={60}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="La maison"
          />
          <FieldRow
            label="Congélateur"
            required
            maxLength={40}
            value={freezerName}
            onChange={e => setFreezerName(e.target.value)}
            placeholder="Cuisine, garage…"
          />
          <div className="flex min-h-[52px] items-center gap-3 border-t border-separator px-4">
            <span className="flex-1 text-body">Tiroirs</span>
            <span className="min-w-6 text-right text-body tabular-nums text-ink-muted">{compartments}</span>
            <div className="flex h-8 items-center overflow-hidden rounded-lg bg-fill-soft">
              <button
                type="button"
                aria-label="Un tiroir de moins"
                onClick={() => setCompartments(n => Math.max(0, n - 1))}
                disabled={compartments === 0}
                className="flex h-8 w-[46px] items-center justify-center disabled:opacity-40"
              >
                <Minus size={18} aria-hidden="true" />
              </button>
              <span className="h-[18px] w-px bg-separator" aria-hidden="true" />
              <button
                type="button"
                aria-label="Un tiroir de plus"
                onClick={() => setCompartments(n => Math.min(MAX_COMPARTMENTS, n + 1))}
                disabled={compartments === MAX_COMPARTMENTS}
                className="flex h-8 w-[46px] items-center justify-center disabled:opacity-40"
              >
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </FieldGroup>
        <p className="mx-4 -mt-2 text-footnote text-ink-muted">
          Un QR code par tiroir, collé sur la porte, ouvrira directement son contenu. Tout reste modifiable.
        </p>
        <Button type="submit" loading={loading} disabled={!name.trim()}>Créer le foyer</Button>
      </form>

      <div className="mt-2 flex items-start gap-3 rounded-xl bg-card p-4">
        <Link2 size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <p className="text-subhead">
          <strong>On vous a invité ?</strong>{' '}
          <span className="text-ink-muted">Ouvrez le lien reçu : il vous ajoute directement au foyer, sans rien créer ici.</span>
        </p>
      </div>

      <button type="button" onClick={signOut} className="mt-1 h-11 text-subhead text-accent">
        Changer de compte
      </button>
    </AuthShell>
  )
}

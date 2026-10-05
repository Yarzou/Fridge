'use client'

import { useEffect, useState } from 'react'
import { FingerprintPattern, LoaderCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isPasskeyCancel, isPasskeyDisabled, passkeyErrorMessage, usePasskeySupport } from '@/lib/passkeys'
import { formatDate, plural } from '@/lib/utils'
import { IconTile, ListRow, ListSection } from '@/components/ui/List'
import Notice from '@/components/ui/Notice'

/** Une passkey enregistrée, telle que la renvoie `supabase.auth.passkey.list()`. */
interface PasskeyItem {
  id: string
  friendly_name?: string
  created_at: string
  last_used_at?: string
}

/**
 * Section « Connexion » de l'onglet Foyer : empreinte ou Face ID sur cet
 * appareil, liste des appareils, retrait (repris de PasskeySection de
 * neighborshare). Masquée si le navigateur ne connaît pas WebAuthn, ou si le
 * projet Supabase n'a pas activé les passkeys (`passkey_disabled`).
 */
export default function PasskeyRows() {
  const [supabase] = useState(() => createClient())
  const supported = usePasskeySupport()

  const [passkeys, setPasskeys] = useState<PasskeyItem[] | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [busy, setBusy] = useState<string | null>(null) // 'register' ou l'id en cours de retrait
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    supabase.auth.passkey.list().then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        if (isPasskeyDisabled(error)) setUnavailable(true)
        else setError(passkeyErrorMessage(error))
        setPasskeys([])
        return
      }
      setPasskeys(data ?? [])
    })
    return () => { cancelled = true }
  }, [supabase, supported])

  if (!supported || unavailable) return null

  const handleRegister = async () => {
    setBusy('register')
    setError(null)
    const { error } = await supabase.auth.registerPasskey()
    if (error) {
      if (!isPasskeyCancel(error)) setError(passkeyErrorMessage(error))
      setBusy(null)
      return
    }
    const { data } = await supabase.auth.passkey.list()
    if (data) setPasskeys(data)
    setBusy(null)
  }

  const handleDelete = async (passkey: PasskeyItem) => {
    const name = passkey.friendly_name || 'cet appareil'
    if (!confirm(`Retirer « ${name} » ? Il faudra de nouveau le mot de passe pour se connecter depuis cet appareil.`)) return
    setBusy(passkey.id)
    setError(null)
    const { error } = await supabase.auth.passkey.delete({ passkeyId: passkey.id })
    if (error) setError(passkeyErrorMessage(error))
    else setPasskeys(list => (list ?? []).filter(p => p.id !== passkey.id))
    setBusy(null)
  }

  const count = passkeys?.length ?? 0

  return (
    <div className="flex flex-col gap-2">
      <ListSection
        header="Connexion"
        footer="Votre empreinte et votre visage restent sur le téléphone : l’appli ne les reçoit jamais."
      >
        <ListRow
          leading={<IconTile className="bg-accent-fill"><FingerprintPattern size={18} aria-hidden="true" /></IconTile>}
          title="Empreinte ou Face ID"
          subtitle={passkeys === null ? 'Chargement…' : count > 0 ? `Activée sur ${plural(count, 'appareil')}` : 'Pas encore activée'}
        />
        {passkeys?.map(p => (
          <ListRow
            key={p.id}
            leading={<span className="w-[30px]" />}
            title={p.friendly_name || 'Appareil sans nom'}
            subtitle={`Ajouté le ${formatDate(p.created_at)}`}
            trailing={
              <button
                type="button"
                onClick={() => handleDelete(p)}
                disabled={busy !== null}
                className="flex h-11 items-center gap-1 text-subhead text-danger disabled:opacity-50"
              >
                {busy === p.id && <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />}
                Retirer
              </button>
            }
          />
        ))}
        <ListRow
          leading={<span className="w-[30px]" />}
          title={busy === 'register' ? 'Activation…' : 'Activer sur cet appareil'}
          tone="accent"
          onClick={handleRegister}
          disabled={busy !== null || passkeys === null}
        />
      </ListSection>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  )
}

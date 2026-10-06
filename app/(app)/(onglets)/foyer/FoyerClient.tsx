'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, CirclePlus, Copy, QrCode, Share, Snowflake, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { APP_NAME } from '@/lib/app'
import { cn, formatDate, initial, plural } from '@/lib/utils'
import { HOUSEHOLD_ROLE_LABELS } from '@/lib/types'
import { useHousehold } from '@/components/household/HouseholdProvider'
import { useHouseholdData } from '@/components/household/HouseholdData'
import { THEME_LABELS, useTheme, type ThemeChoice } from '@/components/theme/theme'
import PasskeyRows from '@/components/foyer/PasskeyRows'
import ReminderSettings from '@/components/foyer/ReminderSettings'
import PageHeader from '@/components/ui/PageHeader'
import Notice from '@/components/ui/Notice'
import Segmented from '@/components/ui/Segmented'
import { IconTile, ListRow, ListSection } from '@/components/ui/List'

/** Couleur d'avatar stable par personne (l'initiale est blanche dessus). */
const AVATAR_TILES = ['bg-tile-brown', 'bg-tile-forest', 'bg-tile-purple', 'bg-tile-red', 'bg-tile-blue', 'bg-tile-teal']

function avatarTile(userId: string) {
  let hash = 0
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return AVATAR_TILES[Math.abs(hash) % AVATAR_TILES.length]
}

interface Invitation {
  url: string
  expiresAt: string
}

const THEME_ORDER: ThemeChoice[] = ['system', 'light', 'dark']

/**
 * Onglet Foyer (maquette « Foyer ») : membres et invitation, congélateurs et
 * étiquettes QR des tiroirs, rappels, connexion, apparence, compte.
 */
export default function FoyerClient() {
  const router = useRouter()
  const { household, userId } = useHousehold()
  const data = useHouseholdData()
  const [supabase] = useState(() => createClient())
  const { theme, setTheme } = useTheme()

  const members = data.status === 'ready' ? data.members : null
  const drawerCount = data.freezers.reduce((n, f) => n + f.compartments.length, 0)

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const isAdmin = household.role === 'admin'

  // Deux temps volontaires : créer le lien, puis le partager. Safari refuse
  // navigator.share() s'il n'est pas appelé directement par un geste, or
  // l'insertion en base passe par un aller-retour réseau.
  const createInvitation = async () => {
    setInviting(true)
    setInviteError(null)
    setCopied(false)
    const { data, error } = await supabase
      .from('household_invitations')
      .insert({ household_id: household.id, created_by: userId })
      .select('id, expires_at')
      .single()
    setInviting(false)
    if (error || !data) {
      console.error('[foyer] invitation', error)
      setInviteError('Impossible de créer le lien. Réessayez.')
      return
    }
    setInvitation({ url: `${window.location.origin}/invitation/${data.id}`, expiresAt: data.expires_at })
  }

  const shareInvitation = async () => {
    if (!invitation) return
    try {
      await navigator.share({
        title: `Rejoindre ${household.name}`,
        text: `Rejoins notre foyer « ${household.name} » sur ${APP_NAME} : le congélateur et les courses, à plusieurs.`,
        url: invitation.url,
      })
    } catch (err) {
      // Partage annulé : rien à signaler
      if ((err as { name?: string })?.name !== 'AbortError') await copyInvitation()
    }
  }

  const copyInvitation = async () => {
    if (!invitation) return
    try {
      await navigator.clipboard.writeText(invitation.url)
      setCopied(true)
    } catch {
      setInviteError('Copie impossible : sélectionnez le lien à la main.')
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title={household.name}
        subtitle={members ? `Partagé par ${plural(members.length, 'personne')}` : undefined}
      />

      {data.status === 'error' && (
        <Notice tone="danger">Impossible de charger le foyer. Vérifiez votre connexion.</Notice>
      )}

      <div className="flex flex-col gap-3">
        <ListSection header="Membres">
          {members?.map(m => {
            const me = m.user_id === userId
            return (
              <ListRow
                key={m.user_id}
                leading={
                  <span
                    className={cn(
                      'my-2.5 flex h-9 w-9 items-center justify-center rounded-full text-subhead font-semibold text-white',
                      me ? 'bg-accent-fill' : avatarTile(m.user_id),
                    )}
                  >
                    {me ? <User size={20} aria-hidden="true" /> : initial(m.display_name)}
                  </span>
                }
                title={me ? 'Vous' : m.display_name}
                subtitle={me ? `${m.display_name} · ${HOUSEHOLD_ROLE_LABELS[m.role]}` : HOUSEHOLD_ROLE_LABELS[m.role]}
              />
            )
          })}
          {isAdmin && (
            <ListRow
              leading={<span className="flex w-9 justify-center text-accent"><CirclePlus size={24} aria-hidden="true" /></span>}
              title={inviting ? 'Création du lien…' : invitation ? 'Créer un autre lien' : 'Inviter par un lien'}
              tone="accent"
              onClick={createInvitation}
              disabled={inviting}
            />
          )}
        </ListSection>

        {invitation && (
          <div className="flex flex-col gap-3 rounded-xl bg-card p-4">
            <p className="text-subhead">
              Envoyez ce lien aux membres du foyer. Il est valable jusqu’au {formatDate(invitation.expiresAt)}, pour autant de personnes que vous voulez.
            </p>
            <input
              readOnly
              value={invitation.url}
              aria-label="Lien d'invitation"
              onFocus={e => e.currentTarget.select()}
              className="h-11 rounded-lg bg-fill-soft px-3 text-subhead text-ink outline-none"
            />
            <div className={cn('grid gap-2', canShare ? 'grid-cols-2' : 'grid-cols-1')}>
              {canShare && (
                <button
                  type="button"
                  onClick={shareInvitation}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent-fill text-subhead font-semibold text-white"
                >
                  <Share size={18} aria-hidden="true" /> Partager
                </button>
              )}
              <button
                type="button"
                onClick={copyInvitation}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent-soft text-subhead font-semibold text-accent"
              >
                <Copy size={18} aria-hidden="true" /> {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
          </div>
        )}
        {inviteError && <Notice tone="danger">{inviteError}</Notice>}
      </div>

      <ListSection
        header="Congélateurs"
        footer="Un QR par tiroir, collé sur la porte. Scanné depuis l’appli, il ouvre le tiroir : on sort un produit en un geste."
      >
        {data.freezers.map((f, index) => {
          const count = data.items.filter(i => i.freezer_id === f.id && i.quantity > 0).length
          const drawers = f.compartments.length === 0 ? 'Sans tiroir' : plural(f.compartments.length, 'tiroir')
          return (
            <ListRow
              key={f.id}
              leading={
                <IconTile className={index === 0 ? 'bg-tile-ice' : 'bg-tile-slate'}>
                  <Snowflake size={18} aria-hidden="true" />
                </IconTile>
              }
              title={f.name}
              subtitle={`${drawers} · ${count === 0 ? 'vide' : plural(count, 'produit')}`}
              trailing={<ChevronRight size={18} strokeWidth={2.4} className="shrink-0 text-ink-faint" aria-hidden="true" />}
              onClick={() => {
                data.selectFreezer(f.id)
                router.push('/congelateur')
              }}
            />
          )
        })}
        {drawerCount > 0 && (
          <ListRow
            href="/etiquettes"
            leading={
              <IconTile className="bg-tile-ink">
                <QrCode size={18} aria-hidden="true" />
              </IconTile>
            }
            title="Imprimer les QR des tiroirs"
            subtitle={`${plural(drawerCount, 'étiquette')} sur une page A4`}
          />
        )}
      </ListSection>

      <ReminderSettings userId={userId} />

      <PasskeyRows />

      <section className="flex flex-col">
        <h2 className="mb-2 ml-4 text-footnote uppercase tracking-[0.3px] text-ink-muted">Apparence</h2>
        <Segmented
          label="Apparence"
          value={theme}
          onChange={setTheme}
          options={THEME_ORDER.map(choice => ({ value: choice, label: THEME_LABELS[choice] }))}
          itemClassName="h-8 text-footnote"
        />
      </section>

      <ListSection>
        <ListRow title="Se déconnecter" tone="danger" onClick={signOut} />
      </ListSection>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Copy, Share, Snowflake, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { APP_NAME } from '@/lib/app'
import { cn, formatDate, initial, plural } from '@/lib/utils'
import { HOUSEHOLD_ROLE_LABELS, type HouseholdMember, type HouseholdRole } from '@/lib/types'
import { useHousehold } from '@/components/household/HouseholdProvider'
import { THEME_LABELS, useTheme, type ThemeChoice } from '@/components/theme/theme'
import PasskeyRows from '@/components/foyer/PasskeyRows'
import PageHeader from '@/components/ui/PageHeader'
import Notice from '@/components/ui/Notice'
import { IconTile, ListRow, ListSection } from '@/components/ui/List'

interface MemberRow {
  user_id: string
  role: HouseholdRole
  joined_at: string
  profiles: { display_name: string } | null
}

interface FreezerRow {
  id: string
  name: string
  compartments: { id: string }[]
}

interface Invitation {
  url: string
  expiresAt: string
}

const THEME_ORDER: ThemeChoice[] = ['system', 'light', 'dark']

/** Onglet Foyer : membres et invitation, congélateurs, connexion, apparence, compte. */
export default function FoyerClient() {
  const { household, userId } = useHousehold()
  const [supabase] = useState(() => createClient())
  const { theme, setTheme } = useTheme()

  const [members, setMembers] = useState<HouseholdMember[] | null>(null)
  const [freezers, setFreezers] = useState<FreezerRow[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const isAdmin = household.role === 'admin'

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase
        .from('household_members')
        .select('user_id, role, joined_at, profiles ( display_name )')
        .eq('household_id', household.id)
        .order('joined_at'),
      supabase
        .from('freezers')
        .select('id, name, compartments ( id )')
        .eq('household_id', household.id)
        .order('position'),
    ]).then(([membersRes, freezersRes]) => {
      if (cancelled) return
      if (membersRes.error || freezersRes.error) {
        console.error('[foyer]', membersRes.error ?? freezersRes.error)
        setLoadError(true)
        return
      }
      setMembers(
        (membersRes.data as unknown as MemberRow[]).map(m => ({
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          display_name: m.profiles?.display_name ?? 'Membre',
        })),
      )
      setFreezers(freezersRes.data as unknown as FreezerRow[])
    })
    return () => { cancelled = true }
  }, [supabase, household.id])

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

      {loadError && <Notice tone="danger">Impossible de charger le foyer. Vérifiez votre connexion.</Notice>}

      <div className="flex flex-col gap-3">
        <ListSection header="Membres">
          {members?.map(m => (
            <ListRow
              key={m.user_id}
              leading={
                <span className="my-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-accent-fill text-subhead font-semibold text-white">
                  {initial(m.display_name)}
                </span>
              }
              title={m.user_id === userId ? `${m.display_name} (vous)` : m.display_name}
              subtitle={HOUSEHOLD_ROLE_LABELS[m.role]}
            />
          ))}
          {isAdmin && (
            <ListRow
              leading={<span className="flex w-9 justify-center text-accent"><UserPlus size={22} aria-hidden="true" /></span>}
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

      <ListSection header="Congélateurs">
        {freezers?.map(f => (
          <ListRow
            key={f.id}
            leading={<IconTile className="bg-accent-fill"><Snowflake size={18} aria-hidden="true" /></IconTile>}
            title={f.name}
            subtitle={f.compartments.length === 0 ? 'Sans tiroir' : plural(f.compartments.length, 'tiroir')}
          />
        ))}
      </ListSection>

      <PasskeyRows />

      <section className="flex flex-col">
        <h2 className="mb-2 ml-4 text-footnote uppercase tracking-[0.3px] text-ink-muted">Apparence</h2>
        <div className="grid grid-cols-3 gap-0.5 rounded-[9px] bg-fill p-0.5">
          {THEME_ORDER.map(choice => (
            <button
              key={choice}
              type="button"
              aria-pressed={theme === choice}
              onClick={() => setTheme(choice)}
              className={cn(
                'h-8 rounded-[7px] text-footnote',
                theme === choice ? 'bg-card font-semibold shadow-lift' : 'text-ink',
              )}
            >
              {THEME_LABELS[choice]}
            </button>
          ))}
        </div>
      </section>

      <ListSection>
        <ListRow title="Se déconnecter" tone="danger" onClick={signOut} />
      </ListSection>
    </div>
  )
}

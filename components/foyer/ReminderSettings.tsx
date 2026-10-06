'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Bell, CalendarDays, ChevronsUpDown, Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { VAPID_PUBLIC_KEY, deviceSubscription, disablePush, enablePush, pushSupport, type PushSupport } from '@/lib/push'
import {
  DAYS_BEFORE_OPTIONS,
  DEFAULT_REMINDER_SETTINGS,
  HOUR_OPTIONS,
  WEEKDAYS,
  daysBeforeLabel,
  hourLabel,
  type ReminderSettings as Settings,
} from '@/lib/reminders'
import { plural } from '@/lib/utils'
import { IconTile, ListRow, ListSection } from '@/components/ui/List'
import Notice from '@/components/ui/Notice'
import Switch from '@/components/ui/Switch'

const noop = () => () => {}

type Device = 'loading' | 'on' | 'off' | 'denied'

/** Les réglages que la personne choisit ; les dates d'envoi restent au serveur. */
const EDITABLE = ['expiry_enabled', 'expiry_days_before', 'expiry_hour', 'recap_enabled', 'recap_weekday', 'recap_hour'] as const

/**
 * Section « Rappels » de l'onglet Foyer (maquette « Foyer ») : activer les
 * rappels sur ce téléphone, régler « Produits à consommer » (combien de jours
 * avant, à quelle heure) et le récapitulatif de la semaine (jour, heure).
 * Inspirée de NotificationSettings de neighborshare.
 *
 * Les réglages sont ceux de la personne (table reminder_settings) et valent
 * pour tous ses appareils. Sans la migration 003, la section reste en « Bientôt ».
 */
export default function ReminderSettings({ userId }: { userId: string }) {
  const [supabase] = useState(() => createClient())
  const support = useSyncExternalStore<PushSupport>(noop, pushSupport, () => 'unsupported')

  const [settings, setSettings] = useState<Settings | null>(null)
  const [available, setAvailable] = useState<'loading' | 'yes' | 'no'>('loading')
  const [device, setDevice] = useState<Device>('loading')
  const [deviceCount, setDeviceCount] = useState(0)
  const [busy, setBusy] = useState<'device' | 'test' | null>(null)
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null)

  const countDevices = () =>
    supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => setDeviceCount(count ?? 0))

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('reminder_settings').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }),
      deviceSubscription().catch(() => null),
    ]).then(([settingsRes, countRes, sub]) => {
      if (cancelled) return
      if (settingsRes.error || countRes.error) {
        setAvailable('no')
        return
      }
      setSettings({ ...DEFAULT_REMINDER_SETTINGS, ...(settingsRes.data ?? {}) })
      setDeviceCount(countRes.count ?? 0)
      const denied = typeof Notification !== 'undefined' && Notification.permission === 'denied'
      setDevice(sub ? 'on' : denied ? 'denied' : 'off')
      setAvailable('yes')
    })
    return () => {
      cancelled = true
    }
  }, [supabase, userId])

  /** Enregistre les réglages (et le fuseau du téléphone, pour envoyer à la bonne heure). */
  const save = async (next: Settings) => {
    const row: Record<string, unknown> = {
      user_id: userId,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
    }
    for (const key of EDITABLE) row[key] = next[key]
    const { error } = await supabase.from('reminder_settings').upsert(row, { onConflict: 'user_id' })
    return !error
  }

  const update = async (patch: Partial<Settings>) => {
    if (!settings) return
    const before = settings
    const next = { ...settings, ...patch }
    setSettings(next)
    setMessage(null)
    if (!(await save(next))) {
      setSettings(before)
      setMessage({ tone: 'danger', text: 'Réglage non enregistré. Vérifiez votre connexion.' })
    }
  }

  const toggleDevice = async (on: boolean) => {
    setBusy('device')
    setMessage(null)
    try {
      if (on) {
        await enablePush(supabase)
        if (settings) await save(settings)
        setDevice('on')
      } else {
        await disablePush(supabase)
        setDevice('off')
      }
      await countDevices()
    } catch (err) {
      setMessage({ tone: 'danger', text: err instanceof Error ? err.message : 'Activation impossible.' })
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') setDevice('denied')
    }
    setBusy(null)
  }

  const sendTest = async () => {
    setBusy('test')
    setMessage(null)
    try {
      const res = await fetch('/api/rappels/test', { method: 'POST' })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      setMessage(
        res.ok
          ? { tone: 'success', text: 'Rappel envoyé : il arrive dans quelques secondes.' }
          : { tone: 'danger', text: json.error ?? 'Envoi impossible.' },
      )
    } catch {
      setMessage({ tone: 'danger', text: 'Envoi impossible. Vérifiez votre connexion.' })
    }
    setBusy(null)
  }

  // Migration 003 absente : la section garde son aspect d'avant
  if (available === 'no') {
    return (
      <ListSection header="Rappels" footer="Bientôt : une notification quand un produit approche de sa date, et un récapitulatif chaque semaine.">
        <ListRow
          leading={<IconTile className="bg-tile-bell"><Bell size={18} aria-hidden="true" /></IconTile>}
          title="Produits à consommer"
          trailing={<span className="text-body text-ink-muted">Bientôt</span>}
        />
        <ListRow
          leading={<IconTile className="bg-tile-purple"><CalendarDays size={18} aria-hidden="true" /></IconTile>}
          title="Récapitulatif"
          trailing={<span className="text-body text-ink-muted">Bientôt</span>}
        />
      </ListSection>
    )
  }

  const s = settings ?? DEFAULT_REMINDER_SETTINGS
  const others = device === 'on' ? deviceCount - 1 : deviceCount
  const deviceSubtitle =
    support === 'install'
      ? 'Installez d’abord l’appli sur l’écran d’accueil'
      : support === 'unsupported'
        ? 'Ce navigateur ne reçoit pas de notifications'
        : !VAPID_PUBLIC_KEY
          ? 'Pas encore configurés sur le serveur'
          : device === 'loading'
            ? 'Chargement…'
            : device === 'denied'
              ? 'Bloqués dans les réglages du téléphone'
              : device === 'on'
                ? `Activés${others > 0 ? ` · aussi sur ${plural(others, 'autre appareil')}` : ''}`
                : `Désactivés${others > 0 ? ` · activés sur ${plural(others, 'autre appareil')}` : ''}`
  const deviceUsable = support === 'ok' && !!VAPID_PUBLIC_KEY && device !== 'loading'
  const spacer = <span className="w-[30px]" />

  return (
    <div className="flex flex-col gap-2">
      <ListSection
        header="Rappels"
        footer="Chaque membre du foyer règle ses propres rappels. Sur iPhone, ils demandent l’appli installée sur l’écran d’accueil (iOS 16.4 ou plus)."
      >
        <ListRow
          leading={<IconTile className="bg-accent-fill"><Smartphone size={18} aria-hidden="true" /></IconTile>}
          title="Sur ce téléphone"
          subtitle={deviceSubtitle}
          trailing={
            <Switch
              label="Rappels sur ce téléphone"
              checked={device === 'on'}
              disabled={!deviceUsable || busy !== null}
              onChange={toggleDevice}
            />
          }
        />

        <ListRow
          leading={<IconTile className="bg-tile-bell"><Bell size={18} aria-hidden="true" /></IconTile>}
          title="Produits à consommer"
          subtitle={
            s.expiry_enabled
              ? `${daysBeforeLabel(s.expiry_days_before).toLocaleLowerCase('fr-FR')}, à ${hourLabel(s.expiry_hour)}`
              : 'Désactivé'
          }
          trailing={
            <Switch
              label="Rappel des produits à consommer"
              checked={s.expiry_enabled}
              disabled={!settings}
              onChange={on => void update({ expiry_enabled: on })}
            />
          }
        />
        {s.expiry_enabled && (
          <>
            <ListRow
              leading={spacer}
              title="Prévenir"
              trailing={
                <SelectPill
                  label="Quand prévenir"
                  value={s.expiry_days_before}
                  options={DAYS_BEFORE_OPTIONS.map(d => ({ value: d, label: daysBeforeLabel(d) }))}
                  onChange={v => void update({ expiry_days_before: v })}
                />
              }
            />
            <ListRow
              leading={spacer}
              title="Heure"
              trailing={
                <SelectPill
                  label="Heure du rappel des produits"
                  value={s.expiry_hour}
                  options={HOUR_OPTIONS.map(h => ({ value: h, label: hourLabel(h) }))}
                  onChange={v => void update({ expiry_hour: v })}
                />
              }
            />
          </>
        )}

        <ListRow
          leading={<IconTile className="bg-tile-purple"><CalendarDays size={18} aria-hidden="true" /></IconTile>}
          title="Récapitulatif"
          subtitle={s.recap_enabled ? `Chaque ${WEEKDAYS[s.recap_weekday - 1]} à ${hourLabel(s.recap_hour)}` : 'Désactivé'}
          trailing={
            <Switch
              label="Récapitulatif de la semaine"
              checked={s.recap_enabled}
              disabled={!settings}
              onChange={on => void update({ recap_enabled: on })}
            />
          }
        />
        {s.recap_enabled && (
          <ListRow
            leading={spacer}
            title="Jour et heure"
            trailing={
              <span className="flex gap-1.5">
                <SelectPill
                  label="Jour du récapitulatif"
                  value={s.recap_weekday}
                  options={WEEKDAYS.map((d, i) => ({ value: i + 1, label: d[0].toLocaleUpperCase('fr-FR') + d.slice(1) }))}
                  onChange={v => void update({ recap_weekday: v })}
                />
                <SelectPill
                  label="Heure du récapitulatif"
                  value={s.recap_hour}
                  options={HOUR_OPTIONS.map(h => ({ value: h, label: hourLabel(h) }))}
                  onChange={v => void update({ recap_hour: v })}
                />
              </span>
            }
          />
        )}

        {device === 'on' && (
          <ListRow
            leading={spacer}
            title={busy === 'test' ? 'Envoi…' : 'Envoyer un rappel de test'}
            tone="accent"
            onClick={sendTest}
            disabled={busy !== null}
          />
        )}
      </ListSection>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </div>
  )
}

/** Valeur en pastille grise ; le vrai `<select>` est posé dessus, transparent (sélecteur natif du téléphone). */
function SelectPill({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: number
  options: { value: number; label: string }[]
  onChange: (value: number) => void
}) {
  return (
    <label className="relative flex h-[34px] shrink-0 items-center gap-1 rounded-lg bg-fill-soft pl-2.5 pr-2 text-body">
      {options.find(o => o.value === value)?.label ?? ''}
      <ChevronsUpDown size={14} className="text-ink-muted" aria-hidden="true" />
      <select
        aria-label={label}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

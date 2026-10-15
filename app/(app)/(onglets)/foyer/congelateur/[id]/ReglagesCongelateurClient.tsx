'use client'

import { useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, LoaderCircle, Minus, Printer, QrCode } from 'lucide-react'
import { MAX_COMPARTMENTS, type Freezer } from '@/lib/types'
import { plural } from '@/lib/utils'
import { useHouseholdData } from '@/components/household/HouseholdData'
import PageHeader from '@/components/ui/PageHeader'
import Notice from '@/components/ui/Notice'
import { buttonClass } from '@/components/ui/Button'
import Stepper from '@/components/ui/Stepper'
import { FieldRow } from '@/components/ui/FieldGroup'
import { IconTile, ListRow, ListSection } from '@/components/ui/List'
import { glassButton } from '@/components/ui/glass'

/** Entrée valide le champ, comme « OK » sur le clavier. */
function blurOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.currentTarget.blur()
}

/**
 * Réglages d'un congélateur : son nom (la pièce où il est : « Garage »), le
 * nombre et le nom de ses tiroirs, l'impression de leurs QR. Chaque changement
 * est enregistré aussitôt, comme dans Réglages d'iOS ; une suppression se
 * rattrape par « Annuler ».
 */
export default function ReglagesCongelateurClient({ id, created }: { id: string; created: boolean }) {
  const router = useRouter()
  const data = useHouseholdData()
  // Nom en cours de saisie (null : celui du congélateur)
  const [name, setName] = useState<string | null>(null)
  const [drawerNames, setDrawerNames] = useState<Record<string, string>>({})
  // Tiroirs ajoutés pendant cette visite : leur QR reste à imprimer
  const [added, setAdded] = useState<string[]>([])
  // Congélateur supprimé : on le garde affiché le temps de revenir au foyer
  const [removed, setRemoved] = useState<Freezer | null>(null)

  const freezer = data.freezers.find(f => f.id === id) ?? removed

  const back = (
    <Link href="/foyer" aria-label="Retour au foyer" className={glassButton('round', 'text-accent')}>
      <ChevronLeft size={24} strokeWidth={2.4} aria-hidden="true" />
    </Link>
  )

  if (data.status === 'loading') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader leading={back} title="Congélateur" />
        <div className="flex justify-center py-10 text-ink-muted">
          <LoaderCircle size={24} className="animate-spin" aria-label="Chargement" />
        </div>
      </div>
    )
  }

  if (!freezer) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader leading={back} title="Congélateur introuvable" />
        <Notice tone={data.status === 'error' ? 'danger' : 'warn'}>
          {data.status === 'error'
            ? 'Impossible de charger ce congélateur. Vérifiez votre connexion.'
            : 'Ce congélateur n’existe plus, ou il appartient à un autre foyer.'}
        </Notice>
      </div>
    )
  }

  const drawers = freezer.compartments
  const inStock = (compartmentId: string | null) =>
    data.items.filter(i => i.freezer_id === freezer.id && i.compartment_id === compartmentId && i.quantity > 0).length
  const stock = data.items.filter(i => i.freezer_id === freezer.id && i.quantity > 0).length
  const loose = inStock(null)
  const fresh = added.filter(drawerId => drawers.some(c => c.id === drawerId))

  const labelsHref = (filter: Record<string, string>) =>
    `/etiquettes?${new URLSearchParams({ ...filter, retour: `/foyer/congelateur/${freezer.id}` })}`

  const saveName = () => {
    if (name === null) return
    void data.renameFreezer(freezer.id, name)
    setName(null)
  }

  const saveDrawerName = (drawerId: string) => {
    const draft = drawerNames[drawerId]
    if (draft === undefined) return
    void data.renameCompartment(drawerId, draft)
    setDrawerNames(prev => {
      const next = { ...prev }
      delete next[drawerId]
      return next
    })
  }

  const setDrawerCount = (next: number) => {
    if (next > drawers.length) {
      void data.addCompartment(freezer.id).then(newId => {
        if (newId) setAdded(prev => [...prev, newId])
      })
    } else {
      const last = drawers.at(-1)
      if (last) void data.deleteCompartment(last)
    }
  }

  const lastFreezer = data.freezers.length <= 1
  const canDelete = !removed && !lastFreezer && stock === 0
  const deleteFreezer = () => {
    setRemoved(freezer)
    router.replace('/foyer')
    void data.deleteFreezer(freezer)
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        leading={back}
        title={freezer.name}
        subtitle={`${drawers.length === 0 ? 'Sans tiroir' : plural(drawers.length, 'tiroir')} · ${stock === 0 ? 'vide' : plural(stock, 'produit')}`}
      />

      {created && (
        <div className="flex flex-col gap-3">
          <Notice tone="success">
            Congélateur créé. Imprimez les QR de ses tiroirs et collez chacun sur son tiroir : scanné depuis l’appli,
            il ouvre ce tiroir.
          </Notice>
          {drawers.length > 0 && (
            <Link href={labelsHref({ congelateur: freezer.id })} className={buttonClass('primary')}>
              <Printer size={20} aria-hidden="true" />
              Imprimer les QR
            </Link>
          )}
        </div>
      )}

      <ListSection
        header="Nom"
        footer={`Le nom de la pièce suffit : « Garage », « Cellier ».${data.freezers.length > 1 ? ' Il est imprimé sous les QR de ses tiroirs.' : ''}`}
      >
        <FieldRow
          label="Nom"
          value={name ?? freezer.name}
          onChange={e => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={blurOnEnter}
          maxLength={40}
          placeholder="Garage, cellier…"
          enterKeyHint="done"
        />
      </ListSection>

      <ListSection
        header="Tiroirs"
        footer={`Touchez un nom pour le changer : le QR déjà collé reste valable. Un tiroir supprimé laisse ses produits dans le congélateur, sans tiroir, et son QR ne marche plus.${loose > 0 ? ` Sans tiroir en ce moment : ${plural(loose, 'produit')}.` : ''}`}
      >
        <div className="flex min-h-[52px] items-center gap-3 px-4">
          <span className="flex-1 text-body">Nombre de tiroirs</span>
          <span className="min-w-6 text-right text-body tabular-nums text-ink-muted">{drawers.length}</span>
          <Stepper
            value={drawers.length}
            min={0}
            max={MAX_COMPARTMENTS}
            onChange={setDrawerCount}
            decreaseLabel="Supprimer le dernier tiroir"
            increaseLabel="Ajouter un tiroir"
          />
        </div>
        {drawers.map(c => {
          const count = inStock(c.id)
          return (
            <div key={c.id} className="flex items-center pl-1.5">
              {/* Le « − » rouge d'une liste en mode édition sur iOS */}
              <button
                type="button"
                onClick={() => void data.deleteCompartment(c)}
                aria-label={`Supprimer ${c.name}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center"
              >
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-danger-fill text-white">
                  <Minus size={14} strokeWidth={3.4} aria-hidden="true" />
                </span>
              </button>
              <span className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 border-t border-separator pr-4">
                <input
                  value={drawerNames[c.id] ?? c.name}
                  onChange={e => setDrawerNames(prev => ({ ...prev, [c.id]: e.target.value }))}
                  onBlur={() => saveDrawerName(c.id)}
                  onKeyDown={blurOnEnter}
                  maxLength={40}
                  aria-label={`Nom de ${c.name}`}
                  enterKeyHint="done"
                  className="h-[52px] min-w-0 flex-1 bg-transparent text-body text-ink outline-none"
                />
                <span className="shrink-0 text-footnote text-ink-muted">
                  {count === 0 ? 'vide' : plural(count, 'produit')}
                </span>
              </span>
            </div>
          )
        })}
      </ListSection>

      {drawers.length > 0 && (
        <ListSection
          header="Étiquettes QR"
          footer="Un nouveau tiroir a besoin de sa propre étiquette."
        >
          <ListRow
            href={labelsHref({ congelateur: freezer.id })}
            leading={
              <IconTile className="bg-tile-ink">
                <QrCode size={18} aria-hidden="true" />
              </IconTile>
            }
            title="Imprimer tous les QR"
            subtitle={`${plural(drawers.length, 'étiquette')} sur une page A4`}
          />
          {fresh.length > 0 && fresh.length < drawers.length && (
            <ListRow
              href={labelsHref({ tiroirs: fresh.join(',') })}
              leading={
                <IconTile className="bg-tile-ink">
                  <QrCode size={18} aria-hidden="true" />
                </IconTile>
              }
              title={fresh.length === 1 ? 'Imprimer le QR du nouveau tiroir' : `Imprimer les QR des ${fresh.length} nouveaux tiroirs`}
              subtitle={drawers
                .filter(c => fresh.includes(c.id))
                .map(c => c.name)
                .join(', ')}
            />
          )}
        </ListSection>
      )}

      <ListSection
        footer={
          lastFreezer
            ? 'Le foyer garde au moins un congélateur.'
            : stock > 0
              ? `Videz-le d’abord : ses ${plural(stock, 'produit')} seraient supprimés avec lui.`
              : 'Les QR collés sur ses tiroirs ne marcheront plus.'
        }
      >
        <ListRow title="Supprimer ce congélateur" tone="danger" onClick={deleteFreezer} disabled={!canDelete} />
      </ListSection>
    </div>
  )
}

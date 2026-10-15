'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft } from 'lucide-react'
import { MAX_COMPARTMENTS } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useHouseholdData } from '@/components/household/HouseholdData'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Stepper from '@/components/ui/Stepper'
import { FieldGroup, FieldRow } from '@/components/ui/FieldGroup'
import { glassButton } from '@/components/ui/glass'

/** Pièces proposées pour nommer le congélateur en un toucher. */
const ROOMS = ['Cuisine', 'Garage', 'Cellier', 'Buanderie', 'Sous-sol', 'Cave']

/**
 * Un congélateur de plus, dans une autre pièce : son nom et son nombre de
 * tiroirs. Une fois créé, ses réglages s'ouvrent pour imprimer ses QR.
 */
export default function NouveauCongelateurClient() {
  const router = useRouter()
  const data = useHouseholdData()
  const [name, setName] = useState('')
  const [drawers, setDrawers] = useState(3)
  const [saving, setSaving] = useState(false)

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const id = await data.addFreezer(name, drawers)
    if (!id) {
      // L'erreur est dans le toast
      setSaving(false)
      return
    }
    router.replace(`/foyer/congelateur/${id}?nouveau=1`)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        leading={
          <Link href="/foyer" aria-label="Retour au foyer" className={glassButton('round', 'text-accent')}>
            <ChevronLeft size={24} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        }
        title="Nouveau congélateur"
        subtitle="Pour un congélateur dans une autre pièce, donnez-lui le nom de la pièce. Il sera imprimé sous les QR de ses tiroirs."
      />

      <form onSubmit={create} className="flex flex-col gap-4">
        <FieldGroup>
          <FieldRow
            label="Nom"
            required
            maxLength={40}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Garage, cellier…"
            enterKeyHint="done"
          />
        </FieldGroup>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Pièces">
          {ROOMS.map(room => {
            const active = name.trim() === room
            return (
              <button
                key={room}
                type="button"
                aria-pressed={active}
                onClick={() => setName(room)}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-subhead',
                  active ? 'border-accent-fill bg-accent-fill font-semibold text-white' : 'border-chip-edge bg-card text-ink',
                )}
              >
                {active && <Check size={15} strokeWidth={3} aria-hidden="true" />}
                {room}
              </button>
            )
          })}
        </div>

        <FieldGroup>
          <div className="flex min-h-[52px] items-center gap-3 px-4">
            <span className="flex-1 text-body">Tiroirs</span>
            <span className="min-w-6 text-right text-body tabular-nums text-ink-muted">{drawers}</span>
            <Stepper
              value={drawers}
              min={0}
              max={MAX_COMPARTMENTS}
              onChange={setDrawers}
              decreaseLabel="Un tiroir de moins"
              increaseLabel="Un tiroir de plus"
            />
          </div>
        </FieldGroup>
        <p className="mx-4 -mt-2 text-footnote text-ink-muted">
          Un QR par tiroir : vous pourrez imprimer leurs étiquettes juste après. Tout reste modifiable.
        </p>

        <Button type="submit" loading={saving} disabled={!name.trim() || data.status !== 'ready'}>
          Créer le congélateur
        </Button>
      </form>
    </div>
  )
}

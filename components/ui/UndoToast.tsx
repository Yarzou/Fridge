'use client'

import { useEffect } from 'react'
import { CircleAlert, Undo2 } from 'lucide-react'
import { useHouseholdData } from '@/components/household/HouseholdData'
import { GLASS } from '@/components/ui/glass'
import { cn } from '@/lib/utils'

/**
 * Toast « Annuler » au-dessus de la barre d'onglets : sortir un produit ne
 * demande jamais de confirmation, on peut revenir en arrière pendant 6 s.
 * En verre, comme l'encart « Ranger » des Courses qui prend la même place.
 */
export default function UndoToast() {
  const { toast, dismissToast } = useHouseholdData()

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(dismissToast, toast.undo ? 6000 : 4000)
    return () => clearTimeout(timer)
  }, [toast, dismissToast])

  return (
    <div role="status" aria-live="polite" className="bottom-toast pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4">
      {toast && (
        <div
          className={cn(
            'pointer-events-auto flex min-h-[52px] w-full max-w-md items-center gap-3 rounded-[26px] py-[3px] pl-4 pr-[3px] text-ink',
            GLASS,
          )}
        >
          {toast.tone === 'error' && <CircleAlert size={18} className="shrink-0 text-danger" aria-hidden="true" />}
          <span className="min-w-0 flex-1 py-2 text-subhead">{toast.text}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                toast.undo?.()
                dismissToast()
              }}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-3.5 text-subhead font-semibold text-accent"
            >
              <Undo2 size={16} strokeWidth={2.4} aria-hidden="true" />
              Annuler
            </button>
          )}
        </div>
      )}
    </div>
  )
}

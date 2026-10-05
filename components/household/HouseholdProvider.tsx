'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { ActiveHousehold } from '@/lib/types'

interface HouseholdContextValue {
  household: ActiveHousehold
  userId: string
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null)

/**
 * Foyer actif, lu une fois par le layout serveur de (app) et transmis aux pages
 * clientes : elles n'ont pas à refaire la requête d'appartenance.
 */
export function HouseholdProvider({ value, children }: { value: HouseholdContextValue; children: ReactNode }) {
  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export function useHousehold(): HouseholdContextValue {
  const value = useContext(HouseholdContext)
  if (!value) throw new Error('useHousehold() hors de <HouseholdProvider> (pages du groupe (app) uniquement)')
  return value
}

// Types partagés. Les noms de colonnes suivent liquibase/changelog/001-schema-initial.sql.

export type HouseholdRole = 'admin' | 'membre'

export const HOUSEHOLD_ROLE_LABELS: Record<HouseholdRole, string> = {
  admin: 'Administrateur',
  membre: 'Membre',
}

/** Le foyer affiché : le plus récemment rejoint (voir lib/household.ts). */
export interface ActiveHousehold {
  id: string
  name: string
  role: HouseholdRole
}

export interface HouseholdMember {
  user_id: string
  role: HouseholdRole
  joined_at: string
  display_name: string
}

export interface Compartment {
  id: string
  freezer_id: string
  name: string
  position: number
}

export interface Freezer {
  id: string
  name: string
  position: number
  compartments: Compartment[]
}

export interface Item {
  id: string
  household_id: string
  freezer_id: string
  compartment_id: string | null
  category_slug: string
  name: string
  quantity: number
  unit: string | null
  barcode: string | null
  image_url: string | null
  frozen_on: string
  best_before: string | null
  added_by: string | null
  created_at: string
  updated_at: string
}

export interface InvitationPreview {
  household_name: string
  invited_by: string | null
  expires_at: string
  is_valid: boolean
}

/** Article de la liste de courses (une seule liste par foyer). */
export interface ShoppingItem {
  id: string
  household_id: string
  name: string
  aisle_slug: string
  /** « ×2 », « 500 g »… */
  note: string | null
  checked: boolean
  checked_at: string | null
  /** Produit du congélateur dont c'est le rachat (« Fini au congélateur »). */
  from_item_id: string | null
  added_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Vocabulaire du foyer (household_aisle_terms) : le rayon d'un terme, et depuis
 * la migration 002 combien de fois il a été ajouté (« Souvent achetés »).
 */
export interface AisleTerm {
  term: string
  aisle_slug: string
  label: string | null
  times_added: number
  last_added_at: string | null
}

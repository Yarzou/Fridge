'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { PostgrestError, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { getCategory } from '@/lib/categories'
import { getAisle, normalizeTerm } from '@/lib/aisles'
import { addMonths, toIsoDate } from '@/lib/dates'
import { plural } from '@/lib/utils'
import {
  MAX_COMPARTMENTS,
  type AisleTerm,
  type Compartment,
  type Freezer,
  type HouseholdMember,
  type HouseholdRole,
  type Item,
  type ShoppingItem,
} from '@/lib/types'
import { useHousehold } from '@/components/household/HouseholdProvider'

/**
 * Les données du foyer, chargées une fois pour tous les écrans de (app) et
 * tenues à jour en direct : congélateurs et tiroirs, produits, liste de
 * courses, membres, vocabulaire des rayons.
 *
 * Toutes les actions sont optimistes (l'écran change avant la réponse du
 * réseau) et passent par un toast « Annuler » plutôt que par une confirmation.
 * Une erreur réseau remet l'état d'avant et le dit.
 *
 * Realtime : `items` et `shopping_items` sont publiées (migration 001). Les
 * suppressions ne sont pas filtrables par foyer côté Supabase : on les écoute
 * sans filtre et on ignore les id inconnus. Au retour au premier plan (téléphone
 * resorti de la poche, websocket coupée), tout est relu.
 */

const ITEM_COLUMNS =
  'id, household_id, freezer_id, compartment_id, category_slug, name, quantity, unit, barcode, image_url, frozen_on, best_before, added_by, created_at, updated_at'
const SHOPPING_COLUMNS =
  'id, household_id, name, aisle_slug, note, checked, checked_at, from_item_id, added_by, created_at, updated_at'
const COMPARTMENT_COLUMNS = 'id, freezer_id, name, position'

/** Produits sortis en entier gardés en mémoire : « dernier sorti », code-barres déjà vu. */
const FINISHED_WINDOW_DAYS = 30

const NETWORK_ERROR = 'Pas de connexion : la modification n’a pas été enregistrée.'

export interface Toast {
  id: number
  text: string
  undo?: () => void
  tone?: 'error'
}

/** Ce qu'il faut pour ranger un produit. */
export interface ItemInput {
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
}

export interface ShoppingInput {
  name: string
  note?: string | null
  aisle_slug: string
  from_item_id?: string | null
}

interface MemberRow {
  user_id: string
  role: HouseholdRole
  joined_at: string
  profiles: { display_name: string } | null
}

interface HouseholdDataValue {
  status: 'loading' | 'ready' | 'error'
  freezers: Freezer[]
  /** En stock, plus les produits finis depuis moins de 30 jours (quantity = 0). */
  items: Item[]
  shopping: ShoppingItem[]
  members: HouseholdMember[]
  /** Terme normalisé → rayon et fréquence (household_aisle_terms). */
  terms: Map<string, AisleTerm>
  /** Congélateur affiché dans l'onglet Congélateur (le premier par défaut). */
  freezer: Freezer | null
  selectFreezer: (id: string) => void
  /** Produits finis pendant cette visite : le tiroir propose de les racheter. */
  finished: Set<string>
  toast: Toast | null
  showToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: () => void
  reload: () => void

  takeOut: (item: Item, count?: number) => Promise<void>
  addItem: (input: ItemInput) => Promise<boolean>
  updateItem: (id: string, patch: Partial<ItemInput>) => Promise<boolean>
  deleteItem: (item: Item) => Promise<void>

  /** Nouveau congélateur, avec ses tiroirs « Tiroir 1 », « Tiroir 2 »… Renvoie son id. */
  addFreezer: (name: string, drawers: number) => Promise<string | null>
  renameFreezer: (id: string, name: string) => Promise<boolean>
  /** Supprime un congélateur, ses tiroirs et ses produits. « Annuler » remet tout, avec les mêmes id. */
  deleteFreezer: (freezer: Freezer) => Promise<boolean>
  /** Un tiroir de plus, en dernier. Renvoie son id. */
  addCompartment: (freezerId: string) => Promise<string | null>
  renameCompartment: (id: string, name: string) => Promise<boolean>
  /** Ses produits restent dans le congélateur, sans tiroir. « Annuler » les y remet. */
  deleteCompartment: (compartment: Compartment) => Promise<void>

  /**
   * Optimiste : l'article s'affiche avant la réponse du réseau. `undoable` : toast
   * « Ajouté : … · Annuler » (panneau « Déjà achetés »).
   */
  addShopping: (input: ShoppingInput, options?: { undoable?: boolean }) => Promise<ShoppingItem | null>
  toggleShopping: (item: ShoppingItem) => Promise<void>
  updateShopping: (item: ShoppingItem, patch: Partial<Pick<ShoppingItem, 'name' | 'note' | 'aisle_slug'>>) => Promise<boolean>
  removeShopping: (ids: string[]) => Promise<void>
  storeFrozen: (ids: string[]) => Promise<void>
  /** Retire un terme de « Déjà achetés » (une faute retenue), rayon retenu compris. « Annuler » le remet. */
  forgetTerm: (term: AisleTerm) => Promise<void>
}

const HouseholdDataContext = createContext<HouseholdDataValue | null>(null)

function upsert<T extends { id: string }>(list: T[], row: T): T[] {
  const index = list.findIndex(x => x.id === row.id)
  if (index === -1) return [...list, row]
  const next = [...list]
  next[index] = row
  return next
}

function sortCompartments(list: Compartment[]): Compartment[] {
  return [...list].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
}

/** « ×3 » → 3 ; tout le reste → 1 (« 500 g » se range comme un produit). */
function countFromNote(note: string | null): number {
  const match = note?.match(/^×(\d+)$/)
  return match ? Math.min(Number(match[1]), 99) : 1
}

/**
 * Écrit un produit. Si la base ne connaît pas encore sa catégorie (migration
 * pas encore passée sur ce projet), réessaie dans celle d'avant (`fallback`).
 */
async function withKnownCategory<R extends { category_slug?: string }, T>(
  row: R,
  write: (row: R) => PromiseLike<{ data: T | null; error: PostgrestError | null }>,
) {
  const result = await write(row)
  const fallback = row.category_slug ? getCategory(row.category_slug).fallback : undefined
  const unknown = result.error?.code === '23503' && result.error.message.includes('category_slug')
  return fallback && unknown ? write({ ...row, category_slug: fallback }) : result
}

/**
 * Même chose pour le rayon d'un article de courses. Renvoie aussi la ligne
 * écrite, pour afficher l'article là où la base l'a vraiment rangé.
 */
async function withKnownAisle<R extends { aisle_slug?: string }, T>(
  row: R,
  write: (row: R) => PromiseLike<{ data: T | null; error: PostgrestError | null }>,
) {
  const result = await write(row)
  const fallback = row.aisle_slug ? getAisle(row.aisle_slug).fallback : undefined
  const unknown = result.error?.code === '23503' && result.error.message.includes('aisle_slug')
  if (!fallback || !unknown) return { ...result, row }
  const retry = { ...row, aisle_slug: fallback }
  return { ...(await write(retry)), row: retry }
}

export function HouseholdDataProvider({ children }: { children: ReactNode }) {
  const { household, userId } = useHousehold()
  const householdId = household.id
  const [supabase] = useState(() => createClient())

  const [status, setStatus] = useState<HouseholdDataValue['status']>('loading')
  const [freezers, setFreezers] = useState<Freezer[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [shopping, setShopping] = useState<ShoppingItem[]>([])
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [terms, setTerms] = useState<Map<string, AisleTerm>>(() => new Map())
  const [freezerId, setFreezerId] = useState<string | null>(null)
  const [finished, setFinished] = useState<Set<string>>(() => new Set())
  const [toast, setToast] = useState<Toast | null>(null)

  const load = useCallback(() => {
    const since = new Date(Date.now() - FINISHED_WINDOW_DAYS * 86_400_000).toISOString()
    // Colonnes de la migration 002 d'abord ; sans elle, le rayon seul.
    const loadTerms = async () => {
      const full = await supabase
        .from('household_aisle_terms')
        .select('term, aisle_slug, label, times_added, last_added_at')
        .eq('household_id', householdId)
      if (!full.error) return full.data as AisleTerm[]
      const basic = await supabase.from('household_aisle_terms').select('term, aisle_slug').eq('household_id', householdId)
      return ((basic.data ?? []) as Pick<AisleTerm, 'term' | 'aisle_slug'>[]).map(t => ({
        ...t,
        label: null,
        times_added: 0,
        last_added_at: null,
      }))
    }

    return Promise.all([
      supabase
        .from('freezers')
        .select('id, name, position, compartments ( id, freezer_id, name, position )')
        .eq('household_id', householdId)
        .order('position')
        .order('created_at'),
      supabase
        .from('items')
        .select(ITEM_COLUMNS)
        .eq('household_id', householdId)
        .or(`quantity.gt.0,updated_at.gte.${since}`)
        .order('created_at'),
      supabase.from('shopping_items').select(SHOPPING_COLUMNS).eq('household_id', householdId).order('created_at'),
      supabase
        .from('household_members')
        .select('user_id, role, joined_at, profiles ( display_name )')
        .eq('household_id', householdId)
        .order('joined_at'),
      loadTerms(),
    ]).then(([freezersRes, itemsRes, shoppingRes, membersRes, termRows]) => {
      const error = freezersRes.error ?? itemsRes.error ?? shoppingRes.error ?? membersRes.error
      if (error) {
        console.error('[foyer] chargement', error.code, error.message)
        setStatus(current => (current === 'ready' ? 'ready' : 'error'))
        return
      }
      setFreezers(
        (freezersRes.data as unknown as Freezer[]).map(f => ({ ...f, compartments: sortCompartments(f.compartments) })),
      )
      setItems(itemsRes.data as Item[])
      setShopping(shoppingRes.data as ShoppingItem[])
      setMembers(
        (membersRes.data as unknown as MemberRow[]).map(m => ({
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          display_name: m.profiles?.display_name ?? 'Membre',
        })),
      )
      setTerms(new Map(termRows.map(t => [t.term, t])))
      setStatus('ready')
    })
  }, [supabase, householdId])

  useEffect(() => {
    load()
  }, [load])

  // Retour au premier plan : la websocket a pu tomber pendant la veille.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  useEffect(() => {
    const filter = `household_id=eq.${householdId}`
    const onItem = (payload: RealtimePostgresChangesPayload<Item>) => {
      if (payload.eventType === 'DELETE') {
        const id = (payload.old as Partial<Item>).id
        if (id) setItems(prev => prev.filter(i => i.id !== id))
        return
      }
      const row = payload.new as Item
      if (row.household_id === householdId) setItems(prev => upsert(prev, row))
    }
    const onShopping = (payload: RealtimePostgresChangesPayload<ShoppingItem>) => {
      if (payload.eventType === 'DELETE') {
        const id = (payload.old as Partial<ShoppingItem>).id
        if (id) setShopping(prev => prev.filter(i => i.id !== id))
        return
      }
      const row = payload.new as ShoppingItem
      if (row.household_id === householdId) setShopping(prev => upsert(prev, row))
    }
    const channel = supabase
      .channel(`foyer-${householdId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'items', filter }, onItem)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'items', filter }, onItem)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'items' }, onItem)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shopping_items', filter }, onShopping)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shopping_items', filter }, onShopping)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'shopping_items' }, onShopping)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, householdId])

  const showToast = useCallback((next: Omit<Toast, 'id'>) => {
    setToast({ ...next, id: Date.now() })
  }, [])
  const dismissToast = useCallback(() => setToast(null), [])
  const showError = () => showToast({ text: NETWORK_ERROR, tone: 'error' })

  const patchItem = (id: string, patch: Partial<Item>) =>
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)))

  /** ±n en base (calcul côté serveur : deux membres ne s'écrasent pas). */
  const adjust = async (id: string, delta: number): Promise<boolean> => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, quantity: Math.max(i.quantity + delta, 0) } : i)))
    const { data, error } = await supabase.rpc('adjust_item_quantity', { p_item: id, p_delta: delta })
    if (error) {
      console.error('[foyer] quantité', error.code, error.message)
      setItems(prev => prev.map(i => (i.id === id ? { ...i, quantity: Math.max(i.quantity - delta, 0) } : i)))
      showError()
      return false
    }
    if (typeof data === 'number') patchItem(id, { quantity: data })
    return true
  }

  const takeOut = async (item: Item, count = 1) => {
    const n = Math.min(count, item.quantity)
    if (n <= 0) return
    const left = item.quantity - n
    if (left === 0) setFinished(prev => new Set(prev).add(item.id))
    showToast({
      text: left > 0 ? `${item.name} · il en reste ${left}` : `${item.name} · plus rien en stock`,
      undo: () => {
        void adjust(item.id, n)
      },
    })
    await adjust(item.id, -n)
  }

  const insertItemRow = async (row: Partial<Item>): Promise<Item | null> => {
    const { data, error } = await withKnownCategory(row, r => supabase.from('items').insert(r).select(ITEM_COLUMNS).single())
    if (error || !data) {
      console.error('[foyer] ajout', error?.code, error?.message)
      showError()
      return null
    }
    setItems(prev => upsert(prev, data as Item))
    return data as Item
  }

  const deleteItemRow = async (id: string): Promise<boolean> => {
    setItems(prev => prev.filter(i => i.id !== id))
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) {
      console.error('[foyer] suppression', error.code, error.message)
      showError()
      load()
      return false
    }
    return true
  }

  const addItem = async (input: ItemInput): Promise<boolean> => {
    const name = input.name.trim()
    // Même produit, même tiroir, même jour de congélation : on cumule.
    const twin = items.find(
      i =>
        i.quantity > 0 &&
        i.freezer_id === input.freezer_id &&
        i.compartment_id === input.compartment_id &&
        i.frozen_on === input.frozen_on &&
        (i.unit ?? null) === (input.unit ?? null) &&
        normalizeTerm(i.name) === normalizeTerm(name),
    )
    if (twin) {
      const ok = await adjust(twin.id, input.quantity)
      if (ok) {
        showToast({
          text: `${twin.name} · ${twin.quantity + input.quantity} en tout`,
          undo: () => {
            void adjust(twin.id, -input.quantity)
          },
        })
      }
      return ok
    }
    const created = await insertItemRow({ ...input, name, household_id: householdId, added_by: userId })
    if (!created) return false
    showToast({
      text: `Rangé : ${created.name}`,
      undo: () => {
        void deleteItemRow(created.id)
      },
    })
    return true
  }

  const updateItem = async (id: string, patch: Partial<ItemInput>): Promise<boolean> => {
    const before = items.find(i => i.id === id)
    patchItem(id, patch)
    const { data, error } = await withKnownCategory(patch, p =>
      supabase.from('items').update(p).eq('id', id).select(ITEM_COLUMNS).single(),
    )
    if (error || !data) {
      console.error('[foyer] modification', error?.code, error?.message)
      if (before) setItems(prev => upsert(prev, before))
      showError()
      return false
    }
    setItems(prev => upsert(prev, data as Item))
    return true
  }

  const deleteItem = async (item: Item) => {
    const ok = await deleteItemRow(item.id)
    if (!ok) return
    showToast({
      text: `Supprimé : ${item.name}`,
      undo: () => {
        void insertItemRow(item)
      },
    })
  }

  const patchFreezer = (id: string, change: (freezer: Freezer) => Freezer) =>
    setFreezers(prev => prev.map(f => (f.id === id ? change(f) : f)))

  const addFreezer = async (name: string, drawers: number): Promise<string | null> => {
    const trimmed = name.trim().slice(0, 40)
    if (!trimmed) return null
    const { data, error } = await supabase
      .from('freezers')
      .insert({ household_id: householdId, name: trimmed, position: Math.max(0, ...freezers.map(f => f.position)) + 1 })
      .select('id, name, position')
      .single()
    if (error || !data) {
      console.error('[foyer] congélateur', error?.code, error?.message)
      showError()
      return null
    }
    const count = Math.min(Math.max(Math.round(drawers), 0), MAX_COMPARTMENTS)
    let compartments: Compartment[] = []
    if (count > 0) {
      const rows = Array.from({ length: count }, (_, i) => ({
        freezer_id: data.id,
        household_id: householdId,
        name: `Tiroir ${i + 1}`,
        position: i + 1,
      }))
      const inserted = await supabase.from('compartments').insert(rows).select(COMPARTMENT_COLUMNS)
      if (inserted.error) {
        console.error('[foyer] tiroirs', inserted.error.code, inserted.error.message)
        // Pas de congélateur à moitié créé
        await supabase.from('freezers').delete().eq('id', data.id)
        showError()
        return null
      }
      compartments = sortCompartments(inserted.data as Compartment[])
    }
    setFreezers(prev => [...prev, { ...(data as Omit<Freezer, 'compartments'>), compartments }])
    return data.id as string
  }

  const renameFreezer = async (id: string, name: string): Promise<boolean> => {
    const trimmed = name.trim().slice(0, 40)
    const before = freezers.find(f => f.id === id)
    if (!trimmed || !before) return false
    if (trimmed === before.name) return true
    patchFreezer(id, f => ({ ...f, name: trimmed }))
    const { error } = await supabase.from('freezers').update({ name: trimmed }).eq('id', id)
    if (error) {
      console.error('[foyer] congélateur', error.code, error.message)
      patchFreezer(id, f => ({ ...f, name: before.name }))
      showError()
      return false
    }
    return true
  }

  /** Remet un congélateur supprimé avec ses id : les QR collés sur ses tiroirs remarchent. */
  const restoreFreezer = async (freezer: Freezer, rows: Item[]) => {
    const { compartments, ...row } = freezer
    const { error } = await supabase.from('freezers').insert({ ...row, household_id: householdId })
    const drawers =
      !error && compartments.length > 0
        ? await supabase.from('compartments').insert(compartments.map(c => ({ ...c, household_id: householdId })))
        : null
    const products = !error && !drawers?.error && rows.length > 0 ? await supabase.from('items').insert(rows) : null
    const failure = error ?? drawers?.error ?? products?.error
    if (failure) {
      console.error('[foyer] restauration du congélateur', failure.code, failure.message)
      showError()
      load()
      return
    }
    setFreezers(prev => [...prev.filter(f => f.id !== freezer.id), freezer].sort((a, b) => a.position - b.position))
    setItems(prev => rows.reduce((list, item) => upsert(list, item), prev))
  }

  const deleteFreezer = async (freezer: Freezer): Promise<boolean> => {
    if (freezers.length <= 1) return false
    // Produits finis compris : la base les supprime avec le congélateur
    const rows = items.filter(i => i.freezer_id === freezer.id)
    setFreezers(prev => prev.filter(f => f.id !== freezer.id))
    setItems(prev => prev.filter(i => i.freezer_id !== freezer.id))
    const { error } = await supabase.from('freezers').delete().eq('id', freezer.id)
    if (error) {
      console.error('[foyer] suppression du congélateur', error.code, error.message)
      setFreezers(prev => [...prev, freezer].sort((a, b) => a.position - b.position))
      setItems(prev => [...prev, ...rows])
      showError()
      return false
    }
    showToast({
      text: `Supprimé : ${freezer.name}`,
      undo: () => {
        void restoreFreezer(freezer, rows)
      },
    })
    return true
  }

  const addCompartment = async (freezerId: string): Promise<string | null> => {
    const freezer = freezers.find(f => f.id === freezerId)
    if (!freezer || freezer.compartments.length >= MAX_COMPARTMENTS) return null
    // « Tiroir 4 » après trois tiroirs, ou le numéro libre suivant
    const taken = new Set(freezer.compartments.map(c => c.name.toLocaleLowerCase('fr-FR')))
    let n = freezer.compartments.length + 1
    while (taken.has(`tiroir ${n}`)) n++
    // id tiré ici : le tiroir s'affiche avant la réponse du réseau
    const drawer: Compartment = {
      id: crypto.randomUUID(),
      freezer_id: freezerId,
      name: `Tiroir ${n}`,
      position: Math.max(0, ...freezer.compartments.map(c => c.position)) + 1,
    }
    patchFreezer(freezerId, f => ({ ...f, compartments: [...f.compartments, drawer] }))
    const { error } = await supabase.from('compartments').insert({ ...drawer, household_id: householdId })
    if (error) {
      console.error('[foyer] ajout du tiroir', error.code, error.message)
      patchFreezer(freezerId, f => ({ ...f, compartments: f.compartments.filter(c => c.id !== drawer.id) }))
      showError()
      return null
    }
    return drawer.id
  }

  const renameCompartment = async (id: string, name: string): Promise<boolean> => {
    const trimmed = name.trim().slice(0, 40)
    const before = freezers.flatMap(f => f.compartments).find(c => c.id === id)
    if (!trimmed || !before) return false
    if (trimmed === before.name) return true
    const rename = (to: string) =>
      patchFreezer(before.freezer_id, f => ({
        ...f,
        compartments: f.compartments.map(c => (c.id === id ? { ...c, name: to } : c)),
      }))
    rename(trimmed)
    const { error } = await supabase.from('compartments').update({ name: trimmed }).eq('id', id)
    if (error) {
      console.error('[foyer] tiroir', error.code, error.message)
      rename(before.name)
      showError()
      return false
    }
    return true
  }

  /** Remet un tiroir supprimé avec son id (son QR remarche) et y replace ses produits. */
  const restoreCompartment = async (drawer: Compartment, moved: string[]) => {
    const { error } = await supabase.from('compartments').insert({ ...drawer, household_id: householdId })
    // Seulement les produits restés sans tiroir : pas ceux rangés ailleurs entre-temps
    const products =
      !error && moved.length > 0
        ? await supabase.from('items').update({ compartment_id: drawer.id }).in('id', moved).is('compartment_id', null)
        : null
    const failure = error ?? products?.error
    if (failure) {
      console.error('[foyer] restauration du tiroir', failure.code, failure.message)
      showError()
      load()
      return
    }
    patchFreezer(drawer.freezer_id, f => ({
      ...f,
      compartments: sortCompartments([...f.compartments.filter(c => c.id !== drawer.id), drawer]),
    }))
    const ids = new Set(moved)
    setItems(prev => prev.map(i => (ids.has(i.id) && !i.compartment_id ? { ...i, compartment_id: drawer.id } : i)))
  }

  const deleteCompartment = async (drawer: Compartment) => {
    const inside = items.filter(i => i.compartment_id === drawer.id)
    const inStock = inside.filter(i => i.quantity > 0).length
    const moved = inside.map(i => i.id)
    const place = (compartmentId: string | null) => {
      const ids = new Set(moved)
      setItems(prev => prev.map(i => (ids.has(i.id) ? { ...i, compartment_id: compartmentId } : i)))
    }
    patchFreezer(drawer.freezer_id, f => ({ ...f, compartments: f.compartments.filter(c => c.id !== drawer.id) }))
    // La base fait de même (on delete set null)
    place(null)
    const { error } = await supabase.from('compartments').delete().eq('id', drawer.id)
    if (error) {
      console.error('[foyer] suppression du tiroir', error.code, error.message)
      patchFreezer(drawer.freezer_id, f => ({ ...f, compartments: sortCompartments([...f.compartments, drawer]) }))
      place(drawer.id)
      showError()
      return
    }
    showToast({
      text: inStock > 0 ? `Supprimé : ${drawer.name} · ${plural(inStock, 'produit')} sans tiroir` : `Supprimé : ${drawer.name}`,
      undo: () => {
        void restoreCompartment(drawer, moved)
      },
    })
  }

  /**
   * Retient le rayon d'un terme, et compte l'ajout s'il y en a un (« Souvent
   * achetés »). Sans la migration 002, seule la correction de rayon est gardée.
   */
  const noteTerm = async (name: string, aisle: string, added: boolean) => {
    const term = normalizeTerm(name)
    if (!term) return
    const label = name.trim().slice(0, 80)
    setTerms(prev => {
      const next = new Map(prev)
      const old = prev.get(term)
      next.set(term, {
        term,
        aisle_slug: aisle,
        label,
        times_added: (old?.times_added ?? 0) + (added ? 1 : 0),
        last_added_at: added ? new Date().toISOString() : (old?.last_added_at ?? null),
      })
      return next
    })
    const { error } = await supabase.rpc('note_shopping_term', {
      p_household: householdId,
      p_term: term,
      p_label: label,
      p_aisle: aisle,
      p_added: added,
    })
    if (!error) return
    if (!added) {
      await supabase
        .from('household_aisle_terms')
        .upsert({ household_id: householdId, term, aisle_slug: aisle, updated_at: new Date().toISOString() })
    }
  }

  const putTerm = (term: AisleTerm) => setTerms(prev => new Map(prev).set(term.term, term))
  const dropTerm = (key: string) =>
    setTerms(prev => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })

  const forgetTerm = async (term: AisleTerm) => {
    dropTerm(term.term)
    const { error } = await supabase
      .from('household_aisle_terms')
      .delete()
      .eq('household_id', householdId)
      .eq('term', term.term)
    if (error) {
      console.error('[courses] oubli du terme', error.code, error.message)
      putTerm(term)
      showError()
      return
    }
    showToast({
      text: `Oublié : ${term.label ?? term.term}`,
      undo: () => {
        void restoreTerm(term)
      },
    })
  }

  const restoreTerm = async (term: AisleTerm) => {
    putTerm(term)
    const { error } = await supabase.from('household_aisle_terms').upsert({
      household_id: householdId,
      term: term.term,
      aisle_slug: term.aisle_slug,
      label: term.label,
      times_added: term.times_added,
      last_added_at: term.last_added_at,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      console.error('[courses] terme remis', error.code, error.message)
      dropTerm(term.term)
      showError()
    }
  }

  const addShopping: HouseholdDataValue['addShopping'] = async (input, options = {}) => {
    const name = input.name.trim().slice(0, 80)
    if (!name) return null
    const existing = shopping.find(s => !s.checked && normalizeTerm(s.name) === normalizeTerm(name))
    if (existing) {
      if (options.undoable) showToast({ text: `Déjà sur la liste : ${existing.name}` })
      return existing
    }
    // id tiré ici : l'article s'affiche (et se coche dans « Déjà achetés ») avant la réponse du réseau
    const now = new Date().toISOString()
    const draft: ShoppingItem = {
      id: crypto.randomUUID(),
      household_id: householdId,
      name,
      note: input.note ?? null,
      aisle_slug: input.aisle_slug,
      checked: false,
      checked_at: null,
      from_item_id: input.from_item_id ?? null,
      added_by: userId,
      created_at: now,
      updated_at: now,
    }
    setShopping(prev => [...prev, draft])
    const { data, error } = await withKnownAisle(
      {
        id: draft.id,
        household_id: householdId,
        name,
        note: draft.note,
        aisle_slug: draft.aisle_slug,
        from_item_id: draft.from_item_id,
        added_by: userId,
      },
      insert => supabase.from('shopping_items').insert(insert).select(SHOPPING_COLUMNS).single(),
    )
    if (error || !data) {
      console.error('[courses] ajout', error?.code, error?.message)
      setShopping(prev => prev.filter(s => s.id !== draft.id))
      showError()
      return null
    }
    const row = data as ShoppingItem
    setShopping(prev => upsert(prev, row))
    void noteTerm(name, row.aisle_slug, true)
    if (options.undoable) {
      showToast({
        text: `Ajouté : ${name}`,
        undo: () => {
          void deleteShoppingRows([row])
        },
      })
    }
    return row
  }

  const toggleShopping = async (item: ShoppingItem) => {
    const checked = !item.checked
    const patch = { checked, checked_at: checked ? new Date().toISOString() : null }
    setShopping(prev => prev.map(s => (s.id === item.id ? { ...s, ...patch } : s)))
    const { error } = await supabase.from('shopping_items').update(patch).eq('id', item.id)
    if (error) {
      console.error('[courses] coche', error.code, error.message)
      setShopping(prev => prev.map(s => (s.id === item.id ? item : s)))
      showError()
    }
  }

  const updateShopping: HouseholdDataValue['updateShopping'] = async (item, patch) => {
    setShopping(prev => prev.map(s => (s.id === item.id ? { ...s, ...patch } : s)))
    const { error, row: written } = await withKnownAisle(patch, update =>
      supabase.from('shopping_items').update(update).eq('id', item.id),
    )
    if (error) {
      console.error('[courses] modification', error.code, error.message)
      setShopping(prev => prev.map(s => (s.id === item.id ? item : s)))
      showError()
      return false
    }
    if (written !== patch) setShopping(prev => prev.map(s => (s.id === item.id ? { ...s, ...written } : s)))
    if (written.aisle_slug && written.aisle_slug !== item.aisle_slug) {
      void noteTerm(written.name ?? item.name, written.aisle_slug, false)
    }
    return true
  }

  const deleteShoppingRows = async (rows: ShoppingItem[]): Promise<boolean> => {
    const ids = new Set(rows.map(r => r.id))
    setShopping(prev => prev.filter(s => !ids.has(s.id)))
    const { error } = await supabase.from('shopping_items').delete().in('id', [...ids])
    if (error) {
      console.error('[courses] suppression', error.code, error.message)
      showError()
      load()
      return false
    }
    return true
  }

  const restoreShoppingRows = async (rows: ShoppingItem[]) => {
    const { data, error } = await supabase.from('shopping_items').insert(rows).select(SHOPPING_COLUMNS)
    if (error) {
      console.error('[courses] restauration', error.code, error.message)
      showError()
      return
    }
    setShopping(prev => (data as ShoppingItem[]).reduce((list, row) => upsert(list, row), prev))
  }

  const removeShopping = async (ids: string[]) => {
    const rows = shopping.filter(s => ids.includes(s.id))
    if (rows.length === 0) return
    const ok = await deleteShoppingRows(rows)
    if (!ok) return
    showToast({
      text: rows.length === 1 ? `Retiré : ${rows[0].name}` : `${rows.length} articles retirés`,
      undo: () => {
        void restoreShoppingRows(rows)
      },
    })
  }

  /**
   * « Ranger » : les surgelés cochés passent au congélateur en un geste. Un
   * article racheté depuis le congélateur reprend sa fiche (catégorie, tiroir,
   * code-barres) ; les autres vont dans le congélateur affiché, sans tiroir.
   */
  const storeFrozen = async (ids: string[]) => {
    const rows = shopping.filter(s => ids.includes(s.id))
    const target = freezers.find(f => f.id === freezerId) ?? freezers[0]
    if (rows.length === 0 || !target) return
    const today = toIsoDate(new Date())

    const revived: { id: string; before: Item }[] = []
    const created: string[] = []
    for (const row of rows) {
      const count = countFromNote(row.note)
      const source = row.from_item_id ? items.find(i => i.id === row.from_item_id) : undefined
      const category = getCategory(source?.category_slug ?? 'autres')
      const fresh = { frozen_on: today, best_before: addMonths(today, category.months) }
      if (source && source.quantity === 0) {
        const { data, error } = await supabase
          .from('items')
          .update({ quantity: count, ...fresh })
          .eq('id', source.id)
          .select(ITEM_COLUMNS)
          .single()
        if (error || !data) continue
        setItems(prev => upsert(prev, data as Item))
        revived.push({ id: source.id, before: source })
      } else {
        const item = await insertItemRow({
          household_id: householdId,
          freezer_id: source?.freezer_id ?? target.id,
          compartment_id: source?.compartment_id ?? null,
          category_slug: category.slug,
          name: source?.name ?? row.name,
          quantity: count,
          unit: source?.unit ?? null,
          barcode: source?.barcode ?? null,
          image_url: source?.image_url ?? null,
          ...fresh,
          added_by: userId,
        })
        if (item) created.push(item.id)
      }
    }
    const stored = revived.length + created.length
    if (stored === 0) return
    await deleteShoppingRows(rows)
    showToast({
      text: stored === 1 ? '1 produit rangé au congélateur' : `${stored} produits rangés au congélateur`,
      undo: () => {
        void (async () => {
          for (const id of created) await deleteItemRow(id)
          for (const { id, before } of revived) {
            const { quantity, frozen_on, best_before } = before
            await supabase.from('items').update({ quantity, frozen_on, best_before }).eq('id', id)
            setItems(prev => upsert(prev, before))
          }
          await restoreShoppingRows(rows)
        })()
      },
    })
  }

  const freezer = freezers.find(f => f.id === freezerId) ?? freezers[0] ?? null

  const value: HouseholdDataValue = {
    status,
    freezers,
    items,
    shopping,
    members,
    terms,
    freezer,
    selectFreezer: setFreezerId,
    finished,
    toast,
    showToast,
    dismissToast,
    reload: load,
    takeOut,
    addItem,
    updateItem,
    deleteItem,
    addFreezer,
    renameFreezer,
    deleteFreezer,
    addCompartment,
    renameCompartment,
    deleteCompartment,
    addShopping,
    toggleShopping,
    updateShopping,
    removeShopping,
    storeFrozen,
    forgetTerm,
  }

  return <HouseholdDataContext.Provider value={value}>{children}</HouseholdDataContext.Provider>
}

export function useHouseholdData(): HouseholdDataValue {
  const value = useContext(HouseholdDataContext)
  if (!value) throw new Error('useHouseholdData() hors de <HouseholdDataProvider> (pages du groupe (app) uniquement)')
  return value
}

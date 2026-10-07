'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { PostgrestError, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { getCategory } from '@/lib/categories'
import { normalizeTerm } from '@/lib/aisles'
import { addMonths, toIsoDate } from '@/lib/dates'
import type { AisleTerm, Freezer, HouseholdMember, HouseholdRole, Item, ShoppingItem } from '@/lib/types'
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
  renameCompartment: (id: string, name: string) => Promise<boolean>

  addShopping: (input: ShoppingInput) => Promise<ShoppingItem | null>
  toggleShopping: (item: ShoppingItem) => Promise<void>
  updateShopping: (item: ShoppingItem, patch: Partial<Pick<ShoppingItem, 'name' | 'note' | 'aisle_slug'>>) => Promise<boolean>
  removeShopping: (ids: string[]) => Promise<void>
  storeFrozen: (ids: string[]) => Promise<void>
}

const HouseholdDataContext = createContext<HouseholdDataValue | null>(null)

function upsert<T extends { id: string }>(list: T[], row: T): T[] {
  const index = list.findIndex(x => x.id === row.id)
  if (index === -1) return [...list, row]
  const next = [...list]
  next[index] = row
  return next
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
        (freezersRes.data as unknown as Freezer[]).map(f => ({
          ...f,
          compartments: [...f.compartments].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
        })),
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

  const renameCompartment = async (id: string, name: string): Promise<boolean> => {
    const trimmed = name.trim().slice(0, 40)
    if (!trimmed) return false
    const { error } = await supabase.from('compartments').update({ name: trimmed }).eq('id', id)
    if (error) {
      console.error('[foyer] tiroir', error.code, error.message)
      showError()
      return false
    }
    setFreezers(prev =>
      prev.map(f => ({ ...f, compartments: f.compartments.map(c => (c.id === id ? { ...c, name: trimmed } : c)) })),
    )
    return true
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

  const addShopping = async (input: ShoppingInput): Promise<ShoppingItem | null> => {
    const name = input.name.trim().slice(0, 80)
    if (!name) return null
    const existing = shopping.find(s => !s.checked && normalizeTerm(s.name) === normalizeTerm(name))
    if (existing) return existing
    const { data, error } = await supabase
      .from('shopping_items')
      .insert({
        household_id: householdId,
        name,
        note: input.note ?? null,
        aisle_slug: input.aisle_slug,
        from_item_id: input.from_item_id ?? null,
        added_by: userId,
      })
      .select(SHOPPING_COLUMNS)
      .single()
    if (error || !data) {
      console.error('[courses] ajout', error?.code, error?.message)
      showError()
      return null
    }
    setShopping(prev => upsert(prev, data as ShoppingItem))
    void noteTerm(name, input.aisle_slug, true)
    return data as ShoppingItem
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
    const { error } = await supabase.from('shopping_items').update(patch).eq('id', item.id)
    if (error) {
      console.error('[courses] modification', error.code, error.message)
      setShopping(prev => prev.map(s => (s.id === item.id ? item : s)))
      showError()
      return false
    }
    if (patch.aisle_slug && patch.aisle_slug !== item.aisle_slug) {
      void noteTerm(patch.name ?? item.name, patch.aisle_slug, false)
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
    renameCompartment,
    addShopping,
    toggleShopping,
    updateShopping,
    removeShopping,
    storeFrozen,
  }

  return <HouseholdDataContext.Provider value={value}>{children}</HouseholdDataContext.Provider>
}

export function useHouseholdData(): HouseholdDataValue {
  const value = useContext(HouseholdDataContext)
  if (!value) throw new Error('useHouseholdData() hors de <HouseholdDataProvider> (pages du groupe (app) uniquement)')
  return value
}

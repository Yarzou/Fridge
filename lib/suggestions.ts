import { normalizeTerm } from '@/lib/aisles'
import type { AisleTerm } from '@/lib/types'

/**
 * « Déjà achetés » : retrouver un article du vocabulaire du foyer
 * (household_aisle_terms) pendant la saisie, sans réseau. Fonctions pures.
 */

/** Terme dont on connaît le libellé tel qu'il a été tapé (migration 002). */
export type LabelledTerm = AisleTerm & { label: string }

export function hasLabel(term: AisleTerm): term is LabelledTerm {
  return !!term.label
}

/** Un terme retrouvé, découpé pour mettre en gras ce qui correspond à la saisie. */
export interface TermMatch {
  term: LabelledTerm
  before: string
  hit: string
  after: string
}

/** À partir de 5 lettres, une faute de frappe est tolérée (« cacahete »). */
const FUZZY_FROM = 5

/** Les plus ajoutés d'abord, puis les plus récents, puis l'ordre alphabétique. */
export function byUse(a: AisleTerm, b: AisleTerm): number {
  return (
    b.times_added - a.times_added ||
    (b.last_added_at ?? '').localeCompare(a.last_added_at ?? '') ||
    (a.label ?? a.term).localeCompare(b.label ?? b.term, 'fr')
  )
}

/**
 * normalizeTerm() lettre par lettre : le texte normalisé, et pour chacune de
 * ses lettres sa place dans le libellé d'origine (« Œufs » → « oeufs » : o et
 * e viennent tous deux de Œ).
 */
function fold(label: string): { text: string; from: number[]; to: number[] } {
  let text = ''
  const from: number[] = []
  const to: number[] = []
  let index = 0
  for (const char of label) {
    for (const letter of normalizeTerm(char) || ' ') {
      if (letter === ' ' && (text === '' || text.endsWith(' '))) continue
      text += letter
      from.push(index)
      to.push(index + char.length)
    }
    index += char.length
  }
  return { text, from, to }
}

/** Distance d'édition (Levenshtein) : 1 = une lettre en trop, en moins ou changée. */
function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    previous = current
  }
  return previous[b.length]
}

/**
 * Où la saisie (déjà normalisée) se trouve dans le libellé : au début de
 * n'importe quel mot (« cac » → « Beurre de cacahuète »), sinon à une faute
 * près dès 5 lettres.
 */
function locate(label: string, query: string): { start: number; end: number; exact: boolean } | null {
  const { text, from, to } = fold(label)
  const starts: number[] = []
  for (let k = 0; k < text.length; k++) {
    if (text[k] !== ' ' && (k === 0 || text[k - 1] === ' ')) starts.push(k)
  }
  const span = (k: number, length: number, exact: boolean) => ({ start: from[k], end: to[k + length - 1], exact })

  const prefix = starts.find(k => text.startsWith(query, k))
  if (prefix !== undefined) return span(prefix, query.length, true)
  if (query.length < FUZZY_FROM) return null
  for (const k of starts) {
    for (const length of [query.length, query.length - 1, query.length + 1]) {
      if (k + length <= text.length && distance(query, text.slice(k, k + length)) <= 1) return span(k, length, false)
    }
  }
  return null
}

/**
 * Les termes du foyer qui correspondent à la saisie : sans fautes d'abord,
 * puis les plus achetés.
 */
export function searchTerms(terms: LabelledTerm[], query: string, limit = 8): TermMatch[] {
  const q = normalizeTerm(query)
  if (!q) return []
  const found: { term: LabelledTerm; at: { start: number; end: number; exact: boolean } }[] = []
  for (const term of terms) {
    const at = locate(term.label, q)
    if (at) found.push({ term, at })
  }
  return found
    .sort((a, b) => Number(b.at.exact) - Number(a.at.exact) || byUse(a.term, b.term))
    .slice(0, limit)
    .map(({ term, at }) => ({
      term,
      before: term.label.slice(0, at.start),
      hit: term.label.slice(at.start, at.end),
      after: term.label.slice(at.end),
    }))
}

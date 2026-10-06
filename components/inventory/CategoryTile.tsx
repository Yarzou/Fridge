import { Clock, TriangleAlert } from 'lucide-react'
import { getCategory } from '@/lib/categories'
import type { Due } from '@/lib/dates'
import { cn } from '@/lib/utils'

const SIZES = {
  sm: { box: 'h-7 w-7 rounded-lg', icon: 18 },
  md: { box: 'h-8 w-8 rounded-[9px]', icon: 19 },
  lg: { box: 'h-[34px] w-[34px] rounded-[9px]', icon: 20 },
  xl: { box: 'h-14 w-14 rounded-[14px]', icon: 28 },
  xxl: { box: 'h-16 w-16 rounded-xl', icon: 30 },
} as const

/**
 * Tuile d'icône d'une catégorie : pleine (icône blanche) dans les listes,
 * claire (`soft`, icône colorée) pour la vignette d'un produit sans photo.
 */
export function CategoryTile({
  slug,
  size = 'lg',
  soft = false,
  className,
}: {
  slug: string
  size?: keyof typeof SIZES
  soft?: boolean
  className?: string
}) {
  const category = getCategory(slug)
  const Icon = category.icon
  const { box, icon } = SIZES[size]
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center',
        box,
        soft ? category.soft : cn(category.tile, 'text-white'),
        className,
      )}
    >
      <Icon size={icon} strokeWidth={soft ? 1.8 : 2} aria-hidden="true" />
    </span>
  )
}

/**
 * Pastille de date : « Dépassé de 5 j » en rouge plein, « Dans 9 jours » en
 * orange clair. Jamais la seule teinte : toujours un texte et une icône.
 */
export function DueBadge({ due, className }: { due: Due; className?: string }) {
  if (due.status !== 'late' && due.status !== 'soon') return null
  const late = due.status === 'late'
  const Icon = late ? TriangleAlert : Clock
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 self-start rounded-[7px] px-2 py-[3px] text-[12px] font-semibold leading-4',
        late ? 'bg-danger-fill text-white' : 'bg-warn-soft text-warn',
        className,
      )}
    >
      <Icon size={12} strokeWidth={2.6} aria-hidden="true" />
      {due.label}
    </span>
  )
}

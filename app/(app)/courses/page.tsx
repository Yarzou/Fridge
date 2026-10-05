import { ShoppingCart } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'

/** Onglet Courses : la liste par rayon arrive avec le lot « courses ». */
export default function CoursesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Courses" subtitle="Partagée avec le foyer" />
      <div className="flex flex-col items-center gap-2 rounded-xl bg-card px-5 py-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <ShoppingCart size={24} aria-hidden="true" />
        </span>
        <p className="text-body font-semibold">La liste est vide</p>
        <p className="text-subhead text-ink-muted">
          Les articles se rangeront par rayon, dans l’ordre du magasin, surgelés en dernier.
        </p>
      </div>
    </div>
  )
}

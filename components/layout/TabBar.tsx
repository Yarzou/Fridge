'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, ShoppingCart, Snowflake, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Tab {
  href: string
  label: string
  icon: LucideIcon
  /** Autres préfixes d'URL qui allument l'onglet (un tiroir est dans « Congélateur »). */
  also?: string[]
}

const TABS: Tab[] = [
  { href: '/congelateur', label: 'Congélateur', icon: Snowflake, also: ['/tiroir/'] },
  { href: '/courses', label: 'Courses', icon: ShoppingCart },
  { href: '/foyer', label: 'Foyer', icon: House },
]

/**
 * Barre d'onglets flottante, en verre dépoli (maquette « Congélateur »).
 * Le bouton Scanner, rond et séparé, la rejoindra à droite avec le lot scanner.
 */
export default function TabBar() {
  const pathname = usePathname()

  return (
    <nav aria-label="Navigation principale" className="bottom-tabbar fixed inset-x-0 z-40 flex justify-center px-4">
      <div className="grid h-[62px] w-full max-w-md grid-cols-3 rounded-full border border-glass-edge bg-glass p-1 shadow-float backdrop-blur-xl">
        {TABS.map(({ href, label, icon: Icon, also }) => {
          const active = pathname.startsWith(href) || (also ?? []).some(p => pathname.startsWith(p))
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 rounded-full text-caption font-semibold',
                active ? 'bg-accent-soft text-accent' : 'text-ink-muted',
              )}
            >
              <Icon size={24} strokeWidth={2} aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

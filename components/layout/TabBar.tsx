'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, ScanLine, ShoppingCart, Snowflake, type LucideIcon } from 'lucide-react'
import { useHouseholdData } from '@/components/household/HouseholdData'
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
 * Barre d'onglets flottante en verre dépoli, et à sa droite le bouton rond du
 * scanner (maquette « Congélateur »). L'onglet Courses porte le nombre
 * d'articles qui restent à acheter.
 */
export default function TabBar() {
  const pathname = usePathname()
  const { shopping } = useHouseholdData()
  const toBuy = shopping.filter(s => !s.checked).length

  return (
    <nav aria-label="Navigation principale" className="bottom-tabbar fixed inset-x-0 z-40 flex justify-center px-4">
      <div className="flex w-full max-w-md items-center gap-2.5">
        <div className="grid h-[62px] flex-1 grid-cols-3 rounded-full border border-glass-edge bg-glass p-1 shadow-float backdrop-blur-xl">
          {TABS.map(({ href, label, icon: Icon, also }) => {
            const active = pathname.startsWith(href) || (also ?? []).some(p => pathname.startsWith(p))
            const badge = href === '/courses' && toBuy > 0 ? toBuy : 0
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 rounded-full text-caption font-semibold',
                  active ? 'bg-accent-soft text-accent' : 'text-ink-muted',
                )}
              >
                <Icon size={24} strokeWidth={2} aria-hidden="true" />
                {label}
                {badge > 0 && (
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute right-[18px] top-[3px] h-[18px] min-w-[18px] rounded-full border-2 border-card bg-badge px-[5px] text-center text-[11px] font-bold leading-[14px] text-white"
                    >
                      {badge > 99 ? '99+' : badge}
                    </span>
                    <span className="sr-only">, {badge} à acheter</span>
                  </>
                )}
              </Link>
            )
          })}
        </div>
        <Link
          href="/scanner"
          aria-label="Scanner"
          className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full bg-accent-fill text-white shadow-float"
        >
          <ScanLine size={26} strokeWidth={2.2} aria-hidden="true" />
        </Link>
      </div>
    </nav>
  )
}

import type { ReactNode } from 'react'
import { Snowflake } from 'lucide-react'

/** Écran plein des parcours de connexion : tuile d'appli, titre, contenu centré. */
export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-accent-fill text-white">
          <Snowflake size={38} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <h1 className="text-large-title">{title}</h1>
        {subtitle && <p className="mt-1 text-subhead text-ink-muted">{subtitle}</p>}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </main>
  )
}

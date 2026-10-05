import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'danger' | 'warn' | 'success' | 'info'

const TONES: Record<Tone, string> = {
  danger: 'bg-danger-soft text-danger',
  warn: 'bg-warn-soft text-warn',
  success: 'bg-accent-soft text-accent',
  info: 'bg-accent-soft text-accent',
}

/** Message dans un encart teinté. Toujours une icône en plus de la couleur. */
export default function Notice({ tone = 'info', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const Icon = tone === 'success' ? CircleCheck : tone === 'info' ? Info : CircleAlert
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-2 rounded-xl px-3.5 py-3 text-subhead', TONES[tone], className)}>
      <Icon size={18} className="mt-px shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

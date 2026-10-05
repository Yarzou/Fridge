import type { ButtonHTMLAttributes } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'plain'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-fill text-white',
  secondary: 'bg-accent-soft text-accent',
  plain: 'bg-transparent text-accent',
}

/** Classes d'un grand bouton (52 px), réutilisables sur un `<Link>`. */
export function buttonClass(variant: Variant = 'primary', className?: string) {
  return cn(
    'flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] px-4 text-body font-semibold transition-opacity disabled:opacity-60',
    VARIANTS[variant],
    className,
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

export default function Button({ variant = 'primary', loading, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button {...props} disabled={disabled || loading} className={buttonClass(variant, className)}>
      {loading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

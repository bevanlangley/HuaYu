import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InlineErrorProps {
  message: string
  className?: string
}

export function InlineError({ message, className }: InlineErrorProps) {
  return (
    <div
      role="alert"
      className={cn('flex items-center gap-2 rounded-md bg-error-bg px-3 py-2 text-sm text-error-text dark:bg-error-bg-dark dark:text-error-text-dark', className)}
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

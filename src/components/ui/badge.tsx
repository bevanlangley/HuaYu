import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        tag: 'bg-secondary-100 text-secondary-500',
        count: 'bg-grey-100 text-grey-600 dark:bg-grey-700 dark:text-grey-300',
        success: 'bg-success-bg text-success-text dark:bg-success-bg-dark dark:text-success-text-dark',
        warning: 'bg-warning-bg text-warning-text dark:bg-warning-bg-dark dark:text-warning-text-dark',
        error: 'bg-error-bg text-error-text dark:bg-error-bg-dark dark:text-error-text-dark',
        info: 'bg-info-bg text-info-text dark:bg-info-bg-dark dark:text-info-text-dark',
        'qa-answer': 'bg-qa-answer-bg text-qa-answer-text',
      },
    },
    defaultVariants: {
      variant: 'count',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }

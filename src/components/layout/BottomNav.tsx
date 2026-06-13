import { NavLink } from 'react-router-dom'
import { BookOpen, BrainCircuit, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/seeds', icon: BookOpen, label: 'Seeds' },
  { to: '/drill', icon: Zap, label: 'Drill' },
  { to: '/recall', icon: BrainCircuit, label: 'Recall' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 border-t border-grey-200 bg-white dark:border-grey-700 dark:bg-grey-800 md:hidden">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50',
              isActive
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-grey-500 hover:text-grey-700 dark:text-grey-400 dark:hover:text-grey-200'
            )
          }
        >
          <Icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

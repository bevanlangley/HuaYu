import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/recall/translate', label: 'Translate' },
  { to: '/recall/qa', label: 'Q&A' },
]

export function RecallTabs() {
  return (
    <nav aria-label="Recall sections" className="border-b border-grey-200 dark:border-grey-700">
      <div className="max-w-2xl mx-auto px-4 flex gap-6">
        {tabs.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'py-3 -mb-px border-b-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50',
                isActive
                  ? 'border-primary-500 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                  : 'border-transparent text-grey-500 hover:text-grey-700 dark:text-grey-400 dark:hover:text-grey-200'
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

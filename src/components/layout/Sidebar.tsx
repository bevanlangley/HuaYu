import { NavLink } from 'react-router-dom'
import { BookOpen, Library, Zap, Moon, Sun, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/context/AuthContext'

const navItems = [
  { to: '/seeds', icon: BookOpen, label: 'Seeds' },
  { to: '/phrases', icon: Library, label: 'Phrases' },
  { to: '/drill', icon: Zap, label: 'Drill' },
]

export function Sidebar() {
  const { theme, toggleTheme } = useTheme()
  const { signOut } = useAuth()

  return (
    <aside className="hidden w-56 flex-col border-r border-grey-200 bg-white dark:border-grey-700 dark:bg-grey-800 md:flex">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-grey-200 px-4 dark:border-grey-700">
        <span className="text-lg font-medium text-grey-800 dark:text-grey-100">
          花語 HuaYu
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50',
                isActive
                  ? 'bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400'
                  : 'text-grey-600 hover:bg-grey-100 hover:text-grey-800 dark:text-grey-400 dark:hover:bg-grey-700 dark:hover:text-grey-200'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Theme toggle */}
      <div className="border-t border-grey-200 p-2 dark:border-grey-700">
        <button
          type="button"
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          onClick={toggleTheme}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            'text-grey-600 hover:bg-grey-100 hover:text-grey-800 dark:text-grey-400 dark:hover:bg-grey-700 dark:hover:text-grey-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50'
          )}
        >
          {theme === 'light' ? (
            <Moon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          ) : (
            <Sun className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          )}
          {theme === 'light' ? 'Dark mode' : 'Light mode'}
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            'text-grey-600 hover:bg-grey-100 hover:text-grey-800 dark:text-grey-400 dark:hover:bg-grey-700 dark:hover:text-grey-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </aside>
  )
}

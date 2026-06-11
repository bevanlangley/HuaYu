import { Moon, Sun, LogOut } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

interface HeaderProps {
  title: string
  actions?: React.ReactNode
}

export function Header({ title, actions }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const { signOut } = useAuth()

  return (
    <header className="flex h-14 items-center justify-between border-b border-grey-200 bg-white px-4 dark:border-grey-700 dark:bg-grey-800 md:hidden">
      <span className="min-w-0 flex-1 truncate text-base font-medium text-grey-800 dark:text-grey-100">{title}</span>
      <div className="flex items-center gap-2">
        {actions}
        <button
          type="button"
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          onClick={toggleTheme}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
            'text-grey-500 hover:bg-grey-100 hover:text-grey-700 dark:text-grey-400 dark:hover:bg-grey-700 dark:hover:text-grey-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50'
          )}
        >
          {theme === 'light' ? (
            <Moon className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <Sun className="h-4 w-4" strokeWidth={1.5} />
          )}
        </button>
        <button
          type="button"
          aria-label="Sign out"
          onClick={() => void signOut()}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
            'text-grey-500 hover:bg-grey-100 hover:text-grey-700 dark:text-grey-400 dark:hover:bg-grey-700 dark:hover:text-grey-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50'
          )}
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </header>
  )
}

import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-2 bg-warning-bg px-4 py-2 text-sm text-warning-text dark:bg-warning-bg-dark dark:text-warning-text-dark"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You&apos;re offline. Changes will not be saved until you reconnect.</span>
    </div>
  )
}

import React from 'react'
import { useAuth } from '@/context/AuthContext'
import { LoginPage } from '@/features/auth/LoginPage'
import { Spinner } from '@/components/ui/Spinner'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-grey-50 dark:bg-grey-900">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!session) return <LoginPage />

  return <>{children}</>
}

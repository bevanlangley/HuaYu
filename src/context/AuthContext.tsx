import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    logger.info('Checking auth session')
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      logger.info('Auth session resolved', { authenticated: data.session !== null })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    logger.info('Signing in', { email })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      logger.error('Sign-in failed', error)
      return { error: 'Invalid email or password.' }
    }
    logger.info('Signed in')
    return { error: null }
  }

  async function signOut(): Promise<void> {
    logger.info('Signing out')
    const { error } = await supabase.auth.signOut()
    if (error) logger.error('Sign-out failed', error)
  }

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

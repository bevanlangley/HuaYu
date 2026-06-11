import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { AuthProvider, useAuth } from './AuthContext'

const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockSignInWithPassword = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}))

const fakeSession = { user: { id: 'user-1', email: 'me@example.com' } } as Session

function Probe() {
  const { session, loading } = useAuth()
  if (loading) return <div>probe-loading</div>
  return <div>{session ? `probe-user:${session.user.email}` : 'probe-anonymous'}</div>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
})

describe('AuthProvider', () => {
  it('is loading until the initial session resolves', async () => {
    let resolveSession!: (value: { data: { session: Session | null } }) => void
    mockGetSession.mockReturnValue(new Promise(resolve => { resolveSession = resolve }))

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    expect(screen.getByText('probe-loading')).toBeInTheDocument()

    await act(async () => resolveSession({ data: { session: null } }))
    expect(screen.getByText('probe-anonymous')).toBeInTheDocument()
  })

  it('exposes the session when one exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    expect(await screen.findByText('probe-user:me@example.com')).toBeInTheDocument()
  })

  it('updates the session when auth state changes', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } })
    let authCallback!: (event: string, session: Session | null) => void
    mockOnAuthStateChange.mockImplementation((cb: typeof authCallback) => {
      authCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    await screen.findByText('probe-user:me@example.com')

    act(() => authCallback('SIGNED_OUT', null))
    expect(screen.getByText('probe-anonymous')).toBeInTheDocument()
  })

  it('unsubscribes from auth changes on unmount', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    const unsubscribe = vi.fn()
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } })

    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    await screen.findByText('probe-anonymous')

    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('signIn returns a plain-language error on failure', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockSignInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })

    let signIn!: ReturnType<typeof useAuth>['signIn']
    function Grab() {
      signIn = useAuth().signIn
      return null
    }
    render(
      <AuthProvider>
        <Grab />
      </AuthProvider>
    )
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled())

    const result = await signIn('me@example.com', 'wrong')
    expect(result.error).toBe('Invalid email or password.')
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'me@example.com',
      password: 'wrong',
    })
  })

  it('signIn returns no error on success', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockSignInWithPassword.mockResolvedValue({ error: null })

    let signIn!: ReturnType<typeof useAuth>['signIn']
    function Grab() {
      signIn = useAuth().signIn
      return null
    }
    render(
      <AuthProvider>
        <Grab />
      </AuthProvider>
    )
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled())

    const result = await signIn('me@example.com', 'right')
    expect(result.error).toBeNull()
  })

  it('signOut calls supabase sign-out', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } })
    mockSignOut.mockResolvedValue({ error: null })

    let signOut!: ReturnType<typeof useAuth>['signOut']
    function Grab() {
      signOut = useAuth().signOut
      return null
    }
    render(
      <AuthProvider>
        <Grab />
      </AuthProvider>
    )
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled())

    await signOut()
    expect(mockSignOut).toHaveBeenCalled()
  })
})

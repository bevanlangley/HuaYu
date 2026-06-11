import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { RequireAuth } from './RequireAuth'

const mockUseAuth = vi.fn()

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('./LoginPage', () => ({
  LoginPage: () => <div>login-page</div>,
}))

afterEach(() => {
  vi.clearAllMocks()
})

const fakeSession = { user: { id: 'user-1' } } as Session

describe('RequireAuth', () => {
  it('shows a loading state while the session resolves', () => {
    mockUseAuth.mockReturnValue({ session: null, loading: true })
    render(<RequireAuth>protected-content</RequireAuth>)
    expect(screen.queryByText('protected-content')).not.toBeInTheDocument()
    expect(screen.queryByText('login-page')).not.toBeInTheDocument()
  })

  it('shows the login page when there is no session', () => {
    mockUseAuth.mockReturnValue({ session: null, loading: false })
    render(<RequireAuth>protected-content</RequireAuth>)
    expect(screen.getByText('login-page')).toBeInTheDocument()
    expect(screen.queryByText('protected-content')).not.toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({ session: fakeSession, loading: false })
    render(<RequireAuth>protected-content</RequireAuth>)
    expect(screen.getByText('protected-content')).toBeInTheDocument()
    expect(screen.queryByText('login-page')).not.toBeInTheDocument()
  })
})

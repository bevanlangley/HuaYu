import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QaPage } from './QaPage'

vi.mock('./qaService', () => ({
  fetchSeedsWithExchangeCounts: vi.fn(),
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, signOut: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { fetchSeedsWithExchangeCounts } from './qaService'
import { toast } from 'sonner'

const mockSeeds = [
  { id: 's1', name: 'Taxi Conversations', tag: null, source_url: null, created_at: '2024-01-01', phraseCount: 5, exchangeCount: 4 },
  { id: 's2', name: 'Empty Seed', tag: null, source_url: null, created_at: '2024-01-02', phraseCount: 2, exchangeCount: 0 },
]

const renderPage = () =>
  render(
    <MemoryRouter>
      <QaPage />
    </MemoryRouter>
  )

describe('QaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchSeedsWithExchangeCounts).mockResolvedValue(mockSeeds)
  })

  it('renders seed options with exchange counts', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Taxi Conversations (4)')).toBeInTheDocument())
    expect(screen.getByText('Empty Seed (0)')).toBeInTheDocument()
  })

  it('disables zero-exchange seeds', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Empty Seed (0)')).toBeInTheDocument())
    expect(screen.getByRole('option', { name: 'Empty Seed (0)' })).toBeDisabled()
    expect(screen.getByRole('option', { name: 'Taxi Conversations (4)' })).not.toBeDisabled()
  })

  it('shows a Coming soon placeholder instead of a live session on Start', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Taxi Conversations (4)')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /start/i }))
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })

  it('defaults Order to Random', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Taxi Conversations (4)')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Random' })).toHaveClass('bg-primary-500')
  })

  it('defaults Display text to On', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Taxi Conversations (4)')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'On' })).toHaveClass('bg-primary-500')
  })

  it('shows an error toast when seeds fail to load', async () => {
    vi.mocked(fetchSeedsWithExchangeCounts).mockRejectedValue(new Error('network error'))
    renderPage()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not load seeds. Try again.'))
  })
})

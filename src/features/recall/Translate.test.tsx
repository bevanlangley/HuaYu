import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Translate } from './Translate'

vi.mock('./useRecall', () => ({
  useRecall: vi.fn(),
}))
vi.mock('@/lib/tts', () => ({
  speakMandarin: vi.fn().mockReturnValue(vi.fn()),
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, signOut: vi.fn() }),
}))
vi.mock('@/context/TtsContext', () => ({
  useTts: () => ({ voiceStatus: 'zh-TW', currentlyPlaying: null, setCurrentlyPlaying: vi.fn() }),
}))

import { useRecall } from './useRecall'

const mockPhrases = [
  { id: 'p1', seed_id: 's1', mandarin: '你好', pinyin: 'nǐ hǎo', english: 'Hello', phrase_type: 'statement' as const, created_at: '2024-01-01' },
  { id: 'p2', seed_id: 's1', mandarin: '謝謝', pinyin: 'xiè xiè', english: 'Thank you', phrase_type: 'statement' as const, created_at: '2024-01-02' },
]
const mockSeeds = [{ id: 's1', name: 'Seed 1', tag: null, source_url: null, created_at: '2024-01-01', phraseCount: 2 }]
const mockStartSession = vi.fn()
const mockStopSession = vi.fn()
const mockReveal = vi.fn()
const mockNext = vi.fn()
const mockPrevious = vi.fn()

function mockHook(overrides = {}) {
  vi.mocked(useRecall).mockReturnValue({
    seeds: mockSeeds,
    seedsLoading: false,
    sessionActive: false,
    phrases: [],
    phrasesLoading: false,
    currentIndex: 0,
    currentPhrase: null as any,
    isRevealed: false,
    justRevealed: false,
    startSession: mockStartSession,
    stopSession: mockStopSession,
    reveal: mockReveal,
    next: mockNext,
    previous: mockPrevious,
    ...overrides,
  })
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <Translate />
    </MemoryRouter>
  )

describe('Translate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHook()
  })

  it('renders config panel when session is not active', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument()
  })

  it('skeletons only the Source field while seeds are loading, keeping Order/Start visible', () => {
    mockHook({ seedsLoading: true })
    renderPage()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByText('Source')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^in order$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^random$/i })).toBeInTheDocument()
  })

  it('disables Start while seeds are loading', () => {
    mockHook({ seedsLoading: true })
    renderPage()
    expect(screen.getByRole('button', { name: /start/i })).toBeDisabled()
  })

  it('calls startSession when Start is clicked', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /start/i }))
    await waitFor(() => expect(mockStartSession).toHaveBeenCalled())
  })

  it('shows English sentence before reveal', () => {
    mockHook({
      sessionActive: true,
      phrases: mockPhrases,
      currentPhrase: mockPhrases[0],
      currentIndex: 0,
      isRevealed: false,
      justRevealed: false,
    })
    renderPage()
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.queryByText('你好')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reveal/i })).toBeInTheDocument()
  })

  it('shows Mandarin and Pinyin after reveal', () => {
    mockHook({
      sessionActive: true,
      phrases: mockPhrases,
      currentPhrase: mockPhrases[0],
      currentIndex: 0,
      isRevealed: true,
      justRevealed: false,
    })
    renderPage()
    expect(screen.getByText('你好')).toBeInTheDocument()
    expect(screen.getByText('nǐ hǎo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reveal/i })).not.toBeInTheDocument()
  })

  it('calls reveal when Reveal button is clicked', () => {
    mockHook({
      sessionActive: true,
      phrases: mockPhrases,
      currentPhrase: mockPhrases[0],
      currentIndex: 0,
      isRevealed: false,
      justRevealed: false,
    })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }))
    expect(mockReveal).toHaveBeenCalled()
  })

  it('shows progress indicator during session', () => {
    mockHook({
      sessionActive: true,
      phrases: mockPhrases,
      currentPhrase: mockPhrases[0],
      currentIndex: 0,
      isRevealed: false,
      justRevealed: false,
    })
    renderPage()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })
})

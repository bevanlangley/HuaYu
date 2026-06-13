import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DrillingMode } from './DrillingMode'

vi.mock('./useDrilling', () => ({
  useDrilling: vi.fn(),
}))
vi.mock('@/context/TtsContext', () => ({
  useTts: () => ({ voiceStatus: 'zh-TW', currentlyPlaying: null, setCurrentlyPlaying: vi.fn() }),
}))

import { useDrilling } from './useDrilling'

const mockSeeds = [{ id: 's1', name: 'Seed 1', tag: null, source_url: null, created_at: '2024-01-01', phraseCount: 2 }]
const mockPhrases = [
  { id: 'p1', seed_id: 's1', mandarin: '你好', pinyin: 'nǐ hǎo', english: 'Hello', created_at: '2024-01-01' },
  { id: 'p2', seed_id: 's1', mandarin: '謝謝', pinyin: 'xiè xiè', english: 'Thank you', created_at: '2024-01-02' },
]
const mockStartSession = vi.fn()
const mockStopSession = vi.fn()
const mockPause = vi.fn()
const mockResume = vi.fn()
const mockNext = vi.fn()
const mockPrevious = vi.fn()
const mockSpeakCurrent = vi.fn()

function mockHook(overrides: Partial<ReturnType<typeof useDrilling>> = {}) {
  vi.mocked(useDrilling).mockReturnValue({
    seeds: mockSeeds,
    seedsLoading: false,
    sessionActive: false,
    config: null,
    phrases: [],
    phrasesLoading: false,
    currentIndex: 0,
    currentPhrase: null as unknown as ReturnType<typeof useDrilling>['currentPhrase'],
    playbackState: 'playing' as const,
    startSession: mockStartSession,
    stopSession: mockStopSession,
    pause: mockPause,
    resume: mockResume,
    next: mockNext,
    previous: mockPrevious,
    speakCurrent: mockSpeakCurrent,
    ...overrides,
  })
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <DrillingMode />
    </MemoryRouter>
  )

describe('DrillingMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHook()
  })

  it('renders config panel when session is not active', () => {
    renderPage()
    expect(screen.getByText('Listen')).toBeInTheDocument()
    expect(screen.getByText('Shadow')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument()
  })

  it('calls startSession with config when Start is clicked', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /start/i }))
    await waitFor(() => expect(mockStartSession).toHaveBeenCalledWith(
      expect.objectContaining({ drillType: 'listen' })
    ))
  })

  it('shows phrase card when session is active', () => {
    mockHook({
      sessionActive: true,
      config: { drillType: 'listen', seedId: 's1', random: false, gapSeconds: 3, loop: false },
      phrases: mockPhrases,
      currentPhrase: mockPhrases[0],
      currentIndex: 0,
    })
    renderPage()
    expect(screen.getByText('你好')).toBeInTheDocument()
    expect(screen.getByText('nǐ hǎo')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('hides phrase text when showText is toggled off in listen mode', async () => {
    mockHook({
      sessionActive: true,
      config: { drillType: 'listen', seedId: 's1', random: false, gapSeconds: 3, loop: false },
      phrases: mockPhrases,
      currentPhrase: mockPhrases[0],
      currentIndex: 0,
    })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /hide text/i }))
    expect(screen.queryByText('你好')).not.toBeInTheDocument()
  })

  it('always shows phrase text in shadow mode', () => {
    mockHook({
      sessionActive: true,
      config: { drillType: 'shadow', seedId: 's1', random: false, gapSeconds: 3, loop: false },
      phrases: mockPhrases,
      currentPhrase: mockPhrases[0],
      currentIndex: 0,
    })
    renderPage()
    expect(screen.getByText('你好')).toBeInTheDocument()
  })
})

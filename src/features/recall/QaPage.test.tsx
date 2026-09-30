import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QaPage } from './QaPage'

const mockSetCurrentlyPlaying = vi.fn()
const mockSpeakMandarin = vi.fn().mockReturnValue(vi.fn())

vi.mock('./useQa', () => ({
  useQa: vi.fn(),
}))
vi.mock('@/lib/tts', () => ({
  speakMandarin: (...args: unknown[]) => mockSpeakMandarin(...args),
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, signOut: vi.fn() }),
}))
vi.mock('@/context/TtsContext', () => ({
  useTts: () => ({ voiceStatus: 'zh-TW', currentlyPlaying: null, setCurrentlyPlaying: mockSetCurrentlyPlaying }),
}))

import { useQa } from './useQa'

const mockSeeds = [
  { id: 's1', name: 'Taxi Conversations', tag: null, source_url: null, created_at: '2024-01-01', phraseCount: 5, exchangeCount: 2 },
  { id: 's2', name: 'Empty Seed', tag: null, source_url: null, created_at: '2024-01-02', phraseCount: 2, exchangeCount: 0 },
]

function makePhrase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    seed_id: 's1',
    mandarin: '你今天怎麼樣？',
    pinyin: 'nǐ jīntiān zěnmeyàng?',
    english: 'How are you today?',
    phrase_type: 'question' as const,
    question_id: null,
    created_at: '2024-01-01',
    ...overrides,
  }
}

const singleAnswerExchange = {
  question: makePhrase({ id: 'q1' }),
  answers: [makePhrase({ id: 'a1', mandarin: '我很好', pinyin: 'wǒ hěn hǎo', english: "I'm doing well", phrase_type: 'answer', question_id: 'q1' })],
}

const multiAnswerExchange = {
  question: makePhrase({ id: 'q2' }),
  answers: [
    makePhrase({ id: 'a2', mandarin: '我很好', pinyin: 'wǒ hěn hǎo', english: "I'm doing well", phrase_type: 'answer', question_id: 'q2' }),
    makePhrase({ id: 'a3', mandarin: '還不錯', pinyin: 'hái búcuò', english: 'Not bad', phrase_type: 'answer', question_id: 'q2' }),
  ],
}

const mockStartSession = vi.fn()
const mockStopSession = vi.fn()
const mockReveal = vi.fn()
const mockNext = vi.fn()
const mockPrevious = vi.fn()

function mockHook(overrides = {}) {
  vi.mocked(useQa).mockReturnValue({
    seeds: mockSeeds,
    seedsLoading: false,
    sessionActive: false,
    exchanges: [],
    exchangesLoading: false,
    currentIndex: 0,
    currentExchange: null as any,
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
      <QaPage />
    </MemoryRouter>
  )

describe('QaPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHook()
  })

  it('renders seed options with exchange counts', () => {
    renderPage()
    expect(screen.getByText('Taxi Conversations (2)')).toBeInTheDocument()
    expect(screen.getByText('Empty Seed (0)')).toBeInTheDocument()
  })

  it('disables zero-exchange seeds', () => {
    renderPage()
    expect(screen.getByRole('option', { name: 'Empty Seed (0)' })).toBeDisabled()
    expect(screen.getByRole('option', { name: 'Taxi Conversations (2)' })).not.toBeDisabled()
  })

  it('does not disable Start by default, since "All seeds" is already selected', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /start/i })).not.toBeDisabled()
  })

  it('defaults the source selector to "All seeds"', () => {
    renderPage()
    expect(screen.getByRole('combobox')).toHaveValue('all')
  })

  it('shows a settings-panel skeleton instead of empty controls while seeds are loading', () => {
    mockHook({ seedsLoading: true })
    renderPage()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^start$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^random$/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Source')).not.toBeInTheDocument()
  })

  it('calls startSession with seedId null and the default Random order when Start is clicked without changing the source', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))
    await waitFor(() => expect(mockStartSession).toHaveBeenCalledWith({ seedId: null, random: true }))
  })

  it('calls startSession with the selected seedId when Start is clicked', async () => {
    renderPage()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 's1' } })
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))
    await waitFor(() => expect(mockStartSession).toHaveBeenCalledWith({ seedId: 's1', random: true }))
  })

  it('calls startSession with random false after toggling Order to "In order"', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^in order$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))
    await waitFor(() => expect(mockStartSession).toHaveBeenCalledWith({ seedId: null, random: false }))
  })

  it('calls startSession with random true after toggling back to "Random"', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^in order$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^random$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }))
    await waitFor(() => expect(mockStartSession).toHaveBeenCalledWith({ seedId: null, random: true }))
  })

  it('shows Question Mandarin and Pinyin but withholds English before reveal', () => {
    mockHook({
      sessionActive: true,
      exchanges: [singleAnswerExchange],
      currentExchange: singleAnswerExchange,
      currentIndex: 0,
      isRevealed: false,
      justRevealed: false,
    })
    renderPage()
    expect(screen.getByText('你今天怎麼樣？')).toBeInTheDocument()
    expect(screen.getByText('nǐ jīntiān zěnmeyàng?')).toBeInTheDocument()
    expect(screen.queryByText('How are you today?')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reveal/i })).toBeInTheDocument()
  })

  it('hides the Question Mandarin/Pinyin pre-reveal when Display text is toggled off, leaving only Replay and Reveal', () => {
    const { rerender } = renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^off$/i }))
    mockHook({
      sessionActive: true,
      exchanges: [singleAnswerExchange],
      currentExchange: singleAnswerExchange,
      currentIndex: 0,
      isRevealed: false,
      justRevealed: false,
    })
    rerender(<MemoryRouter><QaPage /></MemoryRouter>)

    expect(screen.queryByText('你今天怎麼樣？')).not.toBeInTheDocument()
    expect(screen.queryByText('nǐ jīntiān zěnmeyàng?')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /replay/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reveal/i })).toBeInTheDocument()
  })

  it('shows the Question Mandarin/Pinyin/English on reveal regardless of the Display text setting', () => {
    const { rerender } = renderPage()
    fireEvent.click(screen.getByRole('button', { name: /^off$/i }))
    mockHook({
      sessionActive: true,
      exchanges: [singleAnswerExchange],
      currentExchange: singleAnswerExchange,
      currentIndex: 0,
      isRevealed: true,
      justRevealed: true,
    })
    rerender(<MemoryRouter><QaPage /></MemoryRouter>)

    expect(screen.getByText('你今天怎麼樣？')).toBeInTheDocument()
    expect(screen.getByText('nǐ jīntiān zěnmeyàng?')).toBeInTheDocument()
    expect(screen.getByText('How are you today?')).toBeInTheDocument()
  })

  it('shows the progress indicator', () => {
    mockHook({
      sessionActive: true,
      exchanges: [singleAnswerExchange, multiAnswerExchange],
      currentExchange: singleAnswerExchange,
      currentIndex: 0,
    })
    renderPage()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('calls reveal when Reveal is clicked', () => {
    mockHook({
      sessionActive: true,
      exchanges: [singleAnswerExchange],
      currentExchange: singleAnswerExchange,
      currentIndex: 0,
      isRevealed: false,
    })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /reveal/i }))
    expect(mockReveal).toHaveBeenCalled()
  })

  it('reveals the Question English and every Answer Mandarin/Pinyin/English', () => {
    mockHook({
      sessionActive: true,
      exchanges: [multiAnswerExchange],
      currentExchange: multiAnswerExchange,
      currentIndex: 0,
      isRevealed: true,
      justRevealed: true,
    })
    renderPage()
    expect(screen.getByText('How are you today?')).toBeInTheDocument()
    expect(screen.getByText('我很好')).toBeInTheDocument()
    expect(screen.getByText("I'm doing well")).toBeInTheDocument()
    expect(screen.getByText('還不錯')).toBeInTheDocument()
    expect(screen.getByText('Not bad')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reveal/i })).not.toBeInTheDocument()
  })

  it('auto-plays the single linked Answer on reveal and renders no play button for it', () => {
    mockHook({
      sessionActive: true,
      exchanges: [singleAnswerExchange],
      currentExchange: singleAnswerExchange,
      currentIndex: 0,
      isRevealed: true,
      justRevealed: true,
    })
    renderPage()
    expect(mockSpeakMandarin).toHaveBeenCalledWith('我很好', expect.any(Function))
    expect(screen.queryByRole('button', { name: /^play /i })).not.toBeInTheDocument()
  })

  it('does not auto-play when there are multiple linked Answers, and gives each its own play button', () => {
    mockHook({
      sessionActive: true,
      exchanges: [multiAnswerExchange],
      currentExchange: multiAnswerExchange,
      currentIndex: 0,
      isRevealed: true,
      justRevealed: true,
    })
    renderPage()
    expect(mockSpeakMandarin).not.toHaveBeenCalledWith('我很好', expect.any(Function))
    expect(mockSpeakMandarin).not.toHaveBeenCalledWith('還不錯', expect.any(Function))
    const playButtons = screen.getAllByRole('button', { name: /^play /i })
    expect(playButtons).toHaveLength(2)
    fireEvent.click(playButtons[0])
    fireEvent.click(playButtons[1])
    expect(mockSpeakMandarin).toHaveBeenCalledWith('我很好', expect.any(Function))
    expect(mockSpeakMandarin).toHaveBeenCalledWith('還不錯', expect.any(Function))
  })

  it('auto-plays the Question on mount while a session is active', () => {
    mockHook({
      sessionActive: true,
      exchanges: [singleAnswerExchange],
      currentExchange: singleAnswerExchange,
      currentIndex: 0,
    })
    renderPage()
    expect(mockSpeakMandarin).toHaveBeenCalledWith('你今天怎麼樣？', expect.any(Function))
  })

  it('disables Previous on the first exchange and Next on the last', () => {
    mockHook({
      sessionActive: true,
      exchanges: [singleAnswerExchange, multiAnswerExchange],
      currentExchange: multiAnswerExchange,
      currentIndex: 1,
    })
    renderPage()
    expect(screen.getByRole('button', { name: /previous/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('calls stopSession when Stop is clicked', () => {
    mockHook({
      sessionActive: true,
      exchanges: [singleAnswerExchange],
      currentExchange: singleAnswerExchange,
      currentIndex: 0,
    })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /stop/i }))
    expect(mockStopSession).toHaveBeenCalled()
  })
})

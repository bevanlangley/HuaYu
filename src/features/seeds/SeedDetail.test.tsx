import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { SeedDetail } from './SeedDetail'
import { ConfirmDialogProvider } from '@/context/ConfirmDialogContext'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

vi.mock('@/context/TtsContext', () => ({
  useTts: () => ({ voiceStatus: 'zh-TW', currentlyPlaying: null, setCurrentlyPlaying: vi.fn() }),
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ session: { user: { email: 'test@example.com' } }, loading: false, signIn: vi.fn(), signOut: vi.fn() }),
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/features/seeds/seedsService', () => ({
  fetchSeedById: vi.fn(),
}))
vi.mock('@/features/phrases/phrasesService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/phrases/phrasesService')>()
  return {
    ...actual,
    fetchPhrasesBySeed: vi.fn(),
    deletePhrase: vi.fn(),
    updatePhrase: vi.fn(),
  }
})

import { toast } from 'sonner'
import { fetchSeedById } from '@/features/seeds/seedsService'
import {
  fetchPhrasesBySeed,
  deletePhrase,
  updatePhrase,
} from '@/features/phrases/phrasesService'

const mockSeed = { id: 's1', name: 'Taxi Conversations', tag: null, source_url: null, created_at: '2024-01-01' }

const mockQuestion = {
  id: 'q1',
  seed_id: 's1',
  mandarin: '你今天怎麼樣？',
  pinyin: 'nǐ jīntiān zěnmeyàng?',
  english: 'How are you today?',
  phrase_type: 'question' as const,
  question_id: null,
  created_at: '2024-01-01',
}
const mockAnswer = {
  id: 'a1',
  seed_id: 's1',
  mandarin: '我很好',
  pinyin: 'wǒ hěn hǎo',
  english: "I'm well",
  phrase_type: 'answer' as const,
  question_id: 'q1',
  created_at: '2024-01-02',
}

function renderPage() {
  return render(
    <ConfirmDialogProvider>
      <MemoryRouter initialEntries={['/seeds/s1']}>
        <Routes>
          <Route path="/seeds/:seedId" element={<SeedDetail />} />
        </Routes>
      </MemoryRouter>
      <ConfirmDialog />
    </ConfirmDialogProvider>
  )
}

function phraseCardFor(mandarin: string): HTMLElement {
  return screen.getByText(mandarin).closest('div.group') as HTMLElement
}

function unpairedIconWithin(card: HTMLElement) {
  return within(card).queryByLabelText('Unpaired — does not appear in Q&A')
}

const unlinkedAnswer = { ...mockAnswer, question_id: null }

async function openPhraseMenuAction(user: ReturnType<typeof userEvent.setup>, mandarin: string, action: 'Edit' | 'Delete') {
  await user.click(within(phraseCardFor(mandarin)).getByLabelText('Phrase options'))
  await user.click(await screen.findByText(action))
}

async function retypeTo(user: ReturnType<typeof userEvent.setup>, mandarin: string, type: string) {
  await openPhraseMenuAction(user, mandarin, 'Edit')
  await user.selectOptions(await screen.findByLabelText(/phrase type/i), type)
  await user.click(screen.getByRole('button', { name: /save changes/i }))
}

describe('SeedDetail — delete/retype guardrails for linked phrases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchSeedById).mockResolvedValue(mockSeed)
    vi.mocked(fetchPhrasesBySeed).mockResolvedValue([mockQuestion, mockAnswer])
  })

  it('confirms, deletes, then refetches so the unlinked Answer shows the unpaired warning', async () => {
    vi.mocked(deletePhrase).mockResolvedValue(undefined)
    vi.mocked(fetchPhrasesBySeed)
      .mockResolvedValueOnce([mockQuestion, mockAnswer])
      .mockResolvedValueOnce([unlinkedAnswer])
    const user = userEvent.setup()
    renderPage()

    await screen.findByText(mockQuestion.mandarin)
    expect(unpairedIconWithin(phraseCardFor(mockAnswer.mandarin))).not.toBeInTheDocument()

    await openPhraseMenuAction(user, mockQuestion.mandarin, 'Delete')
    expect(await screen.findByText(/1 linked answer/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(deletePhrase).toHaveBeenCalledWith('q1'))
    await waitFor(() => expect(fetchPhrasesBySeed).toHaveBeenCalledTimes(2))
    await waitFor(() => {
      expect(screen.queryByText(mockQuestion.mandarin)).not.toBeInTheDocument()
      expect(unpairedIconWithin(phraseCardFor(mockAnswer.mandarin))).toBeInTheDocument()
    })
  })

  it('confirms, retypes with a single update, then refetches the unlinked Answers', async () => {
    const retyped = { ...mockQuestion, phrase_type: 'statement' as const }
    vi.mocked(updatePhrase).mockResolvedValue(retyped)
    vi.mocked(fetchPhrasesBySeed)
      .mockResolvedValueOnce([mockQuestion, mockAnswer])
      .mockResolvedValueOnce([retyped, unlinkedAnswer])
    const user = userEvent.setup()
    renderPage()

    await screen.findByText(mockQuestion.mandarin)
    await retypeTo(user, mockQuestion.mandarin, 'statement')
    expect(await screen.findByText(/1 linked answer/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(fetchPhrasesBySeed).toHaveBeenCalledTimes(2))
    expect(updatePhrase).toHaveBeenCalledTimes(1)
    expect(updatePhrase).toHaveBeenCalledWith('q1', expect.objectContaining({ phrase_type: 'statement' }))
    await waitFor(() =>
      expect(unpairedIconWithin(phraseCardFor(mockAnswer.mandarin))).toBeInTheDocument()
    )
  })

  it('keeps the saved list and explains when the refetch fails, without reporting the save as failed', async () => {
    const retyped = { ...mockQuestion, phrase_type: 'statement' as const }
    vi.mocked(updatePhrase).mockResolvedValue(retyped)
    vi.mocked(fetchPhrasesBySeed)
      .mockResolvedValueOnce([mockQuestion, mockAnswer])
      .mockRejectedValueOnce(new Error('network'))
    const user = userEvent.setup()
    renderPage()

    await screen.findByText(mockQuestion.mandarin)
    await retypeTo(user, mockQuestion.mandarin, 'statement')
    await user.click(await screen.findByRole('button', { name: 'Continue' }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Phrase saved, but the list couldn't refresh. Reload to see linked answers."
      )
    )
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(screen.getByText(mockAnswer.mandarin)).toBeInTheDocument()
    expect(unpairedIconWithin(phraseCardFor(mockAnswer.mandarin))).toBeInTheDocument()
  })

  it('does not refetch or confirm when deleting an Answer', async () => {
    vi.mocked(deletePhrase).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    await screen.findByText(mockAnswer.mandarin)
    await openPhraseMenuAction(user, mockAnswer.mandarin, 'Delete')
    expect(screen.queryByText(/linked answer/i)).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(deletePhrase).toHaveBeenCalledWith('a1'))
    await waitFor(() => expect(screen.queryByText(mockAnswer.mandarin)).not.toBeInTheDocument())
    expect(fetchPhrasesBySeed).toHaveBeenCalledTimes(1)
  })

  it('retypes an Answer without confirming or refetching', async () => {
    vi.mocked(updatePhrase).mockResolvedValue({ ...mockAnswer, phrase_type: 'statement', question_id: null })
    const user = userEvent.setup()
    renderPage()

    await screen.findByText(mockAnswer.mandarin)
    await retypeTo(user, mockAnswer.mandarin, 'statement')

    await waitFor(() => expect(updatePhrase).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/linked answer/i)).not.toBeInTheDocument()
    expect(fetchPhrasesBySeed).toHaveBeenCalledTimes(1)
  })
})

function makeStatement(i: number) {
  return {
    id: `s${i}`,
    seed_id: 's1',
    mandarin: `statement-${i}`,
    pinyin: `pinyin-${i}`,
    english: `Statement ${i}`,
    phrase_type: 'statement' as const,
    question_id: null,
    created_at: `2024-01-${String(i + 1).padStart(2, '0')}`,
  }
}

describe('SeedDetail — Exchange grouping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchSeedById).mockResolvedValue(mockSeed)
  })

  it('renders a Question directly above its linked Answer inside one shared group', async () => {
    vi.mocked(fetchPhrasesBySeed).mockResolvedValue([mockQuestion, mockAnswer])
    renderPage()

    await screen.findByText(mockQuestion.mandarin)
    const groups = screen.getAllByTestId('exchange-group')
    expect(groups).toHaveLength(1)

    const questionText = within(groups[0]).getByText(mockQuestion.mandarin)
    const answerText = within(groups[0]).getByText(mockAnswer.mandarin)
    expect(
      questionText.compareDocumentPosition(answerText) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('renders a Statement outside any exchange group, unaffected by grouping', async () => {
    const statement = makeStatement(0)
    vi.mocked(fetchPhrasesBySeed).mockResolvedValue([statement])
    renderPage()

    await screen.findByText(statement.mandarin)
    expect(screen.queryByTestId('exchange-group')).not.toBeInTheDocument()
  })

  it('never splits an Exchange across a pagination boundary', async () => {
    const statements = Array.from({ length: 24 }, (_, i) => makeStatement(i))
    const question = { ...mockQuestion, created_at: '2024-02-01' }
    const answer = { ...mockAnswer, created_at: '2024-02-02' }
    vi.mocked(fetchPhrasesBySeed).mockResolvedValue([...statements, question, answer])
    const user = userEvent.setup()
    renderPage()

    await screen.findByText(statements[0].mandarin)
    expect(screen.queryByText(question.mandarin)).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Next page'))

    await screen.findByText(question.mandarin)
    const groups = screen.getAllByTestId('exchange-group')
    expect(groups).toHaveLength(1)
    expect(within(groups[0]).getByText(answer.mandarin)).toBeInTheDocument()
  })
})

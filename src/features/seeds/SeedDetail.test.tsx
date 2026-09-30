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
    unlinkAnswersFromQuestion: vi.fn(),
  }
})

import { fetchSeedById } from '@/features/seeds/seedsService'
import {
  fetchPhrasesBySeed,
  deletePhrase,
  updatePhrase,
  unlinkAnswersFromQuestion,
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

describe('SeedDetail — delete/retype guardrails for linked phrases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchSeedById).mockResolvedValue(mockSeed)
    vi.mocked(fetchPhrasesBySeed).mockResolvedValue([mockQuestion, mockAnswer])
  })

  it('shows the unpaired warning on the Answer immediately after its Question is deleted', async () => {
    vi.mocked(deletePhrase).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    await screen.findByText(mockQuestion.mandarin)
    const answerCard = phraseCardFor(mockAnswer.mandarin)
    expect(unpairedIconWithin(answerCard)).not.toBeInTheDocument()

    const questionCard = phraseCardFor(mockQuestion.mandarin)
    await user.click(within(questionCard).getByLabelText('Phrase options'))
    await user.click(await screen.findByText('Delete'))

    expect(await screen.findByText(/linked answer/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(deletePhrase).toHaveBeenCalledWith('q1'))
    await waitFor(() => {
      const remainingAnswerCard = phraseCardFor(mockAnswer.mandarin)
      expect(unpairedIconWithin(remainingAnswerCard)).toBeInTheDocument()
    })
  })

  it('shows the unpaired warning on the Answer immediately after its Question is retyped away', async () => {
    vi.mocked(updatePhrase).mockResolvedValue({ ...mockQuestion, phrase_type: 'statement' })
    vi.mocked(unlinkAnswersFromQuestion).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    await screen.findByText(mockQuestion.mandarin)
    const questionCard = phraseCardFor(mockQuestion.mandarin)
    await user.click(within(questionCard).getByLabelText('Phrase options'))
    await user.click(await screen.findByText('Edit'))

    const select = await screen.findByLabelText(/phrase type/i)
    await user.selectOptions(select, 'statement')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText(/linked answer/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(unlinkAnswersFromQuestion).toHaveBeenCalledWith('q1'))
    await waitFor(() => {
      const answerCard = phraseCardFor(mockAnswer.mandarin)
      expect(unpairedIconWithin(answerCard)).toBeInTheDocument()
    })
  })
})

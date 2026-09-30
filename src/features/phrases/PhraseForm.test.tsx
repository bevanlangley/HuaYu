import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PhraseForm } from './PhraseForm'

vi.mock('./phrasesService', () => ({
  createPhrase: vi.fn(),
  updatePhrase: vi.fn(),
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { createPhrase, updatePhrase } from './phrasesService'

const mockQuestion = {
  id: 'p1',
  seed_id: 's1',
  mandarin: '你今天怎麼樣？',
  pinyin: 'nǐ jīntiān zěnmeyàng?',
  english: 'How are you today?',
  phrase_type: 'question' as const,
  question_id: null,
  created_at: '2024-01-01',
}

describe('PhraseForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('defaults the Phrase Type selector to Statement on create', () => {
    render(
      <PhraseForm open seedId="s1" phrase={null} onClose={vi.fn()} onSaved={vi.fn()} />
    )
    const select = screen.getByLabelText(/phrase type/i) as HTMLSelectElement
    expect(select.value).toBe('statement')
  })

  it('shows the current type when editing an existing phrase', () => {
    render(
      <PhraseForm open seedId="s1" phrase={mockQuestion} onClose={vi.fn()} onSaved={vi.fn()} />
    )
    const select = screen.getByLabelText(/phrase type/i) as HTMLSelectElement
    expect(select.value).toBe('question')
  })

  it('offers Question, Answer, and Statement as options', () => {
    render(
      <PhraseForm open seedId="s1" phrase={null} onClose={vi.fn()} onSaved={vi.fn()} />
    )
    const select = screen.getByLabelText(/phrase type/i) as HTMLSelectElement
    const values = Array.from(select.options).map(o => o.value)
    expect(values).toEqual(['question', 'answer', 'statement'])
  })

  it('submits the selected phrase_type on create', async () => {
    vi.mocked(createPhrase).mockResolvedValue({ ...mockQuestion, id: 'new', phrase_type: 'answer' })
    render(
      <PhraseForm open seedId="s1" phrase={null} onClose={vi.fn()} onSaved={vi.fn()} />
    )
    fireEvent.change(screen.getByLabelText(/mandarin/i), { target: { value: '你好' } })
    fireEvent.change(screen.getByLabelText(/pinyin/i), { target: { value: 'nǐ hǎo' } })
    fireEvent.change(screen.getByLabelText(/english/i), { target: { value: 'Hello' } })
    fireEvent.change(screen.getByLabelText(/phrase type/i), { target: { value: 'answer' } })
    fireEvent.click(screen.getByRole('button', { name: /add phrase/i }))

    await waitFor(() =>
      expect(createPhrase).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ phrase_type: 'answer' })
      )
    )
  })

  it('submits the selected phrase_type on edit', async () => {
    vi.mocked(updatePhrase).mockResolvedValue({ ...mockQuestion, phrase_type: 'statement' })
    render(
      <PhraseForm open seedId="s1" phrase={mockQuestion} onClose={vi.fn()} onSaved={vi.fn()} />
    )
    fireEvent.change(screen.getByLabelText(/phrase type/i), { target: { value: 'statement' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(updatePhrase).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ phrase_type: 'statement' })
      )
    )
  })

  describe('chained answer-authoring', () => {
    async function createQuestion() {
      const onClose = vi.fn()
      const onSaved = vi.fn()
      vi.mocked(createPhrase).mockResolvedValueOnce(mockQuestion)
      render(<PhraseForm open seedId="s1" phrase={null} onClose={onClose} onSaved={onSaved} />)

      fireEvent.change(screen.getByLabelText(/mandarin/i), { target: { value: mockQuestion.mandarin } })
      fireEvent.change(screen.getByLabelText(/pinyin/i), { target: { value: mockQuestion.pinyin } })
      fireEvent.change(screen.getByLabelText(/english/i), { target: { value: mockQuestion.english } })
      fireEvent.change(screen.getByLabelText(/phrase type/i), { target: { value: 'question' } })
      fireEvent.click(screen.getByRole('button', { name: /add phrase/i }))

      await waitFor(() => expect(createPhrase).toHaveBeenCalledTimes(1))
      return { onClose, onSaved }
    }

    function fillAnswerFields(mandarin: string, pinyin: string, english: string) {
      fireEvent.change(screen.getByLabelText(/mandarin/i), { target: { value: mandarin } })
      fireEvent.change(screen.getByLabelText(/pinyin/i), { target: { value: pinyin } })
      fireEvent.change(screen.getByLabelText(/english/i), { target: { value: english } })
    }

    it('prompts to add an answer after saving a new Question', async () => {
      await createQuestion()
      expect(await screen.findByText(/add an answer to this question now/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^yes$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^skip$/i })).toBeInTheDocument()
    })

    it('does not prompt after saving a new Statement or Answer', async () => {
      vi.mocked(createPhrase).mockResolvedValueOnce({ ...mockQuestion, phrase_type: 'statement' })
      const onClose = vi.fn()
      render(<PhraseForm open seedId="s1" phrase={null} onClose={onClose} onSaved={vi.fn()} />)
      fireEvent.change(screen.getByLabelText(/mandarin/i), { target: { value: '你好' } })
      fireEvent.change(screen.getByLabelText(/pinyin/i), { target: { value: 'nǐ hǎo' } })
      fireEvent.change(screen.getByLabelText(/english/i), { target: { value: 'Hello' } })
      fireEvent.click(screen.getByRole('button', { name: /add phrase/i }))

      await waitFor(() => expect(onClose).toHaveBeenCalled())
      expect(screen.queryByText(/add an answer to this question now/i)).not.toBeInTheDocument()
    })

    it('does not prompt when editing an existing Question', async () => {
      vi.mocked(updatePhrase).mockResolvedValue(mockQuestion)
      const onClose = vi.fn()
      render(<PhraseForm open seedId="s1" phrase={mockQuestion} onClose={onClose} onSaved={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => expect(onClose).toHaveBeenCalled())
      expect(screen.queryByText(/add an answer to this question now/i)).not.toBeInTheDocument()
    })

    it('Skip closes the modal without entering answer-authoring', async () => {
      const { onClose } = await createQuestion()
      fireEvent.click(await screen.findByRole('button', { name: /^skip$/i }))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('Yes opens a locked answer form titled after the parent question', async () => {
      await createQuestion()
      fireEvent.click(await screen.findByRole('button', { name: /^yes$/i }))

      expect(screen.getByText(`Add an answer to ${mockQuestion.mandarin}`)).toBeInTheDocument()
      expect(screen.getByLabelText(/mandarin/i)).toHaveValue('')
      expect(screen.getByLabelText(/pinyin/i)).toHaveValue('')
      expect(screen.getByLabelText(/english/i)).toHaveValue('')
      expect(screen.queryByLabelText(/phrase type/i)).not.toBeInTheDocument()
    })

    it('saving a chained answer sends phrase_type=answer and the parent question_id', async () => {
      const { onSaved } = await createQuestion()
      fireEvent.click(await screen.findByRole('button', { name: /^yes$/i }))

      const answer = { ...mockQuestion, id: 'a1', phrase_type: 'answer' as const, question_id: 'p1' }
      vi.mocked(createPhrase).mockResolvedValueOnce(answer)

      fillAnswerFields('我很好', 'wǒ hěn hǎo', "I'm well")
      fireEvent.click(screen.getByRole('button', { name: /add answer/i }))

      await waitFor(() =>
        expect(createPhrase).toHaveBeenLastCalledWith(
          's1',
          expect.objectContaining({ mandarin: '我很好', pinyin: 'wǒ hěn hǎo', english: "I'm well", phrase_type: 'answer' }),
          'p1'
        )
      )
      expect(onSaved).toHaveBeenLastCalledWith(answer)
    })

    it('prompts "Add another answer?" after each chained answer save, keeps the question-titled form on Add another', async () => {
      await createQuestion()
      fireEvent.click(await screen.findByRole('button', { name: /^yes$/i }))

      vi.mocked(createPhrase).mockResolvedValueOnce({ ...mockQuestion, id: 'a1', phrase_type: 'answer', question_id: 'p1' })
      fillAnswerFields('我很好', 'wǒ hěn hǎo', "I'm well")
      fireEvent.click(screen.getByRole('button', { name: /add answer/i }))

      expect(await screen.findByText(/add another answer/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^done$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add another/i })).toBeInTheDocument()
      // Title stays switched to the parent Question through this interstitial prompt too.
      expect(screen.getByText(`Add an answer to ${mockQuestion.mandarin}`)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /add another/i }))
      expect(screen.getByText(`Add an answer to ${mockQuestion.mandarin}`)).toBeInTheDocument()
      expect(screen.getByLabelText(/mandarin/i)).toHaveValue('')
    })

    it('Done closes the modal, ending the chain', async () => {
      const { onClose } = await createQuestion()
      fireEvent.click(await screen.findByRole('button', { name: /^yes$/i }))

      vi.mocked(createPhrase).mockResolvedValueOnce({ ...mockQuestion, id: 'a1', phrase_type: 'answer', question_id: 'p1' })
      fillAnswerFields('我很好', 'wǒ hěn hǎo', "I'm well")
      fireEvent.click(screen.getByRole('button', { name: /add answer/i }))

      fireEvent.click(await screen.findByRole('button', { name: /^done$/i }))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('the full chain produces answers each linked via question_id', async () => {
      const { onSaved } = await createQuestion()
      fireEvent.click(await screen.findByRole('button', { name: /^yes$/i }))

      const answer1 = { ...mockQuestion, id: 'a1', phrase_type: 'answer' as const, question_id: 'p1' }
      vi.mocked(createPhrase).mockResolvedValueOnce(answer1)
      fillAnswerFields('我很好', 'wǒ hěn hǎo', "I'm well")
      fireEvent.click(screen.getByRole('button', { name: /add answer/i }))
      await waitFor(() => expect(onSaved).toHaveBeenLastCalledWith(answer1))

      fireEvent.click(await screen.findByRole('button', { name: /add another/i }))

      const answer2 = { ...mockQuestion, id: 'a2', phrase_type: 'answer' as const, question_id: 'p1' }
      vi.mocked(createPhrase).mockResolvedValueOnce(answer2)
      fillAnswerFields('還不錯', 'hái búcuò', 'Not bad')
      fireEvent.click(screen.getByRole('button', { name: /add answer/i }))
      await waitFor(() => expect(onSaved).toHaveBeenLastCalledWith(answer2))

      expect(createPhrase).toHaveBeenNthCalledWith(
        2,
        's1',
        expect.objectContaining({ phrase_type: 'answer' }),
        'p1'
      )
      expect(createPhrase).toHaveBeenNthCalledWith(
        3,
        's1',
        expect.objectContaining({ phrase_type: 'answer' }),
        'p1'
      )

      const onDone = await screen.findByRole('button', { name: /^done$/i })
      fireEvent.click(onDone)
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AttachToQuestionDialog } from './AttachToQuestionDialog'
import type { Phrase } from '@/lib/database.types'

vi.mock('./phrasesService', () => ({
  fetchQuestionsBySeed: vi.fn(),
  attachAnswerToQuestion: vi.fn(),
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { fetchQuestionsBySeed, attachAnswerToQuestion } from './phrasesService'
import { toast } from 'sonner'

function makePhrase(overrides: Partial<Phrase> = {}): Phrase {
  return {
    id: 'a1',
    seed_id: 's1',
    mandarin: '我很好',
    pinyin: 'wǒ hěn hǎo',
    english: "I'm doing well",
    phrase_type: 'answer',
    question_id: null,
    created_at: '2024-01-01',
    ...overrides,
  }
}

const questions: Phrase[] = [
  makePhrase({ id: 'q1', phrase_type: 'question', mandarin: '你今天怎麼樣？' }),
  makePhrase({ id: 'q2', phrase_type: 'question', mandarin: '你好嗎？' }),
]

describe('AttachToQuestionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchQuestionsBySeed).mockResolvedValue(questions)
  })

  it('lists "None" plus every Question from the answer\'s seed', async () => {
    render(
      <AttachToQuestionDialog open phrase={makePhrase()} onClose={vi.fn()} onAttached={vi.fn()} />
    )

    await waitFor(() => expect(fetchQuestionsBySeed).toHaveBeenCalledWith('s1'))
    const select = screen.getByRole('combobox') as HTMLSelectElement
    const labels = Array.from(select.options).map(o => o.textContent)
    expect(labels).toEqual(['None', '你今天怎麼樣？', '你好嗎？'])
  })

  it('pre-selects the currently linked question', async () => {
    render(
      <AttachToQuestionDialog
        open
        phrase={makePhrase({ question_id: 'q2' })}
        onClose={vi.fn()}
        onAttached={vi.fn()}
      />
    )

    await waitFor(() => expect(fetchQuestionsBySeed).toHaveBeenCalled())
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('q2')
  })

  it('saves the selected question and calls onAttached', async () => {
    const updated = makePhrase({ question_id: 'q1' })
    vi.mocked(attachAnswerToQuestion).mockResolvedValue(updated)
    const onAttached = vi.fn()
    const onClose = vi.fn()
    render(
      <AttachToQuestionDialog open phrase={makePhrase()} onClose={onClose} onAttached={onAttached} />
    )

    await waitFor(() => expect(fetchQuestionsBySeed).toHaveBeenCalled())
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'q1' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(attachAnswerToQuestion).toHaveBeenCalledWith('a1', 'q1'))
    expect(onAttached).toHaveBeenCalledWith(updated)
    expect(onClose).toHaveBeenCalled()
  })

  it('clears the link silently (no confirm dialog) when "None" is selected', async () => {
    const updated = makePhrase({ question_id: null })
    vi.mocked(attachAnswerToQuestion).mockResolvedValue(updated)
    render(
      <AttachToQuestionDialog
        open
        phrase={makePhrase({ question_id: 'q1' })}
        onClose={vi.fn()}
        onAttached={vi.fn()}
      />
    )

    await waitFor(() => expect(fetchQuestionsBySeed).toHaveBeenCalled())
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(attachAnswerToQuestion).toHaveBeenCalledWith('a1', null))
  })

  it('shows an error toast and keeps the dialog open when saving fails', async () => {
    vi.mocked(attachAnswerToQuestion).mockRejectedValue(new Error('DB error'))
    const onClose = vi.fn()
    render(
      <AttachToQuestionDialog open phrase={makePhrase()} onClose={onClose} onAttached={vi.fn()} />
    )

    await waitFor(() => expect(fetchQuestionsBySeed).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes without saving when Cancel is clicked', async () => {
    const onClose = vi.fn()
    render(
      <AttachToQuestionDialog open phrase={makePhrase()} onClose={onClose} onAttached={vi.fn()} />
    )

    await waitFor(() => expect(fetchQuestionsBySeed).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onClose).toHaveBeenCalled()
    expect(attachAnswerToQuestion).not.toHaveBeenCalled()
  })
})

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
})

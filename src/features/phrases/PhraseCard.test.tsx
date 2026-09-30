import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhraseCard } from './PhraseCard'
import type { Phrase } from '@/lib/database.types'

const { mockOpenConfirmDialog } = vi.hoisted(() => ({ mockOpenConfirmDialog: vi.fn() }))
vi.mock('@/context/ConfirmDialogContext', () => ({
  useConfirmDialog: () => ({ openConfirmDialog: mockOpenConfirmDialog }),
}))
vi.mock('@/context/TtsContext', () => ({
  useTts: () => ({ voiceStatus: 'zh-TW', currentlyPlaying: null, setCurrentlyPlaying: vi.fn() }),
}))
vi.mock('./AttachToQuestionDialog', () => ({
  AttachToQuestionDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="attach-dialog" /> : null,
}))
vi.mock('./phrasesService', () => ({
  deletePhrase: vi.fn(),
  describeLinkedAnswerCount: (count: number) => `${count} linked answer${count === 1 ? '' : 's'}`,
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { deletePhrase } from './phrasesService'

function makePhrase(overrides: Partial<Phrase> = {}): Phrase {
  return {
    id: 'p1',
    seed_id: 's1',
    mandarin: '你好',
    pinyin: 'nǐ hǎo',
    english: 'Hello',
    phrase_type: 'statement',
    question_id: null,
    created_at: '2024-01-01',
    ...overrides,
  }
}

const noop = { onEdit: vi.fn(), onDeleted: vi.fn(), onUpdated: vi.fn() }

describe('PhraseCard', () => {
  beforeEach(() => {
    mockOpenConfirmDialog.mockReset()
    vi.mocked(deletePhrase).mockReset()
  })

  it('shows a Question badge for question-typed phrases', () => {
    render(<PhraseCard phrase={makePhrase({ phrase_type: 'question' })} isUnpaired={false} {...noop} />)
    expect(screen.getByText('Question')).toBeInTheDocument()
  })

  it('shows an Answer badge for answer-typed phrases', () => {
    render(<PhraseCard phrase={makePhrase({ phrase_type: 'answer' })} isUnpaired={false} {...noop} />)
    expect(screen.getByText('Answer')).toBeInTheDocument()
  })

  it('shows a Statement badge for statement-typed phrases', () => {
    render(<PhraseCard phrase={makePhrase({ phrase_type: 'statement' })} isUnpaired={false} {...noop} />)
    expect(screen.getByText('Statement')).toBeInTheDocument()
  })

  it('shows the unpaired warning icon when isUnpaired is true', () => {
    render(<PhraseCard phrase={makePhrase({ phrase_type: 'question' })} isUnpaired {...noop} />)
    expect(screen.getByLabelText('Unpaired — does not appear in Q&A')).toBeInTheDocument()
  })

  it('does not show the unpaired warning icon when isUnpaired is false', () => {
    render(<PhraseCard phrase={makePhrase({ phrase_type: 'question' })} isUnpaired={false} {...noop} />)
    expect(screen.queryByLabelText('Unpaired — does not appear in Q&A')).not.toBeInTheDocument()
  })

  it('shows an "Attach to question" kebab item for answer-typed phrases', async () => {
    const user = userEvent.setup()
    render(<PhraseCard phrase={makePhrase({ phrase_type: 'answer' })} isUnpaired={false} {...noop} />)
    await user.click(screen.getByLabelText('Phrase options'))
    expect(await screen.findByText('Attach to question')).toBeInTheDocument()
  })

  it('does not show "Attach to question" for question-typed phrases', async () => {
    const user = userEvent.setup()
    render(<PhraseCard phrase={makePhrase({ phrase_type: 'question' })} isUnpaired={false} {...noop} />)
    await user.click(screen.getByLabelText('Phrase options'))
    expect(await screen.findByText('Edit')).toBeInTheDocument()
    expect(screen.queryByText('Attach to question')).not.toBeInTheDocument()
  })

  it('does not show "Attach to question" for statement-typed phrases', async () => {
    const user = userEvent.setup()
    render(<PhraseCard phrase={makePhrase({ phrase_type: 'statement' })} isUnpaired={false} {...noop} />)
    await user.click(screen.getByLabelText('Phrase options'))
    expect(await screen.findByText('Edit')).toBeInTheDocument()
    expect(screen.queryByText('Attach to question')).not.toBeInTheDocument()
  })

  it('opens the attach-to-question dialog when the kebab item is clicked', async () => {
    const user = userEvent.setup()
    render(<PhraseCard phrase={makePhrase({ phrase_type: 'answer' })} isUnpaired={false} {...noop} />)
    await user.click(screen.getByLabelText('Phrase options'))
    await user.click(await screen.findByText('Attach to question'))
    expect(screen.getByTestId('attach-dialog')).toBeInTheDocument()
  })

  describe('delete confirm copy', () => {
    async function clickDelete(phrase: Phrase, linkedAnswerCount?: number) {
      const user = userEvent.setup()
      render(
        <PhraseCard
          phrase={phrase}
          isUnpaired={false}
          linkedAnswerCount={linkedAnswerCount}
          {...noop}
        />
      )
      await user.click(screen.getByLabelText('Phrase options'))
      await user.click(await screen.findByText('Delete'))
    }

    const UNQUALIFIED_COPY = 'Delete "你好" (Hello)? This cannot be undone.'

    it.each<{ name: string; phrase: Phrase; linkedAnswerCount?: number; description: string }>([
      {
        name: 'qualified copy naming the count for a Question with 2 linked answers',
        phrase: makePhrase({ id: 'q1', phrase_type: 'question' }),
        linkedAnswerCount: 2,
        description:
          "This question has 2 linked answers. Deleting it will unlink them — they'll become unpaired and drop out of Q&A, but won't be deleted. This can't be undone.",
      },
      {
        name: 'singularizes "answer" for a Question with exactly 1 linked answer',
        phrase: makePhrase({ id: 'q1', phrase_type: 'question' }),
        linkedAnswerCount: 1,
        description:
          "This question has 1 linked answer. Deleting it will unlink them — they'll become unpaired and drop out of Q&A, but won't be deleted. This can't be undone.",
      },
      {
        name: 'unqualified copy for a Question with 0 linked answers',
        phrase: makePhrase({ id: 'q1', phrase_type: 'question' }),
        linkedAnswerCount: 0,
        description: UNQUALIFIED_COPY,
      },
      {
        name: 'unqualified copy for a Statement',
        phrase: makePhrase({ id: 's1', phrase_type: 'statement' }),
        description: UNQUALIFIED_COPY,
      },
      {
        name: 'unqualified copy for an unlinked Answer',
        phrase: makePhrase({ id: 'a1', phrase_type: 'answer', question_id: null }),
        description: UNQUALIFIED_COPY,
      },
    ])('uses $name', async ({ phrase, linkedAnswerCount, description }) => {
      mockOpenConfirmDialog.mockResolvedValue(false)
      await clickDelete(phrase, linkedAnswerCount)

      expect(mockOpenConfirmDialog).toHaveBeenCalledWith(expect.objectContaining({ description }))
    })

    it('deletes the phrase on confirm', async () => {
      mockOpenConfirmDialog.mockResolvedValue(true)
      vi.mocked(deletePhrase).mockResolvedValue(undefined)
      const phrase = makePhrase({ id: 'q1', phrase_type: 'question' })
      const onDeleted = vi.fn()
      const user = userEvent.setup()
      render(
        <PhraseCard phrase={phrase} isUnpaired={false} linkedAnswerCount={2} {...noop} onDeleted={onDeleted} />
      )
      await user.click(screen.getByLabelText('Phrase options'))
      await user.click(await screen.findByText('Delete'))

      expect(deletePhrase).toHaveBeenCalledWith('q1')
    })

    it('does not delete when the dialog is cancelled', async () => {
      mockOpenConfirmDialog.mockResolvedValue(false)
      await clickDelete(makePhrase({ id: 'q1', phrase_type: 'question' }), 2)

      expect(deletePhrase).not.toHaveBeenCalled()
    })
  })
})

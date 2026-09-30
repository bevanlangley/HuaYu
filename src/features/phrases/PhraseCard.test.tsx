import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhraseCard } from './PhraseCard'
import type { Phrase } from '@/lib/database.types'

vi.mock('@/context/ConfirmDialogContext', () => ({
  useConfirmDialog: () => ({ openConfirmDialog: vi.fn() }),
}))
vi.mock('@/context/TtsContext', () => ({
  useTts: () => ({ voiceStatus: 'zh-TW', currentlyPlaying: null, setCurrentlyPlaying: vi.fn() }),
}))
vi.mock('./AttachToQuestionDialog', () => ({
  AttachToQuestionDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="attach-dialog" /> : null,
}))

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
})

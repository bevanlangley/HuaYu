import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PhraseCard } from './PhraseCard'
import type { Phrase } from '@/lib/database.types'

vi.mock('@/context/ConfirmDialogContext', () => ({
  useConfirmDialog: () => ({ openConfirmDialog: vi.fn() }),
}))
vi.mock('@/context/TtsContext', () => ({
  useTts: () => ({ voiceStatus: 'zh-TW', currentlyPlaying: null, setCurrentlyPlaying: vi.fn() }),
}))

function makePhrase(overrides: Partial<Phrase> = {}): Phrase {
  return {
    id: 'p1',
    seed_id: 's1',
    mandarin: '你好',
    pinyin: 'nǐ hǎo',
    english: 'Hello',
    phrase_type: 'statement',
    created_at: '2024-01-01',
    ...overrides,
  }
}

describe('PhraseCard', () => {
  it('shows a Question badge for question-typed phrases', () => {
    render(<PhraseCard phrase={makePhrase({ phrase_type: 'question' })} onEdit={vi.fn()} onDeleted={vi.fn()} />)
    expect(screen.getByText('Question')).toBeInTheDocument()
  })

  it('shows an Answer badge for answer-typed phrases', () => {
    render(<PhraseCard phrase={makePhrase({ phrase_type: 'answer' })} onEdit={vi.fn()} onDeleted={vi.fn()} />)
    expect(screen.getByText('Answer')).toBeInTheDocument()
  })

  it('shows a Statement badge for statement-typed phrases', () => {
    render(<PhraseCard phrase={makePhrase({ phrase_type: 'statement' })} onEdit={vi.fn()} onDeleted={vi.fn()} />)
    expect(screen.getByText('Statement')).toBeInTheDocument()
  })
})

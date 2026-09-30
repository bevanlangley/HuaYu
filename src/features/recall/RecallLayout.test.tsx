import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import { RecallLayout } from './RecallLayout'

vi.mock('./Translate', () => ({ Translate: () => <div>Translate content</div> }))
vi.mock('./QaPage', () => ({ QaPage: () => <div>Q&amp;A content</div> }))

import { Translate } from './Translate'
import { QaPage } from './QaPage'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/recall" element={<RecallLayout />}>
          <Route index element={<Navigate to="translate" replace />} />
          <Route path="translate" element={<Translate />} />
          <Route path="qa" element={<QaPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('RecallLayout routing', () => {
  it('redirects /recall to /recall/translate', () => {
    renderAt('/recall')
    expect(screen.getByText('Translate content')).toBeInTheDocument()
  })

  it('renders the Translate tab content at /recall/translate', () => {
    renderAt('/recall/translate')
    expect(screen.getByText('Translate content')).toBeInTheDocument()
  })

  it('renders the Q&A tab content at /recall/qa', () => {
    renderAt('/recall/qa')
    expect(screen.getByText('Q&A content')).toBeInTheDocument()
  })

  it('renders both tabs regardless of active route', () => {
    renderAt('/recall/qa')
    expect(screen.getByRole('link', { name: 'Translate' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Q&A' })).toBeInTheDocument()
  })

  it('marks the Translate tab active on /recall/translate', () => {
    renderAt('/recall/translate')
    expect(screen.getByRole('link', { name: 'Translate' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Q&A' })).not.toHaveAttribute('aria-current')
  })

  it('marks the Q&A tab active on /recall/qa', () => {
    renderAt('/recall/qa')
    expect(screen.getByRole('link', { name: 'Q&A' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Translate' })).not.toHaveAttribute('aria-current')
  })
})

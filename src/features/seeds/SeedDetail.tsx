import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { fetchSeedById } from '@/features/seeds/seedsService'
import { fetchPhrasesBySeed } from '@/features/phrases/phrasesService'
import { buildExchangeIndex, paginateGroups } from '@/features/phrases/exchanges'
import { linkConsequence } from '@/features/phrases/linkConsequence'
import { PhraseCard } from '@/features/phrases/PhraseCard'
import { PhraseForm } from '@/features/phrases/PhraseForm'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { InlineError } from '@/components/ui/InlineError'
import { Pagination } from '@/components/ui/Pagination'
import type { Seed, Phrase } from '@/lib/database.types'

const PAGE_SIZE = 25

export function SeedDetail() {
  const { seedId } = useParams<{ seedId: string }>()
  const navigate = useNavigate()
  const [seed, setSeed] = useState<Seed | null>(null)
  const [phrases, setPhrases] = useState<Phrase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingPhrase, setEditingPhrase] = useState<Phrase | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!seedId) return
    loadData()
  }, [seedId])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [seedData, phrasesData] = await Promise.all([
        fetchSeedById(seedId!),
        fetchPhrasesBySeed(seedId!),
      ])
      if (!seedData) {
        navigate('/seeds', { replace: true })
        return
      }
      setSeed(seedData)
      setPhrases(phrasesData)
    } catch {
      toast.error('Could not load seed. Try again.')
      setError('Could not load seed.')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditingPhrase(null)
    setFormOpen(true)
  }

  function handlePhraseEdit(phrase: Phrase) {
    setEditingPhrase(phrase)
    setFormOpen(true)
  }

  const exchangeIndex = useMemo(() => buildExchangeIndex(phrases), [phrases])
  const { pageGroups, totalPages } = paginateGroups(exchangeIndex.groups, page, PAGE_SIZE)
  const unpairedCount = exchangeIndex.unpairedCount

  // The database unlinks Answers when their Question is deleted or retyped (ADR 0003). The saved
  // row is applied locally at once; if other rows were affected, refetch rather than predict.
  async function refreshAfterUnlink() {
    try {
      setPhrases(await fetchPhrasesBySeed(seedId!))
    } catch {
      toast.error("Phrase saved, but the list couldn't refresh. Reload to see linked answers.")
    }
  }

  function handlePhraseSaved(saved: Phrase) {
    const previous = phrases.find(p => p.id === saved.id)
    setPhrases(prev =>
      prev.some(p => p.id === saved.id) ? prev.map(p => (p.id === saved.id ? saved : p)) : [...prev, saved]
    )
    if (!previous) return
    const { unpairsAnswers } = linkConsequence(
      previous,
      { kind: 'retype', to: saved.phrase_type },
      exchangeIndex.answerCount(previous.id)
    )
    if (unpairsAnswers > 0) void refreshAfterUnlink()
  }

  function handlePhraseDeleted(id: string) {
    const previous = phrases.find(p => p.id === id)
    setPhrases(prev => prev.filter(p => p.id !== id))
    if (!previous) return
    const { unpairsAnswers } = linkConsequence(previous, { kind: 'delete' }, exchangeIndex.answerCount(id))
    if (unpairsAnswers > 0) void refreshAfterUnlink()
  }

  function renderPhraseCard(phrase: Phrase) {
    return (
      <PhraseCard
        key={phrase.id}
        phrase={phrase}
        isUnpaired={exchangeIndex.isUnpaired(phrase.id)}
        linkedAnswerCount={exchangeIndex.answerCount(phrase.id)}
        onEdit={handlePhraseEdit}
        onDeleted={handlePhraseDeleted}
        onUpdated={handlePhraseSaved}
      />
    )
  }
  const unpairedBadge = unpairedCount > 0 && <Badge variant="warning">{unpairedCount} unpaired</Badge>

  const addButton = (
    <Button size="sm" onClick={openCreate}>
      <Plus className="h-4 w-4" />
      Add phrase
    </Button>
  )

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <Skeleton className="mb-4 h-6 w-48" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <Header title={seed?.name ?? 'Seed'} actions={addButton} />

      <div className="p-4 md:p-6">
        {/* Desktop header */}
        <div className="mb-6 hidden md:block">
          <Link
            to="/seeds"
            className="mb-4 inline-flex items-center gap-1 text-sm text-grey-500 hover:text-grey-700 dark:text-grey-400 dark:hover:text-grey-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Seeds
          </Link>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-medium text-grey-800 dark:text-grey-100">{seed?.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="count">{phrases.length} phrase{phrases.length !== 1 ? 's' : ''}</Badge>
                {seed?.tag && <Badge variant="tag">{seed.tag}</Badge>}
                {unpairedBadge}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {phrases.length > 0 && (
                <Button variant="secondary" size="sm" asChild>
                  <Link to="/drill" state={{ seedId: seed?.id }}>
                    <Zap className="h-4 w-4" />
                    Drill
                  </Link>
                </Button>
              )}
              {addButton}
            </div>
          </div>
        </div>

        {/* Mobile back link */}
        <div className="mb-4 flex items-center gap-2 md:hidden">
          <Link
            to="/seeds"
            className="inline-flex items-center gap-1 text-sm text-grey-500 hover:text-grey-700 dark:text-grey-400 dark:hover:text-grey-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Seeds
          </Link>
          {unpairedBadge}
          {phrases.length > 0 && (
            <Button variant="secondary" size="sm" className="ml-auto" asChild>
              <Link to="/drill" state={{ seedId: seed?.id }}>
                <Zap className="h-4 w-4" />
                Drill
              </Link>
            </Button>
          )}
        </div>

        {error && <InlineError message={error} className="mb-4" />}

        {phrases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-grey-500 dark:text-grey-400">
              No phrases yet. Add your first phrase from this source.
            </p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add a phrase
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {pageGroups.map(group =>
                group.kind === 'standalone' ? (
                  renderPhraseCard(group.phrase)
                ) : (
                  <div
                    key={group.question.id}
                    data-testid="exchange-group"
                    className="flex flex-col gap-2 rounded-lg border border-grey-200 bg-grey-100 p-2 dark:border-grey-700 dark:bg-grey-800 sm:col-span-2"
                  >
                    {renderPhraseCard(group.question)}
                    {group.answers.map(answer => renderPhraseCard(answer))}
                  </div>
                )
              )}
            </div>
            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>

      {seed && (
        <PhraseForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          seedId={seed.id}
          phrase={editingPhrase}
          linkedAnswerCount={
            editingPhrase ? exchangeIndex.answerCount(editingPhrase.id) : 0
          }
          onSaved={handlePhraseSaved}
        />
      )}
    </div>
  )
}

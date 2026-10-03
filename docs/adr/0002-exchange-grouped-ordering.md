# 2. Exchange-grouped ordering for the Phrase list and Drilling

## Status
Accepted

## Context
Phrases within a Seed were always ordered strictly by `created_at ASC`, with no awareness of the
Question↔Answer Link (see ADR 1). A Question could land anywhere relative to its Answers — the
Question first in the list while its Answer was last, or vice versa — because nothing about
`phrase_type` or `question_id` fed into display or playback order. Drilling (sequential or
shuffled) inherited the same flat order, so a Question and its Answers were never guaranteed to
play adjacently, defeating the point of an Exchange as a drillable unit.

The user wanted two things once a Question and its Answers were visibly/audibly linked: (1) open a
Seed and see each Exchange (Question + Answers) grouped together in the Phrase list, and (2) drill
a Seed — in order or shuffled — and always hear a Question immediately followed by its Answer(s).

Two trade-offs had to be resolved to get there.

### (a) Grouped vs. flat ordering
Flat `created_at ASC` ordering is simple and was an explicit prior rule (`CLAUDE.md`: "Phrases
always ordered by `created_at ASC`. No reordering feature in any phase"). Grouping requires
deriving a different order from the existing Link on every read, with no new stored order.

### (b) Atomic vs. split Exchanges under pagination and shuffle
Once Exchanges are grouped, two consumers can still break that grouping in practice:
- **Pagination** could land a page boundary between a Question and its Answer if pages are sliced
  by a strict row count.
- **Shuffle** (Drilling's `random` mode) previously shuffled every Phrase independently, which
  would scatter an Exchange's Answers away from its Question exactly as often as it would any two
  unrelated Phrases.

## Decision
Compute Exchange-grouped order on read, from the existing `phrase_type`/`question_id` columns —
no schema change, no stored order column, no user-driven manual reordering. A Question with ≥1
linked Answer is grouped with those Answers (Question first, Answers in their own `created_at ASC`
order); every other Phrase (Statement, unpaired Question, unpaired Answer) stays in plain
`created_at ASC` order. One function (`groupPhrasesByExchange`, `phrasesService.ts`) is the single
source of this grouping, consumed by both the Seed Detail list and Drilling.

Both edge cases were resolved in favor of **atomic**, not split:
- Pagination walks groups rather than individual rows, and a page boundary never falls inside an
  Exchange — a page's row count can land slightly above or below the usual ~25, but an Exchange is
  never torn across two pages.
- Shuffle groups phrases into Exchange/standalone units first, then shuffles those units — so
  shuffle randomizes an Exchange's position relative to other Exchanges and standalone Phrases,
  but never separates a Question from its own Answers, and never reorders Answers within an
  Exchange.

The simpler alternatives (flat ordering; splitting an oversized Exchange across pages; shuffling
every Phrase independently) were rejected because each one reintroduces the exact problem this
feature exists to solve — a Question and its Answer landing apart from each other, just less often
instead of never.

## Consequences
- `CLAUDE.md`'s ordering rule and `CONTEXT.md`'s Drilling entry describe grouped ordering as the
  rule, not flat `created_at ASC` — the prior documented rule was deliberately superseded, not
  violated by omission.
- A page can contain slightly more or fewer than the nominal page-size rows when an Exchange
  straddles what would otherwise be the boundary; this is intentional, not a counting bug.
- Shuffle is no longer a pure independent shuffle of every Phrase — it shuffles Exchange/standalone
  units. A future feature that wants true per-Phrase shuffle (ignoring Exchange grouping) would
  need an explicit opt-out, not a flag flip, since atomicity is now the expected default.
- If Answer reuse across Questions is ever introduced (see ADR 1's consequences), grouping still
  holds: `groupPhrasesByExchange` only needs each Answer to resolve to exactly one Question at
  read time, regardless of how that resolution is stored.

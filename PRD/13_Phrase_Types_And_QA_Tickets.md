# Tickets — Phrase Types & Q&A Recall

Work breakdown for `13_Phrase_Types_And_QA.md`. Each ticket is scoped to be independently
committable; tickets within a stage can land in any order, but a stage doesn't deploy until all
its tickets are done and its verification step passes. Stage boundaries match the three Vercel
deploys agreed in the spec's **Staged Delivery** section.

Checkbox state reflects implementation status, not planning status — everything starts
unchecked.

---

## Stage 0 — Design Token Refactor

Landed first because Stage 1's new badge variants depend on real tokens existing, and because
it's independently verifiable (zero visual diff) before any feature code touches it.

- [ ] **T0.1 — Add semantic colour tokens to `tailwind.config.js`**
  Add `success`, `warning`, `error` (incl. `error.text-dark-alt` = `#fca5a5`), `info`, and
  `qa-answer` colour objects, per the spec's **Design System Changes** section. No existing
  token values change.

- [ ] **T0.2 — Migrate `badge.tsx` to token classes**
  Replace hardcoded hex in `success`/`warning`/`error` variants with the new tokens. Add `info`
  and `qa-answer` variants (unused until Stage 1, but land the primitive here).
  *Verify:* visual diff of existing badges (tag, count, success, warning, error) is zero.

- [ ] **T0.3 — Migrate the 9 inline error-text sites to tokens**
  `LoginPage.tsx`, `PhraseCard.tsx`, `PhraseForm.tsx`, `SeedCard.tsx`, `SeedForm.tsx`:
  `text-[#991b1b] dark:text-[#fca5a5]` → `text-error-text dark:text-error-text-dark-alt`.
  `InlineError.tsx`, `OfflineBanner.tsx`: their existing `#fee2e2`/`#991b1b` dark-symmetric pair
  → `bg-error-bg text-error-text dark:bg-error-bg-dark dark:text-error-text-dark`.
  Add a one-line comment on `main.tsx`'s hardcoded hex explaining it's exempt (pre-mount, no
  Tailwind classes exist yet).
  *Verify:* zero visual diff, confirmed by comparing rendered dark/light error states before
  and after.

- [ ] **T0.4 — Update `.claude/memory/design-system.md`**
  Add the Info row and `qa-answer` row to the semantic table; document `#fca5a5` as "Error text
  (dark, inline validation)"; note the phrase-type badge colour mapping (forward reference —
  the variants don't render anywhere yet).

---

## Stage 1 — Schema, Authoring, Visual Typing

Ships together with Stage 0 in the same deploy per the spec. Verifiable alone: a user can
categorise every Phrase and link Questions to Answers before any Q&A UI exists.

- [ ] **T1.1 — Migration: `phrase_type` enum + `question_id` + composite FK**
  Write `supabase/migrations/<timestamp>_add_phrase_types_and_links.sql` per the spec's **Data
  Model** SQL. Push via `npx supabase db push`. Note: `npx supabase migration list` currently
  shows the existing RLS migration as unrecorded remotely (applied by hand, never tracked) —
  resolve this first (`supabase migration repair` for the old one) so the new migration doesn't
  attempt to replay it.
  *Verify:* `npx supabase migration list` shows both migrations applied remotely. Manually
  attempt a cross-seed link via SQL and confirm the FK rejects it.

- [ ] **T1.2 — Regenerate `database.types.ts`**
  `npx supabase gen types typescript --linked > src/lib/database.types.ts`. Add derived types:
  `PhraseType`, `Exchange` (`{ question: Phrase; answers: Phrase[] }`), and whatever shape the
  Exchange-fetch query needs.

- [ ] **T1.3 — Extend `phraseSchema` (zod)**
  Add `phrase_type: z.enum(['question', 'answer', 'statement'])` and
  `question_id: z.string().uuid().nullable().optional()`. Add/update
  `src/lib/schemas/phrases.test.ts` for the new fields.

- [ ] **T1.4 — Extend `phrasesService.ts`**
  - `createPhrase`/`updatePhrase`: accept the new fields.
  - New: `fetchQuestionsBySeed(seedId)` — Questions only, for the picker dropdown.
  - New: `attachAnswerToQuestion(answerId, questionId | null)`.
  - `updatePhrase`: when retyping a Question away from `question` and it has linked Answers,
    the caller (form/card) is responsible for the confirm dialog per the transition table in
    the spec — the service function itself just performs the write; it does not own UI concerns.
  - Delete dead exports in this file if untouched by this ticket (see T1.9 — kept separate so
    this ticket stays focused on additive changes).
  *Tests:* `phrasesService.test.ts` — cover all five type-transition rows from the spec's table.

- [ ] **T1.5 — `PhraseForm`: type selector + conditional fields**
  Add the required Phrase Type selector. Add the conditional Question dropdown when
  `phrase_type = 'answer'` (populated via `fetchQuestionsBySeed`). No chained flow yet — that's
  T1.6.
  *Tests:* form renders correct conditional fields per type; validation requires `phrase_type`.

- [ ] **T1.6 — `PhraseForm`: chained answer-authoring flow**
  After saving a new Question: "Add an answer to this question now?" (Yes/Skip). Yes re-opens
  the modal locked to `phrase_type = 'answer'` + this `question_id`, title updated, only the
  three text fields visible; on save, prompts "Add another answer?" (Done/Add another) instead
  of closing.
  *Tests:* the full chain (create question → yes → add answer → add another → done) produces
  the expected sequence of Supabase calls and the expected final phrase set.

- [ ] **T1.7 — `PhraseCard`: type badge + unpaired warning + kebab actions**
  Badge per type (reusing T0.2's variants). `AlertTriangle` warning icon + `aria-label` when
  unpaired (Question with 0 Answers, or Answer with `question_id IS NULL`). Kebab menu gains
  "Add answer" (Question type) or "Attach to question" (Answer type), per the spec.
  "Attach to question" opens a picker using `fetchQuestionsBySeed`; selecting "None" clears the
  link, silently (no confirm — this only changes this row).
  *Tests:* badge renders correct variant/label per type; warning icon appears/absent per pairing
  state; kebab items conditional on type.

- [ ] **T1.8 — `SeedDetail`: unpaired count badge + delete/retype confirms**
  Header gains the `warning`-variant "N unpaired" badge (omitted at 0). Delete-Phrase confirm
  dialog text branches per the spec's **Deleting a Phrase** section. Retype confirm fires only
  for "Question → other, has linked Answers" (per T1.4's transition table).
  *Tests:* confirm dialog copy and trigger conditions for each transition/delete case.

- [ ] **T1.9 — Delete dead code**
  Remove `PhraseCardGlobal.tsx`, `fetchAllPhrases` (and its test coverage) from
  `phrasesService.ts` — unreferenced since the GlobalPhrases route was removed
  (commit `5f3d5fb`). Confirm via `grep -rn "PhraseCardGlobal\|fetchAllPhrases\b" src` that
  nothing else references them before deleting.
  *Verify:* `npx tsc -b --noEmit` and full test suite still pass after removal.

**Stage 1 deploy gate:** `npx tsc -b --noEmit`, `npx vitest run`, manual smoke test (create a
Question, chain an Answer, verify badge/warning/unpaired-count behaviour in both light and dark
mode), Vercel build green.

---

## Stage 2 — Recall Route Split

Ships alone. Verifiable independently: routing and "Translate is unchanged" are checkable
before Q&A session logic exists.

- [x] **T2.1 — Extract `Translate` subcomponent**
  Move `RecallPage.tsx`'s existing JSX/logic into `src/features/recall/Translate.tsx` (or
  equivalent), unchanged. Existing `RecallPage.test.tsx` and `useRecall.test.ts` should pass
  against the relocated component with only import-path changes — if behaviour changes to make
  tests pass, that's a regression, not a valid fix.

- [x] **T2.2 — Tab strip + route split**
  New `/recall` route redirects to `/recall/translate`. Add `/recall/qa`. Tab strip component
  (`Translate | Q&A`, `NavLink`-based) shared by both, styled consistent with
  `BottomNav`/`Sidebar` active-state conventions.
  *Tests:* routing test — `/recall` redirects, both tabs render, active tab styling matches the
  current path.

- [x] **T2.3 — Q&A configuration panel (no live session yet)**
  Build the Source/Order/Display-text/Start panel per the spec. On Start, show a "Coming soon"
  placeholder rather than a live session — this ticket is scaffolding only.
  *Tests:* panel renders seed list with exchange counts (stub/mock the count query if Stage 3's
  real query isn't built yet), zero-exchange seeds render disabled.

**Stage 2 deploy gate:** `npx tsc -b --noEmit`, `npx vitest run`, manual check that `/recall`
still behaves exactly as before for Translate, Vercel build green.

---

## Stage 3 — Q&A Session

Ships alone, last. By this point Stage 1 authoring work means real Exchanges exist to drill.

- [ ] **T3.1 — Exchange fetch service function**
  `fetchExchangesBySeed(seedId)` / `fetchAllExchanges()` in `phrasesService.ts` (or a new
  `exchangesService.ts` if that reads cleaner) — Questions with ≥1 linked Answer, Answers
  `created_at ASC`. Also a seeds-with-exchange-count query for the config panel (replacing
  T2.3's stub).
  *Tests:* returns only Questions with ≥1 Answer; excludes Statements and unpaired rows;
  Answers ordered correctly.

- [ ] **T3.2 — `useQa` hook**
  Mirrors `useRecall`'s shape (seeds list, session state, current index, reveal state,
  start/stop/next/previous), adapted for Exchanges instead of single Phrases. Random shuffles
  Exchange order only, never Answer order within one.
  *Tests:* mirror `useRecall.test.ts` structure — session lifecycle, navigation bounds — plus
  new cases: single-vs-multi-answer distinction available to the UI layer, All-seeds vs
  per-seed scope.

- [ ] **T3.3 — Q&A session UI**
  Pre-reveal: Question Mandarin+Pinyin (respecting Display-text toggle), English withheld,
  Replay button, autoplay on Start/Next/Previous, Reveal button.
  Post-reveal: Question stays visible with Replay; English now shown; each Answer listed with
  Mandarin/Pinyin/English. Exactly one Answer → autoplay. Multiple Answers → no autoplay, each
  gets its own `AudioPlayButton` (reuse existing component/`TtsContext`, no new plumbing).
  Previous/Next/Stop identical shape to Translate.
  *Tests:* single-answer autoplay fires; multi-answer autoplay does not fire and both play
  buttons are independently clickable; Display-text off hides pre-reveal text but not
  post-reveal text.

**Stage 3 deploy gate:** `npx tsc -b --noEmit`, `npx vitest run`, manual end-to-end Q&A session
(single-answer and multi-answer Exchange, both Display-text states, both seed-scope options),
Vercel build green.

---

## Out of Scope (Do Not Build)

- Answer reuse across multiple Questions (ADR 0001).
- A Q&A "session complete" panel (Translate doesn't have one; no request to add one to either).
- Scoring, streaks, or correctness tracking in Q&A.
- Any change to `/drill` or `useDrilling`.
- Unifying `#fca5a5` with the badge's dark error pair, or touching shadcn's `--destructive`
  CSS variable (Stage 0 explicitly does not do this — see spec).

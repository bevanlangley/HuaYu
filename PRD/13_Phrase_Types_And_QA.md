# Phrase Types & Q&A Recall

## Overview

This feature introduces **Phrase Type** (Question / Answer / Statement) as a property of every
Phrase, lets Questions be linked to their Answers within a Seed, and adds a new **Q&A**
subsection to Recall that drills those linked pairs: hear the Question, say an Answer aloud,
Reveal to check yourself against every linked Answer.

Recall becomes two subsections under one route family:
- **Translate** — the existing Recall behaviour, unchanged, moved to `/recall/translate`.
- **Q&A** — new, at `/recall/qa`.

Terminology used throughout this document (Seed, Phrase, Phrase Type, Question, Answer,
Statement, Link, Exchange, Unpaired) is defined in `/CONTEXT.md`. Read that first if any term
here is ambiguous.

See `docs/adr/0001-one-to-many-question-answer-links.md` for why one Question may have many
Answers, but one Answer belongs to at most one Question (not a many-to-many junction table).

## Dependencies

- `02_Database_Schema.md` — `phrases` table (extended by this feature)
- `03_UI_Design_System.md` — Badge component, confirm dialog, modal, toast patterns
- `06_Phrases_Within_Seed.md` — Phrase CRUD, Phrase card, Add/Edit modal (extended by this
  feature — do not treat as frozen)
- `08_TTS_Audio.md` — `speakMandarin`, `AudioPlayButton`, voice availability
- `09_Fluency_Drilling.md` — **unaffected by this feature.** Drilling behaves identically
  regardless of Phrase Type.
- `.claude/memory/design-system.md` — token refactor (Stage 0, below) touches this file

## Non-Goals

- Drilling does not change. A Question phrase drills exactly like a Statement in `/drill`.
- No many-to-many reuse of one Answer across multiple Questions (ADR 0001).
- No bulk retyping or bulk linking UI — one Phrase, one link action, at a time.
- No scoring or correctness tracking in Q&A — Reveal shows the answer; the user self-assesses,
  identical in spirit to Translate.

---

## Data Model

### `phrase_type` enum (new)

```sql
create type phrase_type as enum ('question', 'answer', 'statement');
```

A native enum, not `text` + `CHECK` — this is what makes `supabase gen types` emit a real
TypeScript union (`'question' | 'answer' | 'statement'`) instead of `string`, matching the
project's "never hand-write row types" rule.

### `phrases` table (extended)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `phrase_type` | `phrase_type` | NOT NULL, default `'statement'` | New column |
| `question_id` | uuid | nullable, FK (see below) | New column. Non-null only when `phrase_type = 'answer'` and the Answer is linked |

**Same-seed FK enforcement:**

```sql
alter table phrases add column phrase_type phrase_type not null default 'statement';
alter table phrases add column question_id uuid;

-- Composite uniqueness needed so question_id + seed_id can be a composite FK target
alter table phrases add constraint phrases_id_seed_id_unique unique (id, seed_id);

alter table phrases add constraint phrases_question_id_fkey
  foreign key (question_id, seed_id) references phrases (id, seed_id)
  on delete set null (question_id);
```

`on delete set null (question_id)` (column-specific SET NULL, PG 15+; confirmed available —
project runs Postgres 17.6) means deleting a Question nulls only `question_id` on its Answers,
leaving `seed_id` untouched. This makes a cross-Seed link a database-level impossibility, not
just a UI convention — the FK target `(id, seed_id)` can only match a row where both columns
agree, so `question_id` can never point at a Phrase in a different Seed than the Answer itself.

**Invariants enforced at the application layer (not the database):**
- `question_id` is only meaningful when `phrase_type = 'answer'`. The database does not enforce
  "a `question` row can never have `question_id` set" — the UI never offers that combination,
  and the picker/link actions never write it.
- A row with `phrase_type = 'question'` is never itself a `question_id` target validation beyond
  the FK's existence check (i.e. nothing stops linking to a Phrase that happens to be typed
  `statement` at the database level) — the UI is responsible for only listing `question`-typed
  Phrases in the picker. This is a pragmatic call: a full `CHECK` enforcing "target must be typed
  question" requires a trigger, and the single-app, single-writer nature of this project makes
  that additional enforcement layer not worth the complexity.

**Existing rows:** backfill `phrase_type = 'statement'` for every current row (the column
default handles this — no explicit `UPDATE` needed since the column is added `NOT NULL DEFAULT`).

**Regenerate `src/lib/database.types.ts`** after this migration (`npx supabase gen types
typescript --linked`).

### Derived concepts (not columns)

- **Unpaired Question**: `phrase_type = 'question'` AND no Phrase has `question_id` pointing at
  it.
- **Unpaired Answer**: `phrase_type = 'answer'` AND `question_id IS NULL`.
- **Exchange**: a `question`-typed Phrase with ≥1 Phrase pointing at it via `question_id`. The
  Question plus all such Answers, ordered `created_at ASC`.
- **Exchange count for a Seed**: count of distinct Questions in that Seed with ≥1 linked Answer.

---

## Seed Detail View Changes

### Phrase Type Badge

Every Phrase card gains a type badge (new `Badge` variants — see `03_UI_Design_System.md`
update below):

| Type | Badge label | Badge colour |
|------|-------------|--------------|
| Question | "Question" | Info blue (`bg-[#dbeafe] text-[#1e40af]`, documented but previously unused semantic token) |
| Answer | "Answer" | New violet token (`bg-[#ede9fe] text-[#5b21b6]`) |
| Statement | "Statement" | Neutral grey (existing `count` badge variant — statement is the "nothing special" case) |

Colour is reinforcement, never the sole signal — the label text is always present so the badge
reads correctly under any colour vision.

### Unpaired Warning Icon

A Question with zero linked Answers, or an Answer with `question_id IS NULL`, shows a warning
icon (Lucide `AlertTriangle`, amber, 16px) next to its type badge, with
`aria-label="Unpaired — does not appear in Q&A"`. Statements never show this icon — they never
participate in pairing.

This is informational, not blocking: unpaired Phrases save, display, drill, and translate
normally. They simply don't appear in Q&A until linked.

### Unpaired Count (Seed Header)

The Seed detail header (both desktop and mobile layouts) gains a count when the Seed has any
unpaired Question or Answer:

> ⚠ 2 unpaired

Shown as a `warning`-variant `Badge` adjacent to the existing phrase-count badge. Omitted
entirely when the count is 0. Clicking it does nothing special (Phase 1) — it's a signal, not a
filter/navigation control.

### Phrase Card: Type-Dependent Actions

The existing kebab menu (Edit | Delete) gains a conditional third item depending on type:

- **Type = Question, no linked Answers or has some:** "Add answer" — opens the Add Phrase
  modal in **answer-authoring mode** (see below): `phrase_type` locked to `answer`, `question_id`
  pre-set to this Question, Seed locked. Available regardless of whether the Question already
  has Answers (supports "one question, multiple answers").
- **Type = Answer:** "Attach to question" — opens a lightweight picker (a `<select>` of this
  Seed's Questions, `created_at ASC`) to set or change `question_id`. If already linked, the
  current Question is pre-selected; choosing "None" clears the link (silent — this only affects
  the row being edited, per the confirm rule below).
- **Type = Statement:** no third item. Statements cannot hold or receive a link.

---

## Add/Edit Phrase Modal Changes

### Phrase Type Selector

The Add/Edit Phrase form (`PhraseForm`) gains a required **Phrase Type** selector (segmented
control or `<select>`, matching existing form input styling), positioned after the English
field. Default on create: `statement`. On edit: the Phrase's current type.

```
Mandarin *
Pinyin *
English *
Phrase Type *  [ Question | Answer | Statement ]
```

### Conditional Fields Per Type

**When `phrase_type = 'question'`:** After saving, if this is a *new* Question (create mode,
not edit), show an inline prompt: *"Add an answer to this question now?"* with **Yes** /
**Skip**. **Yes** keeps the modal open, switches its title to *"Add an answer to [question
mandarin]"*, clears the Mandarin/Pinyin/English fields, locks `phrase_type = 'answer'` and
`question_id` to the just-created Question (both hidden from the form — the user only sees the
three text fields), and re-shows itself after each save with *"Add another answer?"* /
**Done**. This is the **chained answer-authoring flow** — it lets a Question and all its
Answers be entered in one sitting without reopening the modal each time.

**When `phrase_type = 'answer'`:** A **Question** dropdown appears (optional at save time — an
Answer can be saved unlinked and attached later via the card's "Attach to question" action).
Populated from this Seed's `question`-typed Phrases, `created_at ASC`. Selecting "No question
yet" leaves `question_id` null (the Phrase saves as an unpaired Answer, warning icon and all).

**When `phrase_type = 'statement'`:** No additional fields. This is also the shape of every
existing Phrase before this feature shipped.

### Editing an Existing Phrase's Type

Allowed with no special restriction on the type transition itself. Consequences depend on
direction, and only side-effects on *other rows* require confirmation (per the project's
existing `openConfirmDialog` pattern — see `.claude/memory/patterns.md` §5):

| From → To | Effect | Confirm? |
|---|---|---|
| Answer → Statement/Question | `question_id` cleared on this row | No — only this row changes |
| Question → Statement/Answer, **no linked Answers** | Nothing else to clean up | No |
| Question → Statement/Answer, **has linked Answers** | Every linked Answer's `question_id` is cleared, orphaning them | **Yes** — dialog: *"This question has N linked answer(s). Changing its type will unlink them; they'll become unpaired and drop out of Q&A. Continue?"* |
| Statement → Question/Answer | No prior links exist (Statements can't hold links) | No |

The rule in one sentence, worth stating explicitly since it generalises beyond this feature:
**a destructive side-effect on a row you are not directly editing always gets a confirm
dialog; a side-effect confined to the row you're editing does not.**

---

## Deleting a Phrase

Extends the existing delete flow (`06_Phrases_Within_Seed.md`), which currently has no
cascade consequences to mention. Now:

- **Deleting a Statement or an unlinked Answer:** unchanged — "This will permanently delete
  this Phrase. This can't be undone."
- **Deleting a Question with linked Answers:** confirm dialog names the count: *"This question
  has N linked answer(s). Deleting it will unlink them — they'll become unpaired and drop out
  of Q&A, but won't be deleted. This can't be undone."* On confirm: delete the Question row;
  the database `ON DELETE SET NULL` nulls `question_id` on the former Answers automatically.
- **Deleting an Answer:** unchanged in effect (its own row is removed; nothing points at it via
  FK), but if it's linked, mention what's lost: *"This will permanently delete this answer.
  This can't be undone."* (No cascade wording needed — nothing downstream references an
  Answer's id.)

---

## Recall: Route & Navigation Changes

### Routing

```
/recall               → redirect → /recall/translate
/recall/translate     → Translate subsection (existing RecallPage content, unchanged)
/recall/qa            → Q&A subsection (new)
```

Both subsections share a **tab strip** at the top of the Recall page (`Translate | Q&A`,
`NavLink`-based, same active-state styling as `BottomNav`/`Sidebar`). The tab strip is visible
whether or not a session is active in either subsection.

### Bottom Nav / Sidebar

The existing "Recall" nav item (`BrainCircuit` icon) now links to `/recall` (which redirects to
`/recall/translate`) — no change to the nav item itself, only to what's behind it.

---

## Q&A Subsection (`/recall/qa`)

Mirrors the Translate subsection's structure and interaction shape wherever this document
doesn't call out a difference — same layout scaffold, same Previous/Next/Stop controls, same
"no session active" config panel giving way to "session active" panel.

### Configuration Panel (Pre-Session)

| Control | Behaviour |
|---|---|
| **Source** | `<select>`: "All seeds" (default) + one entry per Seed, showing its Exchange count, e.g. "Taxi Conversations (4)". Seeds with 0 Exchanges are listed but disabled, so the user can see *why* a seed is missing rather than wondering where it went. |
| **Order** | Two-button toggle: "In order" / "Random" (default: Random — matches Translate's default). |
| **Display text** | Toggle: on (default) / off. See below for what this governs. |
| **Start** | Primary button. Disabled while Exchanges are loading. Loads all Exchanges for the selected scope, applies ordering, begins the session. |

**Query for Exchanges:** fetch all Questions in scope (`phrase_type = 'question'`) with their
linked Answers (`phrases` self-join on `question_id`), filter to Questions with ≥1 Answer,
order Questions per the Order setting and Answers within each Question by `created_at ASC`
(matching the project-wide Phrase ordering rule — this is the one thing the Order setting does
*not* touch).

### Active Session

**Layout**, per Exchange:

```
[ N / total ]

┌─────────────────────────────────────┐
│  你今天怎麼樣？          [▶ Replay]   │   ← Question (Mandarin + Pinyin always
│  nǐ jīntiān zěnmeyàng?                │      shown pre-reveal; English withheld)
│                                        │
│         [ Reveal ]                    │   ← pre-reveal state
└─────────────────────────────────────┘

[ Previous ]  [ Next ]  [ Stop ]
```

**Display text = off:** the Question's Mandarin/Pinyin are hidden pre-reveal too — the box
shows only the Replay control and the Reveal button, making this a pure listening-comprehension
prompt. The toggle governs the *prompt only*; Reveal is unaffected either way (see below). This
is the same relationship Translate has between "guess before reveal" and "the answer is always
fully shown after."

**On Start / Next / Previous:** the current Question's Mandarin auto-plays immediately (no
timer, no gap — unlike Drilling, there is no auto-advance; the session waits indefinitely at
this state until the user acts).

**Pre-reveal:** Question Mandarin + Pinyin shown (if Display text is on); English is withheld
regardless of the Display text setting — it stays a comprehension exercise, not a reading one.
A Replay button re-speaks the Question. A single "Reveal" button is the only other control.

**On Reveal**, the box expands to show, in order:

```
┌─────────────────────────────────────┐
│  你今天怎麼樣？          [▶ Replay]   │   ← Question stays visible, replayable
│  nǐ jīntiān zěnmeyàng?                │
│  How are you today?                   │   ← English now shown
│  ─────────────────────────────────   │
│  我很好                    [▶ Play]   │   ← each Answer: Mandarin, Pinyin,
│  wǒ hěn hǎo                           │      English, individual play button
│  I'm doing well                       │
│  ─────────────────────────────────   │
│  還不錯                    [▶ Play]   │
│  hái búcuò                            │
│  Not bad                              │
└─────────────────────────────────────┘
```

- **Exactly one linked Answer:** it **auto-plays** immediately on reveal (no button press
  needed) — mirrors Translate's single-answer reveal-and-hear behaviour.
- **More than one linked Answer:** **none** auto-play. Each Answer gets its own
  `AudioPlayButton` (reusing the existing component — it already supports per-`id` exclusive
  playback via `TtsContext`, so nothing new is needed there). The user picks which to hear.
- Answers are always listed in `created_at ASC`, regardless of the session's Order setting
  (Order only shuffles which *Exchange* comes next, never the Answers within one).

**Navigation:** identical shape to Translate — `Previous` (disabled on first Exchange), `Next`
(disabled on last Exchange), `Stop` (ends session, returns to the configuration panel). No
"session complete" panel — running out of Exchanges just means Next is disabled and the user
presses Stop, exactly as Translate behaves today.

### What Doesn't Change

- Statements never appear in Q&A, at any point.
- Unpaired Questions and unpaired Answers never appear in Q&A.
- Drilling (`/drill`) is completely unaffected — it drills every Phrase in a Seed regardless of
  type, exactly as before.
- Translate (`/recall/translate`) is completely unaffected — no type filter, same behaviour as
  before this feature.

---

## Design System Changes (Stage 0 — Token Refactor)

This feature is the occasion for closing a pre-existing gap: `badge.tsx`, `PhraseCard.tsx`,
`SeedCard.tsx`, `PhraseForm.tsx`, `SeedForm.tsx`, `LoginPage.tsx`, `InlineError.tsx`, and
`OfflineBanner.tsx` all hardcode semantic colour hexes directly in `className` strings, despite
`design-system.md`'s "never hardcode hex values" rule. Adding three more badge variants the same
way would double down on the inconsistency, so this feature promotes **all** existing semantic
colours to real Tailwind tokens first, then adds the new ones alongside them the same way.

**This refactor must not change any rendered pixel.** Every existing hex value is preserved
exactly — including `#fca5a5`, the dark-mode error text colour used in 9 places that was never
written down in `design-system.md`. It is adopted as-is as the documented "Error text (dark)"
token, not replaced with the badge's `#fee2e2`/`#991b1b` dark pair. A refactor that changes
behavior or appearance stops being verifiable as "just a refactor."

### New `tailwind.config.js` tokens

```js
colors: {
  // ...existing primary/secondary/grey...
  success: { bg: '#d1fae5', text: '#065f46', 'bg-dark': '#065f46', 'text-dark': '#d1fae5' },
  warning: { bg: '#fef3c7', text: '#92400e', 'bg-dark': '#92400e', 'text-dark': '#fef3c7' },
  error:   { bg: '#fee2e2', text: '#991b1b', 'bg-dark': '#991b1b', 'text-dark': '#fee2e2',
             'text-dark-alt': '#fca5a5' }, // dark-mode inline error text (forms), distinct from badge/banner dark pair
  info:    { bg: '#dbeafe', text: '#1e40af', 'bg-dark': '#1e40af', 'text-dark': '#dbeafe' },
  'qa-answer': { bg: '#ede9fe', text: '#5b21b6' }, // new — Answer type badge, no dark-mode swap needed beyond standard bg/text
}
```

`error.text-dark-alt` is a deliberate second dark-mode error token, not a mistake to unify —
see "What This Refactor Does Not Do" below.

### `badge.tsx` — new variants

```typescript
variants: {
  variant: {
    tag: 'bg-secondary-100 text-secondary-500',
    count: 'bg-grey-100 text-grey-600 dark:bg-grey-700 dark:text-grey-300',
    success: 'bg-success-bg text-success-text dark:bg-success-bg-dark dark:text-success-text-dark',
    warning: 'bg-warning-bg text-warning-text dark:bg-warning-bg-dark dark:text-warning-text-dark',
    error: 'bg-error-bg text-error-text dark:bg-error-bg-dark dark:text-error-text-dark',
    info: 'bg-info-bg text-info-text dark:bg-info-bg-dark dark:text-info-text-dark',       // new
    'qa-answer': 'bg-qa-answer-bg text-qa-answer-text',                                     // new
    // 'qa-question' reuses `info`; 'qa-statement' reuses `count` — no new variant needed
  },
}
```

### Inline error text — all 9 sites

Replace `text-[#991b1b] dark:text-[#fca5a5]` with `text-error-text dark:text-error-text-dark-alt`
across `LoginPage.tsx`, `PhraseCard.tsx`, `PhraseForm.tsx`, `SeedCard.tsx`, `SeedForm.tsx`.
`InlineError.tsx` and `OfflineBanner.tsx` keep the badge-matching dark pair
(`text-error-text-dark`), since those already used `#991b1b`/`#fee2e2` symmetrically — only the
9 inline-validation-message sites used the `#fca5a5` variant.

`main.tsx`'s pre-mount `innerHTML` fallback keeps its literal hex — it runs before React (and
therefore Tailwind's generated classes) exists, so no token can apply there. Add a one-line
comment explaining why it's exempt from the "never hardcode" rule, so a future pass doesn't
"fix" it into a no-op.

### `design-system.md` updates

- Semantic table gains an "Info" row (already documented as a colour but never as a component)
  and a "qa-answer" row (new).
- Add a note: "Error text (dark, inline validation): `#fca5a5` — distinct from the Error badge's
  dark pair; used for form-field error messages only."
- Tags & Badges section gains: "Phrase type badges: Question = Info, Answer = qa-answer,
  Statement = count (existing neutral variant, unchanged)."

### What This Refactor Does Not Do

- Does not unify `#fca5a5` and `#991b1b`/`#fee2e2` into one dark-error token — they render
  differently today (softer pink vs. saturated red-on-red), and unifying them would be a visual
  change disguised as a refactor.
- Does not touch shadcn's separate `--destructive` CSS variable (a different red, used by
  shadcn primitives like `dialog.tsx`/`dropdown-menu.tsx` internals) — out of scope, pre-existing,
  unrelated to this feature.
- Does not touch `main.tsx`'s pre-mount hardcoded hex (see above).

---

## Staged Delivery

Per project convention (deploy after every meaningful change), this feature ships in three
Vercel deploys, each independently verifiable:

### Stage 0 + 1 — Schema, Authoring, Visual Typing
- Migration: `phrase_type` enum, `question_id` column, composite FK, `phrases_id_seed_id_unique`
- Regenerate `database.types.ts`
- Design-system token refactor (above), landed in the same deploy since the new badge variants
  depend on it
- `phraseSchema` (zod) extended with `phrase_type` and optional `question_id`
- `PhraseForm`: type selector, conditional Question dropdown, chained answer-authoring flow
- `PhraseCard`: type badge, unpaired warning icon, "Add answer" / "Attach to question" kebab
  actions
- `SeedDetail`: unpaired count badge in header
- Delete/retype confirm-dialog copy changes
- **Verifiable alone:** a user can categorise every Phrase in a Seed and link Questions to
  Answers, before any Q&A session UI exists.

### Stage 2 — Recall Route Split
- `/recall` → `/recall/translate` + `/recall/qa`, tab strip
- `RecallPage` content moves to a `Translate` subcomponent, unchanged behaviour
- `/recall/qa` ships as a functional configuration panel (Source/Order/Display text/Start) that,
  on Start, shows a "Coming soon" placeholder instead of a live session
- **Verifiable alone:** navigation and the Translate/unchanged-behaviour claim are checkable
  without the session logic existing yet.

### Stage 3 — Q&A Session
- `useQa` hook (mirrors `useRecall`'s shape: seeds-with-exchange-counts, session state,
  reveal state, navigation)
- Exchange fetch query (Questions + linked Answers, filtered to ≥1 Answer)
- Session UI: auto-play on Start/Next/Previous, Reveal expansion, single-vs-multi-answer
  autoplay rule, per-answer `AudioPlayButton` reuse
- **Verifiable alone:** by this stage, Stage 1's authoring work means real Exchanges already
  exist to drill against.

---

## Testing Notes

Per project testing defaults (unit + integration, non-negotiable):

- **Schema/migration:** verify the composite FK actually rejects a cross-seed link attempt
  (integration test against a test Supabase instance, or a `pgTAP`-style assertion if the
  project adopts one — otherwise, a manual verification step in Stage 1's acceptance).
- **`phrasesService`:** unit tests for the extended `createPhrase`/`updatePhrase` covering all
  five type-transition rows in the table above, especially that only the "has linked Answers"
  transitions trigger the confirm dialog.
- **`PhraseForm`:** unit tests for the chained answer-authoring flow (Yes/Skip, Done/Add another),
  and that the Question dropdown only lists `question`-typed Phrases from the same Seed.
- **`useQa`:** unit tests mirroring `useRecall.test.ts` — session start/stop, navigation bounds,
  reveal state — plus new cases: single-answer autoplay, multi-answer no-autoplay, Answers
  ordered `created_at ASC` independent of Exchange order.
- **`RecallPage` routing:** integration test that `/recall` redirects to `/recall/translate` and
  that Translate's existing test suite (`RecallPage.test.tsx`) still passes unmodified against
  the relocated component.

---

## Gaps & Assumptions

- **Answer reuse across Questions:** explicitly not supported (ADR 0001). A repeated reply is
  entered as a separate Phrase row per Question.
- **"Add answer" card action vs. chained modal flow:** both exist. The chained flow (triggered
  from Question creation) is the primary bulk-entry path; the card action covers adding an
  Answer to a Question created in an earlier session.
- **No Q&A "session complete" panel:** matches Translate's existing behaviour (Next simply
  disables on the last item).
- **No cross-seed Q&A exchange interleaving indicator:** when Source = "All seeds", the session
  does not visually distinguish which Seed each Exchange came from. Not requested; can be added
  later as a small badge if it proves confusing in practice.

# 1. One-to-many Question→Answer links, not a junction table

## Status
Accepted

## Context
The Q&A feature (see `PRD/13_Phrase_Types_And_QA.md`) requires linking Phrases of type Question
to Phrases of type Answer within the same Seed, so that a scripted "hear the question, say the
answer" drill can be built.

The natural cardinality question: can a single Answer be reused across multiple Questions? For
example, if a Seed contains both 你好嗎？ and 你今天怎麼樣？, and 我很好 is a valid reply to
both, should the user write 我很好 once and link it to both Questions, or write it twice?

Two designs were considered:

1. **Self-referencing FK column.** Add `question_id uuid references phrases(id)` directly to the
   `phrases` table, nullable, non-null only on rows where `phrase_type = 'answer'`. One Question
   can have many Answers (many rows pointing at it); one Answer points at exactly one Question.
2. **Junction table.** A `phrase_links` table with `(question_id, answer_id)` rows, permitting full
   many-to-many: one Answer reusable across many Questions, and (though not asked for) potentially
   one Answer requiring multiple Questions.

The project's own Phase 2 schema (`dialogue_phrases`, documented in `.claude/memory/database.md`)
already establishes the junction-table pattern for a different many-to-many relationship
(Dialogues ↔ Phrases), which made the junction table the "expected" answer a future reader might
reach for here too.

## Decision
Use the self-referencing FK column (option 1): `phrases.question_id`, one Question to many
Answers, one Answer to at most one Question. Reusing an Answer across multiple Questions is not
supported; the same reply text is entered as separate Phrase rows if needed for more than one
Question.

This was a deliberate user choice (not a default), made after being shown the trade-off directly:
the brief only described "one question, multiple answers" — never the reverse — and Phrase-level
reuse of an Answer across unrelated Questions was judged unnecessary complexity for a single-user
personal study tool, where re-typing a short reply is cheaper than building and maintaining a
many-to-many link model, its UI (multi-select picker), and its Q&A-session dedupe logic.

## Consequences
- Schema stays a single column addition to `phrases`, no new table, no new service layer.
- The "attach to a question" UI is a single-select dropdown, not a multi-select.
- Deleting or retyping a Question orphans its Answers (`ON DELETE SET NULL`); deleting or retyping
  an Answer only ever affects that one row, never a shared link other Phrases depend on.
- If Answer reuse across Questions is ever needed, this is an additive migration: introduce a
  junction table, backfill it from the existing `question_id` column, and deprecate the column —
  not a breaking change to existing data.
- Same-Seed enforcement is a composite FK (`(id, seed_id)` unique + composite FK on
  `question_id, seed_id`), which requires Postgres 15+ for column-specific `ON DELETE SET NULL`.
  Confirmed available (project runs Postgres 17.6).

# 3. The database owns Link validity (trigger, not a client-side sequence)

## Status
Accepted

## Context
Deleting a Question already unlinked its Answers atomically through the FK's
`ON DELETE SET NULL (question_id)`. Retyping a Question did not: the client sent two calls (update
the Question, then null its Answers' `question_id`), and if the second failed, the Answers kept
pointing at a Phrase that was no longer a Question. Retyping it back to Question later would
silently re-attach them with no confirmation. Nothing stopped a Link being written to a non-Question
(e.g. a stale "Attach to question" picker) or from a non-Answer either. The client also hand-copied
each server-side effect into local state, and that copy could drift from the server.

## Decision
A Postgres trigger on `phrases` owns every Link rule:
- A row that stops being a Question unlinks every Answer that references it.
- A row that stops being an Answer has its own `question_id` cleared.
- Any write that sets `question_id` is rejected unless the row is an Answer and the referenced
  Phrase is a Question.

A single update that retypes an Answer away *and* writes a new `question_id` is contradictory, so
the third rule wins and it is rejected; only a retype that leaves `question_id` untouched has its
Link cleared.

A one-time cleanup in the same migration nulls every existing Link that breaks these rules. After a
mutation that unlinks other Phrases, the client refetches the Seed's Phrases instead of predicting
the result locally.

## Considered Options
- **RPC (`retype_phrase`)**: atomic and explicit, but every client has to remember to use it
  instead of a plain `update`, and on its own it doesn't stop invalid Links being written.
- **Client-side sequence with retry**: no schema change, but still not atomic, and still needs
  partial-failure handling in the UI.

## Consequences
- Retyping is one plain `update` call. The client has no unlink call and no partial-failure branch.
- Deleting and retyping a Question now behave the same way: the database unlinks the Answers.
- Writing a Link to a non-Question fails with an error the UI must turn into a plain-language toast.
- This behaviour is hidden from anyone reading only the client code. The service layer carries a
  comment pointing here.
- Supabase has no local test setup in this repo, so the trigger is checked by a SQL script run inside
  a transaction that rolls back, not by the Vitest suite.

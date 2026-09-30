# HuaYu — Domain Glossary

This is a glossary, not a spec or implementation guide. It defines the vocabulary the codebase,
PRD, and AI agents should use consistently. Update inline whenever a term is introduced, sharpened,
or found to conflict with usage in code or conversation.

---

## Seed

An external learning source (a video, podcast, article) the user is mining for vocabulary. A Seed
has a name, an optional `source_url`, and an optional free-text `tag`. A Seed owns a collection of
Phrases. Deleting a Seed cascades to delete every Phrase it owns.

## Phrase

A single unit of Mandarin the user has learned from a Seed: Traditional Chinese (`mandarin`),
romanization (`pinyin`), and an English gloss (`english`). Every Phrase belongs to exactly one Seed
and carries a **Phrase Type**.

## Phrase Type

One of three mutually exclusive roles a Phrase plays: **Question**, **Answer**, or **Statement**.
Stored as a native Postgres enum (`phrase_type`), not free text — this is a closed set, not a
taxonomy the user extends. Every Phrase has exactly one type at all times; there is no "untyped"
state. New Phrases default to Statement, since that's what every Phrase was before this
distinction existed.

- **Question** — a Phrase meant to be asked, and optionally linked to one or more Answers within
  the same Seed.
- **Answer** — a Phrase meant to be spoken in reply to a Question. Linked to at most one Question
  via `question_id`. An Answer with no Question is **unpaired**.
- **Statement** — a Phrase with no relationship to any other Phrase. The default type, and the
  only type that participates in Translate but never in Q&A. Genuinely standalone: it cannot hold
  or receive a link.

Changing a Phrase's type after it has been linked is allowed, but destroys links to *other* rows
(see **Unpaired**) and requires confirmation for that reason — not because retyping itself is
unusual.

## Link (Question → Answer)

A directed relationship from an Answer to the Question it replies to, stored as
`phrases.question_id` on the Answer row, referencing the Question's `phrases.id`. The
relationship is **one Question to many Answers**: a single Question may have several valid
Answers, but a single Answer answers exactly one Question. Reusing one Answer across multiple
Questions is not supported — if the same reply is valid for two Questions, it is entered twice,
as two Phrase rows.

A Link is only ever formed between two Phrases in the **same Seed**; a Question and its Answers
never cross Seed boundaries. This is enforced at the database level (composite foreign key on
`(id, seed_id)`), not just in the UI.

## Exchange

The unit of drilling in the **Q&A** subsection: one Question plus every Answer linked to it.
Deliberately not called a "pair," since a Question may carry more than two Phrases in total (one
Question, several Answers). An Exchange exists only when a Question has at least one linked
Answer — a Question with zero Answers is not an Exchange, it's an **unpaired** Question.

## Unpaired

The state of a Question with no linked Answers, or an Answer with no linked Question. Unpaired
Phrases are flagged with a warning icon on their card and are excluded from Q&A — only complete
Exchanges (a Question with ≥1 Answer) are drillable. Unpaired is not an error state the user must
resolve; it's a normal transient state while building out a Seed (e.g., you've written the
Question but haven't added an Answer yet).

## Recall

The umbrella feature (route: `/recall`) for reviewing Phrases without a fixed script, as opposed
to **Drilling**, which is sequential playback of a Seed's Phrases in order. Recall has two
subsections:

- **Translate** — the original Recall mode (unchanged by this feature): an English Phrase is
  shown, the user attempts the Mandarin aloud, and a Reveal button shows the answer. Operates over
  every Phrase regardless of type.
- **Q&A** — hear a Question spoken, attempt an Answer aloud, then Reveal to check against every
  linked Answer. Operates only over complete Exchanges.

## Drilling

Sequential, timed playback of a Seed's Phrases (listen or shadow mode), unaffected by Phrase Type.
Distinct from Recall: Drilling has no "guess before reveal" mechanic.

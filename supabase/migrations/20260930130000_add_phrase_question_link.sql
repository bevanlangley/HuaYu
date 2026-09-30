-- Links Answer-typed phrases to a Question within the same Seed (one Question -> many Answers).
-- See docs/adr/0001-one-to-many-question-answer-links.md for why this is a self-referencing FK,
-- not a junction table.
alter table phrases add column question_id uuid;

-- Composite uniqueness needed so (id, seed_id) can be a composite FK target.
alter table phrases add constraint phrases_id_seed_id_unique unique (id, seed_id);

-- Column-specific ON DELETE SET NULL (PG15+, project runs 17.6) makes a cross-seed link a
-- database-level impossibility: question_id can only reference a row whose seed_id matches.
alter table phrases add constraint phrases_question_id_fkey
  foreign key (question_id, seed_id) references phrases (id, seed_id)
  on delete set null (question_id);

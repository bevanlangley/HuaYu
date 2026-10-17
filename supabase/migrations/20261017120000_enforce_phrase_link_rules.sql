-- The database owns Link validity. See docs/adr/0003-database-owns-link-validity.md.
--
-- A Link runs from a Phrase that is currently an Answer to a Phrase that is currently a Question
-- (same Seed is already enforced by phrases_question_id_fkey). Retyping used to be a client-side
-- two-step; now one UPDATE is enough:
--   * a row that stops being a Question unlinks every Answer pointing at it,
--   * a row that stops being an Answer has its own question_id cleared,
--   * any other write that sets question_id on a non-Answer, or at a non-Question, is rejected.

-- One-time cleanup of Links that already break the rules above (idempotent).
update phrases c
set question_id = null
where c.question_id is not null
  and (
    c.phrase_type <> 'answer'
    or not exists (
      select 1 from phrases q where q.id = c.question_id and q.phrase_type = 'question'
    )
  );

create or replace function enforce_phrase_link_rules() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.phrase_type = 'question' and new.phrase_type <> 'question' then
    update phrases set question_id = null where question_id = new.id;
  end if;

  -- Retyped away from Answer without touching its Link: clear it rather than reject.
  if tg_op = 'UPDATE' and old.phrase_type = 'answer' and new.phrase_type <> 'answer'
     and new.question_id is not distinct from old.question_id then
    new.question_id := null;
  end if;

  if new.question_id is not null then
    if new.phrase_type <> 'answer' then
      raise exception 'Only an answer can be linked to a question' using errcode = 'check_violation';
    end if;
    if not exists (
      select 1 from phrases where id = new.question_id and phrase_type = 'question'
    ) then
      raise exception 'An answer can only be linked to a question' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger phrases_enforce_link_rules
  before insert or update of phrase_type, question_id on phrases
  for each row execute function enforce_phrase_link_rules();

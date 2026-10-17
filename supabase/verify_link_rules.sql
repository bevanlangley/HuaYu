-- Verifies 20261017120000_enforce_phrase_link_rules.sql. Runs inside one transaction that ends in
-- ROLLBACK, so nothing is ever committed. Send the whole file as one multi-statement query via the
-- Management API. Success = a single row `verify_link_rules: all checks passed (rolled back)`; any
-- failed check aborts with a 'FAIL: ...' error and the open transaction is discarded.
begin;

-- Cleanup: with the trigger off, seed Links that break the rules, then run the migration's one-time
-- cleanup. The UPDATE below must stay identical to the one in the migration.
do $$
declare
  s uuid; q uuid; st uuid; good uuid; to_statement uuid; from_statement uuid; n int;
begin
  alter table phrases disable trigger phrases_enforce_link_rules;

  insert into seeds (name) values ('verify_link_rules cleanup') returning id into s;
  insert into phrases (seed_id, mandarin, pinyin, english, phrase_type)
    values (s, 'q', 'q', 'q', 'question') returning id into q;
  insert into phrases (seed_id, mandarin, pinyin, english, phrase_type)
    values (s, 'st', 'st', 'st', 'statement') returning id into st;
  insert into phrases (seed_id, mandarin, pinyin, english, phrase_type, question_id)
    values (s, 'good', 'good', 'good', 'answer', q) returning id into good;
  insert into phrases (seed_id, mandarin, pinyin, english, phrase_type, question_id)
    values (s, 'a', 'a', 'a', 'answer', st) returning id into to_statement;
  insert into phrases (seed_id, mandarin, pinyin, english, phrase_type, question_id)
    values (s, 'x', 'x', 'x', 'statement', q) returning id into from_statement;

  update phrases c
  set question_id = null
  where c.question_id is not null
    and (
      c.phrase_type <> 'answer'
      or not exists (
        select 1 from phrases q where q.id = c.question_id and q.phrase_type = 'question'
      )
    );

  select count(*) into n from phrases where id in (to_statement, from_statement) and question_id is null;
  assert n = 2, 'FAIL: cleanup left an invalid Link';
  select count(*) into n from phrases where id = good and question_id = q;
  assert n = 1, 'FAIL: cleanup removed a valid Link';

  alter table phrases enable trigger phrases_enforce_link_rules;
end;
$$;

-- Trigger.
do $$
declare
  s uuid; q uuid; q2 uuid; a uuid; st uuid; n int;
begin
  insert into seeds (name) values ('verify_link_rules') returning id into s;
  insert into phrases (seed_id, mandarin, pinyin, english, phrase_type)
    values (s, 'q', 'q', 'q', 'question') returning id into q;
  insert into phrases (seed_id, mandarin, pinyin, english, phrase_type)
    values (s, 'q2', 'q2', 'q2', 'question') returning id into q2;
  insert into phrases (seed_id, mandarin, pinyin, english, phrase_type)
    values (s, 'st', 'st', 'st', 'statement') returning id into st;

  -- Valid: create an Answer linked to a Question.
  insert into phrases (seed_id, mandarin, pinyin, english, phrase_type, question_id)
    values (s, 'a', 'a', 'a', 'answer', q) returning id into a;

  -- Valid: re-attach the Answer to another Question, then back.
  update phrases set question_id = q2 where id = a;
  update phrases set question_id = q where id = a;

  -- Rejected: link to a non-Question.
  begin
    update phrases set question_id = st where id = a;
    raise exception 'FAIL: link to a Statement was accepted';
  exception when check_violation then null; end;

  -- Rejected: link from a non-Answer (insert and update).
  begin
    insert into phrases (seed_id, mandarin, pinyin, english, phrase_type, question_id)
      values (s, 'x', 'x', 'x', 'statement', q);
    raise exception 'FAIL: Statement with a link was inserted';
  exception when check_violation then null; end;
  begin
    update phrases set question_id = q where id = st;
    raise exception 'FAIL: link set on a Statement was accepted';
  exception when check_violation then null; end;

  -- Rejected: retyping an Answer away while also writing a new Link is contradictory (ADR 0003).
  begin
    update phrases set phrase_type = 'statement', question_id = q2 where id = a;
    raise exception 'FAIL: retype away from Answer with a new Link was accepted';
  exception when check_violation then null; end;

  -- Answer retyped away: its own Link is cleared, no error.
  update phrases set phrase_type = 'statement' where id = a;
  select count(*) into n from phrases where id = a and question_id is null;
  assert n = 1, 'FAIL: retyped Answer kept its question_id';

  -- Question retyped away: every Answer pointing at it is unlinked, none deleted.
  update phrases set phrase_type = 'answer', question_id = q where id = a;
  insert into phrases (seed_id, mandarin, pinyin, english, phrase_type, question_id)
    values (s, 'a2', 'a2', 'a2', 'answer', q);
  update phrases set phrase_type = 'statement' where id = q;
  select count(*) into n from phrases where seed_id = s and phrase_type = 'answer' and question_id is null;
  assert n = 2, 'FAIL: Answers were not unlinked when their Question was retyped';

  -- Retyping it back to Question does not resurrect the old Links.
  update phrases set phrase_type = 'question' where id = q;
  select count(*) into n from phrases where question_id = q;
  assert n = 0, 'FAIL: old Answers rejoined a re-retyped Question';

  -- Deleting a Question still unlinks via the FK.
  update phrases set question_id = q where seed_id = s and phrase_type = 'answer';
  delete from phrases where id = q;
  select count(*) into n from phrases where seed_id = s and phrase_type = 'answer' and question_id is null;
  assert n = 2, 'FAIL: delete did not unlink Answers';
end;
$$;

rollback;

select 'verify_link_rules: all checks passed (rolled back)' as result;

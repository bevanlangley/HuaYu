-- Adds Phrase Type (Question / Answer / Statement) to phrases.
-- Native enum (not text + CHECK) so `supabase gen types` emits a real TS union.
create type phrase_type as enum ('question', 'answer', 'statement');

alter table phrases
  add column phrase_type phrase_type not null default 'statement';

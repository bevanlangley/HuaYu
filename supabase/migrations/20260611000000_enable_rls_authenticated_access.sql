-- Enable RLS on Phase 1 tables. The app is single-user: any authenticated
-- user has full access; the anon role has none. Per-user policies (user_id
-- columns) are deferred to the Phase 2 multi-user migration.
--
-- Deploy order matters: the auth-gated app build must be live and the single
-- auth user created BEFORE running this, or the app loses data access.

alter table public.seeds enable row level security;
alter table public.phrases enable row level security;

create policy "authenticated full access" on public.seeds
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on public.phrases
  for all to authenticated using (true) with check (true);

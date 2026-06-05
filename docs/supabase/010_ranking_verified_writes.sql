-- Ticket133: restrict ranking_records writes to verified server-side paths.
-- Apply after 001_schema.sql and 002_rls.sql.
-- Normal user ranking writes must go through /api/save-ranking-record with the service role key.

drop policy if exists "ranking_records_insert_own" on public.ranking_records;
drop policy if exists "ranking_records_update_own_or_admin" on public.ranking_records;

drop policy if exists "ranking_records_insert_admin" on public.ranking_records;
create policy "ranking_records_insert_admin"
on public.ranking_records
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "ranking_records_update_admin" on public.ranking_records;
create policy "ranking_records_update_admin"
on public.ranking_records
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

comment on table public.ranking_records is
'Leaderboard records. Normal user writes must be performed by a server-verified service-role API; direct client insert/update is denied.';

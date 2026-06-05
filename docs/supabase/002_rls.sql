-- Web Picross Ver2 Supabase RLS policies
-- Apply after 001_schema.sql.

alter table public.profiles enable row level security;
alter table public.puzzles enable row level security;
alter table public.user_progress enable row level security;
alter table public.play_history enable row level security;
alter table public.ranking_records enable row level security;
alter table public.account_delete_requests enable row level security;
alter table public.email_change_request_logs enable row level security;
alter table public.admin_email_repair_logs enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and coalesce(account_status, 'active') <> 'disabled'
  );
$$;

comment on function public.is_admin() is 'Checks active admin role from profiles. Do not use local admin/admin credentials in production.';

drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "puzzles_select_published" on public.puzzles;
create policy "puzzles_select_published"
on public.puzzles
for select
to anon, authenticated
using (is_published = true or public.is_admin());

drop policy if exists "puzzles_admin_insert" on public.puzzles;
create policy "puzzles_admin_insert"
on public.puzzles
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "puzzles_admin_update" on public.puzzles;
create policy "puzzles_admin_update"
on public.puzzles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "puzzles_admin_delete" on public.puzzles;
create policy "puzzles_admin_delete"
on public.puzzles
for delete
to authenticated
using (public.is_admin());

drop policy if exists "user_progress_select_own_or_admin" on public.user_progress;
create policy "user_progress_select_own_or_admin"
on public.user_progress
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_progress_insert_own" on public.user_progress;
create policy "user_progress_insert_own"
on public.user_progress
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "user_progress_update_own" on public.user_progress;
create policy "user_progress_update_own"
on public.user_progress
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "play_history_select_own_or_admin" on public.play_history;
create policy "play_history_select_own_or_admin"
on public.play_history
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "play_history_insert_own" on public.play_history;
create policy "play_history_insert_own"
on public.play_history
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "ranking_records_select_public" on public.ranking_records;
create policy "ranking_records_select_public"
on public.ranking_records
for select
to anon, authenticated
using (true);

drop policy if exists "ranking_records_insert_own" on public.ranking_records;
drop policy if exists "ranking_records_insert_admin" on public.ranking_records;
create policy "ranking_records_insert_admin"
on public.ranking_records
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "ranking_records_update_own_or_admin" on public.ranking_records;
drop policy if exists "ranking_records_update_admin" on public.ranking_records;
create policy "ranking_records_update_admin"
on public.ranking_records
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "ranking_records_delete_admin" on public.ranking_records;
create policy "ranking_records_delete_admin"
on public.ranking_records
for delete
to authenticated
using (public.is_admin());

drop policy if exists "account_delete_requests_select_own_or_admin" on public.account_delete_requests;
create policy "account_delete_requests_select_own_or_admin"
on public.account_delete_requests
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "account_delete_requests_insert_own_pending" on public.account_delete_requests;
create policy "account_delete_requests_insert_own_pending"
on public.account_delete_requests
for insert
to authenticated
with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "account_delete_requests_update_admin" on public.account_delete_requests;
create policy "account_delete_requests_update_admin"
on public.account_delete_requests
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "email_change_request_logs_select_admin" on public.email_change_request_logs;
create policy "email_change_request_logs_select_admin"
on public.email_change_request_logs
for select
to authenticated
using (public.is_admin());

drop policy if exists "admin_email_repair_logs_select_admin" on public.admin_email_repair_logs;
create policy "admin_email_repair_logs_select_admin"
on public.admin_email_repair_logs
for select
to authenticated
using (public.is_admin());

-- Production authentication policy:
-- - The current local fixed user admin/admin is for development only.
-- - Production must use Supabase Auth users and profiles.role = 'admin' for admin operations.
-- - Never place a service role key, DB password, or fixed admin password in browser JavaScript.

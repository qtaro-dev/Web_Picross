-- Web Picross Ver2 account delete request table
-- Apply after 001_schema.sql and 002_rls.sql, or use this as a standalone migration.

alter table public.profiles
add column if not exists account_status text not null default 'active';

alter table public.profiles
add column if not exists disabled_at timestamptz;

alter table public.profiles
add column if not exists disabled_reason text;

alter table public.profiles
add column if not exists delete_request_count integer not null default 0,
add column if not exists delete_approved_count integer not null default 0,
add column if not exists delete_rejected_count integer not null default 0,
add column if not exists account_disabled_count integer not null default 0,
add column if not exists account_reactivated_count integer not null default 0,
add column if not exists last_delete_requested_at timestamptz,
add column if not exists last_disabled_at timestamptz,
add column if not exists last_reactivated_at timestamptz;

alter table public.profiles
drop constraint if exists profiles_account_status_check;

alter table public.profiles
add constraint profiles_account_status_check
check (account_status in ('active', 'disabled'));

create table if not exists public.account_delete_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text,
  display_name text,
  email text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_account_delete_requests_user_status
on public.account_delete_requests (user_id, status);

create index if not exists idx_account_delete_requests_status_requested
on public.account_delete_requests (status, requested_at desc);

create unique index if not exists account_delete_requests_one_pending_per_user
on public.account_delete_requests (user_id)
where status = 'pending';

drop trigger if exists trg_account_delete_requests_set_updated_at on public.account_delete_requests;
create trigger trg_account_delete_requests_set_updated_at
before update on public.account_delete_requests
for each row execute function public.set_updated_at();

alter table public.account_delete_requests enable row level security;

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

comment on table public.account_delete_requests is 'User-submitted account deletion requests. This table records requests only; Auth user deletion is handled by later admin-only workflow.';

-- Web Picross Ver2 Supabase schema
-- Apply this file in the Supabase SQL editor before 002_rls.sql.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text,
  display_name text,
  role text not null default 'user' check (role in ('user', 'player', 'admin')),
  account_status text not null default 'active' check (account_status in ('active', 'disabled')),
  disabled_at timestamptz,
  disabled_reason text,
  delete_request_count integer not null default 0,
  delete_approved_count integer not null default 0,
  delete_rejected_count integer not null default 0,
  account_disabled_count integer not null default 0,
  account_reactivated_count integer not null default 0,
  last_delete_requested_at timestamptz,
  last_disabled_at timestamptz,
  last_reactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists email text;

alter table public.profiles
alter column role set default 'user';

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
add column if not exists password_clear_required boolean not null default false,
add column if not exists password_clear_requested_at timestamptz,
add column if not exists password_clear_requested_by uuid references public.profiles(id) on delete set null,
add column if not exists password_clear_count integer not null default 0,
add column if not exists last_password_changed_at timestamptz;

create table if not exists public.password_reset_request_logs (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now(),
  request_type text not null default 'admin_password_clear'
);

create index if not exists password_reset_request_logs_rate_limit_idx
on public.password_reset_request_logs (target_user_id, request_type, requested_at desc);

alter table public.password_reset_request_logs enable row level security;

create table if not exists public.email_change_request_logs (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  old_email text,
  new_email text not null,
  requested_at timestamptz not null default now(),
  request_type text not null default 'user_email_change'
);

create index if not exists email_change_request_logs_rate_limit_idx
on public.email_change_request_logs (target_user_id, request_type, requested_at desc);

alter table public.email_change_request_logs enable row level security;

create table if not exists public.admin_email_repair_logs (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  old_email text,
  new_email text not null,
  repaired_at timestamptz not null default now(),
  reason text
);

create index if not exists admin_email_repair_logs_target_repaired_idx
on public.admin_email_repair_logs (target_user_id, repaired_at desc);

create index if not exists admin_email_repair_logs_admin_repaired_idx
on public.admin_email_repair_logs (admin_user_id, repaired_at desc);

alter table public.admin_email_repair_logs enable row level security;

alter table public.profiles
drop constraint if exists profiles_account_status_check;

alter table public.profiles
add constraint profiles_account_status_check
check (account_status in ('active', 'disabled'));

create table if not exists public.puzzles (
  id uuid primary key default gen_random_uuid(),
  difficulty text not null check (difficulty in ('beginner', 'easy', 'normal', 'hard', 'endless')),
  stage_no integer not null check (stage_no > 0),
  title text not null default '',
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  color_mode text not null default 'mono' check (color_mode in ('mono', 'color')),
  palette jsonb not null default '[]'::jsonb,
  solution jsonb not null,
  thumbnail_path text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (difficulty, stage_no)
);

create table if not exists public.user_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  cleared boolean not null default false,
  best_clear_time_ms integer check (best_clear_time_ms is null or best_clear_time_ms >= 0),
  latest_clear_time_ms integer check (latest_clear_time_ms is null or latest_clear_time_ms >= 0),
  clear_count integer not null default 0 check (clear_count >= 0),
  fail_count integer not null default 0 check (fail_count >= 0),
  giveup_count integer not null default 0 check (giveup_count >= 0),
  hint_used_count integer not null default 0 check (hint_used_count >= 0),
  last_played_at timestamptz,
  cleared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, puzzle_id)
);

alter table public.user_progress
add column if not exists last_played_at timestamptz;

alter table public.user_progress
add column if not exists cleared_at timestamptz;

create table if not exists public.play_history (
  id bigint generated by default as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  result text not null check (result in ('clear', 'fail', 'giveup')),
  play_time_ms integer not null default 0 check (play_time_ms >= 0),
  hint_used_count integer not null default 0 check (hint_used_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.ranking_records (
  id bigint generated by default as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  puzzle_id uuid not null references public.puzzles(id) on delete cascade,
  difficulty text not null check (difficulty in ('beginner', 'easy', 'normal', 'hard', 'endless')),
  stage_no integer not null check (stage_no > 0),
  clear_time_ms integer not null check (clear_time_ms >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, puzzle_id)
);

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

create index if not exists idx_puzzles_difficulty_stage_no on public.puzzles (difficulty, stage_no);
create index if not exists idx_puzzles_published on public.puzzles (is_published);
create index if not exists idx_user_progress_user_id on public.user_progress (user_id);
create index if not exists idx_user_progress_puzzle_id on public.user_progress (puzzle_id);
create index if not exists idx_play_history_user_created on public.play_history (user_id, created_at desc);
create index if not exists idx_play_history_puzzle_id on public.play_history (puzzle_id);
create index if not exists idx_ranking_records_difficulty_stage_time on public.ranking_records (difficulty, stage_no, clear_time_ms);
create index if not exists idx_ranking_records_user_id on public.ranking_records (user_id);
create index if not exists idx_ranking_records_puzzle_id on public.ranking_records (puzzle_id);
create unique index if not exists profiles_email_unique on public.profiles (email) where email is not null;
create index if not exists idx_account_delete_requests_user_status on public.account_delete_requests (user_id, status);
create index if not exists idx_account_delete_requests_status_requested on public.account_delete_requests (status, requested_at desc);
create unique index if not exists account_delete_requests_one_pending_per_user
on public.account_delete_requests (user_id)
where status = 'pending';

create or replace view public.public_profiles as
select
  id,
  username,
  display_name
from public.profiles
where account_status = 'active'
  and role <> 'admin';

grant select on public.public_profiles to anon, authenticated;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_puzzles_set_updated_at on public.puzzles;
create trigger trg_puzzles_set_updated_at
before update on public.puzzles
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_progress_set_updated_at on public.user_progress;
create trigger trg_user_progress_set_updated_at
before update on public.user_progress
for each row execute function public.set_updated_at();

drop trigger if exists trg_account_delete_requests_set_updated_at on public.account_delete_requests;
create trigger trg_account_delete_requests_set_updated_at
before update on public.account_delete_requests
for each row execute function public.set_updated_at();

comment on table public.profiles is 'Supabase Auth user profile. Local admin/admin is development only and must not be used as production authentication.';
comment on view public.public_profiles is 'Public-safe profile fields for rankings. Does not expose email, role, account status, counters, or password reset flags.';
comment on table public.puzzles is 'Puzzle definitions migrated from data/*.json. solution stores mono/color answer cells as JSON.';
comment on table public.user_progress is 'Per-user aggregate progress migrated from user/*.json.';
comment on table public.play_history is 'Append-only play result history for clear, fail, and giveup events.';
comment on table public.ranking_records is 'Leaderboard records separated from local user JSON files.';
comment on table public.account_delete_requests is 'User-submitted account deletion requests. This table records requests only; Auth user deletion is handled by later admin-only workflow.';
comment on table public.email_change_request_logs is 'Audit and rate-limit log for user requested Supabase Auth email change confirmation mails.';
comment on table public.admin_email_repair_logs is 'Admin audit log for repairing invalid or inconsistent Supabase Auth and profiles email addresses.';

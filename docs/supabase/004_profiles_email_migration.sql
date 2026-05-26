-- Web Picross Ver2 profiles email migration
-- Apply this after 001_schema.sql when upgrading an existing Supabase project.

alter table public.profiles
add column if not exists email text;

alter table public.profiles
alter column role set default 'user';

alter table public.profiles
drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check
check (role in ('user', 'player', 'admin'));

alter table public.profiles
add column if not exists account_status text not null default 'active';

alter table public.profiles
add column if not exists disabled_at timestamptz;

alter table public.profiles
add column if not exists disabled_reason text;

alter table public.profiles
drop constraint if exists profiles_account_status_check;

alter table public.profiles
add constraint profiles_account_status_check
check (account_status in ('active', 'disabled'));

create unique index if not exists profiles_email_unique
on public.profiles (email)
where email is not null;

alter table public.user_progress
add column if not exists last_played_at timestamptz;

alter table public.user_progress
add column if not exists cleared_at timestamptz;

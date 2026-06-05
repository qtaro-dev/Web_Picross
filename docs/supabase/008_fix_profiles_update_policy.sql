-- Ticket131: prevent profile self-update privilege escalation.
-- Apply after 001_schema.sql and 002_rls.sql.

create or replace function public.sync_account_delete_request_profile_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles
    set
      delete_request_count = coalesce(delete_request_count, 0) + 1,
      last_delete_requested_at = coalesce(new.requested_at, now())
    where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_account_delete_requests_profile_counters on public.account_delete_requests;
create trigger trg_account_delete_requests_profile_counters
after insert on public.account_delete_requests
for each row execute function public.sync_account_delete_request_profile_counters();

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

comment on policy "profiles_update_admin" on public.profiles is
'Only active admins may update profile management fields. Users must not self-update role, account_status, email, or internal counters.';

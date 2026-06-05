-- Ticket132: exclude disabled admin accounts from DB-side admin checks.
-- Apply after 001_schema.sql.

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

comment on function public.is_admin() is
'Checks active admin role from profiles. Disabled accounts are not treated as admins by RLS.';

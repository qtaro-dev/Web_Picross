-- Ticket139: public_profiles Security Definer View warning review.
--
-- Supabase Security Advisor may warn that public.public_profiles is a
-- security-definer view. In the current Web Picross schema this is intentional:
--
-- - public_profiles exposes only id, username, and display_name.
-- - email, role, account_status, counters, delete request state, and other
--   internal profile columns are not exposed through the view.
-- - profiles table SELECT remains limited to the owner or active admins by RLS.
-- - anonymous ranking display needs to resolve ranking_records.user_id to a
--   public-safe name without granting broad SELECT on profiles itself.
--
-- Do not switch this view to security_invoker=true unless the profile access
-- design is also changed. A security_invoker view would apply profiles RLS to
-- anonymous callers and can break public ranking display. Granting broad
-- profiles SELECT to compensate would risk exposing more than the safe
-- projection.

create or replace view public.public_profiles as
select
  id,
  username,
  display_name
from public.profiles
where account_status = 'active'
  and role <> 'admin';

grant select on public.public_profiles to anon, authenticated;

comment on view public.public_profiles is
'Public-safe profile fields for rankings. Exposes only id, username, and display_name for active non-admin profiles. Does not expose email, role, account status, counters, or password reset flags. Kept as a default security-definer view so anonymous rankings can read the safe projection while profiles table SELECT stays limited by RLS.';

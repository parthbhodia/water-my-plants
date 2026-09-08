-- Supabase's `alter default privileges` hands anon AND authenticated the full
-- arwdDxtm on every new public table, so `admins` shipped with both roles
-- holding INSERT/UPDATE/DELETE. RLS did refuse them — verified, a non-admin's
-- insert raises 42501 — but "nobody can grant themselves admin" should not rest
-- on a single policy being present and correct. Take the privilege away too.
--
-- SELECT stays for `authenticated` on purpose: the RLS policy filters it to the
-- caller's own row, and that is how the client asks "am I an admin?" in order
-- to decide whether to render the Analytics nav item.
revoke all on table admins from anon;
revoke insert, update, delete, truncate, references, trigger
  on table admins from authenticated;
grant select on table admins to authenticated;

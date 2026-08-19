-- Frictionless signup: auto-confirm new users at insert time so the
-- email round-trip (whose link points at the project's Site URL) is
-- never required to start playing. To restore real email verification:
-- drop trigger auto_confirm_users on auth.users; and set the Site URL
-- in Auth -> URL Configuration.

create or replace function public.auto_confirm_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end $$;

revoke all on function public.auto_confirm_user() from public, anon, authenticated;

drop trigger if exists auto_confirm_users on auth.users;
create trigger auto_confirm_users
  before insert on auth.users
  for each row execute function public.auto_confirm_user();

-- one-time backfill: unlock anyone already stuck waiting on a localhost link
update auth.users
  set email_confirmed_at = now()
  where email_confirmed_at is null and email is not null;

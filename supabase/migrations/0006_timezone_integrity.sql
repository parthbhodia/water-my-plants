-- ============================================================
-- Timezone integrity
--
-- Local days are the right UX (nobody should lose a streak because UTC
-- rolled over), but the client was allowed to *redeclare* its timezone on
-- every load. Jumping UTC-10 -> UTC+14 advanced "today" by a day with zero
-- real time elapsed, granting free growth. Two defences:
--
--   1. The stored timezone is set once and then frozen; changing it is an
--      explicit action with a 14-day cooldown (travel is rare, shopping is not).
--   2. Care also requires real elapsed time, so even the one permitted change
--      cannot buy an extra action.
--
-- Full function bodies were applied to the remote project under the
-- migration name `timezone_integrity`; the schema changes are below.
-- ============================================================

alter table public.profiles
  add column if not exists tz_changed_at timestamptz;

alter table public.plants
  add column if not exists last_care_at timestamptz;

update public.plants
   set last_care_at = last_care_on::timestamptz
 where last_care_at is null and last_care_on is not null;

update public.profiles
   set tz_changed_at = coalesce(tz_changed_at, created_at, now())
 where tz_changed_at is null;

-- Minimum real time between two waterings of the same plant. Honest play is
-- once per local day, so this only bites on a deliberate clock jump.
create or replace function public.min_care_gap()
returns interval language sql immutable as $$ select interval '6 hours' $$;

revoke all on function public.min_care_gap() from public, anon, authenticated;

-- get_garden_state: adopts the client timezone only when creating the profile,
--   thereafter reports clientTimezone / timezoneMismatch / canChangeTimezone.
-- set_timezone(text): explicit relocation, 14-day cooldown.
-- tend_plant: adds the `too_soon` guard using last_care_at + min_care_gap().

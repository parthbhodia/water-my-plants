-- ============================================================
-- All-time standing alongside the weekly league.
--
-- The weekly league is the fair, winnable heartbeat, but its score resets, so
-- it cannot reward the player who has kept the same garden alive for months.
-- These counters only ever go up, survive every season, and are what a
-- long-term gardener competes on. The garden itself is never reset by either.
--
-- Applied remotely as migration `hall_of_fame_and_gardener_level`.
-- ============================================================

alter table public.profiles
  add column if not exists best_streak int not null default 0,
  add column if not exists lifetime_blooms int not null default 0,
  add column if not exists gardening_since date;

update public.profiles p
   set gardening_since = coalesce(gardening_since, p.created_at::date);

update public.profiles p
   set lifetime_blooms = (select count(*) from completed_lilies c where c.user_id = p.id),
       best_streak = greatest(p.best_streak,
         coalesce((select max(pl.streak) from plants pl where pl.user_id = p.id), 0));

-- Functions (bodies applied remotely):
--   gardener_level(int)      permanent progression from lifetime dewdrops
--   garden_value(uuid)       what a garden is worth right now, season-agnostic
--   trg_track_bests()        keeps best_streak / lifetime_blooms current
--   get_hall_of_fame()       four all-time boards + the caller's own record

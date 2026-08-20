-- ============================================================
-- Phase 04 — Friends, visits, decor and the showcase
--
-- Design note on visits: letting a friend *grow* your plants would be trivially
-- farmed with alt accounts and would hollow out the daily ritual. So a visit
-- rescues rather than progresses — it cancels decay and stops a plant dying
-- while you are away, but growth still only ever comes from the owner's own
-- care. Recorded separately as rescued_on, so a rescue also never consumes the
-- owner's own watering for that day.
--
-- Applied remotely as `friends_visits_decor_showcase_v2`,
-- `fix_overdue_rescue_coalesce` and `decor_in_garden_state`.
-- ============================================================

alter table public.plants add column if not exists rescued_on date;

-- GREATEST ignores NULLs, so an un-rescued plant is unaffected. (Coalescing
-- rescued_on to planted_on made a fresh row look cared-for regardless of
-- last_care_on — fixed in fix_overdue_rescue_coalesce.)
create or replace function public.overdue_days(p public.plants, s public.species, v_today date)
returns int language sql immutable
set search_path = public
as $$
  select greatest(0,
    (v_today - greatest(coalesce(p.last_care_on, p.planted_on), p.rescued_on)) - s.cadence_days)
$$;

create table if not exists public.friendships (
  user_id    uuid not null references auth.users(id) on delete cascade,
  friend_id  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  constraint no_self_friending check (user_id <> friend_id)
);

create table if not exists public.visits (
  id         bigint generated always as identity primary key,
  visitor_id uuid not null references auth.users(id) on delete cascade,
  host_id    uuid not null references auth.users(id) on delete cascade,
  plant_id   uuid,
  visit_date date not null,
  created_at timestamptz not null default now(),
  constraint visit_once_per_day unique (visitor_id, host_id, visit_date)
);

create table if not exists public.decor_placed (
  user_id  uuid not null references auth.users(id) on delete cascade,
  slot_idx smallint not null check (slot_idx between 0 and 7),
  item_key text not null,
  primary key (user_id, slot_idx)
);

alter table public.friendships enable row level security;
alter table public.visits enable row level security;
alter table public.decor_placed enable row level security;

drop policy if exists "friendships_select_own" on public.friendships;
create policy "friendships_select_own" on public.friendships
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "visits_select_own" on public.visits;
create policy "visits_select_own" on public.visits
  for select to authenticated using ((select auth.uid()) = visitor_id);
drop policy if exists "decor_select_own" on public.decor_placed;
create policy "decor_select_own" on public.decor_placed
  for select to authenticated using ((select auth.uid()) = user_id);

alter table public.shop_items drop constraint if exists shop_items_kind_check;
alter table public.shop_items add constraint shop_items_kind_check
  check (kind in ('species','consumable','tool','decor'));

insert into public.shop_items (key, name, blurb, kind, species_id, cost, max_qty, sort) values
  ('decor_lantern','Stone Lantern','A soft glow by the water after dark.','decor', null, 300, 1, 100),
  ('decor_bench','Garden Bench','Somewhere to sit and admire your work.','decor', null, 350, 1, 110),
  ('decor_birdbath','Bird Bath','The sparrows will find it within a day.','decor', null, 400, 1, 120),
  ('decor_koi','Koi Fish','Three of them, circling the pond forever.','decor', null, 650, 1, 130),
  ('decor_gnome','Garden Gnome','He judges your watering schedule silently.','decor', null, 500, 1, 140),
  ('decor_arch','Rose Arch','A climbing arch to walk beneath.','decor', null, 800, 1, 150)
on conflict (key) do update set
  name = excluded.name, blurb = excluded.blurb, kind = excluded.kind,
  cost = excluded.cost, max_qty = excluded.max_qty, sort = excluded.sort;

-- Functions (bodies applied remotely):
--   add_friend(text) / remove_friend(uuid)  mutual friendship by code
--   get_friends()      neighbours, who needs help, whether visited today
--   visit_water(uuid)  rescue a friend's neediest plant, once per day, both earn
--   place_decor(int, text)  place or put away an ornament
--   get_showcase(int)       PUBLIC: real gardens for the landing page, exposing
--                           only name, avatar, level, value, blooms and plants
--   get_garden_of_the_day() deterministic daily pick from the showcase

-- ============================================================
-- Phase 03 — Seasons, leagues, promotion and relegation
--
-- Leagues hold up to 30 players and are banded by UTC offset, so a shared
-- season deadline lands at a similar local hour for everyone you are ranked
-- against. Rivals are exposed only through get_league(); RLS on the underlying
-- tables stays own-rows-only, so nobody can read another player's garden.
--
-- Applied to the remote project as migrations `seasons_and_leagues`,
-- `fix_get_league_aliasing`, `league_fixes_join_and_thresholds` and
-- `league_thresholds_match_reality`.
-- ============================================================

create table if not exists public.seasons (
  id         int primary key,               -- ISO weeks since 1970-01-05
  starts_on  date not null,
  ends_on    date not null,
  closed_at  timestamptz
);

create table if not exists public.leagues (
  id         bigint generated always as identity primary key,
  season_id  int not null references public.seasons(id) on delete cascade,
  tier       smallint not null default 0 check (tier between 0 and 4),
  tz_band    smallint not null check (tz_band between 0 and 8),
  created_at timestamptz not null default now()
);
create index if not exists leagues_lookup on public.leagues (season_id, tier, tz_band);

create table if not exists public.league_members (
  league_id  bigint not null references public.leagues(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  season_id  int not null references public.seasons(id) on delete cascade,
  tier       smallint not null default 0,
  score      int not null default 0,
  final_rank int,
  movement   smallint,                       -- -1 relegated, 0 stayed, +1 promoted
  joined_at  timestamptz not null default now(),
  primary key (season_id, user_id)
);
create index if not exists league_members_board on public.league_members (league_id, score desc);

alter table public.seasons enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;

drop policy if exists "seasons_read" on public.seasons;
create policy "seasons_read" on public.seasons for select to authenticated using (true);
drop policy if exists "league_members_select_own" on public.league_members;
create policy "league_members_select_own" on public.league_members
  for select to authenticated using ((select auth.uid()) = user_id);

-- Functions (bodies applied remotely):
--   tier_name, tz_offset_minutes, tz_band_of, band_label, season_id_for,
--   current_season, compute_garden_score, ensure_league, refresh_league_score,
--   league_promote_n, league_relegate_n, close_season, get_league
--
-- Score = living plants weighted by health
--       + best streak (capped 30) x 12
--       + distinct species harvested this season x 25
--       + points of everything harvested this season
--       - 15 per plant left to die
--
-- Promotion scales with league size: least(6, floor(size/5)) up, the same
-- number down once a league has at least 12 members. Triggers on plants and
-- completed_lilies keep league_members.score current automatically.

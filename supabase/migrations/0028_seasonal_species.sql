-- Seasonal species: four plants that only go in the ground during their own
-- phase of the year.
--
-- The phase is decided HERE, not in the browser, for the same reason every
-- other day rule is: `local_today()` and the player's frozen timezone are the
-- only trustworthy clock in this system. The client mirrors the same rule in
-- lib/yearphase.ts purely to grey out a seed card; this function is what
-- actually decides, and garden_state_json ships its answer so the two can
-- never drift into disagreeing about what month it is.

-- ---------------------------------------------------------------- hemisphere
-- A frozen IANA zone is the only location signal the game has — there is no
-- latitude to read. A short list of clearly-southern, populated zones beats a
-- clever guess: anything unlisted falls through to northern, and for the
-- genuinely equatorial zones either answer is equally wrong, because they do
-- not have these four seasons at all.
create or replace function public.is_southern_tz(p_tz text)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select coalesce(
    p_tz like 'Australia/%'
    or p_tz like 'Antarctica/%'
    or p_tz like 'America/Argentina/%'
    or p_tz in (
      'Pacific/Auckland','Pacific/Chatham','Pacific/Fiji','Pacific/Norfolk',
      'Pacific/Noumea','Pacific/Port_Moresby','Pacific/Tongatapu','Pacific/Apia',
      'America/Sao_Paulo','America/Santiago','America/Montevideo','America/La_Paz',
      'America/Asuncion','America/Punta_Arenas','America/Bahia','America/Recife',
      'America/Fortaleza','America/Lima','America/Campo_Grande','America/Cuiaba',
      'Africa/Johannesburg','Africa/Windhoek','Africa/Harare','Africa/Lusaka',
      'Africa/Maputo','Africa/Gaborone','Africa/Luanda','Africa/Kinshasa',
      'Africa/Dar_es_Salaam','Africa/Lubumbashi','Africa/Blantyre',
      'Indian/Antananarivo','Indian/Mauritius','Indian/Reunion',
      'Atlantic/Stanley'
    ),
    false);
$$;

-- Meteorological boundaries (whole months), not astronomical ones: nobody
-- feels a solstice, and "spring started on the 20th" is a fact about an orbit
-- rather than about a garden.
create or replace function public.year_phase(p_tz text, p_today date)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case
    when public.is_southern_tz(p_tz) then
      case
        when extract(month from p_today) between 3 and 5  then 'autumn'
        when extract(month from p_today) between 6 and 8  then 'winter'
        when extract(month from p_today) between 9 and 11 then 'spring'
        else 'summer'
      end
    else
      case
        when extract(month from p_today) between 3 and 5  then 'spring'
        when extract(month from p_today) between 6 and 8  then 'summer'
        when extract(month from p_today) between 9 and 11 then 'autumn'
        else 'winter'
      end
  end;
$$;

revoke execute on function public.is_southern_tz(text) from anon, authenticated;
revoke execute on function public.year_phase(text, date) from anon, authenticated;

-- ------------------------------------------------------------------- species
alter table public.species
  add column if not exists phase text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'species_phase_check'
  ) then
    alter table public.species
      add constraint species_phase_check
      check (phase is null or phase in ('spring','summer','autumn','winter'));
  end if;
end $$;

comment on column public.species.phase is
  'Null means plantable all year. Otherwise the only phase of the year in '
  'which plant_seed will accept it — see year_phase().';

-- Free, so every player has them; the gate is the calendar, not the wallet.
-- Each matures well inside a three-month phase, so nobody is handed a plant
-- they cannot finish before its season runs out.
insert into public.species
  (id, key, name, blurb, form, cadence_days, window_start, window_end,
   needs_plot, feeds_required, prunes_required, matures_days, points,
   unlock_cost, overwaterable, phase)
values
  (9, 'blossom', 'Cherry Blossom',
   'Spring only. Two weeks of fuss for one week of pink.',
   'blossom', 2, null, null, 'any', 0, 1, 12, 40, 0, false, 'spring'),
  (10, 'lavender', 'Lavender',
   'Summer only. Full sun, dry feet — water it early and it sulks.',
   'spike', 3, null, null, 'sun', 0, 0, 10, 34, 0, true, 'summer'),
  (11, 'pumpkin', 'Field Pumpkin',
   'Autumn only. Greedy: three feeds and a drink every single day.',
   'gourd', 1, null, null, 'sun', 3, 0, 14, 46, 0, false, 'autumn'),
  (12, 'snowdrop', 'Snowdrop',
   'Winter only. Comes up through frozen ground while nothing else dares.',
   'bell', 2, null, null, 'shade', 0, 0, 8, 30, 0, false, 'winter')
on conflict (id) do update set
  key = excluded.key, name = excluded.name, blurb = excluded.blurb,
  form = excluded.form, cadence_days = excluded.cadence_days,
  needs_plot = excluded.needs_plot, feeds_required = excluded.feeds_required,
  prunes_required = excluded.prunes_required, matures_days = excluded.matures_days,
  points = excluded.points, unlock_cost = excluded.unlock_cost,
  overwaterable = excluded.overwaterable, phase = excluded.phase;

-- ---------------------------------------------------------------- plant_seed
-- The gate goes in beside the plot-kind check, before anything is written.
-- Nothing already growing is ever touched: a pumpkin planted in October
-- finishes in November exactly as it would have, because the phase is only
-- ever consulted at the moment a seed goes in.
create or replace function public.plant_seed(p_plot_idx smallint, p_species text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_today date;
  v_garden gardens%rowtype;
  v_species species%rowtype;
  v_phase text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select timezone into v_tz from profiles where id = v_uid;
  if v_tz is null then raise exception 'no profile: load the garden first'; end if;
  v_today := local_today(v_tz);

  select * into v_garden from gardens where user_id = v_uid for update;
  if not found then raise exception 'no garden'; end if;
  if p_plot_idx < 0 or p_plot_idx >= v_garden.plot_count then
    raise exception 'that plot is not unlocked yet';
  end if;

  select * into v_species from species where key = p_species;
  if not found then raise exception 'unknown species'; end if;

  if v_species.unlock_cost > 0 and not exists (
    select 1 from species_unlocks where user_id = v_uid and species_id = v_species.id
  ) then
    raise exception 'species locked';
  end if;

  if v_species.phase is not null then
    v_phase := year_phase(v_tz, v_today);
    if v_species.phase <> v_phase then
      raise exception '% only goes in the ground in %, and it is % where you are',
        v_species.name, v_species.phase, v_phase;
    end if;
  end if;

  if v_species.needs_plot <> 'any' and v_species.needs_plot <> plot_kind(p_plot_idx) then
    raise exception '% needs a % plot', v_species.name, v_species.needs_plot;
  end if;

  if exists (select 1 from plants where garden_id = v_garden.id and plot_idx = p_plot_idx and active) then
    raise exception 'that plot is occupied';
  end if;

  insert into plants (user_id, garden_id, plot_idx, species_id, planted_on, stage)
  values (v_uid, v_garden.id, p_plot_idx, v_species.id, v_today, 0);

  return garden_state_json(v_uid, v_tz);
end $function$;

-- --------------------------------------------------------- garden_state_json
-- Two changes, and the first one matters more than it looks:
--
-- `unlockedSpecies` now means "what you may put in the ground TODAY", so an
-- out-of-phase seasonal plant is simply absent from it. That keeps the
-- document self-consistent for any client — including the one already
-- deployed in somebody's browser, which knows nothing about phases and would
-- otherwise offer a seed the server is about to refuse.
--
-- `yearPhase` ships the server's own answer, so the UI greys the right cards
-- and the two clocks can never drift into disagreeing about the month.
create or replace function public.garden_state_json(v_uid uuid, v_tz text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_today date := local_today(v_tz);
  v_hour numeric := extract(hour from (now() at time zone safe_timezone(v_tz)))
                  + extract(minute from (now() at time zone safe_timezone(v_tz))) / 60.0;
  v_garden gardens%rowtype;
  v_profile profiles%rowtype;
  v_dew int;
  v_plots jsonb;
  v_unlocked jsonb;
  v_inv jsonb;
  v_decor jsonb;
  v_score int;
  v_level int;
  v_lifetime int;
  v_zones jsonb;
  v_phase text := year_phase(v_tz, v_today);
begin
  select * into v_garden from gardens where user_id = v_uid;
  select * into v_profile from profiles where id = v_uid;
  select coalesce(dewdrops, 0), coalesce(lifetime_earned, 0)
    into v_dew, v_lifetime from wallet where user_id = v_uid;
  v_lifetime := coalesce(v_lifetime, 0);
  v_level := coalesce(gardener_level(v_lifetime), 1);

  select coalesce(jsonb_agg(x order by x.idx), '[]'::jsonb) into v_plots
  from (
    select
      i.idx,
      plot_kind(i.idx::smallint) as kind,
      (i.idx < v_garden.plot_count) as unlocked,
      (select plant_json(p, s, v_today)
         from plants p join species s on s.id = p.species_id
        where p.garden_id = v_garden.id and p.plot_idx = i.idx and p.active
        limit 1) as plant
    from generate_series(0, 11) as i(idx)
  ) x;

  select coalesce(jsonb_agg(sp.key), '[]'::jsonb) into v_unlocked
  from species sp
  where (sp.phase is null or sp.phase = v_phase)
    and (sp.unlock_cost = 0
         or exists (select 1 from species_unlocks u where u.user_id = v_uid and u.species_id = sp.id));

  select coalesce(jsonb_object_agg(item_key, qty), '{}'::jsonb) into v_inv
  from inventory where user_id = v_uid and qty > 0;

  select coalesce(jsonb_object_agg(slot_idx::text, item_key), '{}'::jsonb) into v_decor
  from decor_placed where user_id = v_uid;

  select coalesce(sum(
    case when p.died_on is not null then -15
    else round(s.points * greatest(0, 1 - 0.25 * overdue_days(p, s, v_today))) end
  ), 0)::int into v_score
  from plants p join species s on s.id = p.species_id
  where p.user_id = v_uid and p.active;

  select coalesce(jsonb_agg(zz.z order by zz.sort_key), '[]'::jsonb) into v_zones
  from (
    select
      rz.sort as sort_key,
      jsonb_build_object(
        'key', rz.key,
        'name', rz.name,
        'blurb', rz.blurb,
        'minLevel', rz.min_level,
        'unlocked', v_level >= rz.min_level,
        'fixtures', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'key', rf.key,
            'name', rf.name,
            'blurb', rf.blurb,
            'cost', rf.cost,
            'restored', exists (select 1 from restorations r
                                 where r.user_id = v_uid and r.fixture_key = rf.key)
          ) order by rf.sort), '[]'::jsonb)
          from restoration_fixtures rf where rf.zone_key = rz.key
        )
      ) as z
    from restoration_zones rz
  ) zz;

  return jsonb_build_object(
    'gardenId', v_garden.id,
    'gardenName', v_garden.name,
    'plotCount', v_garden.plot_count,
    'displayName', v_profile.display_name,
    'friendCode', v_profile.friend_code,
    'nameChanged', v_profile.name_changed,
    'tutorialDone', v_profile.tutorial_done,
    'avatar', coalesce(v_profile.avatar, '{"skin":0,"hair":0,"hat":0,"outfit":0}'::jsonb),
    'dewdrops', coalesce(v_dew, 0),
    'inventory', v_inv,
    'decor', v_decor,
    'zones', v_zones,
    'today', v_today,
    'hour', round(v_hour, 2),
    'timezone', v_profile.timezone,
    'yearPhase', v_phase,
    'plots', v_plots,
    'unlockedSpecies', v_unlocked,
    'gardenScore', v_score,
    'level', v_level,
    'lifetimeEarned', v_lifetime,
    'levelFloor', level_floor(v_level),
    'nextLevelAt', level_floor(v_level + 1),
    'completedCount', (select count(*) from completed_lilies where user_id = v_uid)
  );
end $function$;

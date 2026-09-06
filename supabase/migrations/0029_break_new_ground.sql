-- Breaking new ground: the garden can finally grow.
--
-- Every garden in production sits at plot_count = 4 and nothing has ever
-- raised it. Meanwhile the scene draws a padlock on plot 5 — so the game has
-- been promising an expansion it had no way to deliver, to every player,
-- since launch. This is the missing half.
--
-- Earned two ways at once, deliberately:
--   * dewdrops, which you spend, and
--   * gardener level, which you cannot — it rises with LIFETIME earnings and
--     is never reduced by spending, so it is a record of care actually given.
-- A player who hoards can afford the next bed but still has to have shown up
-- for it. That is the same thesis as the consistency league, applied to the
-- one thing in the game you can buy with the garden itself.

create table if not exists public.plot_unlocks (
  idx        smallint primary key,
  cost       int not null,
  min_level  int not null
);

alter table public.plot_unlocks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'plot_unlocks'
       and policyname = 'plot_unlocks_readable'
  ) then
    create policy plot_unlocks_readable on public.plot_unlocks for select using (true);
  end if;
end $$;

-- Priced against what a garden actually earns: about 4 dewdrops a watering,
-- so a 4-plot garden tended daily brings in ~16 a day and a 12-plot one ~48.
-- The ladder is meant to compound the way a property does — each bed you buy
-- shortens the wait for the next.
insert into public.plot_unlocks (idx, cost, min_level) values
  (4,   250, 2),
  (5,   400, 2),
  (6,   600, 3),
  (7,   850, 3),
  (8,  1150, 4),
  (9,  1500, 5),
  (10, 1900, 6),
  (11, 2400, 7)
on conflict (idx) do update
  set cost = excluded.cost, min_level = excluded.min_level;

/**
 * The next bed, described for the UI: what it costs, what it needs, and
 * whether this player can take it today. Null once the whole garden is
 * theirs — "you have it all" is a state the UI has to be able to render.
 */
create or replace function public.next_plot_json(p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_count int;
  v_row plot_unlocks%rowtype;
  v_dew int;
  v_lifetime int;
  v_level int;
begin
  select plot_count into v_count from gardens where user_id = p_uid;
  if v_count is null then return null; end if;

  select * into v_row from plot_unlocks where idx = v_count;
  if not found then return null; end if;   -- the whole garden is already theirs

  select coalesce(dewdrops, 0), coalesce(lifetime_earned, 0)
    into v_dew, v_lifetime from wallet where user_id = p_uid;
  v_level := coalesce(gardener_level(coalesce(v_lifetime, 0)), 1);

  return jsonb_build_object(
    'idx', v_row.idx,
    'cost', v_row.cost,
    'minLevel', v_row.min_level,
    'kind', plot_kind(v_row.idx::smallint),
    'levelOk', v_level >= v_row.min_level,
    'dewOk', coalesce(v_dew, 0) >= v_row.cost,
    'dewToGo', greatest(0, v_row.cost - coalesce(v_dew, 0)),
    'levelAt', level_floor(v_row.min_level)
  );
end $function$;

/**
 * Buy the next bed. Both gates are checked here, because the client's copy
 * of them is decoration — the wallet is the only thing that can be raced.
 */
create or replace function public.break_ground()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_garden gardens%rowtype;
  v_row plot_unlocks%rowtype;
  v_dew int;
  v_lifetime int;
  v_level int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select timezone into v_tz from profiles where id = v_uid;
  if v_tz is null then raise exception 'no profile: load the garden first'; end if;

  select * into v_garden from gardens where user_id = v_uid for update;
  if not found then raise exception 'no garden'; end if;

  select * into v_row from plot_unlocks where idx = v_garden.plot_count;
  if not found then
    raise exception 'Every bed in the garden is already yours.';
  end if;

  -- Level first: it is the gate you cannot buy past, so failing on it should
  -- never cost anybody a single dewdrop.
  select coalesce(dewdrops, 0), coalesce(lifetime_earned, 0)
    into v_dew, v_lifetime from wallet where user_id = v_uid for update;
  v_level := coalesce(gardener_level(coalesce(v_lifetime, 0)), 1);
  if v_level < v_row.min_level then
    raise exception 'That bed opens at gardener level %. You are level %.',
      v_row.min_level, v_level;
  end if;

  if coalesce(v_dew, 0) < v_row.cost then
    raise exception 'Not enough dewdrops — you need % more.',
      v_row.cost - coalesce(v_dew, 0);
  end if;

  -- Spending never touches lifetime_earned, so buying a bed cannot cost you
  -- a level. Nothing a player earned is ever taken away.
  update wallet set dewdrops = dewdrops - v_row.cost where user_id = v_uid;
  update gardens set plot_count = plot_count + 1 where id = v_garden.id;

  return jsonb_build_object(
    'status', 'broke_ground',
    'plotIdx', v_row.idx,
    'spent', v_row.cost,
    'state', garden_state_json(v_uid, v_tz));
end $function$;

-- `revoke execute ... from anon` is a NO-OP: anon never holds a direct grant,
-- it inherits EXECUTE from PUBLIC, which every function gets by default. The
-- revoke has to name PUBLIC, and anything a signed-in player still needs is
-- then granted back explicitly. (The older migrations in this repo revoke
-- from `anon` and therefore never actually closed anything — see the note in
-- CLAUDE.md.)
revoke execute on function public.next_plot_json(uuid) from public;
revoke execute on function public.break_ground() from public;
grant  execute on function public.break_ground() to authenticated;

-- --------------------------------------------------------- garden_state_json
-- One field: what the next bed costs and whether it can be taken today. The
-- padlock in the scene has always been drawn from `plotCount`; now the panel
-- beside it can say what opens it.
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
    'nextPlot', next_plot_json(v_uid),
    'unlockedSpecies', v_unlocked,
    'gardenScore', v_score,
    'level', v_level,
    'lifetimeEarned', v_lifetime,
    'levelFloor', level_floor(v_level),
    'nextLevelAt', level_floor(v_level + 1),
    'completedCount', (select count(*) from completed_lilies where user_id = v_uid)
  );
end $function$;

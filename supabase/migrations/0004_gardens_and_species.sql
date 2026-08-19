-- ============================================================
-- Phase 01 — Many plots, many species
--
-- The single-lily model becomes a garden of plots. Each species carries its
-- own care contract (cadence, time window, plot type, feeds, prunes) and the
-- server remains the only authority on "today" and "now" in the player's
-- timezone. Existing lilies are migrated into plot 0 of a new garden.
-- ============================================================

alter table public.care_logs drop constraint if exists care_logs_action_check;
alter table public.care_logs add constraint care_logs_action_check
  check (action in ('visit','water','replant','feed','prune','visit_water'));

-- ---------- species: the care contract for every plant ----------

create table if not exists public.species (
  id            smallint primary key,
  key           text unique not null,
  name          text not null,
  blurb         text not null,
  form          text not null,               -- render archetype (see game/plants.ts)
  cadence_days  smallint not null default 1, -- days between waterings
  window_start  smallint,                    -- local hour window (null = anytime)
  window_end    smallint,
  needs_plot    text not null default 'any', -- 'any' | 'sun' | 'shade' | 'water'
  feeds_required  smallint not null default 0,
  prunes_required smallint not null default 0,
  matures_days  smallint not null,
  points        smallint not null,
  unlock_cost   int not null default 0,
  overwaterable boolean not null default false, -- true = early watering damages it
  constraint species_plot_kind check (needs_plot in ('any','sun','shade','water'))
);

insert into public.species
  (id, key, name, blurb, form, cadence_days, window_start, window_end, needs_plot,
   feeds_required, prunes_required, matures_days, points, unlock_cost, overwaterable)
values
  (1,'lily','Water Lily','Floats in the pond and asks only that you show up.','pad',
    1, null, null, 'water', 0, 0, 7, 10, 0, false),
  (2,'sunflower','Sunflower','Grows tall, but only drinks while the sun is up.','tall',
    1, 6, 20, 'sun', 0, 0, 10, 18, 0, false),
  (3,'fern','Woodland Fern','Scorches in the sun. Give it shade and a drink every other day.','frond',
    2, null, null, 'shade', 0, 0, 8, 16, 0, false),
  (4,'cactus','Desert Cactus','Thrives on neglect — water it early and the roots rot.','succulent',
    3, null, null, 'sun', 0, 0, 12, 24, 0, true),
  (5,'moonflower','Moonflower','Opens after dusk. Daytime water runs straight off.','vine',
    1, 18, 6, 'any', 0, 0, 9, 26, 500, false),
  (6,'tomato','Heirloom Tomato','Hungry as well as thirsty — feed it three times.','bush',
    1, null, null, 'sun', 3, 0, 14, 32, 700, false),
  (7,'orchid','Ghost Orchid','Shade, patience and four feedings. Miss too long and it is gone.','orchid',
    2, null, null, 'shade', 4, 0, 18, 60, 1400, false),
  (8,'bonsai','Bonsai Pine','A month of care and four prunings shape it properly.','tree',
    2, null, null, 'any', 0, 4, 30, 85, 2500, false)
on conflict (id) do update set
  name = excluded.name, blurb = excluded.blurb, form = excluded.form,
  cadence_days = excluded.cadence_days, window_start = excluded.window_start,
  window_end = excluded.window_end, needs_plot = excluded.needs_plot,
  feeds_required = excluded.feeds_required, prunes_required = excluded.prunes_required,
  matures_days = excluded.matures_days, points = excluded.points,
  unlock_cost = excluded.unlock_cost, overwaterable = excluded.overwaterable;

alter table public.species enable row level security;
drop policy if exists "species_read_all" on public.species;
create policy "species_read_all" on public.species for select to authenticated using (true);

-- ---------- gardens and plots ----------

create table if not exists public.gardens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default 'My Garden',
  plot_count smallint not null default 4 check (plot_count between 1 and 12),
  created_at timestamptz not null default now()
);
create unique index if not exists gardens_one_per_user on public.gardens (user_id);

-- Fixed plot layout: the first four span three different kinds so a new player
-- can immediately try a water, a sun and a shade species.
create or replace function public.plot_kind(idx smallint)
returns text language sql immutable
set search_path = public
as $$
  select case idx
    when 0 then 'water' when 1 then 'sun'   when 2 then 'shade' when 3 then 'sun'
    when 4 then 'water' when 5 then 'shade' when 6 then 'sun'   when 7 then 'water'
    when 8 then 'shade' when 9 then 'sun'   when 10 then 'sun'  else 'shade'
  end
$$;

-- ---------- wallet and inventory ----------

create table if not exists public.wallet (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  dewdrops        int not null default 0 check (dewdrops >= 0),
  lifetime_earned int not null default 0
);

create table if not exists public.inventory (
  user_id  uuid not null references auth.users(id) on delete cascade,
  item_key text not null,
  qty      int not null default 0 check (qty >= 0),
  primary key (user_id, item_key)
);

create table if not exists public.species_unlocks (
  user_id    uuid not null references auth.users(id) on delete cascade,
  species_id smallint not null references public.species(id),
  primary key (user_id, species_id)
);

-- ---------- plants become plot occupants ----------

drop index if exists public.plants_one_active_per_user;

alter table public.plants
  add column if not exists species_id smallint references public.species(id),
  add column if not exists garden_id uuid references public.gardens(id) on delete cascade,
  add column if not exists plot_idx smallint,
  add column if not exists growth smallint not null default 0,
  add column if not exists feeds_done smallint not null default 0,
  add column if not exists prunes_done smallint not null default 0,
  add column if not exists last_care_on date,
  add column if not exists died_on date;

-- stage is now derived from growth, which can exceed the old 0..6 ceiling
alter table public.plants drop constraint if exists plants_stage_check;

create unique index if not exists plants_one_per_plot
  on public.plants (garden_id, plot_idx) where active;

alter table public.completed_lilies
  add column if not exists species_id smallint references public.species(id);

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists friend_code text unique,
  add column if not exists name_changed boolean not null default false;

alter table public.gardens enable row level security;
alter table public.wallet enable row level security;
alter table public.inventory enable row level security;
alter table public.species_unlocks enable row level security;

drop policy if exists "gardens_select_own" on public.gardens;
create policy "gardens_select_own" on public.gardens
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "wallet_select_own" on public.wallet;
create policy "wallet_select_own" on public.wallet
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "inventory_select_own" on public.inventory;
create policy "inventory_select_own" on public.inventory
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "unlocks_select_own" on public.species_unlocks;
create policy "unlocks_select_own" on public.species_unlocks
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------- care logs: one entry per plant, per action, per day ----------

alter table public.care_logs drop constraint if exists care_logs_once_per_day;
create unique index if not exists care_logs_once_per_plant_day
  on public.care_logs (user_id, plant_id, action, care_date) where plant_id is not null;
create unique index if not exists care_logs_once_per_user_day
  on public.care_logs (user_id, action, care_date) where plant_id is null;

-- ---------- care maths ----------

-- Waterings needed to mature, given the species cadence.
create or replace function public.waters_to_mature(s public.species)
returns int language sql immutable
set search_path = public
as $$ select greatest(1, ceil(s.matures_days::numeric / s.cadence_days)::int) $$;

-- Visible growth stage 0..6, held back at 5 until feeds/prunes are done.
create or replace function public.plant_stage(p public.plants, s public.species)
returns int language sql immutable
set search_path = public
as $$
  select case
    when p.growth >= waters_to_mature(s)
         and p.feeds_done >= s.feeds_required
         and p.prunes_done >= s.prunes_required
      then 6
    else least(5, floor(p.growth::numeric * 6 / waters_to_mature(s))::int)
  end
$$;

-- Days overdue beyond the species' cadence.
create or replace function public.overdue_days(p public.plants, s public.species, v_today date)
returns int language sql immutable
set search_path = public
as $$
  select greatest(0, (v_today - coalesce(p.last_care_on, p.planted_on)) - s.cadence_days)
$$;

-- Is the local hour inside the species' care window? Handles windows that
-- wrap midnight (e.g. moonflower, 18:00 -> 06:00).
create or replace function public.in_window(s public.species, v_hour numeric)
returns boolean language sql immutable
set search_path = public
as $$
  select case
    when s.window_start is null then true
    when s.window_start < s.window_end then v_hour >= s.window_start and v_hour < s.window_end
    else v_hour >= s.window_start or v_hour < s.window_end
  end
$$;

create or replace function public.plant_json(p public.plants, s public.species, v_today date)
returns jsonb language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'plotIdx', p.plot_idx,
    'species', s.key,
    'stage', plant_stage(p, s),
    'growth', p.growth,
    'watersNeeded', waters_to_mature(s),
    'feedsDone', p.feeds_done,
    'prunesDone', p.prunes_done,
    'plantedOn', p.planted_on,
    'lastCareOn', p.last_care_on,
    'dayNumber', (v_today - p.planted_on) + 1,
    'overdueDays', overdue_days(p, s, v_today),
    'thirsty', p.last_care_on is null or (v_today - p.last_care_on) >= s.cadence_days,
    'wilted', overdue_days(p, s, v_today) > 0,
    'health', greatest(0, 1 - 0.25 * overdue_days(p, s, v_today)),
    'dead', p.died_on is not null,
    'isBloomed', p.is_bloomed,
    'streak', p.streak
  )
$$;

-- Kills anything left unattended for cadence + 4 days.
create or replace function public.reap_dead(v_uid uuid, v_today date)
returns void language sql
set search_path = public
as $$
  update plants p set died_on = v_today
  from species s
  where p.species_id = s.id
    and p.user_id = v_uid
    and p.active
    and p.died_on is null
    and not p.is_bloomed
    and overdue_days(p, s, v_today) >= 4;
$$;

-- ---------- garden state ----------

create or replace function public.garden_state_json(v_uid uuid, v_tz text)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  v_today date := local_today(v_tz);
  v_hour numeric := extract(hour from (now() at time zone safe_timezone(v_tz)))
                  + extract(minute from (now() at time zone safe_timezone(v_tz))) / 60.0;
  v_garden gardens%rowtype;
  v_profile profiles%rowtype;
  v_dew int;
  v_plots jsonb;
  v_unlocked jsonb;
  v_score int;
begin
  select * into v_garden from gardens where user_id = v_uid;
  select * into v_profile from profiles where id = v_uid;
  select coalesce(dewdrops, 0) into v_dew from wallet where user_id = v_uid;

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
  where sp.unlock_cost = 0
     or exists (select 1 from species_unlocks u where u.user_id = v_uid and u.species_id = sp.id);

  select coalesce(sum(
    case when p.died_on is not null then -15
    else round(s.points * greatest(0, 1 - 0.25 * overdue_days(p, s, v_today))) end
  ), 0)::int into v_score
  from plants p join species s on s.id = p.species_id
  where p.user_id = v_uid and p.active;

  return jsonb_build_object(
    'gardenId', v_garden.id,
    'gardenName', v_garden.name,
    'plotCount', v_garden.plot_count,
    'displayName', v_profile.display_name,
    'friendCode', v_profile.friend_code,
    'avatar', coalesce(v_profile.avatar, '{"skin":0,"hair":0,"hat":0,"outfit":0}'::jsonb),
    'dewdrops', coalesce(v_dew, 0),
    'today', v_today,
    'hour', round(v_hour, 2),
    'timezone', v_profile.timezone,
    'plots', v_plots,
    'unlockedSpecies', v_unlocked,
    'gardenScore', v_score,
    'completedCount', (select count(*) from completed_lilies where user_id = v_uid)
  );
end $$;

create or replace function public.get_garden_state(p_timezone text default null)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile profiles%rowtype;
  v_garden gardens%rowtype;
  v_today date;
  v_legacy plants%rowtype;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  insert into profiles (id, timezone)
  values (v_uid, safe_timezone(p_timezone))
  on conflict (id) do update
    set timezone = case
      when p_timezone is null or p_timezone = '' then profiles.timezone
      else safe_timezone(p_timezone)
    end
  returning * into v_profile;

  -- auto-assign a handle + friend code on first visit
  if v_profile.display_name is null then
    update profiles set
      display_name = (array['Mossy','Sunny','Dewy','Fern','Petal','Willow','Clover','Thistle',
                            'Bramble','Poppy','Cedar','Juniper'])[1 + floor(random()*12)]
                     || (array['Fern','Bloom','Pond','Sprout','Leaf','Lily','Root','Vine',
                               'Bud','Moss','Reed','Sage'])[1 + floor(random()*12)]
                     || floor(random()*90 + 10)::text,
      friend_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
    where id = v_uid
    returning * into v_profile;
  end if;

  v_today := local_today(v_profile.timezone);

  select * into v_garden from gardens where user_id = v_uid;
  if not found then
    insert into gardens (user_id) values (v_uid) returning * into v_garden;

    -- migrate a pre-Phase-01 lily into plot 0
    select * into v_legacy from plants
      where user_id = v_uid and active and garden_id is null
      order by created_at limit 1;
    if found then
      update plants set
        garden_id = v_garden.id,
        plot_idx = 0,
        species_id = 1,
        growth = greatest(coalesce(waters, 0), coalesce(stage, 0)),
        last_care_on = last_watered_on
      where id = v_legacy.id;
      -- retire any other legacy rows; they have no plot to live in
      update plants set active = false
        where user_id = v_uid and active and garden_id is null;
    end if;
  end if;

  insert into wallet (user_id) values (v_uid) on conflict do nothing;

  perform reap_dead(v_uid, v_today);

  insert into care_logs (user_id, plant_id, action, care_date)
  values (v_uid, null, 'visit', v_today)
  on conflict do nothing;

  return garden_state_json(v_uid, v_profile.timezone);
end $$;

-- ---------- planting ----------

create or replace function public.plant_seed(p_plot_idx smallint, p_species text)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_today date;
  v_garden gardens%rowtype;
  v_species species%rowtype;
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

  if v_species.needs_plot <> 'any' and v_species.needs_plot <> plot_kind(p_plot_idx) then
    raise exception '% needs a % plot', v_species.name, v_species.needs_plot;
  end if;

  if exists (select 1 from plants where garden_id = v_garden.id and plot_idx = p_plot_idx and active) then
    raise exception 'that plot is occupied';
  end if;

  insert into plants (user_id, garden_id, plot_idx, species_id, planted_on, stage)
  values (v_uid, v_garden.id, p_plot_idx, v_species.id, v_today, 0);

  return garden_state_json(v_uid, v_tz);
end $$;

-- ---------- clearing a plot (bloomed or dead) ----------

create or replace function public.clear_plot(p_plot_idx smallint)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_today date;
  v_garden gardens%rowtype;
  v_plant plants%rowtype;
  v_species species%rowtype;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select timezone into v_tz from profiles where id = v_uid;
  if v_tz is null then raise exception 'no profile: load the garden first'; end if;
  v_today := local_today(v_tz);

  select * into v_garden from gardens where user_id = v_uid;
  select * into v_plant from plants
    where garden_id = v_garden.id and plot_idx = p_plot_idx and active for update;
  if not found then raise exception 'nothing planted there'; end if;
  select * into v_species from species where id = v_plant.species_id;

  if not v_plant.is_bloomed and v_plant.died_on is null then
    raise exception 'that plant is still growing';
  end if;

  if v_plant.is_bloomed then
    insert into completed_lilies (user_id, plant_id, species_id, days_taken, waters, perfect)
    values (v_uid, v_plant.id, v_plant.species_id,
            (coalesce(v_plant.last_care_on, v_today) - v_plant.planted_on) + 1,
            v_plant.waters, v_plant.missed_days = 0);
  end if;

  update plants set active = false where id = v_plant.id;
  return garden_state_json(v_uid, v_tz);
end $$;

-- ---------- the core action ----------

create or replace function public.tend_plant(p_plot_idx smallint, p_action text)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_today date;
  v_hour numeric;
  v_garden gardens%rowtype;
  v_plant plants%rowtype;
  v_s species%rowtype;
  v_overdue int;
  v_gap int;
  v_dew int := 0;
  v_status text;
  v_grew boolean := false;
  v_bloomed boolean := false;
  v_damaged boolean := false;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_action not in ('water','feed','prune') then raise exception 'unknown action'; end if;

  select timezone into v_tz from profiles where id = v_uid;
  if v_tz is null then raise exception 'no profile: load the garden first'; end if;
  v_today := local_today(v_tz);
  v_hour := extract(hour from (now() at time zone safe_timezone(v_tz)))
          + extract(minute from (now() at time zone safe_timezone(v_tz))) / 60.0;

  select * into v_garden from gardens where user_id = v_uid;
  select * into v_plant from plants
    where garden_id = v_garden.id and plot_idx = p_plot_idx and active for update;
  if not found then raise exception 'nothing planted there'; end if;
  select * into v_s from species where id = v_plant.species_id;

  if v_plant.died_on is not null then
    return jsonb_build_object('status','dead','state', garden_state_json(v_uid, v_tz));
  end if;
  if v_plant.is_bloomed then
    return jsonb_build_object('status','bloomed','state', garden_state_json(v_uid, v_tz));
  end if;

  v_overdue := overdue_days(v_plant, v_s, v_today);

  -- ----- feed / prune: once per day, count toward maturity requirements -----
  if p_action = 'feed' then
    if v_s.feeds_required = 0 then
      return jsonb_build_object('status','not_needed','reason','This plant does not need feeding.',
                                'state', garden_state_json(v_uid, v_tz));
    end if;
    if v_plant.feeds_done >= v_s.feeds_required then
      return jsonb_build_object('status','not_needed','reason','Already fully fed.',
                                'state', garden_state_json(v_uid, v_tz));
    end if;
    insert into care_logs (user_id, plant_id, action, care_date)
    values (v_uid, v_plant.id, 'feed', v_today) on conflict do nothing;
    if not found then
      return jsonb_build_object('status','already','reason','Already fed today.',
                                'state', garden_state_json(v_uid, v_tz));
    end if;
    update plants set feeds_done = feeds_done + 1 where id = v_plant.id returning * into v_plant;
    v_dew := 4;
    v_status := 'fed';

  elsif p_action = 'prune' then
    if v_s.prunes_required = 0 then
      return jsonb_build_object('status','not_needed','reason','This plant does not need pruning.',
                                'state', garden_state_json(v_uid, v_tz));
    end if;
    if v_plant.prunes_done >= v_s.prunes_required then
      return jsonb_build_object('status','not_needed','reason','Already well shaped.',
                                'state', garden_state_json(v_uid, v_tz));
    end if;
    insert into care_logs (user_id, plant_id, action, care_date)
    values (v_uid, v_plant.id, 'prune', v_today) on conflict do nothing;
    if not found then
      return jsonb_build_object('status','already','reason','Already pruned today.',
                                'state', garden_state_json(v_uid, v_tz));
    end if;
    update plants set prunes_done = prunes_done + 1 where id = v_plant.id returning * into v_plant;
    v_dew := 4;
    v_status := 'pruned';

  else
    -- ----- water -----
    if not in_window(v_s, v_hour) then
      return jsonb_build_object('status','wrong_window',
        'windowStart', v_s.window_start, 'windowEnd', v_s.window_end,
        'state', garden_state_json(v_uid, v_tz));
    end if;

    if v_plant.last_care_on = v_today then
      return jsonb_build_object('status','already','state', garden_state_json(v_uid, v_tz));
    end if;

    -- not yet thirsty: a trap species rots, everything else simply declines
    if v_plant.last_care_on is not null
       and (v_today - v_plant.last_care_on) < v_s.cadence_days then
      if v_s.overwaterable then
        update plants set missed_days = missed_days + 1 where id = v_plant.id;
        insert into care_logs (user_id, plant_id, action, care_date)
        values (v_uid, v_plant.id, 'water', v_today) on conflict do nothing;
        return jsonb_build_object('status','overwatered',
          'state', garden_state_json(v_uid, v_tz));
      end if;
      return jsonb_build_object('status','not_thirsty',
        'nextDue', v_plant.last_care_on + v_s.cadence_days,
        'state', garden_state_json(v_uid, v_tz));
    end if;

    v_gap := v_overdue;
    update plants set
      growth = growth + 1,
      waters = waters + 1,
      last_care_on = v_today,
      last_watered_on = v_today,
      streak = case when v_gap > 0 then 1 else streak + 1 end,
      missed_days = missed_days + v_gap
    where id = v_plant.id returning * into v_plant;

    v_grew := true;
    v_damaged := v_gap > 0;
    v_dew := 5 + (v_s.points / 6);
    if v_plant.streak >= 5 then v_dew := v_dew + 3; end if;
    v_status := 'watered';

    insert into care_logs (user_id, plant_id, action, care_date)
    values (v_uid, v_plant.id, 'water', v_today) on conflict do nothing;
  end if;

  -- ----- maturity check -----
  if plant_stage(v_plant, v_s) = 6 and not v_plant.is_bloomed then
    update plants set is_bloomed = true, bloomed_at = now(), stage = 6
      where id = v_plant.id returning * into v_plant;
    v_bloomed := true;
    v_dew := v_dew + v_s.points;
  else
    update plants set stage = plant_stage(v_plant, v_s) where id = v_plant.id;
  end if;

  if v_dew > 0 then
    insert into wallet (user_id, dewdrops, lifetime_earned)
    values (v_uid, v_dew, v_dew)
    on conflict (user_id) do update
      set dewdrops = wallet.dewdrops + v_dew,
          lifetime_earned = wallet.lifetime_earned + v_dew;
  end if;

  return jsonb_build_object(
    'status', v_status,
    'grew', v_grew,
    'bloomedNow', v_bloomed,
    'wasWilted', v_damaged,
    'dewEarned', v_dew,
    'species', v_s.key,
    'plotIdx', p_plot_idx,
    'state', garden_state_json(v_uid, v_tz));
end $$;

-- ---------- rename (one free change) ----------

create or replace function public.set_display_name(p_name text)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_clean text;
  v_tz text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_clean := btrim(regexp_replace(coalesce(p_name, ''), '[^A-Za-z0-9 _-]', '', 'g'));
  if length(v_clean) < 3 or length(v_clean) > 18 then
    raise exception 'Pick a name between 3 and 18 characters (letters, numbers, spaces).';
  end if;
  select timezone into v_tz from profiles where id = v_uid;
  if exists (select 1 from profiles where id = v_uid and name_changed) then
    raise exception 'You have already used your one name change.';
  end if;
  update profiles set display_name = v_clean, name_changed = true where id = v_uid;
  return garden_state_json(v_uid, v_tz);
end $$;

-- ---------- permissions ----------

revoke all on function public.garden_state_json(uuid, text) from public, anon, authenticated;
revoke all on function public.waters_to_mature(public.species) from public, anon, authenticated;
revoke all on function public.plant_stage(public.plants, public.species) from public, anon, authenticated;
revoke all on function public.overdue_days(public.plants, public.species, date) from public, anon, authenticated;
revoke all on function public.in_window(public.species, numeric) from public, anon, authenticated;
revoke all on function public.plant_json(public.plants, public.species, date) from public, anon, authenticated;
revoke all on function public.reap_dead(uuid, date) from public, anon, authenticated;
revoke all on function public.plot_kind(smallint) from public, anon, authenticated;

revoke all on function public.tend_plant(smallint, text) from public, anon;
revoke all on function public.plant_seed(smallint, text) from public, anon;
revoke all on function public.clear_plot(smallint) from public, anon;
revoke all on function public.set_display_name(text) from public, anon;
grant execute on function public.tend_plant(smallint, text) to authenticated;
grant execute on function public.plant_seed(smallint, text) to authenticated;
grant execute on function public.clear_plot(smallint) to authenticated;
grant execute on function public.set_display_name(text) to authenticated;

-- the single-lily entry points are gone
drop function if exists public.water_lily();
drop function if exists public.replant();

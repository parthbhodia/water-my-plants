-- ============================================================
-- Garden restoration — the long game.
--
-- Two overgrown corners of the meadow sit behind the fence, fogged over.
-- Each unlocks at a gardener level and holds ruined fixtures that dewdrops
-- restore permanently. Restoration is the sink for long-term players: it
-- transforms the garden visibly, feeds the showcase, and never touches the
-- daily care loop — you cannot buy growth, only scenery you earned.
--
--   restoration_zones      zone defs: unlock level, name
--   restoration_fixtures   fixture defs: zone, cost, name/blurb
--   restorations           per-user restored set (RLS: select own)
--   restore_fixture(text)  spends dewdrops under the wallet row lock
--   garden_state_json      now carries 'zones' with per-user state
-- ============================================================

create table if not exists public.restoration_zones (
  key        text primary key,
  name       text not null,
  blurb      text not null,
  min_level  int  not null,
  sort       int  not null default 0
);

create table if not exists public.restoration_fixtures (
  key       text primary key,
  zone_key  text not null references public.restoration_zones(key),
  name      text not null,
  blurb     text not null,
  cost      int  not null check (cost > 0),
  sort      int  not null default 0
);

insert into public.restoration_zones (key, name, blurb, min_level, sort) values
  ('glade',  'The Old Glade',
   'A mossed-over corner by the willows. Someone loved this place once.', 3, 10),
  ('meadow', 'The Far Meadow',
   'Waist-high grass past the fence, hiding stonework older than the house.', 6, 20)
on conflict (key) do update set
  name = excluded.name, blurb = excluded.blurb,
  min_level = excluded.min_level, sort = excluded.sort;

insert into public.restoration_fixtures (key, zone_key, name, blurb, cost, sort) values
  ('fountain', 'glade',  'Stone Fountain',
   'Choked with ivy and dry as a bone. It could sing again.', 450, 10),
  ('swing',    'glade',  'Willow Swing',
   'Two frayed ropes and a cracked seat under the big tree.', 700, 20),
  ('well',     'meadow', 'Wishing Well',
   'The roof has fallen in and the bucket is long gone.', 1000, 10),
  ('arch',     'meadow', 'Rose Arch',
   'A bare iron skeleton that once carried a hundred blooms.', 1600, 20)
on conflict (key) do update set
  zone_key = excluded.zone_key, name = excluded.name,
  blurb = excluded.blurb, cost = excluded.cost, sort = excluded.sort;

alter table public.restoration_zones enable row level security;
alter table public.restoration_fixtures enable row level security;
drop policy if exists "zones_read" on public.restoration_zones;
create policy "zones_read" on public.restoration_zones
  for select to authenticated using (true);
drop policy if exists "fixtures_read" on public.restoration_fixtures;
create policy "fixtures_read" on public.restoration_fixtures
  for select to authenticated using (true);

create table if not exists public.restorations (
  user_id     uuid not null references auth.users(id) on delete cascade,
  fixture_key text not null references public.restoration_fixtures(key),
  restored_at timestamptz not null default now(),
  primary key (user_id, fixture_key)
);

alter table public.restorations enable row level security;
drop policy if exists "restorations_select_own" on public.restorations;
create policy "restorations_select_own" on public.restorations
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------- restore ----------

create or replace function public.restore_fixture(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_fix restoration_fixtures%rowtype;
  v_zone restoration_zones%rowtype;
  v_level int;
  v_dew int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select timezone into v_tz from profiles where id = v_uid;
  if v_tz is null then raise exception 'no profile: load the garden first'; end if;

  select * into v_fix from restoration_fixtures where key = p_key;
  if not found then raise exception 'no such fixture'; end if;
  select * into v_zone from restoration_zones where key = v_fix.zone_key;

  select gardener_level(coalesce(lifetime_earned, 0)) into v_level
    from wallet where user_id = v_uid;
  if coalesce(v_level, 1) < v_zone.min_level then
    raise exception '% opens at gardener level %.', v_zone.name, v_zone.min_level;
  end if;

  if exists (select 1 from restorations
              where user_id = v_uid and fixture_key = p_key) then
    raise exception 'Already restored.';
  end if;

  -- lock the wallet so two taps cannot spend the same dewdrops twice
  select dewdrops into v_dew from wallet where user_id = v_uid for update;
  if coalesce(v_dew, 0) < v_fix.cost then
    raise exception 'Not enough dewdrops — you need % more.', v_fix.cost - coalesce(v_dew, 0);
  end if;

  update wallet set dewdrops = dewdrops - v_fix.cost where user_id = v_uid;
  insert into restorations (user_id, fixture_key) values (v_uid, p_key);

  return jsonb_build_object(
    'status', 'restored',
    'fixture', v_fix.key,
    'name', v_fix.name,
    'spent', v_fix.cost,
    'state', garden_state_json(v_uid, v_tz));
end $$;

grant execute on function public.restore_fixture(text) to authenticated;

-- ---------- state: zones join garden_state_json ----------


create or replace function public.garden_state_json(v_uid uuid, v_tz text)
returns jsonb
language plpgsql
stable
security definer
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
  v_inv jsonb;
  v_decor jsonb;
  v_score int;
  v_level int;
  v_zones jsonb;
begin
  select * into v_garden from gardens where user_id = v_uid;
  select * into v_profile from profiles where id = v_uid;
  select coalesce(dewdrops, 0) into v_dew from wallet where user_id = v_uid;
  select gardener_level(coalesce(lifetime_earned, 0)) into v_level
    from wallet where user_id = v_uid;
  v_level := coalesce(v_level, 1);

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
    'plots', v_plots,
    'unlockedSpecies', v_unlocked,
    'gardenScore', v_score,
    'level', v_level,
    'completedCount', (select count(*) from completed_lilies where user_id = v_uid)
  );
end $$;

revoke all on function public.garden_state_json(uuid, text) from public, anon, authenticated;

-- Lily Days: schema, RLS, and server-authoritative game logic
-- (applied to the project as migration `lily_days_init`)
-- All writes go through SECURITY DEFINER functions; clients only ever SELECT their own rows.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

create table public.plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stage int not null default 0 check (stage between 0 and 6),
  planted_on date not null,
  last_watered_on date,
  streak int not null default 0,
  waters int not null default 0,
  missed_days int not null default 0,
  is_bloomed boolean not null default false,
  bloomed_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index plants_one_active_per_user on public.plants (user_id) where active;
create index plants_user_idx on public.plants (user_id);

create table public.care_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id uuid references public.plants(id) on delete set null,
  action text not null check (action in ('visit','water','replant')),
  care_date date not null,
  created_at timestamptz not null default now(),
  constraint care_logs_once_per_day unique (user_id, action, care_date)
);
create index care_logs_plant_idx on public.care_logs (plant_id);
create index care_logs_date_idx on public.care_logs (care_date);

create table public.completed_lilies (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plant_id uuid,
  days_taken int not null,
  waters int not null,
  perfect boolean not null default false,
  completed_at timestamptz not null default now()
);
create index completed_lilies_user_idx on public.completed_lilies (user_id);

alter table public.profiles enable row level security;
alter table public.plants enable row level security;
alter table public.care_logs enable row level security;
alter table public.completed_lilies enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "plants_select_own" on public.plants
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "care_logs_select_own" on public.care_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "completed_lilies_select_own" on public.completed_lilies
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.safe_timezone(tz text)
returns text language plpgsql stable
set search_path = public
as $$
begin
  if tz is null or tz = '' then return 'UTC'; end if;
  perform now() at time zone tz;
  return tz;
exception when others then
  return 'UTC';
end $$;

create or replace function public.local_today(tz text)
returns date language sql stable
set search_path = public
as $$
  select (now() at time zone public.safe_timezone(tz))::date
$$;

create or replace function public.garden_json(p public.plants, v_uid uuid, v_tz text, v_today date)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  v_completed int;
begin
  select count(*) into v_completed from completed_lilies where user_id = v_uid;
  return jsonb_build_object(
    'plantId', p.id,
    'stage', p.stage,
    'dayNumber', (v_today - p.planted_on) + 1,
    'plantedOn', p.planted_on,
    'lastWateredOn', p.last_watered_on,
    'wateredToday', (p.last_watered_on = v_today),
    'wilted', (not p.is_bloomed) and (
        (p.last_watered_on is null and v_today - p.planted_on >= 1)
        or (p.last_watered_on is not null and v_today - p.last_watered_on > 1)),
    'streak', p.streak,
    'waters', p.waters,
    'missedDays', p.missed_days,
    'isBloomed', p.is_bloomed,
    'completedCount', v_completed,
    'today', v_today,
    'timezone', v_tz
  );
end $$;

create or replace function public.get_garden_state(p_timezone text default null)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile profiles%rowtype;
  v_plant plants%rowtype;
  v_tz text;
  v_today date;
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

  v_tz := v_profile.timezone;
  v_today := local_today(v_tz);

  select * into v_plant from plants where user_id = v_uid and active;
  if not found then
    insert into plants (user_id, planted_on) values (v_uid, v_today)
    returning * into v_plant;
  end if;

  insert into care_logs (user_id, plant_id, action, care_date)
  values (v_uid, v_plant.id, 'visit', v_today)
  on conflict do nothing;

  return garden_json(v_plant, v_uid, v_tz, v_today);
end $$;

create or replace function public.water_lily()
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_today date;
  v_plant plants%rowtype;
  v_gap int;
  v_bloomed_now boolean;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select timezone into v_tz from profiles where id = v_uid;
  if v_tz is null then raise exception 'no profile: load the garden first'; end if;
  v_today := local_today(v_tz);

  select * into v_plant from plants where user_id = v_uid and active for update;
  if not found then raise exception 'no active plant'; end if;

  if v_plant.is_bloomed then
    return jsonb_build_object('status', 'bloomed',
      'state', garden_json(v_plant, v_uid, v_tz, v_today));
  end if;

  if v_plant.last_watered_on = v_today then
    return jsonb_build_object('status', 'already',
      'state', garden_json(v_plant, v_uid, v_tz, v_today));
  end if;

  if v_plant.last_watered_on is null then
    v_gap := greatest(v_today - v_plant.planted_on, 0);
  else
    v_gap := greatest(v_today - v_plant.last_watered_on - 1, 0);
  end if;

  update plants set
    stage = least(stage + 1, 6),
    last_watered_on = v_today,
    streak = case when v_gap > 0 then 1 else streak + 1 end,
    waters = waters + 1,
    missed_days = missed_days + v_gap,
    is_bloomed = (least(stage + 1, 6) = 6),
    bloomed_at = case when least(stage + 1, 6) = 6 then now() else bloomed_at end
  where id = v_plant.id
  returning * into v_plant;

  v_bloomed_now := v_plant.is_bloomed;

  insert into care_logs (user_id, plant_id, action, care_date)
  values (v_uid, v_plant.id, 'water', v_today)
  on conflict do nothing;

  return jsonb_build_object(
    'status', 'watered',
    'grew', true,
    'bloomedNow', v_bloomed_now,
    'wasWilted', v_gap > 0,
    'state', garden_json(v_plant, v_uid, v_tz, v_today));
end $$;

create or replace function public.replant()
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_today date;
  v_plant plants%rowtype;
  v_new plants%rowtype;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select timezone into v_tz from profiles where id = v_uid;
  if v_tz is null then raise exception 'no profile: load the garden first'; end if;
  v_today := local_today(v_tz);

  select * into v_plant from plants where user_id = v_uid and active for update;
  if not found then raise exception 'no active plant'; end if;
  if not v_plant.is_bloomed then raise exception 'lily has not bloomed yet'; end if;

  insert into completed_lilies (user_id, plant_id, days_taken, waters, perfect)
  values (v_uid, v_plant.id,
          (coalesce(v_plant.last_watered_on, v_today) - v_plant.planted_on) + 1,
          v_plant.waters,
          v_plant.missed_days = 0);

  update plants set active = false where id = v_plant.id;

  insert into plants (user_id, planted_on) values (v_uid, v_today)
  returning * into v_new;

  insert into care_logs (user_id, plant_id, action, care_date)
  values (v_uid, v_new.id, 'replant', v_today)
  on conflict do nothing;

  return jsonb_build_object('status', 'replanted',
    'state', garden_json(v_new, v_uid, v_tz, v_today));
end $$;

revoke all on function public.garden_json(public.plants, uuid, text, date) from public, anon, authenticated;
revoke all on function public.get_garden_state(text) from public, anon;
revoke all on function public.water_lily() from public, anon;
revoke all on function public.replant() from public, anon;
grant execute on function public.get_garden_state(text) to authenticated;
grant execute on function public.water_lily() to authenticated;
grant execute on function public.replant() to authenticated;

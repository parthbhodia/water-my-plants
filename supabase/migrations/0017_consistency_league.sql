-- ============================================================
-- The weekly league ranks on showing up, not on having more.
--
-- compute_garden_score grew with everything a player accumulated — living
-- plant points, harvest points, species variety — so a day-1 player could
-- never catch a day-90 player. That is the textbook way to make a
-- leaderboard demotivating, and it rewarded grinding in a game whose pitch
-- is "built to be finished, not farmed".
--
-- A day is "met" when every plant that was due that day got its water.
-- Score = met days x 100, plus every plant tended as a tiebreak, so a
-- two-plant newcomer and a twelve-plant veteran play for the same ceiling
-- while a bigger garden still edges ahead on equal consistency.
--
-- Nothing anyone earned is lost: compute_garden_score is left untouched and
-- still powers garden_value() and the all-time Hall of Fame boards, which
-- never reset. Only the weekly league — which always reset — changes basis.
--
-- Both facts are reconstructed from care_logs, which already records every
-- watering by date, so there is no new table, no cron and no backfill.
--
-- Applied remotely as migration `consistency_league`.
-- ============================================================

-- Was each plant due on v_day, and did it get watered? Purely historical:
-- the previous water strictly before v_day sets the clock, so overwatering
-- can never manufacture a "met".
create or replace function public.care_day_counts(v_uid uuid, v_day date)
returns table (due int, met int)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(count(*) filter (where d.was_due), 0)::int,
    coalesce(count(*) filter (where d.was_due and d.did), 0)::int
  from (
    select
      (v_day - coalesce(
        (select max(cl.care_date) from care_logs cl
          where cl.plant_id = p.id and cl.action = 'water' and cl.care_date < v_day),
        p.planted_on)) >= s.cadence_days as was_due,
      exists (
        select 1 from care_logs c2
         where c2.plant_id = p.id and c2.action = 'water' and c2.care_date = v_day
      ) as did
    from plants p join species s on s.id = p.species_id
    where p.user_id = v_uid
      and p.planted_on <= v_day
      and (p.died_on is null or p.died_on > v_day)
      and (p.bloomed_at is null or p.bloomed_at::date >= v_day)
  ) d
$$;

-- A day with nothing due is a rest day: neither scored nor penalised, so a
-- sparse garden simply gets fewer chances rather than free perfect days.
create or replace function public.compute_consistency_score(v_uid uuid)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_today date;
  v_season seasons%rowtype;
  v_day date;
  v_c record;
  v_days int := 0;
  v_tended int := 0;
begin
  select timezone into v_tz from profiles where id = v_uid;
  if v_tz is null then return 0; end if;
  v_today := local_today(v_tz);
  select * into v_season from seasons where id = season_id_for(current_date);
  if v_season.id is null then return 0; end if;

  v_day := v_season.starts_on;
  while v_day <= least(v_today, v_season.ends_on) loop
    select * into v_c from care_day_counts(v_uid, v_day);
    if v_c.due > 0 and v_c.met = v_c.due then
      v_days := v_days + 1;
    end if;
    v_tended := v_tended + coalesce(v_c.met, 0);
    v_day := v_day + 1;
  end loop;

  return v_days * 100 + v_tended;
end $$;

create or replace function public.refresh_league_score(v_uid uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_season_id int := season_id_for(current_date);
begin
  update league_members
     set score = compute_consistency_score(v_uid)
   where user_id = v_uid and season_id = v_season_id;
end $$;

-- Seven marks for the running week, plus the totals the share string needs.
create or replace function public.get_care_week()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_today date;
  v_season seasons%rowtype;
  v_day date;
  v_c record;
  v_marks jsonb := '[]'::jsonb;
  v_mark text;
  v_met_days int := 0;
  v_tended int := 0;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select timezone into v_tz from profiles where id = v_uid;
  if v_tz is null then raise exception 'no profile'; end if;
  v_today := local_today(v_tz);
  select * into v_season from seasons where id = season_id_for(current_date);
  if v_season.id is null then return jsonb_build_object('marks', '[]'::jsonb); end if;

  v_day := v_season.starts_on;
  while v_day <= v_season.ends_on loop
    if v_day > v_today then
      v_mark := 'future';
    else
      select * into v_c from care_day_counts(v_uid, v_day);
      if v_c.due = 0 then
        v_mark := 'rest';
      elsif v_c.met = v_c.due then
        v_mark := 'full';
        v_met_days := v_met_days + 1;
      elsif v_c.met > 0 then
        v_mark := 'partial';
      else
        v_mark := 'missed';
      end if;
      v_tended := v_tended + coalesce(v_c.met, 0);
    end if;
    v_marks := v_marks || jsonb_build_object(
      'day', v_day,
      'weekday', to_char(v_day, 'Dy'),
      'mark', v_mark);
    v_day := v_day + 1;
  end loop;

  return jsonb_build_object(
    'seasonNumber', v_season.id,
    'startsOn', v_season.starts_on,
    'marks', v_marks,
    'metDays', v_met_days,
    'tended', v_tended,
    'score', v_met_days * 100 + v_tended);
end $$;

revoke all on function public.care_day_counts(uuid, date) from public, anon, authenticated;
revoke all on function public.compute_consistency_score(uuid) from public, anon, authenticated;
grant execute on function public.get_care_week() to authenticated;

-- ============================================================
-- Day one of a plant's life was unscoreable.
--
-- care_day_counts marks a plant "due" only once
--   (day - last_water_before_day, else planted_on) >= cadence_days
-- so a plant planted and watered the same day is 0 >= 1, not due, and its
-- watering is not counted in `met`. compute_consistency_score then summed
-- `met` for BOTH terms — so that watering contributed nothing to the
-- tiebreak either, and a player who planted a seed and watered it scored
-- zero for the day. They did the work and the ledger ignored it.
--
-- The perfect-day term is right as it stands: a day is met when every plant
-- that ASKED for something got it, and a plant not yet thirsty asked for
-- nothing. That term still caps at 7 for everyone, which is the entire point
-- of the consistency league — a two-plant newcomer and a twelve-plant
-- veteran play for the same ceiling.
--
-- The tiebreak is what was wrong. It is documented as "total tended" and was
-- in fact "total tended while overdue". It now counts every watering in the
-- season, so no act of care goes unrecorded.
--
-- Applied remotely as `tiebreak_counts_every_watering`, followed by
-- refresh_league_score for every profile. Scores recompute from care_logs on
-- every refresh, so this only ever corrects rows upward — nothing anyone
-- earned is removed.
-- ============================================================

create or replace function public.compute_consistency_score(v_uid uuid)
returns integer
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

  -- primary: days where everything that was due got done
  v_day := v_season.starts_on;
  while v_day <= least(v_today, v_season.ends_on) loop
    select * into v_c from care_day_counts(v_uid, v_day);
    if v_c.due > 0 and v_c.met = v_c.due then
      v_days := v_days + 1;
    end if;
    v_day := v_day + 1;
  end loop;

  -- tiebreak: every watering this season, due or not
  select count(*) into v_tended
  from care_logs cl
  where cl.user_id = v_uid
    and cl.action = 'water'
    and cl.care_date between v_season.starts_on and least(v_today, v_season.ends_on);

  return v_days * 100 + coalesce(v_tended, 0);
end $$;

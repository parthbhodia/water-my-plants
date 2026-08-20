-- 0012_tutorial_flag
--
-- First-run onboarding.
--
--   profiles.tutorial_done   false until the player finishes (or skips) the
--                            "how to play" walkthrough
--   finish_tutorial()        marks it done and returns the refreshed state
--   garden_state_json        now carries 'tutorialDone' so the client knows
--                            on first load whether to show the walkthrough
--
-- Anyone who already has plants has clearly worked out how to play, so they
-- are backfilled as done and never see the overlay.

alter table public.profiles
  add column if not exists tutorial_done boolean not null default false;

update public.profiles p
   set tutorial_done = true
 where not tutorial_done
   and exists (select 1 from public.plants pl where pl.user_id = p.id);

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
    'today', v_today,
    'hour', round(v_hour, 2),
    'timezone', v_profile.timezone,
    'plots', v_plots,
    'unlockedSpecies', v_unlocked,
    'gardenScore', v_score,
    'level', gardener_level(coalesce((select lifetime_earned from wallet where user_id = v_uid), 0)),
    'completedCount', (select count(*) from completed_lilies where user_id = v_uid)
  );
end $$;

revoke all on function public.garden_state_json(uuid, text) from public, anon, authenticated;

create or replace function public.finish_tutorial()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  update profiles set tutorial_done = true where id = v_uid
    returning timezone into v_tz;
  if v_tz is null then raise exception 'no profile'; end if;
  return garden_state_json(v_uid, v_tz);
end $$;

grant execute on function public.finish_tutorial() to authenticated;

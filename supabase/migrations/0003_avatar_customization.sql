-- Gardener avatar customization: stored per profile, returned with garden state.

alter table public.profiles
  add column if not exists avatar jsonb not null
  default '{"skin":0,"hair":0,"hat":0,"outfit":0}'::jsonb;

-- Keeps only the four known integer keys, clamped to a sane range, so a
-- malformed client payload can never poison the render path.
create or replace function public.clean_avatar(a jsonb)
returns jsonb language sql immutable
set search_path = public
as $$
  select jsonb_build_object(
    'skin',   greatest(0, least(15, coalesce((a->>'skin')::int, 0))),
    'hair',   greatest(0, least(15, coalesce((a->>'hair')::int, 0))),
    'hat',    greatest(0, least(15, coalesce((a->>'hat')::int, 0))),
    'outfit', greatest(0, least(15, coalesce((a->>'outfit')::int, 0)))
  )
$$;

create or replace function public.set_avatar(p_avatar jsonb)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_clean jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_clean := clean_avatar(p_avatar);
  update profiles set avatar = v_clean where id = v_uid;
  if not found then raise exception 'no profile: load the garden first'; end if;
  return v_clean;
exception when invalid_text_representation then
  raise exception 'invalid avatar payload';
end $$;

-- include the avatar in the state the client already fetches
create or replace function public.garden_json(p public.plants, v_uid uuid, v_tz text, v_today date)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  v_completed int;
  v_avatar jsonb;
begin
  select count(*) into v_completed from completed_lilies where user_id = v_uid;
  select avatar into v_avatar from profiles where id = v_uid;
  return jsonb_build_object(
    'plantId', p.id,
    'avatar', coalesce(v_avatar, '{"skin":0,"hair":0,"hat":0,"outfit":0}'::jsonb),
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

revoke all on function public.clean_avatar(jsonb) from public, anon, authenticated;
revoke all on function public.set_avatar(jsonb) from public, anon;
grant execute on function public.set_avatar(jsonb) to authenticated;

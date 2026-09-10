-- ============================================================
-- Phase 12b — The Hall of Fame becomes a door
--
-- 0036 shipped two of the three ways into somebody's garden: neighbours,
-- and gardens already public on the showcase. The third — the all-time
-- boards — was missing, and it is the one that matters most on a small
-- player base, because those boards never reset. Somebody who bloomed a
-- dozen lilies and gathered them all has NOTHING currently growing:
-- absent from the showcase, present on the Hall of Fame, and unreachable.
--
-- Live data made that concrete rather than theoretical. Four players, four
-- gardens, four living plants — all belonging to ONE person. Both tests
-- reported the consequence: `get_visitable` returned an empty array and
-- `enter_garden_real` skipped for want of any visitable garden, so the
-- POSITIVE path of enter_garden had never once executed against real data.
--
-- Two changes, and both are read off the live function bodies rather than
-- inferred — get_showcase and get_hall_of_fame were applied remotely and
-- exist in this repo only as comments in 0011, which is how the first
-- attempt came to approximate the showcase rule and get it wrong.
--
-- Both functions are re-created WHOLE so this migration lands the same way
-- whether or not 0036's later amendment was applied.
-- ============================================================

-- --------------------------------------------------------------- visitable
-- Now all three arms the design actually asked for.
--
-- The board predicates are copied from get_hall_of_fame's own bodies:
--   blooms   profiles.lifetime_blooms > 0
--   streaks  profiles.best_streak     > 0
--   gardens  garden_value(id)         > 0   (already the showcase arm)
--   levels   wallet.lifetime_earned   > 0
--
-- `lifetime_earned > 0` is the widest of them — anyone who has ever earned a
-- dewdrop, which is anyone who has ever watered anything. That is deliberate
-- and it is not new exposure: the Levels board has been showing those
-- players' names, avatars and levels to every signed-in player since 0008.
--
-- Every table is SCHEMA-QUALIFIED because this is `language sql`, whose body
-- Postgres parses at CREATE time; the `set search_path` below applies at
-- EXECUTION. This is the one function in the visiting feature where an
-- unresolvable name fails the whole migration instead of one later call.
create or replace function public.visitable(p_viewer uuid, p_host uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p_viewer is not null
     and p_host is not null
     and p_viewer <> p_host
     and exists (select 1 from public.gardens g where g.user_id = p_host)
     and (
       -- a neighbour, in either direction
       exists (select 1 from public.friendships f
                where (f.user_id = p_viewer and f.friend_id = p_host)
                   or (f.user_id = p_host   and f.friend_id = p_viewer))
       -- or a garden already public on the showcase: get_showcase's OWN
       -- predicate, so the picker and the landing page cannot disagree
       or public.garden_value(p_host) > 0
       -- or a place on the blooms or longest-streak board
       or exists (select 1 from public.profiles p
                   where p.id = p_host
                     and (coalesce(p.lifetime_blooms, 0) > 0
                       or coalesce(p.best_streak, 0) > 0))
       -- or a place on the gardener-level board
       or exists (select 1 from public.wallet w
                   where w.user_id = p_host
                     and coalesce(w.lifetime_earned, 0) > 0)
     )
$function$;

revoke execute on function public.visitable(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------- get_hall_of_fame
-- Unchanged in every respect but one: each row now carries `uid`, and ONLY
-- when that garden is currently visitable to the caller. A board must never
-- advertise a door `enter_garden` is about to refuse — `components/Leaderboard.tsx`
-- draws a row as a button when `uid` is present and as plain text when it is
-- not, precisely so a dead control is impossible.
--
-- The uid is the host's user id, which is not a secret: RLS is select-own-rows,
-- every read goes through a SECURITY DEFINER function, and `add_friend` takes a
-- friend CODE rather than an id, so holding one buys nothing on its own.
create or replace function public.get_hall_of_fame()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_blooms jsonb; v_streaks jsonb; v_gardens jsonb; v_levels jsonb;
  v_me jsonb;
  v_lifetime int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select coalesce(jsonb_agg(j order by rk), '[]'::jsonb) into v_blooms from (
    select jsonb_build_object('rank', rk, 'name', name, 'avatar', avatar,
                              'value', v, 'isMe', me, 'uid', uid) as j, rk
    from (
      select row_number() over (order by p.lifetime_blooms desc, p.gardening_since) as rk,
             coalesce(p.display_name,'Gardener') as name, p.avatar,
             p.lifetime_blooms as v, p.id = v_uid as me,
             case when visitable(v_uid, p.id) then p.id else null end as uid
      from profiles p where p.lifetime_blooms > 0
      order by p.lifetime_blooms desc, p.gardening_since limit 10
    ) t
  ) u;

  select coalesce(jsonb_agg(j order by rk), '[]'::jsonb) into v_streaks from (
    select jsonb_build_object('rank', rk, 'name', name, 'avatar', avatar,
                              'value', v, 'isMe', me, 'uid', uid) as j, rk
    from (
      select row_number() over (order by p.best_streak desc, p.gardening_since) as rk,
             coalesce(p.display_name,'Gardener') as name, p.avatar,
             p.best_streak as v, p.id = v_uid as me,
             case when visitable(v_uid, p.id) then p.id else null end as uid
      from profiles p where p.best_streak > 0
      order by p.best_streak desc, p.gardening_since limit 10
    ) t
  ) u;

  select coalesce(jsonb_agg(j order by rk), '[]'::jsonb) into v_gardens from (
    select jsonb_build_object('rank', rk, 'name', name, 'avatar', avatar,
                              'value', v, 'isMe', me, 'uid', uid) as j, rk
    from (
      select row_number() over (order by gv desc) as rk, name, avatar, gv as v, me, uid
      from (
        select coalesce(p.display_name,'Gardener') as name, p.avatar,
               garden_value(p.id) as gv, p.id = v_uid as me,
               case when visitable(v_uid, p.id) then p.id else null end as uid
        from profiles p
      ) g where gv > 0
      order by gv desc limit 10
    ) t
  ) u;

  select coalesce(jsonb_agg(j order by rk), '[]'::jsonb) into v_levels from (
    select jsonb_build_object('rank', rk, 'name', name, 'avatar', avatar,
                              'value', v, 'isMe', me, 'uid', uid) as j, rk
    from (
      select row_number() over (order by w.lifetime_earned desc) as rk,
             coalesce(p.display_name,'Gardener') as name, p.avatar,
             gardener_level(w.lifetime_earned) as v, p.id = v_uid as me,
             case when visitable(v_uid, p.id) then p.id else null end as uid
      from wallet w join profiles p on p.id = w.user_id
      where w.lifetime_earned > 0
      order by w.lifetime_earned desc limit 10
    ) t
  ) u;

  select coalesce(lifetime_earned, 0) into v_lifetime from wallet where user_id = v_uid;

  select jsonb_build_object(
    'level', gardener_level(coalesce(v_lifetime, 0)),
    'lifetimeEarned', coalesce(v_lifetime, 0),
    'nextLevelAt', (power(gardener_level(coalesce(v_lifetime,0)), 2) * 40)::int,
    'blooms', p.lifetime_blooms,
    'bestStreak', p.best_streak,
    'gardenValue', garden_value(v_uid),
    'gardeningSince', p.gardening_since,
    'daysTending', (current_date - p.gardening_since)
  ) into v_me
  from profiles p where p.id = v_uid;

  return jsonb_build_object(
    'me', v_me,
    'blooms', v_blooms,
    'streaks', v_streaks,
    'gardens', v_gardens,
    'levels', v_levels
  );
end $function$;

-- Grants unchanged from 0008; restated because `create or replace` on an
-- existing function keeps its ACL, and stating them makes the intended
-- surface reviewable in one place. Read the ACL back afterwards — never
-- trust the SQL you just ran (see the grants table in CLAUDE.md).
revoke execute on function public.get_hall_of_fame() from public, anon;
grant  execute on function public.get_hall_of_fame() to authenticated;

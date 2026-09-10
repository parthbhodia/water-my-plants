-- ============================================================
-- Phase 12 — Visiting gardens, choosing the rescue, and the bell
--
-- Why this exists: the neighbour system shipped, was granted, was smoke
-- tested — and `friendships` and `visits` both hold ZERO rows. Nobody has
-- ever used it, because the only door was a `LILY-XXXX` code you had to
-- obtain out of band, and because "visiting" meant pressing a button in a
-- list that picked a plant for you. You never saw the garden.
--
-- So: `enter_garden` returns a spectator copy of the host's state document
-- (the scene paints it unchanged), `rescue_plant` lets a guest choose which
-- plant to save now that they can see them, and `notifications` tells the
-- host somebody came. `get_visitable` is the guest list, which finally gives
-- `get_garden_of_the_day()` — granted and callable since 0011, called by
-- nothing ever since — a job.
--
-- `visit_water` is deliberately UNTOUCHED. It still works, the smoke test
-- still asserts its self-visit guard, and the blind quick-help button in the
-- friends list still calls it.
-- ============================================================

-- ------------------------------------------------------------------ table
create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('visit','rescue')),
  title      text not null,
  body       text,
  -- The actor's DISPLAY NAME, denormalised on purpose: a notification is a
  -- record of what happened at the time, and it must not start saying a
  -- different name because somebody renamed themselves afterwards.
  actor_name text,
  actor_id   uuid references auth.users(id) on delete set null,
  plot_idx   smallint,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index if not exists notifications_user_recent
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);

-- Supabase's `alter default privileges` hands `anon` AND `authenticated` a
-- full arwdDxtm on every new table, so a fresh table ships WRITABLE by
-- anybody signed in unless this is said out loud — exactly what migration
-- 0035 had to go back and fix for `admins`. Every write here goes through an
-- RPC, so SELECT is the only grant anyone needs.
revoke all on table public.notifications from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.notifications from authenticated;
grant select on table public.notifications to authenticated;

-- -------------------------------------------------------------- guest list
-- The one place that decides whose gate is open. Everything else calls this,
-- so the picker, the boards and `enter_garden` can never disagree.
--
-- Deliberately NOT league rivals: the league is a ranking, not a social
-- container, and being ranked beside somebody is not an introduction.
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
     and exists (select 1 from gardens g where g.user_id = p_host)
     and (
       -- a neighbour, in either direction
       exists (select 1 from friendships f
                where (f.user_id = p_viewer and f.friend_id = p_host)
                   or (f.user_id = p_host   and f.friend_id = p_viewer))
       -- or a garden already shown in public: the landing page has been
       -- displaying these to logged-OUT strangers since 0011, so letting a
       -- signed-in player walk into one gives away nothing new
       or exists (select 1 from plants p
                   where p.user_id = p_host and p.active and p.died_on is null)
     )
$function$;

-- Internal: its callers are all SECURITY DEFINER and keep the owner's access.
-- Name all three roles — a `revoke ... from anon` does nothing to a PUBLIC
-- default and vice versa, and this repo has made that mistake in both
-- directions (0021 and 0030). See the grants table in CLAUDE.md.
revoke execute on function public.visitable(uuid, uuid) from public, anon, authenticated;

-- --------------------------------------------------------- the spectator doc
-- A mirror of garden_state_json (0029) with two deliberate differences:
--
--   1. It runs on the HOST's frozen timezone, never the viewer's. Thirst and
--      overdue_days are computed against local_today(host_tz), so a visitor
--      in Tokyo sees a Berlin garden's day. Get this wrong and the screen and
--      rescue_plant disagree about which plants need help.
--   2. The private half is BLANKED, not omitted — dewdrops 0, empty
--      inventory, null nextPlot, null friendCode. Keeping the document
--      GardenState-shaped is what lets the Phaser scene paint it with no
--      second renderer, and blanking rather than dropping keys means no
--      client has to null-check a field that always existed.
create or replace function public.garden_view_json(p_host uuid, p_viewer uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_profile profiles%rowtype;
  v_garden  gardens%rowtype;
  v_tz      text;
  v_today   date;
  v_hour    numeric;
  v_phase   text;
  v_plots   jsonb;
  v_decor   jsonb;
  v_zones   jsonb;
  v_score   int;
  v_level   int;
  v_lifetime int;
  v_needs   int;
  v_rescued boolean;
begin
  select * into v_profile from profiles where id = p_host;
  select * into v_garden  from gardens  where user_id = p_host;
  if v_garden.id is null then
    raise exception 'no such garden' using errcode = '22023';
  end if;

  v_tz    := safe_timezone(v_profile.timezone);
  v_today := local_today(v_tz);
  v_hour  := extract(hour from (now() at time zone v_tz))
           + extract(minute from (now() at time zone v_tz)) / 60.0;
  v_phase := year_phase(v_tz, v_today);

  select coalesce(lifetime_earned, 0) into v_lifetime from wallet where user_id = p_host;
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

  select coalesce(jsonb_object_agg(slot_idx::text, item_key), '{}'::jsonb) into v_decor
  from decor_placed where user_id = p_host;

  select coalesce(sum(
    case when p.died_on is not null then -15
    else round(s.points * greatest(0, 1 - 0.25 * overdue_days(p, s, v_today))) end
  ), 0)::int into v_score
  from plants p join species s on s.id = p.species_id
  where p.user_id = p_host and p.active;

  select coalesce(jsonb_agg(zz.z order by zz.sort_key), '[]'::jsonb) into v_zones
  from (
    select
      rz.sort as sort_key,
      jsonb_build_object(
        'key', rz.key, 'name', rz.name, 'blurb', rz.blurb,
        'minLevel', rz.min_level,
        'unlocked', v_level >= rz.min_level,
        'fixtures', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'key', rf.key, 'name', rf.name, 'blurb', rf.blurb, 'cost', rf.cost,
            'restored', exists (select 1 from restorations r
                                 where r.user_id = p_host and r.fixture_key = rf.key)
          ) order by rf.sort), '[]'::jsonb)
          from restoration_fixtures rf where rf.zone_key = rz.key
        )
      ) as z
    from restoration_zones rz
  ) zz;

  -- What a guest could actually do here. "In trouble" is overdue, not merely
  -- thirsty: a plant on schedule needs its owner, and offering to save it
  -- would be theatre. `lib/species.ts:needsRescue` mirrors this exactly.
  select count(*)::int into v_needs
  from plants p join species s on s.id = p.species_id
  where p.user_id = p_host and p.active and p.died_on is null
    and not p.is_bloomed and overdue_days(p, s, v_today) > 0;

  v_rescued := exists (
    select 1 from visits
     where visitor_id = p_viewer and host_id = p_host and visit_date = v_today
  );

  return jsonb_build_object(
    'hostUid', p_host,
    'gardenId', v_garden.id,
    'gardenName', v_garden.name,
    'plotCount', v_garden.plot_count,
    'displayName', v_profile.display_name,
    'avatar', coalesce(v_profile.avatar, '{"skin":0,"hair":0,"hat":0,"outfit":0}'::jsonb),
    'today', v_today,
    'hour', round(v_hour, 2),
    'timezone', v_tz,
    'yearPhase', v_phase,
    'plots', v_plots,
    'decor', v_decor,
    'zones', v_zones,
    'gardenScore', v_score,
    'level', v_level,
    'completedCount', (select count(*) from completed_lilies where user_id = p_host),
    -- --- blanked: shaped like the owner's document, carrying none of it ---
    'friendCode', null,
    'dewdrops', 0,
    'inventory', '{}'::jsonb,
    'unlockedSpecies', '[]'::jsonb,
    'nextPlot', null,
    'lifetimeEarned', null,
    'levelFloor', null,
    'nextLevelAt', null,
    'nameChanged', true,
    'tutorialDone', true,
    'viewer', jsonb_build_object(
      'canRescue', (not v_rescued) and v_needs > 0,
      'rescuedToday', v_rescued,
      'needsHelp', v_needs
    )
  );
end $function$;

revoke execute on function public.garden_view_json(uuid, uuid) from public, anon, authenticated;

-- ------------------------------------------------------------- enter_garden
-- Walking in. Writes the host a notification and hands back the view.
--
-- Every entry is its own notification, by design. The 10-minute re-entry
-- cooldown is what keeps that from being a weapon: without it one player
-- could bury somebody's bell by tapping Visit in a loop. Each entry still
-- notifies; there just cannot be five hundred of them.
create or replace function public.enter_garden(p_host uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_uid  uuid := auth.uid();
  v_name text;
  v_recent boolean;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if v_uid = p_host then
    raise exception 'that is your own garden' using errcode = '22023';
  end if;
  if not visitable(v_uid, p_host) then
    raise exception 'that gate is closed' using errcode = '42501';
  end if;

  select display_name into v_name from profiles where id = v_uid;

  v_recent := exists (
    select 1 from notifications
     where user_id = p_host and actor_id = v_uid and kind = 'visit'
       and created_at > now() - interval '10 minutes'
  );

  if not v_recent then
    insert into notifications (user_id, kind, title, body, actor_name, actor_id)
    values (
      p_host, 'visit',
      coalesce(v_name, 'Someone') || ' looked in on your garden',
      'They had a wander round. Nothing was touched.',
      v_name, v_uid
    );
  end if;

  return garden_view_json(p_host, v_uid);
end $function$;

revoke execute on function public.enter_garden(uuid) from public, anon;
grant  execute on function public.enter_garden(uuid) to authenticated;

-- ------------------------------------------------------------ rescue_plant
-- The rescue you choose by looking, now that looking is possible.
--
-- Same contract as visit_water and for the same reason (see the design note
-- at the top of 0011): a rescue CANCELS DECAY and never grows anything, so
-- alt accounts cannot farm progress, and `rescued_on` is separate from
-- `last_care_on` so a rescue never consumes the owner's own watering.
create or replace function public.rescue_plant(p_host uuid, p_plot_idx smallint)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_uid    uuid := auth.uid();
  v_tz     text;
  v_today  date;
  v_plant  plants%rowtype;
  v_sp     species%rowtype;
  v_name   text;
  v_over   int;
  v_dew_visitor constant int := 6;
  v_dew_host    constant int := 4;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if v_uid = p_host then
    raise exception 'you cannot rescue your own plants' using errcode = '22023';
  end if;
  if not visitable(v_uid, p_host) then
    raise exception 'that gate is closed' using errcode = '42501';
  end if;

  select safe_timezone(timezone) into v_tz from profiles where id = p_host;
  v_today := local_today(v_tz);

  if exists (select 1 from visits
              where visitor_id = v_uid and host_id = p_host and visit_date = v_today) then
    return jsonb_build_object(
      'status', 'already',
      'reason', 'You have already helped here today.',
      'state', garden_view_json(p_host, v_uid));
  end if;

  select p.* into v_plant
  from plants p
  where p.user_id = p_host and p.plot_idx = p_plot_idx and p.active
  limit 1;

  if v_plant.id is null then
    return jsonb_build_object('status', 'empty', 'reason', 'Nothing is growing there.',
                              'state', garden_view_json(p_host, v_uid));
  end if;

  select * into v_sp from species where id = v_plant.species_id;
  v_over := overdue_days(v_plant, v_sp, v_today);

  if v_plant.died_on is not null or v_plant.is_bloomed or v_over <= 0 then
    return jsonb_build_object(
      'status', 'not_needed',
      'reason', case
        when v_plant.died_on is not null then 'That one is past helping.'
        when v_plant.is_bloomed then 'That one is already finished — and lovely.'
        else 'That one is doing fine. Save your help for a plant that needs it.'
      end,
      'state', garden_view_json(p_host, v_uid));
  end if;

  update plants set rescued_on = v_today where id = v_plant.id;

  insert into visits (visitor_id, host_id, plant_id, visit_date)
  values (v_uid, p_host, v_plant.id, v_today);

  insert into care_logs (user_id, plant_id, action, care_date)
  values (v_uid, v_plant.id, 'visit_water', v_today);

  -- Both wallets lock before they move. Copy this shape for any new spend or
  -- award — it is the pattern `buy_item` and `restore_fixture` follow.
  perform 1 from wallet where user_id = v_uid for update;
  update wallet set dewdrops = dewdrops + v_dew_visitor,
                    lifetime_earned = lifetime_earned + v_dew_visitor
   where user_id = v_uid;
  perform 1 from wallet where user_id = p_host for update;
  update wallet set dewdrops = dewdrops + v_dew_host,
                    lifetime_earned = lifetime_earned + v_dew_host
   where user_id = p_host;

  select display_name into v_name from profiles where id = v_uid;

  insert into notifications (user_id, kind, title, body, actor_name, actor_id, plot_idx)
  values (
    p_host, 'rescue',
    coalesce(v_name, 'Someone') || ' rescued your ' || v_sp.name,
    'Plot ' || (p_plot_idx + 1) || ' was ' || v_over || ' day'
      || case when v_over = 1 then '' else 's' end
      || ' past its drink. It will hold now — but it still needs you to grow.',
    v_name, v_uid, p_plot_idx
  );

  return jsonb_build_object(
    'status', 'rescued',
    'dewEarned', v_dew_visitor,
    'species', v_sp.key,
    'plotIdx', p_plot_idx,
    'state', garden_view_json(p_host, v_uid));
end $function$;

revoke execute on function public.rescue_plant(uuid, smallint) from public, anon;
grant  execute on function public.rescue_plant(uuid, smallint) to authenticated;

-- ------------------------------------------------------------ get_visitable
-- Gardens to suggest. Never authorisation — `enter_garden` re-checks
-- `visitable` on every entry, and this list is only what the server is
-- willing to offer.
create or replace function public.get_visitable(p_limit int default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_daily uuid;
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  -- The daily pick, so the list has a reason to change tomorrow. Deterministic
  -- per day, which is what get_garden_of_the_day() was built for and has never
  -- once been asked.
  select p.id into v_daily
  from profiles p
  where visitable(v_uid, p.id)
  order by md5(p.id::text || current_date::text)
  limit 1;

  select coalesce(jsonb_agg(row order by row.sort_key, row.name), '[]'::jsonb) into v_out
  from (
    select
      p.id as uid,
      coalesce(p.display_name, 'A gardener') as name,
      coalesce(p.avatar, '{"skin":0,"hair":0,"hat":0,"outfit":0}'::jsonb) as avatar,
      coalesce(gardener_level((select lifetime_earned from wallet w where w.user_id = p.id)), 1) as level,
      coalesce(garden_value(p.id), 0) as "gardenValue",
      (select count(*)::int from plants pl join species s on s.id = pl.species_id
        where pl.user_id = p.id and pl.active and pl.died_on is null
          and not pl.is_bloomed
          and overdue_days(pl, s, local_today(safe_timezone(p.timezone))) > 0) as "needsHelp",
      case
        when exists (select 1 from friendships f
                      where (f.user_id = v_uid and f.friend_id = p.id)
                         or (f.user_id = p.id and f.friend_id = v_uid)) then 'friend'
        when p.id = v_daily then 'daily'
        else 'showcase'
      end as source,
      case
        when exists (select 1 from friendships f
                      where (f.user_id = v_uid and f.friend_id = p.id)
                         or (f.user_id = p.id and f.friend_id = v_uid)) then 0
        when p.id = v_daily then 1
        else 2
      end as sort_key
    from profiles p
    where visitable(v_uid, p.id)
    limit p_limit
  ) row;

  return v_out;
end $function$;

revoke execute on function public.get_visitable(int) from public, anon;
grant  execute on function public.get_visitable(int) to authenticated;

-- ---------------------------------------------------------- get_notifications
-- The bell carries two very different kinds of line, and only ONE of them is
-- this function's business:
--
--   * What OTHER PEOPLE did — stored rows, because nothing else can know it.
--     That is everything below.
--   * What YOUR OWN garden wants — derived on the client from the state
--     document it already holds, by `lib/nextstep.ts`, which is the same
--     ladder the NextStep panel reads. It is not stored and not fetched:
--     there is no cron, no backfill and nothing to keep in sync, and a
--     "your fern is dying" line simply stops existing once the fern is
--     watered. Two copies of that priority order is how the panel and the
--     bell end up naming different plants as the urgent one.
create or replace function public.get_notifications(p_limit int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_uid   uuid := auth.uid();
  v_items jsonb;
  v_unread int;
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  select count(*)::int into v_unread
  from notifications where user_id = v_uid and read_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', 'n' || n.id,
      'kind', n.kind,
      'title', n.title,
      'body', n.body,
      'actorName', n.actor_name,
      'actorAvatar', (select coalesce(pr.avatar, '{"skin":0,"hair":0,"hat":0,"outfit":0}'::jsonb)
                        from profiles pr where pr.id = n.actor_id),
      -- Only offered when their gate is currently open, so "visit back" can
      -- never present a door enter_garden is about to refuse.
      'actorUid', case when n.actor_id is not null and visitable(v_uid, n.actor_id)
                       then n.actor_id else null end,
      'plotIdx', n.plot_idx,
      'createdAt', n.created_at,
      'read', n.read_at is not null
    ) order by n.created_at desc), '[]'::jsonb) into v_items
  from (
    select * from notifications
     where user_id = v_uid
     order by created_at desc
     limit p_limit
  ) n;

  return jsonb_build_object('unread', v_unread, 'items', v_items);
end $function$;

revoke execute on function public.get_notifications(int) from public, anon;
grant  execute on function public.get_notifications(int) to authenticated;

-- ------------------------------------------------- mark_notifications_read
create or replace function public.mark_notifications_read()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  update notifications set read_at = now()
   where user_id = v_uid and read_at is null;
  return jsonb_build_object('unread', 0);
end $function$;

revoke execute on function public.mark_notifications_read() from public, anon;
grant  execute on function public.mark_notifications_read() to authenticated;

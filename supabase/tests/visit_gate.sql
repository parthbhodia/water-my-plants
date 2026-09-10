-- ============================================================
-- Visiting gate test — run after ANY change to 0036's functions or grants.
--
-- The RPC smoke test CANNOT cover this. It runs as the OWNER, who passes
-- every grant check and every RLS policy, so a `garden_view_json` left
-- callable by `anon` — handing a logged-out stranger any player's document
-- by user id — would look perfectly healthy there. Seeing what a real client
-- sees needs `set local role`, which is what this does.
--
-- Run through `apply_migration`. It ends in a deliberate exception so
-- everything rolls back — read the TESTRESULT line. Any `**FAIL` is real.
-- ============================================================

do $$
declare
  v_a uuid; v_b uuid; v_open uuid; v_closed uuid;
  v_out text := ''; v_doc jsonb; v_n int;
begin
  -- Preconditions first, and the table one BEFORE any has_table_privilege
  -- call: that function raises 42P01 on a relation that does not exist, so
  -- running this against a database without 0036 died on a raw Postgres
  -- error with no TESTRESULT line at all — which reads like the test is
  -- broken rather than like the migration is missing.
  if to_regclass('public.notifications') is null then
    raise exception 'TESTRESULT SKIPPED — migration 0036 has not been applied yet';
  end if;
  if to_regprocedure('public.enter_garden(uuid)') is null then
    raise exception 'TESTRESULT SKIPPED — 0036 table exists but enter_garden does not';
  end if;

  -- Choose the viewer DELIBERATELY.
  --
  -- This used to be `select id from profiles limit 1` with no ORDER BY, so it
  -- got whichever row the planner felt like — and on live data that landed on
  -- the ONLY player with a garden. From that seat nobody else is visitable, so
  -- the guest list came back empty and the positive path never ran, while the
  -- code was perfectly correct. An arbitrary actor makes a test that reports
  -- the actor's luck instead of the code's behaviour.
  --
  -- So: find a pair that actually exercises the feature, if one exists at all.
  select a.id, b.id into v_a, v_open
  from profiles a
  join profiles b on b.id <> a.id
  where visitable(a.id, b.id)
  order by a.id, b.id
  limit 1;

  if v_a is null then
    -- Nobody can visit anybody. The negative checks below still mean
    -- something, so run them — but say plainly that the positive half did not.
    select id into v_a from profiles order by id limit 1;
    v_out := v_out || ' positive-path=SKIPPED(no visitable pair exists)';
  end if;

  -- A host the viewer may NOT visit, for the closed-gate check. Deliberately
  -- separate from v_open: one variable serving both roles is how that check
  -- quietly turned into "skipped" whenever the pair happened to be open.
  select id into v_closed from profiles
   where id <> v_a and not visitable(v_a, id)
   order by id limit 1;

  if v_a is null then
    raise exception 'TESTRESULT SKIPPED — need at least one profile to test with';
  end if;

  -- 0. The table surface. Supabase's `alter default privileges` hands anon
  --    AND authenticated a full arwdDxtm on every new public table, so
  --    `notifications` would ship WRITABLE by anybody signed in unless 0036
  --    said otherwise — which is exactly what 0035 had to go back and fix
  --    for `admins`. A player who can insert here can forge "somebody
  --    rescued your plant" for anyone.
  if has_table_privilege('anon', 'public.notifications', 'select')
     or has_table_privilege('authenticated', 'public.notifications', 'insert')
     or has_table_privilege('authenticated', 'public.notifications', 'update')
     or has_table_privilege('authenticated', 'public.notifications', 'delete') then
    v_out := v_out || ' **FAIL:notifications is writable or anon-readable**';
  else
    v_out := v_out || ' table-surface=ok';
  end if;
  if not has_table_privilege('authenticated', 'public.notifications', 'select') then
    v_out := v_out || ' **FAIL:authenticated lost SELECT on notifications**';
  else
    v_out := v_out || ' auth-select-kept=ok';
  end if;

  -- 1. anon reaches none of it. get_showcase is still meant to be the ONLY
  --    function anon may call (see the grants section of CLAUDE.md).
  if has_function_privilege('anon', 'enter_garden(uuid)', 'execute')
     or has_function_privilege('anon', 'rescue_plant(uuid,smallint)', 'execute')
     or has_function_privilege('anon', 'get_notifications(integer)', 'execute')
     or has_function_privilege('anon', 'mark_notifications_read()', 'execute')
     or has_function_privilege('anon', 'get_visitable(integer)', 'execute') then
    v_out := v_out || ' **FAIL:anon can execute a visiting RPC**';
  else
    v_out := v_out || ' anon-blocked=ok';
  end if;

  -- 2. the internals reach NOBODY. Both are SECURITY DEFINER callees and
  --    keep the owner's access; a client that could call garden_view_json
  --    directly would skip the `visitable` check entirely and read any
  --    garden by id.
  if has_function_privilege('anon', 'garden_view_json(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'garden_view_json(uuid,uuid)', 'execute')
     or has_function_privilege('anon', 'visitable(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'visitable(uuid,uuid)', 'execute') then
    v_out := v_out || ' **FAIL:an internal helper is reachable by a client**';
  else
    v_out := v_out || ' internals-sealed=ok';
  end if;

  -- 3. As a REAL authenticated user, not the owner.
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);

  -- 3a. your own gate is shut to you
  begin
    perform public.enter_garden(v_a);
    v_out := v_out || ' **FAIL:entered own garden**';
  exception when others then v_out := v_out || ' self-visit-refused=ok';
  end;

  -- 3b. the bell answers, and answers with a shape
  begin
    v_doc := public.get_notifications();
    if v_doc ? 'unread' and jsonb_typeof(v_doc->'items') = 'array' then
      v_out := v_out || ' notifications=ok';
    else
      v_out := v_out || ' **FAIL:get_notifications returned the wrong shape**';
    end if;
  exception when others then
    v_out := v_out || ' **FAIL:get_notifications ' || SQLERRM || '**';
  end;

  -- 3c. the guest list runs and is an array. `create or replace function`
  --     proves nothing — plpgsql does not parse a body until it runs, which
  --     is how a shipped admin_funnel() with an ambiguous column reported
  --     success and then raised 42702 for every caller.
  begin
    v_doc := public.get_visitable();
    if jsonb_typeof(v_doc) <> 'array' then
      v_out := v_out || ' **FAIL:get_visitable is not an array**';
    elsif v_open is not null and jsonb_array_length(v_doc) = 0 then
      -- We PROVED a visitable pair exists before impersonating, so an empty
      -- list here is get_visitable disagreeing with visitable() — exactly the
      -- drift the single-guest-list rule exists to prevent.
      v_out := v_out || ' **FAIL:get_visitable is empty but a visitable host exists**';
    else
      v_out := v_out || ' visitable-list=ok(' || jsonb_array_length(v_doc) || ')';
    end if;
  exception when others then
    v_out := v_out || ' **FAIL:get_visitable ' || SQLERRM || '**';
  end;

  -- 3c2. THE POSITIVE PATH. Every other check here is a refusal, and a gate
  --      that refuses everybody passes all of them while being broken. This is
  --      the only one that proves the document comes back whole AND blanked.
  if v_open is not null then
    begin
      v_doc := public.enter_garden(v_open);
      if jsonb_array_length(v_doc->'plots') <> 12 then
        v_out := v_out || ' **FAIL:enter_garden returned '
              || jsonb_array_length(v_doc->'plots') || ' plots, not 12**';
      elsif (v_doc->>'dewdrops')::int <> 0
         or (v_doc->>'friendCode') is not null
         or jsonb_array_length(v_doc->'unlockedSpecies') <> 0 then
        v_out := v_out || ' **FAIL:enter_garden leaked the host private half**';
      elsif (v_doc->>'hostUid') <> v_open::text then
        v_out := v_out || ' **FAIL:enter_garden hostUid is not the host**';
      elsif (v_doc->'viewer') is null then
        v_out := v_out || ' **FAIL:enter_garden has no viewer block**';
      else
        v_out := v_out || ' enter-garden-real=ok';
      end if;
    exception when others then
      v_out := v_out || ' **FAIL:enter_garden ' || SQLERRM || '**';
    end;
  end if;

  -- 3d. a garden that is NOT on the guest list must be refused. Proven by
  --     asking the predicate first, so this cannot pass by accident on a
  --     host who happens to be visitable.
  reset role;
  if v_closed is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      perform public.enter_garden(v_closed);
      v_out := v_out || ' **FAIL:entered a garden that is not visitable**';
    exception when others then v_out := v_out || ' closed-gate-refused=ok';
    end;
    reset role;
  else
    v_out := v_out || ' closed-gate=SKIPPED(every garden is open to this viewer)';
  end if;

  -- 3e. RLS: one player must never read another's notifications.
  reset role;
  select id into v_b from profiles where id <> v_a order by id limit 1;
  if v_b is null then
    raise exception 'TESTRESULT SKIPPED — need a second profile for the RLS check';
  end if;
  insert into notifications (user_id, kind, title, actor_name)
  values (v_b, 'visit', 'a private line for B', 'nobody');
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from notifications where user_id = v_b;
  reset role;
  if v_n > 0 then
    v_out := v_out || ' **FAIL:read another player''s notifications**';
  else
    v_out := v_out || ' rls-select-own=ok';
  end if;

  raise exception 'TESTRESULT %', case when v_out like '%**FAIL%'
    then 'FAILURES —' || v_out else 'ALL PASS —' || v_out end;
end $$;

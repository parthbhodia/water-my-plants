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
  v_a uuid; v_b uuid; v_out text := ''; v_doc jsonb; v_n int;
begin
  select id into v_a from profiles limit 1;
  select id into v_b from profiles where id <> v_a limit 1;
  if v_a is null or v_b is null then
    raise exception 'TESTRESULT SKIPPED — need two profiles to test with';
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
    if jsonb_typeof(v_doc) = 'array' then
      v_out := v_out || ' visitable-list=ok(' || jsonb_array_length(v_doc) || ')';
    else
      v_out := v_out || ' **FAIL:get_visitable is not an array**';
    end if;
  exception when others then
    v_out := v_out || ' **FAIL:get_visitable ' || SQLERRM || '**';
  end;

  -- 3d. a garden that is NOT on the guest list must be refused. Proven by
  --     asking the predicate first, so this cannot pass by accident on a
  --     host who happens to be visitable.
  reset role;
  if not public.visitable(v_a, v_b) then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      perform public.enter_garden(v_b);
      v_out := v_out || ' **FAIL:entered a garden that is not visitable**';
    exception when others then v_out := v_out || ' closed-gate-refused=ok';
    end;
    reset role;
  else
    v_out := v_out || ' closed-gate=SKIPPED(second garden is open)';
  end if;

  -- 3e. RLS: one player must never read another's notifications.
  reset role;
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

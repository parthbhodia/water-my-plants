-- ============================================================
-- Admin gate test — run after ANY change to admins / is_admin / admin_funnel.
--
-- The RPC smoke test CANNOT cover this. It runs as the OWNER, and an owner
-- passes every grant check and every RLS policy, so a wide-open admin
-- function would look perfectly healthy there. Seeing what a real client sees
-- needs `set local role authenticated` (or anon) inside a rolled-back block,
-- which is what this does.
--
-- Run through `apply_migration`. It ends in a deliberate exception so
-- everything rolls back — read the TESTRESULT line. Any `**FAIL` is real.
-- ============================================================

do $$
declare
  v_admin uuid; v_other uuid; v_out text := ''; v_r jsonb;
begin
  select user_id into v_admin from admins limit 1;
  select id into v_other from auth.users where id <> v_admin limit 1;
  if v_admin is null then raise exception 'TESTRESULT SKIPPED — no admin seeded'; end if;
  if v_other is null then raise exception 'TESTRESULT SKIPPED — need a second user'; end if;

  -- 0. the table surface. Supabase's default privileges hand anon AND
  --    authenticated full arwdDxtm on every new public table, so `admins`
  --    shipped writable by anybody signed in; RLS refused it, but that is one
  --    policy standing between a player and self-granted admin.
  if has_table_privilege('anon', 'public.admins', 'select')
     or has_table_privilege('authenticated', 'public.admins', 'insert')
     or has_table_privilege('authenticated', 'public.admins', 'delete') then
    v_out := v_out || ' **FAIL:admins table is writable or anon-readable**';
  else
    v_out := v_out || ' table-surface=ok';
  end if;
  -- ...but SELECT has to stay, or the client cannot ask "am I an admin?" and
  -- the nav item silently disappears for the person it exists for.
  if not has_table_privilege('authenticated', 'public.admins', 'select') then
    v_out := v_out || ' **FAIL:authenticated lost SELECT on admins**';
  else
    v_out := v_out || ' auth-select-kept=ok';
  end if;

  -- 1. anon must not reach it at all, and the helper must reach nobody
  if has_function_privilege('anon', 'admin_funnel()', 'execute') then
    v_out := v_out || ' **FAIL:anon can execute admin_funnel**';
  else
    v_out := v_out || ' anon-blocked=ok';
  end if;
  if has_function_privilege('anon', 'is_admin()', 'execute')
     or has_function_privilege('authenticated', 'is_admin()', 'execute') then
    v_out := v_out || ' **FAIL:is_admin is reachable from the API**';
  else
    v_out := v_out || ' is_admin-internal=ok';
  end if;

  -- 2. a signed-in NON-admin must be refused
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
    set local role authenticated;
    perform admin_funnel();
    reset role;
    v_out := v_out || ' **FAIL:non-admin got the funnel**';
  exception when insufficient_privilege then
    reset role; v_out := v_out || ' non-admin-refused=ok';
  when others then
    reset role; v_out := v_out || ' **FAIL:non-admin got ' || sqlstate || '**';
  end;

  -- 3. the admin must get real numbers — a gate that refuses everybody passes
  --    every check above and is still broken
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_r := admin_funnel();
    reset role;
    -- Assert the SHAPE, not just that it answered. plpgsql does not parse a
    -- function body until it runs, so a `create or replace` that "succeeded"
    -- proves nothing — a broken series silently returns null and the chart
    -- renders an empty state that looks like "no data yet".
    if v_r->'totals'->>'players' is null
       or jsonb_array_length(v_r->'daily') <> 30
       or jsonb_array_length(v_r->'retention') <> 14
       or jsonb_array_length(v_r->'hours') <> 24 then
      v_out := v_out || ' **FAIL:admin got a short document**';
    else
      v_out := v_out || ' admin-reads=ok(players='
             || (v_r->'totals'->>'players')
             || ',cohorts=' || jsonb_array_length(v_r->'cohorts')
             || ',species=' || jsonb_array_length(v_r->'species')
             || ',daily=' || jsonb_array_length(v_r->'daily')
             || ',retention=' || jsonb_array_length(v_r->'retention')
             || ',hours=' || jsonb_array_length(v_r->'hours') || ')';
    end if;
  exception when others then
    reset role; v_out := v_out || ' **FAIL:admin errored ' || sqlstate || ' ' || sqlerrm || '**';
  end;

  -- 4. and the allow-list itself must not be readable by a non-admin
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
    set local role authenticated;
    if (select count(*) from admins) > 0 then
      reset role; v_out := v_out || ' **FAIL:non-admin can read the admins table**';
    else
      reset role; v_out := v_out || ' admins-hidden=ok';
    end if;
  exception when others then
    reset role; v_out := v_out || ' admins-denied=ok';
  end;

  raise exception 'TESTRESULT %: %',
    case when v_out like '%**FAIL%' then '*** FAILURES ***' else 'ALL PASS' end, v_out;
end $$;

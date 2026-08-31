-- ============================================================
-- RPC smoke test — run this after ANY database change.
--
-- Why this exists: the league tab went down in production for every player
-- because close_season() passed a bigint to league_promote_n(integer).
-- `npm run build`, `tsc --noEmit` and the mobile audit all passed, because
-- not one of them ever executes an RPC. A function can be missing, mistyped
-- or ungranted and every gate we had would still say clean.
--
-- Run it through `apply_migration` (or the SQL editor wrapped in a
-- transaction). It ends in a deliberate exception so EVERYTHING rolls back —
-- the TESTRESULT line is the output you read. Any `**FAIL` is a real bug.
--
-- Validation errors are expected and are NOT failures: the point is to prove
-- each function *runs*, so inputs are chosen to be valid where possible and
-- guard messages are reported as `guard(...)` rather than as breakage.
-- ============================================================

do $$
declare
  v_uid uuid; v_tz text; v_out text := ''; v_name text; v_plot smallint;
  v_kind text; v_sp text; v_item text; v_gift text; v_r jsonb; v_fx text;
  v_reads text[] := array[
    'get_care_week','get_friends','get_hall_of_fame','get_league','get_shop',
    'get_today_brief','get_variant_collection','get_weekly_gift'];

  procedure_failed boolean := false;
begin
  select id, timezone into v_uid, v_tz from profiles limit 1;
  if v_uid is null then raise exception 'TESTRESULT SKIPPED — no profiles to test with'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role','authenticated')::text, true);

  -- ---------- reads: every one must simply run ----------
  foreach v_name in array v_reads loop
    begin
      execute format('select public.%I()', v_name);
      v_out := v_out || v_name || '=ok ';
    exception when others then
      v_out := v_out || v_name || '=**FAIL:' || SQLERRM || '** ';
      procedure_failed := true;
    end;
  end loop;

  begin perform public.get_garden_state(v_tz); v_out := v_out || 'get_garden_state=ok ';
  exception when others then
    v_out := v_out || 'get_garden_state=**FAIL:'||SQLERRM||'** '; procedure_failed := true; end;

  begin perform public.get_showcase(6); v_out := v_out || 'get_showcase=ok ';
  exception when others then
    v_out := v_out || 'get_showcase=**FAIL:'||SQLERRM||'** '; procedure_failed := true; end;

  -- ---------- season rollover: the path that actually broke ----------
  begin
    perform public.close_season(s.id) from seasons s where s.closed_at is null;
    v_out := v_out || 'close_season=ok ';
  exception when others then
    v_out := v_out || 'close_season=**FAIL:'||SQLERRM||'** '; procedure_failed := true; end;

  -- ---------- writes, with inputs valid enough to reach the real body ----------
  update wallet set dewdrops = 99999 where user_id = v_uid;

  select i, plot_kind(i::smallint) into v_plot, v_kind
    from generate_series(0,11) i
   where i < (select plot_count from gardens where user_id = v_uid)
     and not exists (select 1 from plants p join gardens g on g.id = p.garden_id
                      where g.user_id = v_uid and p.plot_idx = i and p.active)
   limit 1;
  select key into v_sp from species
   where (needs_plot = v_kind or needs_plot = 'any') and unlock_cost = 0 limit 1;

  if v_plot is not null and v_sp is not null then
    begin perform public.plant_seed(v_plot, v_sp); v_out := v_out || 'plant_seed=ok ';
    exception when others then
      v_out := v_out || 'plant_seed=**FAIL:'||SQLERRM||'** '; procedure_failed := true; end;

    begin v_r := public.tend_plant(v_plot, 'water');
      v_out := v_out || 'tend_plant=ok(' || coalesce(v_r->>'status','?') || ') ';
    exception when others then
      v_out := v_out || 'tend_plant=**FAIL:'||SQLERRM||'** '; procedure_failed := true; end;

    -- revival needs a tonic in hand, so buy one first
    begin
      perform public.buy_item('tonic', 1);
      update plants set died_on = current_date
       where user_id = v_uid and plot_idx = v_plot and active;
      perform public.revive_plant(v_plot);
      v_out := v_out || 'buy_item+revive_plant=ok ';
    exception when others then
      v_out := v_out || 'buy/revive=**FAIL:'||SQLERRM||'** '; procedure_failed := true; end;

    -- clear_plot only accepts a finished plant, so bloom it first; clearing a
    -- plant that is still growing is meant to be refused
    begin
      -- NB: clear_plot gates on the is_bloomed *flag*, not bloomed_at; the
      -- two are separate columns that tend_plant keeps in step
      update plants set is_bloomed = true, bloomed_at = now(), died_on = null
       where user_id = v_uid and plot_idx = v_plot and active;
      perform public.clear_plot(v_plot);
      v_out := v_out || 'clear_plot=ok ';
    exception when others then
      v_out := v_out || 'clear_plot=**FAIL:'||SQLERRM||'** '; procedure_failed := true; end;
  else
    v_out := v_out || 'plant/tend/clear=SKIPPED(no free plot) ';
  end if;

  select key into v_item from shop_items where kind = 'decor' limit 1;
  begin
    perform public.buy_item(v_item, 1);
    perform public.place_decor(0::smallint, v_item);
    v_out := v_out || 'place_decor=ok ';
  exception when others then
    v_out := v_out || 'place_decor=**FAIL:'||SQLERRM||'** '; procedure_failed := true; end;

  select rf.key into v_fx from restoration_fixtures rf
    join restoration_zones rz on rz.key = rf.zone_key
   where not exists (select 1 from restorations r
                      where r.user_id = v_uid and r.fixture_key = rf.key)
   order by rz.min_level limit 1;
  if v_fx is not null then
    begin
      update wallet set lifetime_earned = 999999 where user_id = v_uid;
      perform public.restore_fixture(v_fx);
      v_out := v_out || 'restore_fixture=ok ';
    exception when others then
      v_out := v_out || 'restore_fixture=**FAIL:'||SQLERRM||'** '; procedure_failed := true; end;
  end if;

  begin
    v_gift := (public.get_weekly_gift())->'options'->0->>'key';
    perform public.claim_weekly_gift(v_gift);
    v_out := v_out || 'claim_weekly_gift=ok ';
  exception when others then
    v_out := v_out || 'claim_weekly_gift=**FAIL:'||SQLERRM||'** '; procedure_failed := true; end;

  begin perform public.set_avatar('{"skin":1,"hair":2,"hat":0,"outfit":1}'::jsonb);
    v_out := v_out || 'set_avatar=ok ';
  exception when others then
    v_out := v_out || 'set_avatar=**FAIL:'||SQLERRM||'** '; procedure_failed := true; end;

  begin perform public.set_notification_prefs(true, 8::smallint);
    v_out := v_out || 'set_notification_prefs=ok ';
  exception when others then
    v_out := v_out || 'set_notification_prefs=**FAIL:'||SQLERRM||'** '; procedure_failed := true; end;

  begin perform public.set_display_name('Smoke Test'); v_out := v_out || 'set_display_name=ok ';
  exception when others then
    v_out := v_out || 'set_display_name=**FAIL:'||SQLERRM||'** '; procedure_failed := true; end;

  begin perform public.finish_tutorial(); v_out := v_out || 'finish_tutorial=ok ';
  exception when others then
    v_out := v_out || 'finish_tutorial=**FAIL:'||SQLERRM||'** '; procedure_failed := true; end;

  -- guarded-by-design: these SHOULD refuse, and refusing is a pass
  begin perform public.add_friend('LILY-0000');
    v_out := v_out || 'add_friend=**FAIL:accepted a bogus code** '; procedure_failed := true;
  exception when others then v_out := v_out || 'add_friend=guard(ok) '; end;

  begin perform public.visit_water(v_uid);
    v_out := v_out || 'visit_water=**FAIL:let a player visit themselves** '; procedure_failed := true;
  exception when others then v_out := v_out || 'visit_water=guard(ok) '; end;

  raise exception 'TESTRESULT %: %',
    case when procedure_failed then '*** FAILURES ***' else 'ALL PASS' end, v_out;
end $$;

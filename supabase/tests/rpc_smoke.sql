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
    'get_today_brief','get_variant_collection','get_weekly_gift',
    'get_notifications','get_visitable','mark_notifications_read'];

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
  -- `phase is null` matters: a seasonal species is only plantable in its own
  -- quarter of the year, so picking one here would make this test fail for
  -- nine months out of twelve and say nothing true about the RPC.
  select key into v_sp from species
   where (needs_plot = v_kind or needs_plot = 'any')
     and unlock_cost = 0 and phase is null limit 1;

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

  -- The basket is once a WEEK, so "already had this week's" is the guard doing
  -- its job, not breakage — and it is unavoidable for any test user who claimed
  -- their gift in the game that week, which made ALL PASS impossible to reach
  -- through no fault of the code. Same treatment as add_friend and visit_water
  -- below: the body ran, and refusing is the correct answer.
  --
  -- Only that ONE refusal is forgiven. Anything else still fails, or this stops
  -- being a test of claim_weekly_gift at all.
  begin
    v_gift := (public.get_weekly_gift())->'options'->0->>'key';
    perform public.claim_weekly_gift(v_gift);
    v_out := v_out || 'claim_weekly_gift=ok ';
  exception when others then
    if SQLERRM ilike '%already%' then
      v_out := v_out || 'claim_weekly_gift=guard(ok:claimed already) ';
    else
      v_out := v_out || 'claim_weekly_gift=**FAIL:'||SQLERRM||'** '; procedure_failed := true;
    end if;
  end;

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

  -- A garden of dead plants must never report "nothing to do". Every branch
  -- of pending_care once filtered `died_on is null`, so a wiped-out garden
  -- fell through to null and the app said "Everything is tended."
  begin
    update plants set died_on = current_date
     where user_id = v_uid and active and died_on is null and not is_bloomed;
    if (public.pending_care(v_uid))->>'kind' is distinct from 'dead' then
      v_out := v_out || 'dead_is_reported=**FAIL:dead garden reports '
            || coalesce((public.pending_care(v_uid))->>'kind','nothing') || '** ';
      procedure_failed := true;
    else
      v_out := v_out || 'dead_is_reported=ok ';
    end if;
  exception when others then
    v_out := v_out || 'dead_is_reported=**FAIL:'||SQLERRM||'** '; procedure_failed := true; end;

  -- guarded-by-design: these SHOULD refuse, and refusing is a pass
  begin perform public.add_friend('LILY-0000');
    v_out := v_out || 'add_friend=**FAIL:accepted a bogus code** '; procedure_failed := true;
  exception when others then v_out := v_out || 'add_friend=guard(ok) '; end;

  begin perform public.visit_water(v_uid);
    v_out := v_out || 'visit_water=**FAIL:let a player visit themselves** '; procedure_failed := true;
  exception when others then v_out := v_out || 'visit_water=guard(ok) '; end;

  begin perform public.enter_garden(v_uid);
    v_out := v_out || 'enter_garden=**FAIL:let a player visit their own garden** ';
    procedure_failed := true;
  exception when others then v_out := v_out || 'enter_garden=guard(ok) '; end;

  begin perform public.rescue_plant(v_uid, 0::smallint);
    v_out := v_out || 'rescue_plant=**FAIL:let a player rescue their own plant** ';
    procedure_failed := true;
  exception when others then v_out := v_out || 'rescue_plant=guard(ok) '; end;

  -- The positive case, and the one that actually matters. A guard that
  -- refuses everybody passes every negative check above and is still broken,
  -- so this walks into a REAL second garden and asserts the document came
  -- back whole AND blanked. `dewdrops` is the tell: if garden_view_json ever
  -- drifts back towards garden_state_json, the host's wallet shows up here.
  declare v_other uuid; v_viewer uuid := v_uid; v_doc jsonb;
  begin
    select id into v_other from profiles
     where id <> v_uid and public.visitable(v_uid, id) limit 1;

    -- This test picks its user with an arbitrary `limit 1`, and on live data
    -- that landed on the ONLY player with a garden — from whose seat nobody
    -- else is visitable. Rather than skip the one check that exercises the
    -- POSITIVE path, borrow a viewer for whom a host actually exists. An
    -- arbitrary actor makes a test that reports the actor's luck instead of
    -- the code's behaviour.
    if v_other is null then
      select a.id, b.id into v_viewer, v_other
      from profiles a join profiles b on b.id <> a.id
      where public.visitable(a.id, b.id)
      order by a.id, b.id limit 1;
      if v_viewer is not null and v_viewer <> v_uid then
        perform set_config('request.jwt.claims',
          json_build_object('sub', v_viewer, 'role','authenticated')::text, true);
      end if;
    end if;

    if v_other is null then
      v_out := v_out || 'enter_garden_real=SKIPPED(nobody can visit anybody) ';
    else
      v_doc := public.enter_garden(v_other);
      if jsonb_array_length(v_doc->'plots') <> 12 then
        v_out := v_out || '**FAIL:enter_garden returned '
              || jsonb_array_length(v_doc->'plots') || ' plots, not 12** ';
        procedure_failed := true;
      elsif (v_doc->>'dewdrops')::int <> 0
         or (v_doc->>'friendCode') is not null
         or jsonb_array_length(v_doc->'unlockedSpecies') <> 0 then
        v_out := v_out || '**FAIL:enter_garden leaked the host private half** ';
        procedure_failed := true;
      elsif (v_doc->>'hostUid') <> v_other::text then
        v_out := v_out || '**FAIL:enter_garden hostUid is not the host** ';
        procedure_failed := true;
      elsif (v_doc->'viewer') is null then
        v_out := v_out || '**FAIL:enter_garden has no viewer block** ';
        procedure_failed := true;
      else
        v_out := v_out || 'enter_garden_real=ok ';
      end if;
    end if;
    -- Put the impersonation back, or every check after this one silently runs
    -- as the borrowed user.
    if v_viewer is distinct from v_uid then
      perform set_config('request.jwt.claims',
        json_build_object('sub', v_uid, 'role','authenticated')::text, true);
    end if;
  exception when others then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_uid, 'role','authenticated')::text, true);
    v_out := v_out || 'enter_garden_real=**FAIL:'||SQLERRM||'** '; procedure_failed := true; end;

  -- Breaking new ground. Funded first, because the interesting failure is
  -- the one where it runs and silently does nothing, not the one where a
  -- broke player is refused.
  begin
    update wallet set dewdrops = 99999, lifetime_earned = 99999 where user_id = v_uid;
    declare v_pc_before int; v_pc_after int;
    begin
      select plot_count into v_pc_before from gardens where user_id = v_uid;
      if v_pc_before >= 12 then
        v_out := v_out || 'break_ground=SKIPPED(garden already full) ';
      else
        perform public.break_ground();
        select plot_count into v_pc_after from gardens where user_id = v_uid;
        if v_pc_after = v_pc_before + 1 then
          v_out := v_out || 'break_ground=ok ';
        else
          v_out := v_out || '**FAIL:break_ground left plot_count at ' || v_pc_after || '** ';
          procedure_failed := true;
        end if;
      end if;
    end;
  exception when others then
    v_out := v_out || 'break_ground=**FAIL:' || SQLERRM || '** '; procedure_failed := true; end;

  -- The seasonal gate, checked against a species that is DEFINITELY out of
  -- phase today whatever the date is: three of the four always are. The gate
  -- sits BEFORE the plot-kind and occupancy checks in plant_seed, so plot 0
  -- always reaches it — and the message is asserted, because "it threw" would
  -- pass just as happily on "that plot is occupied" with the gate ripped out.
  declare v_off text;
  begin
    select key into v_off from species
     where phase is not null
       and phase <> year_phase((select timezone from profiles where id = v_uid), current_date)
     limit 1;
    if v_off is null then
      v_out := v_out || 'phase_gate=**FAIL:no out-of-phase species to test with** ';
      procedure_failed := true;
    else
      begin
        perform public.plant_seed(0::smallint, v_off);
        v_out := v_out || 'phase_gate=**FAIL:planted ' || v_off || ' out of season** ';
        procedure_failed := true;
      exception when others then
        if SQLERRM like '%goes in the ground in%' then
          v_out := v_out || 'phase_gate=guard(ok) ';
        else
          v_out := v_out || 'phase_gate=**FAIL:refused for the wrong reason: ' || SQLERRM || '** ';
          procedure_failed := true;
        end if;
      end;
    end if;
  end;

  raise exception 'TESTRESULT %: %',
    case when procedure_failed then '*** FAILURES ***' else 'ALL PASS' end, v_out;
end $$;

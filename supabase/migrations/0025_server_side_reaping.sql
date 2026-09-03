-- ============================================================
-- Death was browser-authoritative, not server-authoritative.
--
-- reap_dead(uid, today) is the only thing that sets died_on, and it ran in
-- exactly one place: get_garden_state, i.e. when the player loaded their own
-- garden. Correct for whoever is looking — and useless for everyone else.
-- One player opened the app and found four dead plants; three players who
-- did not open it kept gardens 9-11 days dry that the database still called
-- alive, and pending_care described as mildly "thirsty".
--
-- That is a loop that cannot close: the system could only learn a plant had
-- died if the player came to look, and the whole purpose of the nudge email
-- is to reach someone who has not come to look.
--
-- Note this is NOT a trigger, and cannot be. A trigger fires on a write, and
-- nothing writes to `plants` when a plant crosses from three days overdue to
-- four. Time passes; no row is touched. Time events belong to cron. Triggers
-- stay for real data changes — refresh_league_score on plants /
-- completed_lilies is the correct use of one.
--
-- Two layers, both needed:
--   on read     get_garden_state -> reap_dead   (unchanged, still right)
--   on schedule reap_all_players()              (hourly, added here)
--
-- Grace first, so fixing the bug did not retroactively kill three gardens
-- that only the bug had spared: every plant then in danger got
-- rescued_on = today, the existing "fresh clock" column overdue_days already
-- respects. No watering history was falsified — those plants stayed thirsty
-- and waiting, they just stopped being four days from gone. Plants already
-- dead were untouched; that death was real and had been seen.
--
-- Applied remotely as `server_side_reaping_with_grace`.
-- ============================================================

create or replace function public.reap_all_players()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare r record; v_n int := 0;
begin
  for r in select id, timezone from profiles where timezone is not null loop
    begin
      -- each player's own local day, never the server's
      perform reap_dead(r.id, local_today(r.timezone));
      v_n := v_n + 1;
    exception when others then
      -- one broken profile must never stop the sweep
      null;
    end;
  end loop;
  return v_n;
end $$;

revoke all on function public.reap_all_players() from public, anon, authenticated;

-- Ordering matters: reap decides who died BEFORE build_nudges decides what
-- to say about them.
--   select cron.schedule('lily-build-nudges', '0 * * * *',
--     'select public.reap_all_players(); select public.expire_stale_nudges(2);
--      select public.enroll_all_players(); select public.build_nudges();
--      select public.build_rescues();');

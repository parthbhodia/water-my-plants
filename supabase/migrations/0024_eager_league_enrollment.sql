-- ============================================================
-- Four players, and a league with one person in it.
--
-- 1. Enrollment was lazy. ensure_league() only ran inside get_league(), so
--    a player joined the season's board the moment they opened the League
--    tab and never before. Three of the four last signed in in August, so
--    the current season had exactly one member: whoever last looked. A
--    leaderboard you are alone on is the most demotivating screen in the
--    game, and it was the default state for everyone.
--
-- 2. ensure_league seeded the row with compute_garden_score — the OLD
--    accumulation metric that 0017 replaced. A newly enrolled player
--    entered carrying a score computed a different way from everyone
--    refreshed since, until their next refresh corrected it.
--
-- enroll_all_players() now runs hourly alongside the nudge build, and is
-- safe to repeat: ensure_league returns the existing row when there is one.
-- Applied remotely as `eager_league_enrollment`.
-- ============================================================

create or replace function public.enroll_all_players()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid; v_n int := 0;
begin
  for v_uid in select id from profiles where timezone is not null loop
    begin
      perform ensure_league(v_uid);
      v_n := v_n + 1;
    exception when others then
      -- one broken profile must never stop the rest of the field enrolling
      null;
    end;
  end loop;
  return v_n;
end $$;

revoke all on function public.enroll_all_players() from public, anon, authenticated;

-- ensure_league is re-created in the remote migration with the only change
-- being its seed score: compute_consistency_score, not compute_garden_score.

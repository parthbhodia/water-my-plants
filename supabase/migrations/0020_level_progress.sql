-- ============================================================
-- Gardener level had no visible progress anywhere in the app.
--
-- The state document carried `level` and nothing else, so a player could
-- see a number go up but never how close the next one was, or what it
-- would open. The restoration zones gate on exactly this number
-- ("Opens at gardener level 3") with no way to tell how far off that is.
--
-- gardener_level(le) = floor(sqrt(le / 40)) + 1, so reaching level L needs
-- lifetime_earned >= 40 * (L-1)^2 and the next rung sits at 40 * L^2.
-- Both bounds now ship with the state so the UI can draw a real bar.
-- Ladder: L2=40, L3=160, L4=360, L5=640, L6=1000, L7=1440.
--
-- garden_state_json is re-created whole with 'lifetimeEarned', 'levelFloor'
-- and 'nextLevelAt' added to the returned object; everything else in it is
-- unchanged from 0013.
-- ============================================================

create or replace function public.level_floor(p_level int)
returns int language sql immutable as $$
  select (40 * power(greatest(1, p_level) - 1, 2))::int
$$;

grant execute on function public.level_floor(int) to authenticated;

-- garden_state_json: as 0013, plus the three level-progress keys.
-- (Applied remotely via the `level_progress_in_state` migration.)

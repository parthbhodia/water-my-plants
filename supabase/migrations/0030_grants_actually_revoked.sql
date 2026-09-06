-- The grants sweep: make migration 0021 true.
--
-- 0021 wrote `revoke execute on function ... from anon` for six functions.
-- Every one of those lines was a no-op, and all six are still callable by
-- `anon` today. Postgres grants EXECUTE on a new function to **PUBLIC**, and
-- `anon` inherits from there — it never held a direct grant, so revoking one
-- removed a privilege that did not exist. The revoke has to name PUBLIC.
--
-- The proof this is the whole story: the six functions still open to anon are
-- exactly the six 0021 named. Nothing else leaked, because every other RPC
-- was written with `revoke ... from public` from the start.
--
-- Seven plain helpers were never addressed at all and are also reachable over
-- PostgREST as `/rest/v1/rpc/<name>`. They leak nothing interesting on their
-- own — `tier_name(2)` returns a word — but they are not part of the API and
-- should not answer.
--
-- Checked before writing this: no RLS policy, column default, check
-- constraint or view references any of these, so revoking cannot break an
-- ordinary table read. (Policies and defaults are evaluated as the CALLING
-- user, which is the trap that would make this dangerous.)

-- ---- the six 0021 meant to close ------------------------------------------
-- Writes first: these two spend a player's dewdrops.
revoke execute on function public.claim_weekly_gift(text) from public;
revoke execute on function public.restore_fixture(text)   from public;
grant  execute on function public.claim_weekly_gift(text) to authenticated;
grant  execute on function public.restore_fixture(text)   to authenticated;

-- Reads that describe one signed-in player.
revoke execute on function public.get_care_week()          from public;
revoke execute on function public.get_variant_collection() from public;
revoke execute on function public.get_weekly_gift()        from public;
grant  execute on function public.get_care_week()          to authenticated;
grant  execute on function public.get_variant_collection() to authenticated;
grant  execute on function public.get_weekly_gift()        to authenticated;

-- Called by nothing at all today. Locked to signed-in users rather than left
-- open; if it is ever wired to the landing page the grant is one line.
revoke execute on function public.get_garden_of_the_day() from public;
grant  execute on function public.get_garden_of_the_day() to authenticated;

-- ---- internal helpers: nobody calls these over HTTP ------------------------
-- Every remaining caller is a SECURITY DEFINER function, which runs as the
-- owner and keeps its access. Verified: get_garden_state still returns a full
-- document after this, and it reaches local_today, safe_timezone, level_floor,
-- year_phase and next_plot_json on the way.
--
-- NOTE THE DIFFERENT VERB. These seven hold **explicit** `anon=X` grants,
-- from Supabase's `alter default privileges` on the public schema — so
-- `revoke ... from public` does nothing to them, the mirror image of the
-- 0021 mistake. There are two ways a function ends up reachable and the ACL
-- is the only thing that says which you are looking at:
--
--   proacl null or `=X/postgres`  -> PUBLIC default   -> revoke from public
--   proacl contains `anon=X`      -> explicit grant   -> revoke from anon
--
-- I got this wrong once in this very migration: the PUBLIC revoke ran
-- clean and all seven were still callable afterwards.
revoke execute on function public.band_label(smallint)      from public, anon, authenticated;
revoke execute on function public.league_promote_n(bigint)  from public, anon, authenticated;
revoke execute on function public.league_relegate_n(bigint) from public, anon, authenticated;
revoke execute on function public.level_floor(integer)      from public, anon, authenticated;
revoke execute on function public.local_today(text)         from public, anon, authenticated;
revoke execute on function public.safe_timezone(text)       from public, anon, authenticated;
revoke execute on function public.tier_name(smallint)       from public, anon, authenticated;

-- ---- deliberately still open to anon ---------------------------------------
-- get_showcase feeds the gardens on the public landing page, which logged-out
-- visitors see. It is the ONLY RPC that should answer to anon; re-granting it
-- explicitly here so that intent is written down rather than inferred from an
-- absence.
grant execute on function public.get_showcase(integer) to anon, authenticated;

-- ============================================================
-- The league tab died at the first season rollover.
--
-- close_season() derives league size with `count(*) over (partition by
-- league_id) as sz`, which is a bigint, and handed it to
-- league_promote_n(sz integer). Postgres will widen int -> bigint
-- implicitly but never narrows, so resolution failed with
--   function league_promote_n(bigint) does not exist
-- Latent since the league was written: nothing called close_season until a
-- season actually expired, and get_league() closes expired seasons on the
-- way in — so the whole standings RPC went down with it, for everyone.
--
-- Widening the parameter to bigint fixes both callers at once: the windowed
-- count passes as-is, and get_league's `v_size int` widens in implicitly.
-- The call site is cast explicitly too, so the intent survives a future edit.
-- ============================================================

drop function if exists public.league_promote_n(integer);
drop function if exists public.league_relegate_n(integer);

create function public.league_promote_n(sz bigint) returns integer
  language sql immutable as $$ select least(6, floor(sz / 5.0))::int $$;

create function public.league_relegate_n(sz bigint) returns integer
  language sql immutable as $$
    select case when sz >= 12 then least(6, floor(sz / 5.0))::int else 0 end $$;

create or replace function public.close_season(p_season_id integer)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not pg_try_advisory_xact_lock(841001, p_season_id) then return; end if;
  if exists (select 1 from seasons where id = p_season_id and closed_at is not null) then return; end if;

  with ranked as (
    select m.league_id, m.user_id,
           row_number() over (partition by m.league_id order by m.score desc, m.joined_at) as rk,
           count(*) over (partition by m.league_id) as sz
    from league_members m
    where m.season_id = p_season_id
  )
  update league_members m
     set final_rank = r.rk,
         movement = case
           when league_promote_n(r.sz::bigint) > 0 and r.rk <= league_promote_n(r.sz::bigint) then 1
           when league_relegate_n(r.sz::bigint) > 0 and r.rk > r.sz - league_relegate_n(r.sz::bigint) then -1
           else 0 end
    from ranked r
   where m.season_id = p_season_id and m.user_id = r.user_id and m.league_id = r.league_id;

  update seasons set closed_at = now() where id = p_season_id;
end $$;

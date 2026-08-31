-- ============================================================
-- Two real findings from the database linter.
--
-- 1. Five SECURITY DEFINER functions were callable by `anon` over the
--    public REST endpoint. Each already refuses a null auth.uid(), so none
--    was exploitable — but two of them are *writes* (claim_weekly_gift,
--    restore_fixture) and none has business being reachable without a
--    session. Only get_showcase stays public: the landing page shows real
--    gardens to signed-out visitors.
--
-- 2. Nine helpers had a role-mutable search_path. They are called from
--    SECURITY DEFINER functions, which is exactly where an attacker-supplied
--    search_path can resolve a call to something other than what was meant.
--    Pinned with ALTER so the bodies are left untouched.
-- ============================================================

revoke execute on function public.claim_weekly_gift(text)  from anon;
revoke execute on function public.get_care_week()          from anon;
revoke execute on function public.get_variant_collection() from anon;
revoke execute on function public.get_weekly_gift()        from anon;
revoke execute on function public.restore_fixture(text)    from anon;
revoke execute on function public.get_garden_of_the_day()  from anon;

alter function public.band_label(smallint)          set search_path = public;
alter function public.gardener_level(integer)       set search_path = public;
alter function public.league_promote_n(bigint)      set search_path = public;
alter function public.league_relegate_n(bigint)     set search_path = public;
alter function public.level_floor(integer)          set search_path = public;
alter function public.min_care_gap()                set search_path = public;
alter function public.season_id_for(date)           set search_path = public;
alter function public.tier_name(smallint)           set search_path = public;
alter function public.weekly_gift_options(date)     set search_path = public;

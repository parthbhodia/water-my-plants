-- The back half of the funnel, reconstructed from tables that already exist.
--
-- Vercel Web Analytics covers everything up to the sign-up button; it cannot
-- see anything after it, because a logged-in player is Supabase's business.
-- Nothing here needs instrumenting: every table already carries created_at, so
-- activation and retention have been recorded since launch and were simply
-- never queried.
--
-- Read-only. Run with the MCP `execute_sql` tool or in the SQL editor.

-- 1. Activation: of the people who signed up, how many ever planted anything,
--    and how many came back to water it? A signup that never plants is a
--    landing-page problem; a plant that is never watered twice is a game one.
with signups as (
  select id as user_id, created_at::date as joined
  from profiles
),
planted as (
  select user_id, min(created_at)::date as first_plant
  from plants group by user_id
),
watered as (
  select user_id,
         count(distinct care_date) as care_days,
         min(care_date) as first_care,
         max(care_date) as last_care
  from care_logs group by user_id
)
select
  s.joined,
  count(*)                                              as signed_up,
  count(p.user_id)                                      as planted_something,
  count(*) filter (where w.care_days >= 2)              as watered_twice,
  count(*) filter (where w.care_days >= 7)              as reached_a_week,
  round(100.0 * count(p.user_id) / nullif(count(*), 0), 1)  as pct_activated
from signups s
left join planted p using (user_id)
left join watered w using (user_id)
group by s.joined
order by s.joined desc;

-- 2. Where people stop. One row per player, newest first — small enough to
--    read by eye while the numbers are still tiny, and the shape that tells
--    you WHICH step is leaking rather than just that one is.
select
  pr.created_at::date                          as joined,
  count(distinct pl.id)                        as plants_ever,
  count(distinct cl.care_date)                 as days_tended,
  max(cl.care_date)                            as last_seen,
  current_date - max(cl.care_date)             as days_since
from profiles pr
left join plants pl on pl.user_id = pr.id
left join care_logs cl on cl.user_id = pr.id
group by pr.id, pr.created_at
order by pr.created_at desc;

-- 3. Which species people actually choose. The landing page's plant picker
--    orders the twelve easiest-first and leads on the lily; this is the check
--    on whether that is what newcomers really take.
select sp.key, sp.name, count(*) as times_planted
from plants pl
join species sp on sp.id = pl.species_id
group by sp.key, sp.name
order by times_planted desc;

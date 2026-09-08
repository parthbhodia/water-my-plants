-- `left join (... ) lh on lh.h = h` — the bare `h` matched both the
-- generate_series output column and lh.h, so admin_funnel() raised 42702 at
-- RUN time. `create or replace function` accepted it happily: plpgsql does not
-- parse a function body until it executes, which is exactly why a deploy that
-- "succeeded" proves nothing and the RPC has to be called.
create or replace function admin_funnel()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_out jsonb;
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select jsonb_build_object(

    'totals', (
      select jsonb_build_object(
        'players',       (select count(*) from profiles),
        'planted_ever',  (select count(distinct user_id) from plants),
        'plants_alive',  (select count(*) from plants where active),
        'waterings',     (select count(*) from care_logs),
        'active_7d',     (select count(distinct user_id) from care_logs
                          where care_date >= current_date - 7),
        'active_1d',     (select count(distinct user_id) from care_logs
                          where care_date >= current_date - 1)
      )
    ),

    'cohorts', (
      select coalesce(jsonb_agg(r order by r->>'joined' desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'joined',      s.joined,
          'signed_up',   count(*),
          'planted',     count(p.user_id),
          'watered_2',   count(*) filter (where w.care_days >= 2),
          'lasted_week', count(*) filter (where w.care_days >= 7)
        ) as r
        from (select id as user_id, created_at::date as joined from profiles) s
        left join (
          select user_id, min(created_at)::date as first_plant
          from plants group by user_id
        ) p using (user_id)
        left join (
          select user_id, count(distinct care_date) as care_days
          from care_logs group by user_id
        ) w using (user_id)
        group by s.joined
      ) q
    ),

    'species', (
      select coalesce(jsonb_agg(r order by (r->>'planted')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'key', sp.key, 'name', sp.name, 'planted', count(*)
        ) as r
        from plants pl
        join species sp on sp.id = pl.species_id
        group by sp.key, sp.name
      ) q
    ),

    -- generate_series, not `group by care_date`, so a day when nobody watered
    -- is a zero on the chart and not a missing point the line draws through.
    'daily', (
      select coalesce(jsonb_agg(r order by r->>'day'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'day',       g.d::date,
          'waterings', count(cl.user_id),
          'players',   count(distinct cl.user_id)
        ) as r
        from generate_series(current_date - 29, current_date, interval '1 day') as g(d)
        left join care_logs cl on cl.care_date = g.d::date
        group by g.d
      ) q
    ),

    -- Classic Dn retention. `eligible` only counts players who have actually
    -- existed that many days — without it every cohort looks like it churned
    -- on day 13 purely because it signed up last week.
    'retention', (
      select coalesce(jsonb_agg(r order by (r->>'day')::int), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'day', g.off,
          'eligible', count(*) filter (where p.created_at::date + g.off <= current_date),
          'active',   count(*) filter (
            where p.created_at::date + g.off <= current_date
              and exists (select 1 from care_logs c
                          where c.user_id = p.id
                            and c.care_date = p.created_at::date + g.off))
        ) as r
        from generate_series(0, 13) as g(off)
        cross join profiles p
        group by g.off
      ) q
    ),

    -- When people tend, on THEIR clock. The game runs on a frozen local
    -- timezone, so a UTC hour would be a different question with a
    -- similar-looking answer — and this is what the nudge send-hour should be
    -- argued from.
    'hours', (
      select coalesce(jsonb_agg(r order by (r->>'hour')::int), '[]'::jsonb)
      from (
        select jsonb_build_object('hour', g.h, 'waterings', count(lh.lhour)) as r
        from generate_series(0, 23) as g(h)
        left join (
          select extract(hour from (c.created_at at time zone
                   coalesce(nullif(pr.timezone, ''), 'UTC')))::int as lhour
          from care_logs c
          join profiles pr on pr.id = c.user_id
        ) lh on lh.lhour = g.h
        group by g.h
      ) q
    )
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function admin_funnel() from public, anon, authenticated;
grant execute on function admin_funnel() to authenticated;

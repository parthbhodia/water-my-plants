-- Admin-only funnel analytics.
--
-- The numbers span every player, which RLS (select-own-rows) rightly forbids a
-- client from reading. So the aggregate lives behind a SECURITY DEFINER RPC
-- that checks the caller is an admin and raises otherwise — the same shape as
-- every other privileged read in this schema. Nothing here writes.

create table if not exists admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table admins enable row level security;

drop policy if exists admins_select_own on admins;
create policy admins_select_own on admins
  for select to authenticated using (user_id = auth.uid());

-- Internal helper: callable by neither anon nor authenticated. Its only caller
-- is admin_funnel(), which is SECURITY DEFINER and so keeps the owner's access.
-- It is deliberately NOT used in any RLS policy — policies are evaluated as the
-- CALLING user, and a revoked function there breaks ordinary table reads.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins a where a.user_id = auth.uid());
$$;

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

    -- Headline counts.
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

    -- Activation by signup day: of the people who joined, how many ever
    -- planted, watered twice, or lasted a week. A signup that never plants is
    -- a landing-page problem; a plant never watered twice is a game one.
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

    -- What newcomers actually choose. The landing page orders the twelve
    -- easiest-first and leads on the lily; this is the check on that.
    'species', (
      select coalesce(jsonb_agg(r order by (r->>'planted')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'key',     sp.key,
          'name',    sp.name,
          'planted', count(*)
        ) as r
        from plants pl
        join species sp on sp.id = pl.species_id
        group by sp.key, sp.name
      ) q
    )
  ) into v_out;

  return v_out;
end;
$$;

-- Grants. Read the ACL, then pick the verb — naming all three is the safe form.
revoke all on function is_admin()     from public, anon, authenticated;
revoke all on function admin_funnel() from public, anon, authenticated;
grant execute on function admin_funnel() to authenticated;

-- The allow-list itself is seeded in the next migration, so that granting a
-- person admin is a reviewable one-line change and not buried in the DDL.

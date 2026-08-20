-- ============================================================
-- Granny's Sunday basket — one free gift per local week.
--
-- A kindness, not an economy: nothing here counts toward
-- lifetime_earned, so levels stay earned by tending alone.
--
--   weekly_gifts            (user_id, week_start) PK — one claim a week
--   weekly_gift_options()   two options per week; items rotate weekly
--   get_weekly_gift()       claimed flag + this week's options
--   claim_weekly_gift(text) validates the choice, grants dew/items
-- ============================================================

create table if not exists public.weekly_gifts (
  user_id    uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  choice     text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table public.weekly_gifts enable row level security;
drop policy if exists "weekly_gifts_select_own" on public.weekly_gifts;
create policy "weekly_gifts_select_own" on public.weekly_gifts
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.weekly_gift_options(v_week date)
returns jsonb
language sql
immutable
as $$
  select case when (extract(epoch from v_week)::bigint / 604800) % 2 = 0
    then jsonb_build_array(
      jsonb_build_object('key','dew','name','A pouch of dewdrops','blurb','60 dewdrops for the purse.'),
      jsonb_build_object('key','fertilizer','name','Two scoops of fertilizer','blurb','For the hungry ones.'))
    else jsonb_build_array(
      jsonb_build_object('key','dew','name','A pouch of dewdrops','blurb','60 dewdrops for the purse.'),
      jsonb_build_object('key','tonic','name','A revival tonic','blurb','Tucked away for a bad week.'))
  end
$$;

create or replace function public.get_weekly_gift()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_week date;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select timezone into v_tz from profiles where id = v_uid;
  if v_tz is null then raise exception 'no profile'; end if;
  v_week := date_trunc('week', local_today(v_tz))::date;
  return jsonb_build_object(
    'weekStart', v_week,
    'claimed', exists (select 1 from weekly_gifts
                        where user_id = v_uid and week_start = v_week),
    'options', weekly_gift_options(v_week));
end $$;

create or replace function public.claim_weekly_gift(p_choice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_week date;
  v_ok boolean;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select timezone into v_tz from profiles where id = v_uid;
  if v_tz is null then raise exception 'no profile'; end if;
  v_week := date_trunc('week', local_today(v_tz))::date;

  select exists (
    select 1 from jsonb_array_elements(weekly_gift_options(v_week)) o
     where o->>'key' = p_choice
  ) into v_ok;
  if not v_ok then raise exception 'That is not in this week''s basket.'; end if;

  -- the PK makes a second claim in the same week impossible
  insert into weekly_gifts (user_id, week_start, choice)
  values (v_uid, v_week, p_choice);

  if p_choice = 'dew' then
    update wallet set dewdrops = dewdrops + 60 where user_id = v_uid;
  elsif p_choice = 'fertilizer' then
    insert into inventory (user_id, item_key, qty) values (v_uid, 'fertilizer', 2)
    on conflict (user_id, item_key) do update set qty = inventory.qty + 2;
  elsif p_choice = 'tonic' then
    insert into inventory (user_id, item_key, qty) values (v_uid, 'tonic', 1)
    on conflict (user_id, item_key) do update set qty = inventory.qty + 1;
  end if;

  return jsonb_build_object(
    'status', 'claimed',
    'choice', p_choice,
    'state', garden_state_json(v_uid, v_tz));
exception when unique_violation then
  raise exception 'You have already had this week''s basket.';
end $$;

revoke all on function public.weekly_gift_options(date) from public, anon, authenticated;
grant execute on function public.get_weekly_gift() to authenticated;
grant execute on function public.claim_weekly_gift(text) to authenticated;

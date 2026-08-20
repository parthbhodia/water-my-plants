-- ============================================================
-- Last-chance rescue emails + the delivery drain.
--
-- build_rescues() is the emergency channel: a plant on its FINAL day
-- (overdue = 3; midnight kills it) triggers one evening email (17:00-21:00
-- local), outside the player's chosen nudge hour, bypassing the
-- one-message-a-day calm — but never more than one rescue a day, never
-- when they've already tended something today, and only while the plant
-- can still be watered before midnight (window-aware).
--
-- Delivery: cron 'lily-drain-nudges' POSTs to the send-nudges edge
-- function every 5 minutes with the public anon JWT. The function is a
-- no-op (queue intact) until RESEND_API_KEY is set as a function secret.
-- Verified with a rolled-back test: queues once, titles carry the
-- player's name, reruns don't duplicate, playing today suppresses,
-- closed windows are excluded.
--
-- Full build_rescues() body applied remotely as `rescue_emails_and_drain`;
-- kept in sync here.
-- ============================================================

create or replace function public.build_rescues()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_made int := 0;
  v_today date;
  v_hour int;
  v_n int;
  v_names text;
  v_first text;
  v_title text;
begin
  for v_row in
    select p.id, p.timezone, p.display_name,
           coalesce(n.email_enabled, true) as enabled
    from profiles p
    left join notification_prefs n on n.user_id = p.id
  loop
    continue when not v_row.enabled;

    v_hour := extract(hour from (now() at time zone safe_timezone(v_row.timezone)))::int;
    -- the player's evening: late enough to be the last word, early enough to act
    continue when v_hour < 17 or v_hour > 21;

    v_today := local_today(v_row.timezone);

    -- they already tended something today: they saw the garden and chose
    continue when exists (
      select 1 from plants pl
       where pl.user_id = v_row.id and pl.last_care_on = v_today);

    -- one rescue a day, ever
    continue when exists (
      select 1 from notification_queue q
       where q.user_id = v_row.id and q.kind = 'rescue' and q.for_date = v_today);

    -- final-day plants that can still be watered before midnight
    select count(*), string_agg(s.name, ', ' order by s.name)
      into v_n, v_names
    from plants pl join species s on s.id = pl.species_id
    where pl.user_id = v_row.id and pl.active
      and pl.died_on is null and not pl.is_bloomed
      and overdue_days(pl, s, v_today) = 3
      and (s.window_start is null
        or (s.window_end > s.window_start and v_hour < s.window_end)
        or (s.window_end < s.window_start));
    continue when coalesce(v_n, 0) = 0;

    v_first := split_part(coalesce(v_row.display_name, ''), ' ', 1);
    v_title := case
      when v_n = 1 then 'the ' || v_names || ' won''t last the night'
      else v_n || ' plants won''t last the night' end;
    if length(v_first) between 2 and 16 then
      v_title := v_first || ' — ' || v_title;
    else
      v_title := initcap(substr(v_title, 1, 1)) || substr(v_title, 2);
    end if;

    insert into notification_queue (user_id, kind, title, body, for_date)
    values (v_row.id, 'rescue', v_title,
      case when v_n = 1
        then 'She has been dry three days, love, and one more ends it. A single watering before midnight saves her completely. — Granny Fern'
        else 'They have been dry three days (' || v_names || '), and one more ends it. A quick watering before midnight saves every one. — Granny Fern'
      end,
      v_today)
    on conflict do nothing;
    v_made := v_made + 1;
  end loop;
  return v_made;
end $$;

revoke all on function public.build_rescues() from public, anon, authenticated;

-- the hourly sweep builds both the daily nudge and any rescues
-- (cron.alter_job applied remotely); delivery drain scheduled as
-- 'lily-drain-nudges', */5 * * * *, POSTing to send-nudges with the anon JWT.

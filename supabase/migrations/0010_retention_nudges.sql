-- ============================================================
-- Phase 05 — The retention loop
--
-- A daily game lives or dies on the reminder. The hard part is not sending
-- mail, it is knowing *what* is worth saying and *when* in the player's own
-- day to say it. That decision lives here: an hourly job walks every player,
-- checks whether their local clock has reached their chosen nudge hour, and
-- writes one specific message about what actually needs them. Delivery drains
-- the outbox separately (supabase/functions/send-nudges).
--
-- Applied remotely as migration `retention_nudges`.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.notification_prefs (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  nudge_hour    smallint not null default 18 check (nudge_hour between 0 and 23),
  created_at    timestamptz not null default now()
);

create table if not exists public.notification_queue (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text not null,
  for_date    date not null,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  send_error  text,
  constraint notification_once unique (user_id, kind, for_date)
);
create index if not exists notification_unsent
  on public.notification_queue (created_at) where sent_at is null;

alter table public.notification_prefs enable row level security;
alter table public.notification_queue enable row level security;

drop policy if exists "prefs_select_own" on public.notification_prefs;
create policy "prefs_select_own" on public.notification_prefs
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "queue_select_own" on public.notification_queue;
create policy "queue_select_own" on public.notification_queue
  for select to authenticated using ((select auth.uid()) = user_id);

-- Hourly sweep. Each player is only considered when their own local clock
-- reaches their nudge hour, so one UTC schedule serves every timezone.
select cron.schedule('lily-build-nudges', '0 * * * *', $$select public.build_nudges()$$)
where not exists (select 1 from cron.job where jobname = 'lily-build-nudges');

-- Functions (bodies applied remotely):
--   pending_care(uuid)        the single most useful thing to say, by priority:
--                             dying > closing window > thirsty > ready to harvest
--   build_nudges()            hourly sweep; one message per player per local day
--   get_today_brief()         the same decision, surfaced in-app
--   set_notification_prefs()  opt out, or choose the hour

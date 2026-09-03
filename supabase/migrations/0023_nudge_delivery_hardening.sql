-- ============================================================
-- Nudge delivery: expire stale, and never let one env var stop everything.
--
-- RESEND_API_KEY was never set, so the queue filled from 21 August and
-- delivered nothing — 48 unsent rows across 4 players, 9 of them "won't
-- last the night" rescues about plants that had since died. A watering
-- reminder is only true on the day it was built, so anything older than
-- two days is retired rather than sent, and the sweep now runs before
-- every build so a queue can never accumulate silently again.
--
-- (The edge function is versioned separately in Supabase. It now answers
-- 503 rather than 200 when the key is missing, 502 when every send fails,
-- and falls back to a safe sender when NUDGE_FROM is not a valid address —
-- an invalid `from` was failing every message in the batch with a 422.)
-- Applied remotely as `expire_stale_nudges_v2`.
-- ============================================================

create or replace function public.expire_stale_nudges(p_max_age_days int default 2)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  update notification_queue
     set sent_at = now(),
         send_error = 'expired: ' || (current_date - for_date)
                    || ' days stale, never delivered'
   where sent_at is null
     and for_date < current_date - p_max_age_days;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.expire_stale_nudges(int) from public, anon, authenticated;

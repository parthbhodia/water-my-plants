# send-nudges

Drains `public.notification_queue` and emails each pending reminder via Resend.

The queue is built entirely in Postgres (`build_nudges()`, hourly via pg_cron),
so this function only decides how a message travels — never what it says.

## Switching delivery on

Email is **off** until a key is configured. Without `RESEND_API_KEY` the
function returns `{"sent":0,"pending":N,"note":"..."}` and leaves the queue
intact, so nothing is lost in the meantime and the rest of the game is
unaffected.

1. Create a Resend API key at https://resend.com and verify a sending domain.
2. Add the secrets to the project:
   - `RESEND_API_KEY` — required
   - `NUDGE_FROM` — optional, e.g. `Lily Days <hello@yourdomain.com>`
   - `APP_URL` — optional, defaults to the Vercel deployment
3. Schedule the drain (runs alongside the hourly queue build):

```sql
select cron.schedule(
  'lily-send-nudges', '*/10 * * * *',
  $$select net.http_post(
      url     := 'https://<project-ref>.supabase.co/functions/v1/send-nudges',
      headers := jsonb_build_object(
                   'Content-Type','application/json',
                   'Authorization','Bearer ' || current_setting('app.service_key')),
      body    := '{}'::jsonb) $$);
```

Store the service key in Supabase Vault rather than inline.

## Failure handling

A send that fails records `send_error` on the row and leaves `sent_at` null,
so the next run retries it. `notification_once` (user, kind, date) guarantees a
player is never emailed twice about the same thing on the same day.

# 🌸 Lily Days

**Live:** https://water-my-plants-parthbhodias-projects.vercel.app

A cozy daily water-lily gardening game. Come back **once every real day** to water your
lily and watch it grow from a sleepy seed to a full bloom over 7 stages. Miss a day and
it wilts a little (and your streak resets) — but one watering brings it right back.

Everything on screen — the gardener, the pond, the house, butterflies, fireflies, the
day/night sky — is **drawn with code** (Phaser graphics + SVG). No image or audio assets;
even the sounds are synthesized with WebAudio.

## Stack

| Layer     | Choice |
|-----------|--------|
| Framework | Next.js 15 (App Router) + React 19 |
| Game      | Phaser 3, mounted in a client component, all textures generated at boot |
| Database  | Supabase Postgres (`profiles`, `plants`, `care_logs`, `completed_lilies`) |
| Auth      | Supabase email/password via `@supabase/ssr` cookies |
| Hosting   | Vercel (auto-deploys from GitHub) |

## How the game logic stays cheat-proof

The client never decides what day it is. All mutations go through Postgres functions
(`get_garden_state`, `water_lily`, `replant`) that are `SECURITY DEFINER`:

- "Today" is computed **server-side** in the user's stored IANA timezone
  (`(now() at time zone tz)::date`), captured from the browser at first load —
  so a 9pm watering in New Jersey doesn't lose a streak because UTC rolled over.
- One water per local day, enforced by `last_watered_on` + row locking, plus a
  `unique (user_id, action, care_date)` constraint on `care_logs` as a backstop.
- Tables have RLS with **select-only** policies; there are no insert/update policies,
  so the RPCs are the only write path.
- `care_logs` doubles as the analytics table: DAU = `count(distinct user_id)` per `care_date`.

## Growth rules

- 7 stages: Seed → Sprout → Young Pad → Lily Pad → Budding → Blushing Bud → Full Bloom.
- Each daily watering advances one stage (6 waterings to bloom).
- Missed days pause growth, wilt the plant visually, add to `missed_days`, and reset the streak.
- After full bloom: replant archives the lily into `completed_lilies` (shown in the journal's
  Bloom Gallery, with a "perfect" badge for zero missed days) and starts a new seed.

## Development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + publishable key
npm run dev
```

The Supabase **publishable** key is browser-safe by design (it ships in the bundle; RLS
protects the data). Defaults are baked into `utils/supabase/config.ts` and can be
overridden with `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
The secret key is not used anywhere in this app.

The database schema lives in `supabase/migrations/` and was applied to the project as
migration `lily_days_init`.

## Auth notes

Sign-up needs **no email round-trip**: a database trigger
(`supabase/migrations/0002_auto_confirm_users.sql`) auto-confirms new users, and the
client signs them in immediately after registering. Confirmation emails may still be
delivered but can be ignored.

To switch to real email verification instead:

1. `drop trigger auto_confirm_users on auth.users;`
2. In the Supabase dashboard → **Authentication → URL Configuration**, set **Site URL**
   to your deployed URL and add `https://<your-domain>/auth/callback` to the redirect
   allow list (otherwise confirmation links point at `localhost:3000`).
3. Remove the auto-sign-in fallback in `components/AuthForm.tsx`.

## Controls

- **← → / A D** — walk
- **E / Space** — water (auto-walks to the pond)
- **Tap** the pond to water, tap elsewhere to walk (mobile)
- **💧 button** — one-tap water from anywhere

# Lily Days — a daily gardening web game

Live at https://waterlilly.app (Vercel project `water-my-plants`, repo
`parthbhodia/water-my-plants`). Players water eight species — each with its
own care contract — one turn per plant per local day, and compete in weekly
timezone-banded leagues. Coins ("dewdrops") are earned only by tending;
nothing is purchasable with real money.

## Stack

- Next.js 15 App Router + TypeScript. `@supabase/ssr` cookie sessions;
  middleware refreshes the session; `/garden` is the authed app, `/` the
  landing page (server component, redirects signed-in users).
- Phaser 3.90 in `game/GardenScene.ts` — imported as `import * as Phaser`
  (its ESM build has no default export). React↔Phaser talk only through
  `game/bridge.ts` (`GameBridge`), never directly.
- `motion` (framer-motion v13, `motion/react`) for landing-page reveals and
  parallax; `lucide-react` for all UI icons — do NOT use emoji as icons.
- PWA: `app/manifest.ts`, `public/sw.js`, `components/PwaSetup.tsx`.

## Art: everything is painted in code

No image assets exist. All art is Canvas2D painted at runtime:

- `game/draw.ts` — shared helpers (`lg`, `rgrad`, `rr`, `ell`, `blob`).
  **`lg()`/`rgrad()` RETURN a gradient — always assign to `fillStyle`;
  a bare `lg(...)` call silently paints nothing (black).**
- `game/plants.ts` — 8 species × 7 stages, parametric painter; `bloomScale()`
  normalises per-form heights for the bloom celebration.
- `game/avatar.ts` — gardener painter + palettes (shared by Phaser frames
  and React `AvatarPreview`).
- `game/guide.ts` — Granny Fern portrait, 5 moods (`happy/cheer/worry/proud/
  sleepy`); rendered by `components/GuidePortrait.tsx`. She narrates the
  tutorial, all toasts (via `guide-toast`), and the weekly gift.
- `game/decor.ts`, `game/fixtures.ts` — ornaments and restorable ruins
  (broken + restored states). `game/scenecard.ts` — the landing-page garden
  vignette painter (showcase cards + playable hero).

## Database (Supabase project `qkjieeopawcvgfchextu`)

- Server-authoritative time: all day logic lives in Postgres
  `SECURITY DEFINER` functions using the player's **frozen** IANA timezone
  (`set_timezone()` has a 14-day cooldown; `min_care_gap()` enforces a 6h
  floor — this closed a proven timezone-hopping exploit).
- RLS is select-own-rows only; **every write goes through an RPC**. Helper
  functions are `revoke`d from `authenticated`.
- `garden_state_json(uid, tz)` is the single state document the client
  loads; RPCs return it under `state` so the UI can `applyState` atomically.
- Wallet spends lock the row (`select ... for update`) — copy that pattern
  for any new spend (see `buy_item`, `restore_fixture`).
- Migrations in `supabase/migrations/` MIRROR what was applied remotely via
  the MCP `apply_migration` tool; keep them in sync when changing the DB.

### Testing DB changes

`execute_sql` runs read-only. Mutation tests go through `apply_migration`
with a terminal `raise exception 'TESTRESULT ...'` so everything rolls back;
impersonate a user inside the DO block with:
`perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role','authenticated')::text, true);`

## Testing the UI

The sandbox proxy blocks browser→Supabase, so no logged-in E2E. Instead:
create a temporary `app/dev-*/page.tsx` fixture page that feeds mock
`GardenState` through `GameBridge`, screenshot it with playwright-core
(`executablePath: "/opt/pw-browsers/chromium"`), then DELETE the dev page
before committing. `npm run build` + `tsc --noEmit` must pass.

Kill the dev server with `pkill -f "[n]ext-server"` — a bare
`pkill -f "next start"` kills your own shell.

On localhost the scene exposes `window.__lilyProbe()` → `{x, y, pouring,
target}` for movement assertions. Headless Chromium renders ~8fps; player
movement uses wall-clock time so speeds still hold, but allow generous
waits before screenshots.

## Conventions

- Branch: `claude/lily-days-game-al8cgd` only.
- Depth in the Phaser yard: `YARD (=100) + y` for anything standing on
  grass; fixtures along the fence sit at ~6.35, fog 6.55, UI overlays 800+.
- The scene freezes input (`bridge.setFrozen`) while any modal is open.
- Sounds: `game/audio.ts` — `sfx` (synth effects) and `music` (generative
  ambient loop, needs a user gesture to start; independent toggle, global
  mute silences both). All audio is generated, no files.
- Voice: Granny Fern speaks in a warm, plain-spoken register ("There you
  go, love."). Keep copy short; the landing page sells by showing, not
  pitching.
- Never use the Supabase secret key in app code; only the publishable key.

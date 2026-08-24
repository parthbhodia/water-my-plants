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

## Mobile is the primary target

Most players arrive on a phone. Treat mobile as the default case, not an
adaptation, and hold to these rules:

- **Every control clears 44x44px on coarse pointers.** The global rule
  lives at the end of `globals.css` under "Touch targets". Small text
  links get vertical padding rather than a bigger font. Never ship a
  control that only a mouse can hit.
- **Never rely on hover.** Hover styling may decorate, never inform —
  anything a player must know has to be visible at rest.
- **No horizontal overflow, ever.** Wide rows (`.plot-chips`, `.seed-grid`,
  `.shop-grid`) wrap or scroll inside their own container.
- **Respect the safe area** on anything pinned to a screen edge
  (`env(safe-area-inset-*)`), or the notch and home bar will eat it.
- **The game canvas uses `Phaser.CANVAS`, not WebGL.** iOS Safari's
  texture-memory ceiling kills a WebGL boot on a scene this texture-heavy;
  all art here is painted canvas anyway, so the 2D renderer costs nothing.
  Boot failures must stay visible (error text + retry), never a silent
  spinner.
- **Landscape is the recommended orientation** and the installed PWA locks
  to it; in the browser, portrait still works and only *invites* rotation.
  Never block play on orientation.
- **`touch-action: none` on the game canvas.** Without it Safari claims the
  gesture as scroll/zoom and Phaser never sees the tap — the canvas looks
  alive but nothing responds.
- **The scene must not draw under React chrome.** `bridge.setBottomInset(px)`
  reports the height of the sheet's *collapsed grab handle* only; the camera
  viewport shrinks to match, so plots never hide beneath it. Never feed it
  the expanded sheet height — an open sheet is a temporary overlay, and
  reserving it squeezed the garden into a sliver.
- **No user action may leave a lock stuck.** The tend guard
  (`acting`/`busy`) has a 15s watchdog; without it one hung request killed
  the Water button silently for the rest of the session.
- **Touch devices never see keyboard copy** — no W A S D, no "press E".
  Gate on `matchMedia("(pointer: coarse)")`.

### Testing mobile

`node scripts/mobile-audit.mjs` walks the landing page and every garden
panel across three phone viewports and reports horizontal overflow,
sub-44px tap targets, controls pushed off-screen, and page errors.
**It must print `0 findings` before shipping UI work.** It also taps a
plant through the real canvas and asserts the scene registered the hit,
which is the check that catches gesture regressions, taps the Water
button and asserts a pour actually starts, and fails if an open sheet
reflows the camera. It needs
`npm run start` on :3000 and the `app/dev-mobile` fixture, which mounts
every panel with mock state so no login is required. Screenshots land in
`/tmp/mobile-audit`.

## Watering

Three ways in, because hunting for a button is not a ritual:

- **Tap the plant.** If it can drink right now (`canWaterNow` in
  `lib/species.ts` — the one source of truth) the gardener walks over and
  waters it. If it cannot, the tap only selects: a tap must never damage an
  overwaterable species like the cactus.
- **The floating button** (`WaterFab`) lives on the stage, never inside the
  pull-up sheet, so watering is one thumb-reach on a phone.
- **Water all** runs the day's round in sequence, walking plant to plant.
  Each pour escalates a combo flourish and the round ends in confetti.

Never kill a plant's tweens by walking `getTweensOf(...)` — chained
animations (the drink gulp) break mid-flight and throw. Track long-lived
tweens explicitly, like `shivers`.

## Guiding a lost player

A player should never wonder what to do next:

- `components/NextStep.tsx` sits above the plot chips and names one
  action, in priority order — dying plant, thirsty plant, empty plot,
  ready bloom — with the plot number and a button that jumps there.
- Empty unlocked plots carry a breathing gold ring and a bobbing
  seed-packet sign in the scene, so "where can I plant?" is answered by
  looking.
- First-timers get: Granny's tutorial → guided first planting (camera
  dives in, holds through the first watering) → coach marks over the real
  interface. Each hands off to the next; they never overlap.

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

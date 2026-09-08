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

### The RPC smoke test — run it after ANY database change

`supabase/tests/rpc_smoke.sql` executes **every** RPC the client calls, as a
real impersonated user, and ends in a deliberate exception so it all rolls
back. Read the `TESTRESULT` line: it must say `ALL PASS`.

This exists because the league went down in production for every player —
`close_season()` passed a `bigint` to `league_promote_n(integer)` — and
`npm run build`, `tsc --noEmit` **and** the mobile audit all reported clean,
because not one of them ever executes an RPC. A function can be missing,
mistyped or ungranted and every other gate still says fine. The test is
verified to catch that exact regression when it is reintroduced.

Validation guards firing are **not** failures — the test feeds valid inputs
so each body actually runs, and asserts separately that `add_friend` and
`visit_water` still refuse bad input. Two gotchas it encodes: `clear_plot`
gates on the `is_bloomed` *flag*, not `bloomed_at` (separate columns), and
`revive_plant` needs a tonic bought first.

Also run `get_advisors` after DDL: it is what caught `anon` being able to
call `restore_fixture` and `claim_weekly_gift`.

### Grants: there are TWO ways a function is reachable

A function ends up callable over `/rest/v1/rpc/<name>` by one of two
mechanisms, and **the revoke that closes one does nothing to the other**:

| `proacl` shows | how it is reachable | what closes it |
|---|---|---|
| `null` or `=X/postgres` | the PUBLIC default | `revoke … from public` |
| `anon=X/postgres` | Supabase's `alter default privileges` | `revoke … from anon` |

Both mistakes have been made in this repo, in both directions:

- Migration **0021** wrote `revoke … from anon` for six functions that held
  PUBLIC grants. All six lines were inert and all six were still open to
  `anon` until migration 0030.
- Migration **0030** then wrote `revoke … from public` for seven helpers
  that held explicit `anon=X` grants. Also inert — the revoke ran clean and
  all seven were still callable afterwards.

So: **read the ACL first, then pick the verb.** When in doubt name all
three (`from public, anon, authenticated`) and grant back what is needed.

**Never trust the SQL you just ran — ask the database:**

```sql
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_can,
       coalesce(array_to_string(p.proacl, ' | '), '(PUBLIC default)') as acl
from pg_proc p where p.pronamespace = 'public'::regnamespace;
```

The intended surface, as of 0030: **`get_showcase` is the only function
`anon` may call** (the landing page shows real gardens to logged-out
visitors). Everything else is `authenticated` or nothing. Internal helpers
— `local_today`, `safe_timezone`, `level_floor`, `year_phase`, `band_label`,
`tier_name`, the league maths — are callable by neither; every caller is a
SECURITY DEFINER function, which runs as the owner and keeps its access.

Before revoking, check nothing *else* depends on the function: **RLS
policies, column defaults and check constraints are evaluated as the
CALLING user**, so a revoke there breaks ordinary table reads. Query
`pg_policy`, `pg_attrdef` and `pg_constraint` for the name first.

And note the smoke test **cannot** catch any of this: it runs as the owner.
Testing a grant needs `set local role authenticated;` (or `anon`) inside the
rolled-back block — that is the only way to see what a real client sees.

### `npm run lint` — the gate that did not exist

A `useEffect` placed below an early return took the **whole Shop tab down
for every player** ("Rendered more hooks than during the previous render"),
and `tsc --noEmit`, `next build` and the mobile audit all reported clean.
None of them knows the rules of hooks, and this repo had **no ESLint config
and no lint script at all**, so the rule that catches it instantly had never
run here.

The mobile audit specifically *cannot* see this class of bug: the sandbox
blocks browser→Supabase, so a panel that early-returns while its data loads
(`if (!shop) return …`) takes that branch on every render in the fixture.
The second render — the one that trips the crash — never happens.

`eslint.config.mjs` is deliberately narrow: `react-hooks/rules-of-hooks` as
an **error**, `exhaustive-deps` as a warning, nothing else. A hundred
cosmetic rules on a codebase that has never been linted would bury the one
rule that matters. Verified to catch the exact regression when it is
reintroduced.

Note `next lint` is deprecated in Next 15 and crashes on a flat config
("Converting circular structure to JSON") — the script calls `eslint`
directly.

**Run it with the other gates before shipping UI work.**

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

## `setTint()` does nothing — the renderer is CANVAS

Phaser's canvas `batchSprite` reads `blendMode`, `alpha`, then `drawImage`.
It never reads `tintTopLeft`, and the whole `renderer/canvas/` directory
contains no reference to tint at all. **Every `setTint` call in this
codebase is dead code**, including `tint:` arrays on particle emitters.

This is not academic. A "dust brown" leaf built by tinting the white
`petalbit` fell on dead plants as **white confetti** — the exact
celebratory-vocabulary mistake the loss states exist to avoid. Anything
that needs a colour needs its own painted texture: `leafdry`, `mote_dew`,
`mote_gold`, `mote_moon` were all added for this reason.

Before adding a coloured effect, paint the texture. If a change looks
right in a screenshot only because the base texture was already that
colour (`sunglow`, `moonglow`, `ray`), the tint on it is still a no-op.

## Watering

Three ways in, because hunting for a button is not a ritual:

- **Tap the plant.** If it can drink right now (`canWaterNow` in
  `lib/species.ts` — the one source of truth) the gardener walks over and
  waters it. If it cannot, the tap only selects: a tap must never damage an
  overwaterable species like the cactus.
- **The floating button** (`WaterFab`) lives on the stage, never inside the
  pull-up sheet, so watering is one thumb-reach on a phone.
- **The stream starts at the spout and is aimed, not guessed.**
  `SPOUT_OFFSET` is in *logical frame units* and the frames are painted at
  2x, so converting to world pixels is `2 * sprite.scale` — multiplying by
  the scale alone put the origin at half the height, which is his hip, and
  the water poured out of his trousers. The droplet speeds are then solved
  to reach the plant in a fixed `POUR_T`; deriving the time from the fall
  instead would have no solution for a **pond** plot, where the lily sits
  further back and therefore *higher* on screen than the bank he stands on.
  Both emitter speeds must stay plain numbers: `EmitterOp.onChange` only
  writes `current`, which a `{min,max}` op never reads back, so aiming one
  silently does nothing. Scatter comes from the emit zone.
- **A pond plant is not thirsty — the pond is.** A lily floats, so "Water"
  was a verb the game could not justify, and the card admitted as much
  ("she is never really thirsty") while the button insisted otherwise.
  `tendVerb()` in `lib/species.ts` gives any `needsPlot: "water"` species the
  honest words — *Top up* — and the scene matches: the can is aimed at the
  open water in front of the pad, and `wetSoil` hands over to `pondRise`,
  because there is no soil to darken and the level coming up is the whole
  point. The RPC is still `water`; only the words and the aim changed.
- **Water all** runs the day's round in sequence, walking plant to plant.
  Each pour escalates a combo flourish and the round ends in confetti.

Never kill a plant's tweens by walking `getTweensOf(...)` — chained
animations (the drink gulp) break mid-flight and throw. Track long-lived
tweens explicitly, like `shivers`.

## Scoring: consistency, not accumulation

The weekly league ranks on **met care days**, never on how much you own.
`compute_consistency_score` = `met_days * 100 + total_tended` — the primary
term caps at 7 for everyone, so a two-plant newcomer and a twelve-plant
veteran play for the same ceiling and the tiebreak keeps the bigger garden
meaningfully ahead on equal consistency. `care_day_counts()` reconstructs
each day's verdict from `care_logs`, so there is no verdict table, no cron
and no backfill to keep in sync.

A day where nothing was due is a **rest day** — neither scored nor
penalised. That is what stops a cactus-only garden farming easy perfect days.

**`compute_garden_score` is deliberately untouched.** It still powers
`garden_value()` and the all-time Hall of Fame boards, which never reset.
Nothing a player earned is ever taken away — only the *weekly* board, which
always reset by design, changed what it measures.

## Rare variants are alive, not painted on

Variants roll server-side at bloom (`roll_variant`, ~8% base and ~3x that
when `missed_days = 0` — perfect care is what pays). They render in two
places and the split matters:

- **Baked** into the plant texture by `paintVariant()` in `game/plants.ts`,
  for every static context (chips, journal, almanac).
- **Live** in the scene via `syncVariantFx()` / `stepVariantFx()` in
  `game/GardenScene.ts` — haloes, sweeping sheens, dripping beads and
  orbiting motes.

The motes orbit an ellipse and **swap depth as they cross behind the plant**
(`base ± 0.9`), dimming on the far side. Occlusion plus aerial perspective is
the only thing that reads as depth on a flat canvas — that crossover is the
whole trick, so do not flatten it to a single depth.

Anchor everything to `plantHeightPx(form, stage)`. A lily pad and a
sunflower differ threefold in height; a fixed offset leaves the dressing
hanging in the sky above the short ones.

## The hands-on rituals

Clearing a bed, gathering a bloom and sowing a seed are not state changes
with a toast on top — the gardener walks over, kneels, and does them.
`ritual(plotIdx, kind, done)` on the scene (via `bridge.ritual(kind, i)`,
which returns a promise) owns all three, and they deliberately share one
shape — walk, kneel, work, stand — so the garden reads as one place with one
pair of hands in it.

- **The vocabularies must not blur.** Clearing *descends* — 196 → 131/98 →
  88 → 58 Hz, the exact inverse of `comboSplash`'s semitone climb — the
  plant leaves sideways and out of frame, and there is **no closing sound at
  all**, because every other cue in the game is a rising major-key fanfare
  and playing one over a plant being pulled out congratulates the player for
  a loss. Gathering is a win: it rises, sparkles, and the bloom leaves
  upward. Sowing is small and dry and ends on a promise.
- **The mourning is already paid for** by `GonePlantModal`. The scene beat's
  job is continuity — it was there, hands took it away, the bed is level now
  — not a second helping of grief. Hence no camera move and no ghostly
  silhouette of what used to be growing there.
- **Beats are scheduled in wall-clock ms, never frame counts.** Headless
  Chromium renders at ~8fps, where one frame is 125ms.
- **The beats run alongside the request, never in front of it.** They
  decorate a fact the server has already committed, so a slow network shows
  a longer kneel, not a stalled button — and `bridge.ritual` always
  resolves, through a watchdog if it has to. A failed RPC calls
  `cancelRitual()`, which puts the plant back.
- The plant the gardener carries is a **detached ghost** (`takeGhost`), so
  state arriving mid-beat repaints the bed without yanking it out of his
  hands. `refreshPlot` knows to leave the real sprite hidden while a ghost
  is out.
- `prefers-reduced-motion` collapses all three to one fade plus the sound.
  The fact still lands; only the travel goes.
- A Graphics scales about its **own position**, so anything drawn at
  absolute world coordinates flies across the yard when you scale it. Place
  the Graphics at the plot and draw at its origin — that is what `soilPuff`
  and `soilRing` do.

## The turn of the year is weather, not rules

`lib/yearphase.ts` shifts the whole yard through spring, summer, autumn and
winter. It is **deliberately not called a season** — `seasonNumber` already
means the weekly league season, and two meanings of one word is how a league
bug hides in plain sight.

**It gates exactly one thing: which seeds go in the ground.** Four species
carry a `phase` and are only plantable during it — Cherry Blossom (spring),
Lavender (summer), Field Pumpkin (autumn), Snowdrop (winter). They are free;
the calendar is the gate, not the wallet.

The original objection to a calendar lock was that it recreates the "you are
too late" problem the consistency league was rebuilt to remove. That was
overstated: the league ranks `met_days * 100 + total_tended`, whose primary
term caps at 7 for **everyone**, so a newcomer with a perfect week still
beats a veteran with five. A phase lock cannot touch the standings. What it
does touch is *collection* — a player who arrives in November waits for
spring to try the blossom — and that was judged an acceptable price for the
garden feeling like it belongs to a year.

The rules that keep it fair:

- **Nothing already growing is ever affected.** The phase is consulted once,
  at the moment a seed goes in. A pumpkin planted in November finishes in
  December exactly as it would have.
- **Each matures well inside its own phase** (8–14 days against ~90), so
  nobody is handed a plant they cannot finish before the season runs out.
- **`plant_seed` is the authority.** It raises before writing anything, and
  the gate sits *before* the plot-kind and occupancy checks, which is what
  lets the smoke test reach it with plot 0 every time.
- **`unlockedSpecies` means "plantable today"** — an out-of-phase seasonal
  is simply absent from it. That keeps the state document honest for any
  client, including one already loaded in a browser that has never heard of
  phases and would otherwise offer a seed the server is about to refuse.
- The UI still *shows* the four, greyed, with the season they return in.
  Hiding them would mean a player never learns they exist, and finding out
  the garden has four plants you have not seen is most of the pleasure.

- The phase comes from the server: `year_phase(tz, today)` in Postgres,
  shipped as `state.yearPhase`. `lib/yearphase.ts` mirrors the same rule and
  is only a fallback for a state document that predates the field — never
  `new Date()`, which is the browser's idea of the date. Southern-hemisphere
  zones flip it; equatorial ones fall through to northern, where either
  answer is equally wrong.
- One palette drives it. `paintYearTextures()` repaints sky, hills, ground,
  canopy, bush, blades, tufts and wildflowers **in place** — `ctex` reuses
  the canvas behind a key and every Image already points at it, so a phase
  change needs nothing destroyed or re-created. This only works for
  `ctex`-painted textures: `Graphics.generateTexture` refuses a key that
  already exists.
- **The sky belongs to both clocks.** `applyTimeOfDay` repaints it every
  minute, so a seasonal sky painted once is gone before anyone sees it. It
  is *blended* — `0.45 * (1 - nightF)` toward the phase — because a winter
  midnight and a summer midnight are the same sky.
- Summer's palette is the reference: it is exactly the colours the original
  art pass was tuned against, so a summer garden must look untouched.
- Winter wildflowers were the tell. Leaving them in full bloom under snow
  made the whole thing read as a colour filter rather than a season, which
  is why `PhasePalette.flower` exists.
- Blossom, leaf-fall and snow are three separate emitters with their own
  painted textures — they differ in weight and density, not just colour,
  and CANVAS could not tint one shared speck anyway.
- Music follows the phase through `music.suggestMode()`, which **never**
  overrides a player who has chosen a record.

## The garden grows: breaking new ground

Every garden shipped at `plot_count = 4` and **nothing had ever raised it**,
while the scene drew a padlock on plot 5 — a promise the game could not
keep, shown to every player since launch. `break_ground()` is the other half.

- **Two gates, and they are different on purpose.** Dewdrops are what you
  spend; gardener level is what you cannot, because it rises with *lifetime*
  earnings and is never reduced by spending. A hoarder can afford the next
  bed but still has to have shown up for it.
- The level is checked **before** the wallet, so failing it never costs a
  dewdrop, and the wallet row is locked (`select … for update`) like every
  other spend.
- `plot_unlocks(idx, cost, min_level)` holds the ladder: 250 → 2400 across
  plots 5-12, priced against the real earn rate (~4 dewdrops a watering, so
  ~16/day at four plots and ~48/day at twelve). Each bed you buy shortens
  the wait for the next, which is the compounding a property should have.
- `garden_state_json` ships `nextPlot` (or null once the garden is whole —
  "you have it all" is a state the UI has to render).
- **The padlock is now tappable** and routes to the Shop tab. It had been
  drawn and untouchable since launch: the one clear invitation in the scene
  to make the garden bigger did nothing when pressed.
- The `"break"` ritual is the fourth of the hands-on beats, and the only one
  that moves the camera — the new bed is somewhere the gardener has never
  stood. Its ladder **rises** (131 → 196 → 262) where clearing's falls.

## Reward beats: every act of care lands

Nothing a player earns may happen silently.

- **A pour**: splash + drink gulp + wet soil + two burst rings + a camera
  punch that scales with the combo + `comboSplash(n)`, pitched a semitone
  higher per plant in the round.
- **A stage** (a week of somebody's life): soil puff, a spring that
  overshoots and settles elastically, a green ring, and a `Stage N of 7`
  ribbon with pips — because growth you cannot see on the plant still has to
  be felt.
- **A gardener level**: `celebrateLevel()`. This used to happen in total
  silence — the number in the Hall of Fame simply differed next time you
  looked. `applyState` is the single place that can notice, so **every path
  that lands new state must go through it**, never a bare `setState`.
- **Dewdrops**: the `+N` flies to the wallet counter and pulses it
  (`onDewBanked`), so earning and balance read as one event.

## A death has to teach something

The dead card used to say only "Thirteen days without water." — a number
with no contract attached, which teaches nothing, because thirteen days is a
shrug to a cactus and fatal to a fern. `deathStory()` in `lib/plantfacts.ts`
now supplies three things:

- **The cause, in checkable numbers.** "She drank every 2 days. Thirteen days
  went by — 6 drinks missed." Missed *drinks*, not days: a three-day plant
  left six days missed two, not six.
- **One concrete change**, never a vague apology, graded by severity —
  `near` (one day short), `clear`, `long` (four or more drinks missed). Only
  the `long` copy says "this one was avoidable"; saying it to somebody who
  missed by a day would be untrue and unkind.
- **Somewhere to go.** "Get a revival tonic" is a button that opens the Shop
  *and flashes the tonic* (`focusKey` on `ShopPanel`), because sending a
  grieving player to the top of a four-group shop is still making them hunt.
  "Turn on reminders" goes to Profile — the reminder is the actual fix.

**This is the one screen that does not soften.** Granny stays warm and never
scolds, but she is straight about what went wrong. Everywhere else the game
forgives; here it explains.

The prevention side is the seed picker: every card states the commitment
*before* you take it — how often, how long, **how many visits in total**, and
a warning on the species where watering early is what kills them. Most
players used to learn a plant's contract the day it died.

Two alerts about the same death is one too many. `TodayBrief` was deleted:
it and `NextStep` both read `pending_care`'s priority, but only `NextStep`
names a plot and carries a button, so it wins.

## Explaining the plant, not just the rule

`components/PlantCard.tsx` shows the selected plant's contract in plain
words, and `lib/plantfacts.ts` gives the *reason* behind each rule plus a
true botanical aside. A care contract a player understands is one they can
plan around.

The overwater warning arrives **before** the action, never as a toast after
it. Tapping a plant that cannot drink only selects it, and `WaterFab` routes
to a plant that can — so the UI cannot rot a cactus. The card explains why
the button is pointing elsewhere.

## The landing page shows the journey, not just the destination

`components/GrowthJourney.tsx` sits directly above the Showcase: two
vignettes side by side, day one and day ninety, painted with the game's own
`paintGardenCard` so they cannot drift from what the game looks like.

- **The empty panel is what gives the full one meaning.** A picture of a
  finished garden on its own is a nice drawing that says nothing about where
  it came from. The contrast is the message.
- **They never stack.** Side by side at every width, shrinking together —
  stacked, you scroll from one to the other and compare from memory, which
  is the one thing this section exists to avoid. The empty panel gives up
  more width than the full one, because it has less to show.
- **Honest about the cost.** The ninety days are named, not hidden, so
  nobody arrives expecting the garden to show up fully grown.
- **It is an illustration, and must never be mistaken for a real garden.**
  The Showcase immediately below is where real players' gardens live. Do not
  blur those two.
The two journey panels pass `lush`, and **nothing else does** — `GardenCard`
(real players' showcase postcards) and `HeroGarden` render byte-identical to
before, verified by screenshotting a card either side of the change. It is a
separate painter rather than more flags threaded through the old one, because
the composition differs in kind:

- **The horizon is high.** The old card gave 56% of the frame to empty sky.
- **The fence stands ON the ground line.** It used to be painted *above* the
  horizon, hanging in the sky, which is most of why the top of the card read
  as detached from the garden. A flowering hedge fills the strip beneath it.
- **Plants live in beds, not in rows.** Twelve plants spaced evenly across a
  lawn read as twelve objects; four beds at three distances read as a garden
  somebody laid out. Tallest species go to the farthest beds — that is how a
  border is actually planted, and it stops the near row hiding the far one.
- **Beds are underplanted** (`groundCover`). Three plants on a bare brown
  ellipse read as a hole in the lawn. The day-one bed is the deliberate
  exception: turned earth and one sprout, because handing a newcomer a full
  bed destroys the contrast the pair of pictures exists to draw.
- **Everything casts a contact shadow**, sized from `plantHeightPx` rather
  than from the sprite scale — a sprout and a sunflower at the same scale do
  not cast the same shadow. This is the single biggest "pasted on" fix.
- **One light direction** (warm from the upper left, cool into the lower
  right) plus an aerial-haze band at the horizon. Size falloff alone does not
  read as depth.
- **The lily is the hero.** The game is called Lily Days and the namesake used
  to be a half-inch speck at the back of the pond. She is now front of the
  water, the largest single plant in the picture, with the light gathered
  behind her — and day one is a lily pad, not somebody else's seedling.

- `paintGardenCard` takes `{ dense, plantScale }`: `dense` raises the 3+4
  plant cap and splits land plants into staggered back and front rows for
  the big panel; `plantScale` exists because a lone stage-1 sprout was a
  speck in a 420x300 frame, and scaling it also has to lift the row, since
  plants grow downward from their baseline and it fell off the bottom edge.

### The seasonal banner

`components/SeasonalBanner.tsx` is the four calendar plants shown in the
weather that lets you sow them — the picker above can only say "Spring only"
in a chip, which undersells the one genuinely nice thing about them.

- It paints from the **same `PHASE_PALETTE` the real scene uses**, so a spring
  banner cannot drift from what a spring garden actually looks like in game.
- **The seasons melt, they do not cut.** Every palette colour is interpolated
  across the handover and the outgoing plant fades down as the incoming one
  grows in. Four cuts read as four pictures; the melt reads as one garden with
  a year going past, which is the whole point.
- **Last season's weather has to be cleared, not left to fall.** A petal takes
  nine seconds to cross the frame, so spring was still snowing pink through
  autumn. Wrong-kind drops fade out over ~600ms.
- Summer's palette has `drift: null` — the scene has nothing falling in
  summer — but a still summer beside three moving seasons looks broken, so the
  banner gives it golden pollen motes that rise instead of fall. Same reason
  `BLOOM` exists: the palette leaves `flower` null for spring and summer.
- `prefers-reduced-motion` keeps the pictures and the tabs and drops the loop,
  the drift and the auto-advance.
- On a phone the caption moves **below** the canvas. Overlaid on a 5:3 frame it
  covered the sky and most of the treeline.

## Funnel analytics

The landing page had been rebuilt several times with **no way to tell whether
any of it worked** — no analytics package, nothing in the layout, Vercel Web
Analytics not enabled, no events table. The back half was recoverable
(everything carries `created_at`) but had never been queried.

- **Front half — Vercel Web Analytics.** `<Analytics />` in `app/layout.tsx`.
  It is cookieless and needs no consent banner, **and it stays that way only
  while nothing sent from `lib/analytics.ts` carries personal data.** Never
  pass an email, display name or user id; every payload is a bounded set of
  literals chosen in advance (which section, which species key, which season).
  That rule is the reason the file exists instead of `track()` being called
  ad hoc from a dozen components. **It requires the toggle in the Vercel
  dashboard** — without it the script 404s and every event is dropped.
- **Events sent before the beacon exists must be buffered.** `track()` hands
  off to `window.va`, which `<Analytics>` installs from its own effect, and
  effects run parent-last — so the FIRST section on the page marks itself
  before the beacon is there and the event vanishes with no error. That lost
  the hero view, which every visitor triggers, and would have made the top of
  the funnel look emptier than the sections below it. `send()` queues and
  flushes once `window.va` appears.
- **`SectionMark` tests overlap with the middle half of the viewport**
  (`rootMargin: -25%`), not a threshold fraction: `#plants` is over 2000px
  tall and 40% of it never fits on an 844px phone, so a threshold would have
  made the tallest sections look like the ones nobody reaches. It disconnects
  on the first hit, or scrolling back up would re-fire it.
- **Back half — `supabase/queries/funnel.sql`.** Activation and retention
  reconstructed from `profiles`, `plants` and `care_logs`. Read-only, no
  instrumentation, no new tables.

## Panels: one job per tab

The pull-up sheet had all seven panels stacked under **Garden** and nobody
could tell which one wanted them. The split is by *what the player is
doing*, not by what the feature is:

- **Garden** — only what you act on now: `TodayBrief`, `WeeklyGift`,
  `NextStep`, `PlantCard`, `PlotBar`.
- **Shop** — everything that spends dewdrops on things: `ShopPanel`,
  `DecorBar`, `RestorePanel`.
- **Profile** — you: `LevelBar` then `ProfilePanel`.
- **League** — `Leaderboard`.

Resist adding a sixth thing to Garden. If it is not an action available
right now, it belongs in another tab.

## Gardener level has to explain itself

Level rises with **lifetime** dewdrops (`gardener_level(le) =
floor(sqrt(le / 40)) + 1`), never reduced by spending — it is a record of
care given, which is why it can gate scenery without making it purchasable.
Rungs: L2=40, L3=160, L4=360, L5=640, L6=1000, L7=1440 (`level_floor()`).

`garden_state_json` ships `lifetimeEarned`, `levelFloor` and `nextLevelAt`
so `components/LevelBar.tsx` can draw a real bar and name the next unlock.
A locked restoration zone shows its fixtures in silhouette and the distance
in dewdrops — a padlock with a bare level number gives the player nothing
to want.

## Audio only survives if you keep asking

`music.start()` is safe to call repeatedly and must stay that way. iOS
suspends the AudioContext whenever the tab is backgrounded or the phone
locks and never resumes it on its own, so the gesture listener spans
several event types, keeps listening until `music.playing` is true, and
re-fires on `visibilitychange`. A single `once: true` listener silently
lost the music the first time somebody pocketed their phone.

`resume()` is async: anchor the schedule only *after* the context is
running, or every event lands in a `currentTime` still frozen at the moment
of suspension. And watch the master gain — 0.055 was a loop running
perfectly that nobody could hear.

## Email nudges: fail loudly, and keep the history honest

`build_nudges()` (hourly, pg_cron) writes rows to `notification_queue`;
the `send-nudges` edge function drains them through Resend. Secrets:
`RESEND_API_KEY`, `NUDGE_FROM` (a real address on a verified domain),
optional `NUDGE_REPLY_TO`.

This system queued warnings for two weeks and delivered none, and a
player's whole garden died un-warned, because `RESEND_API_KEY` was unset
and the function answered **HTTP 200** anyway. pg_cron logged 3456
consecutive "successes". Hence the rules:

- **A queue with no key is 503, not 200.** Every send failing is 502.
  `net._http_response` is the only place this is visible, so the status
  code has to carry the truth. `pg_cron` reporting success means the
  *request* was made, never that mail moved.
- **One bad env var may not stop delivery.** `NUDGE_FROM` is validated and
  falls back to a known-good sender; an invalid one warns rather than
  failing the batch. A key once landed in that field and 422'd every
  message.
- **Never echo a rejected config value.** That warning copied the pasted
  API key into the response log every five minutes. Describe the shape
  ("what looks like an API key"), never the value.
- **Nudges expire.** `expire_stale_nudges(2)` runs before every build. A
  watering reminder is only true on the day it was built; a two-day-old
  "won't last the night" about a plant that already died is worse than
  silence.
- **Retire, do not delete.** An undelivered row is marked `sent_at` with a
  `send_error` saying why (`expired: ... never delivered`). Only rows with
  `sent_at` *and* a null `send_error` were genuinely emailed — keep that
  distinction true, so the table never claims to have told someone
  something it did not.

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

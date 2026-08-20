-- ============================================================
-- Phase 02 — The shop
--
-- Dewdrops are earned only by tending. Nothing is purchasable with money, and
-- plots stay milestone-only, so spending never buys an advantage — it buys
-- *more to look after*. The four free species remain fully playable without
-- ever opening the shop.
--
-- Applied remotely as `shop_and_inventory` + `feeding_and_pruning_need_items`.
-- ============================================================

create table if not exists public.shop_items (
  key        text primary key,
  name       text not null,
  blurb      text not null,
  kind       text not null check (kind in ('species','consumable','tool')),
  species_id smallint references public.species(id),
  cost       int not null check (cost > 0),
  max_qty    int,                        -- null = stackable without limit
  sort       int not null default 0
);

insert into public.shop_items (key, name, blurb, kind, species_id, cost, max_qty, sort) values
  ('fertilizer','Fertilizer','A scoop of rich compost. Hungry plants need one per feeding.',
    'consumable', null, 60, null, 10),
  ('shears','Pruning Shears','A good sharp pair, bought once and kept forever. Required to prune.',
    'tool', null, 400, 1, 20),
  ('tonic','Revival Tonic','Brings one plant back from the dead. Use it before you clear the plot.',
    'consumable', null, 250, null, 30),
  ('seed_moonflower','Moonflower Seeds','Unlocks the Moonflower — opens after dusk.',
    'species', 5, 500, 1, 40),
  ('seed_tomato','Tomato Seeds','Unlocks the Heirloom Tomato — thirsty and hungry.',
    'species', 6, 700, 1, 50),
  ('seed_orchid','Ghost Orchid Seeds','Unlocks the Ghost Orchid — shade, patience, four feedings.',
    'species', 7, 1400, 1, 60),
  ('seed_bonsai','Bonsai Cutting','Unlocks the Bonsai Pine — a month of care and four prunings.',
    'species', 8, 2500, 1, 70)
on conflict (key) do update set
  name = excluded.name, blurb = excluded.blurb, kind = excluded.kind,
  species_id = excluded.species_id, cost = excluded.cost,
  max_qty = excluded.max_qty, sort = excluded.sort;

alter table public.shop_items enable row level security;
drop policy if exists "shop_items_read" on public.shop_items;
create policy "shop_items_read" on public.shop_items for select to authenticated using (true);

-- Functions (bodies applied remotely):
--   buy_item(text, int)   spends dewdrops under a wallet row lock; grants a
--                         species unlock or stacks an inventory item. Rejects
--                         duplicates, over-cap tools and absurd quantities.
--   get_shop()            catalogue with owned counts and affordability
--   revive_plant(int)     consumes a Revival Tonic to undo a death
--   tend_plant(...)       'feed' now consumes a Fertilizer, 'prune' requires
--                         Shears; both return status 'no_item' when missing
--   garden_state_json     now carries inventory and gardener level

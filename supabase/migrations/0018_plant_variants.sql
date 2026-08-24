-- ============================================================
-- Rare variants, rolled at bloom.
--
-- Cosmetic only and never purchasable. The odds are EARNED: a plant brought
-- to bloom without a single missed day is ~3x likelier to turn out special
-- (24% vs 8%, measured at 2.85x over 4000 rolls each). Perfect care pays off
-- in the collection, which is the same thesis the league now runs on.
--
-- Applied remotely as migrations `plant_variants` and `variant_in_state`.
-- Following the convention of 0004/0009, the two long function bodies that
-- were re-created are described rather than duplicated:
--
--   tend_plant   — unchanged except the bloom branch, which now rolls
--                  `roll_variant(v_plant.missed_days = 0)` and stores it on
--                  the plant, and the return value, which carries 'variant'
--   clear_plot   — unchanged except completed_lilies now records the variant
--
-- ============================================================

alter table public.plants
  add column if not exists variant text;
alter table public.completed_lilies
  add column if not exists variant text;

-- Weighted pick. Rarity rises left to right; `v_lucky` widens the window for
-- a flawlessly grown plant instead of changing which variants exist.
create or replace function public.roll_variant(v_lucky boolean)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_chance numeric := case when v_lucky then 0.24 else 0.08 end;
  v_r numeric;
begin
  if random() >= v_chance then return null; end if;
  v_r := random();
  if    v_r < 0.42 then return 'dewkissed';
  elsif v_r < 0.72 then return 'variegated';
  elsif v_r < 0.92 then return 'moonlit';
  else                  return 'golden';
  end if;
end $$;

revoke all on function public.roll_variant(boolean) from public, anon, authenticated;

create or replace function public.plant_json(p public.plants, s public.species, v_today date)
returns jsonb language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'plotIdx', p.plot_idx,
    'species', s.key,
    'stage', p.stage,
    'growth', p.growth,
    'watersNeeded', s.matures_days,
    'feedsDone', p.feeds_done,
    'prunesDone', p.prunes_done,
    'plantedOn', p.planted_on,
    'lastCareOn', p.last_care_on,
    'dayNumber', (v_today - p.planted_on) + 1,
    'overdueDays', overdue_days(p, s, v_today),
    'thirsty', p.last_care_on is null or (v_today - p.last_care_on) >= s.cadence_days,
    'wilted', overdue_days(p, s, v_today) > 0,
    'health', greatest(0, 1 - 0.25 * overdue_days(p, s, v_today)),
    'dead', p.died_on is not null,
    'isBloomed', p.is_bloomed,
    'variant', p.variant,
    'streak', p.streak
  )
$$;

-- which variants a gardener has ever brought in, for the almanac
create or replace function public.get_variant_collection()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(distinct v), '[]'::jsonb)
  from (
    select variant as v from completed_lilies
      where user_id = auth.uid() and variant is not null
    union
    select variant from plants
      where user_id = auth.uid() and variant is not null
  ) x
$$;

grant execute on function public.get_variant_collection() to authenticated;

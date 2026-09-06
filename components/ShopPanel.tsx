"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { GardenState, ShopItem, ShopState } from "@/lib/types";
import { SPECIES_BY_KEY, careSummary } from "@/lib/species";
import PlantIcon from "./PlantIcon";
import { Droplets, Nut, Scissors, FlaskConical, Gift, Check, Store } from "lucide-react";

const ITEM_ART = { fertilizer: Nut, shears: Scissors, tonic: FlaskConical } as const;

/** Why this item is worth saving for — shown while it's out of reach. */
const ITEM_WHY: Record<string, string> = {
  fertilizer: "Needed to feed the Tomato and the Ghost Orchid.",
  shears: "Needed to prune the Bonsai Pine. Bought once, kept forever.",
  tonic: "Undoes a death. The best insurance in the shed.",
};

/** Rough dewdrops a day of honest tending brings in. */
const DEW_PER_DAY = 25;

export default function ShopPanel({
  state,
  onBought,
  showToast,
  focusKey,
  onFocused,
}: {
  state: GardenState;
  onBought: (s: GardenState) => void;
  showToast: (m: string) => void;
  /**
   * An item to scroll to and flash on arrival. A dead plant says "get a
   * revival tonic" and then sends you here — landing at the top of a shop
   * with four groups and thirteen items is still making you hunt.
   */
  focusKey?: string | null;
  onFocused?: () => void;
}) {
  const [shop, setShop] = useState<ShopState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("get_shop");
    if (data) setShop(data as ShopState);
  }, []);

  useEffect(() => { void load(); }, [load, state.dewdrops]);

  const buy = async (item: ShopItem, qty = 1) => {
    setBusy(item.key);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("buy_item", { p_key: item.key, p_qty: qty });
    setBusy(null);
    if (error) {
      showToast(error.message);
      return;
    }
    const res = data as { name: string; spent: number; state: GardenState };
    onBought(res.state);
    showToast(`${res.name} is yours — ${res.spent} dewdrops well spent. 🌿`);
    void load();
  };

  /**
   * Scroll to and flash the item a dead plant sent the player here to find.
   *
   * This MUST sit above the `if (!shop)` early return below. Hooks run in
   * order on every render, and placing it after the return meant the first
   * render (shop still null) ran three hooks and the next ran four — which
   * is "Rendered more hooks than during the previous render", and it took
   * the whole Shop tab down with a client-side exception.
   */
  useEffect(() => {
    if (!focusKey || !shop) return;
    const el = document.querySelector(`[data-shop-key="${focusKey}"]`) as HTMLElement | null;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    el.classList.remove("shop-lookhere");
    void el.offsetWidth; // reflow, so the flash replays on a repeat visit
    el.classList.add("shop-lookhere");
    onFocused?.();
  }, [focusKey, shop, onFocused]);

  if (!shop) return <p className="gallery-empty">Opening the potting shed…</p>;

  const groups: Array<{ title: string; note: string; kinds: ShopItem["kind"][] }> = [
    { title: "Supplies", note: "Only the trickier species need these.", kinds: ["consumable", "tool"] },
    { title: "New species", note: "Each one is a different daily commitment. Buy what you can keep up with.", kinds: ["species"] },
  ];

  return (
    <div className="shop">
      <div className="shop-head">
        <h3><Store size={18} strokeWidth={2.4} aria-hidden /> Potting Shed</h3>
        <span className="purse"><Droplets size={15} strokeWidth={2.5} aria-hidden /> {shop.dewdrops} dewdrops</span>
      </div>
      <p className="shop-note">
        Everything here is bought with dewdrops you earned by tending. There is nothing to
        buy with real money — not a single thing, ever. New beds are earned the same way:
        dewdrops you saved, plus a gardener level you cannot buy.
      </p>

      {groups.map((g) => (
        <div key={g.title} className="shop-group">
          <h4>{g.title} <span>{g.note}</span></h4>
          <div className="shop-grid">
            {shop.items.filter((i) => g.kinds.includes(i.kind)).map((item) => {
              const sp = item.species ? SPECIES_BY_KEY[item.species] : null;
              const maxed = item.maxQty !== null && item.owned >= item.maxQty;
              return (
                <div key={item.key} data-shop-key={item.key}
                     className={`shop-card ${maxed ? "owned" : ""}`}>
                  <div className="shop-art">
                    {sp ? (
                      <PlantIcon species={sp} stage={6} size={70} />
                    ) : (
                      (() => {
                        const I = ITEM_ART[item.key as keyof typeof ITEM_ART] ?? Gift;
                        return <I size={30} strokeWidth={1.8} className="shop-item-icon" aria-hidden />;
                      })()
                    )}
                  </div>
                  <h5>{item.name}</h5>
                  {sp && <p className="seed-care">{careSummary(sp)}</p>}
                  <p className="shop-blurb">{item.blurb}</p>
                  {!maxed && !item.affordable && (
                    <div className="shop-progress">
                      <div className="sp-bar">
                        <div style={{ width: `${Math.min(100, (shop.dewdrops / item.cost) * 100)}%` }} />
                      </div>
                      <span className="sp-note">
                        {item.cost - shop.dewdrops} to go — about{" "}
                        {Math.max(1, Math.ceil((item.cost - shop.dewdrops) / DEW_PER_DAY))} day
                        {Math.ceil((item.cost - shop.dewdrops) / DEW_PER_DAY) === 1 ? "" : "s"} of tending
                      </span>
                      {ITEM_WHY[item.key] && <span className="sp-why">{ITEM_WHY[item.key]}</span>}
                    </div>
                  )}
                  <div className="shop-foot">
                    {maxed ? (
                      <span className="shop-owned">
                        <Check size={14} strokeWidth={3} aria-hidden /> {item.kind === "species" ? "Unlocked" : "Owned"}
                      </span>
                    ) : (
                      <>
                        <span className="shop-cost"><Droplets size={13} strokeWidth={2.6} aria-hidden /> {item.cost}</span>
                        <button
                          className={`btn small${item.affordable ? "" : " dim"}`}
                          disabled={!item.affordable || busy === item.key}
                          onClick={() => buy(item)}
                        >
                          {busy === item.key ? "…" : item.affordable ? "Buy" : "Saving up"}
                        </button>
                      </>
                    )}
                  </div>
                  {item.kind === "consumable" && item.owned > 0 && (
                    <span className="shop-have">you have {item.owned}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

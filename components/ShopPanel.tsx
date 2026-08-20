"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { GardenState, ShopItem, ShopState } from "@/lib/types";
import { SPECIES_BY_KEY, careSummary } from "@/lib/species";
import PlantIcon from "./PlantIcon";

const ITEM_ART: Record<string, string> = {
  fertilizer: "🌰",
  shears: "✂️",
  tonic: "🧪",
};

export default function ShopPanel({
  state,
  onBought,
  showToast,
}: {
  state: GardenState;
  onBought: (s: GardenState) => void;
  showToast: (m: string) => void;
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
    showToast(`Bought ${res.name} for ${res.spent} 💧`);
    void load();
  };

  if (!shop) return <p className="gallery-empty">Opening the potting shed…</p>;

  const groups: Array<{ title: string; note: string; kinds: ShopItem["kind"][] }> = [
    { title: "Supplies", note: "Only the trickier species need these.", kinds: ["consumable", "tool"] },
    { title: "New species", note: "Each one is a different daily commitment. Buy what you can keep up with.", kinds: ["species"] },
  ];

  return (
    <div className="shop">
      <div className="shop-head">
        <h3>🛒 Potting Shed</h3>
        <span className="purse">💧 {shop.dewdrops} dewdrops</span>
      </div>
      <p className="shop-note">
        Everything here is bought with dewdrops you earned by tending. There is nothing to
        buy with real money, and plots are never for sale — they come from milestones.
      </p>

      {groups.map((g) => (
        <div key={g.title} className="shop-group">
          <h4>{g.title} <span>{g.note}</span></h4>
          <div className="shop-grid">
            {shop.items.filter((i) => g.kinds.includes(i.kind)).map((item) => {
              const sp = item.species ? SPECIES_BY_KEY[item.species] : null;
              const maxed = item.maxQty !== null && item.owned >= item.maxQty;
              return (
                <div key={item.key} className={`shop-card ${maxed ? "owned" : ""}`}>
                  <div className="shop-art">
                    {sp ? <PlantIcon species={sp} stage={6} size={50} />
                        : <span className="shop-emoji">{ITEM_ART[item.key] ?? "🎁"}</span>}
                  </div>
                  <h5>{item.name}</h5>
                  {sp && <p className="seed-care">{careSummary(sp)}</p>}
                  <p className="shop-blurb">{item.blurb}</p>
                  <div className="shop-foot">
                    {maxed ? (
                      <span className="shop-owned">
                        {item.kind === "species" ? "✓ Unlocked" : "✓ Owned"}
                      </span>
                    ) : (
                      <>
                        <span className="shop-cost">💧 {item.cost}</span>
                        <button
                          className="btn small"
                          disabled={!item.affordable || busy === item.key}
                          onClick={() => buy(item)}
                        >
                          {busy === item.key ? "…" : item.affordable ? "Buy" : "Too pricey"}
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

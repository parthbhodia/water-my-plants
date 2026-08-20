"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { GardenState } from "@/lib/types";
import { DECOR_NAMES } from "@/game/decor";

const ART: Record<string, string> = {
  decor_lantern: "🏮",
  decor_bench: "🪑",
  decor_birdbath: "⛲",
  decor_koi: "🐟",
  decor_gnome: "🧙",
  decor_arch: "🌹",
};

/** Owned ornaments, and the eight spots they can stand in. */
export default function DecorBar({
  state,
  onState,
  showToast,
}: {
  state: GardenState;
  onState: (s: GardenState) => void;
  showToast: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const owned = Object.keys(state.inventory ?? {}).filter(
    (k) => k.startsWith("decor_") && (state.inventory[k] ?? 0) > 0
  );
  const placed = state.decor ?? {};
  const slotOf = (item: string) =>
    Object.entries(placed).find(([, v]) => v === item)?.[0];

  if (owned.length === 0) return null;

  const put = async (slot: number, item: string | null) => {
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("place_decor", {
      p_slot: slot,
      p_item: item,
    });
    setBusy(false);
    if (error) { showToast(error.message); return; }
    onState(data as GardenState);
    setPicked(null);
  };

  return (
    <div className="decor-bar">
      <div className="decor-owned">
        <span className="decor-label">Ornaments</span>
        {owned.map((k) => (
          <button
            key={k}
            className={`decor-chip ${picked === k ? "sel" : ""} ${slotOf(k) ? "out" : ""}`}
            onClick={() => setPicked(picked === k ? null : k)}
            title={DECOR_NAMES[k] ?? k}
          >
            {ART[k] ?? "🎁"}
          </button>
        ))}
      </div>

      {picked && (
        <div className="decor-slots">
          <span className="decor-label">
            Put the {DECOR_NAMES[picked]} where?
          </span>
          {Array.from({ length: 8 }, (_, i) => (
            <button
              key={i}
              className={`decor-slot ${placed[String(i)] ? "taken" : ""}`}
              disabled={busy}
              onClick={() => put(i, picked)}
            >
              {i + 1}
            </button>
          ))}
          {slotOf(picked) && (
            <button
              className="btn ghost small"
              disabled={busy}
              onClick={() => put(Number(slotOf(picked)), null)}
            >
              Put away
            </button>
          )}
        </div>
      )}
    </div>
  );
}

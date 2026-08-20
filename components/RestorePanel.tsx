"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { sfx } from "@/game/audio";
import { Amphora, TreeDeciduous, Landmark, Flower2, Lock, Leaf, Check, Droplets } from "lucide-react";
import type { GardenState } from "@/lib/types";

const FIXTURE_ICON = {
  fountain: Amphora, swing: TreeDeciduous, well: Landmark, arch: Flower2,
} as const;

/**
 * The long game: overgrown corners of the meadow, restored piece by piece
 * with dewdrops. Purely earned — restoration never touches the care loop.
 */
export default function RestorePanel({
  state,
  onState,
  showToast,
}: {
  state: GardenState;
  onState: (s: GardenState) => void;
  showToast: (msg: string, ms?: number, mood?: "happy" | "cheer" | "worry" | "proud" | "sleepy") => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const zones = state.zones ?? [];
  if (zones.length === 0) return null;

  const restore = async (key: string, name: string) => {
    if (busy) return;
    setBusy(key);
    sfx.click();
    const { data, error } = await createClient().rpc("restore_fixture", { p_key: key });
    setBusy(null);
    if (error) {
      showToast(error.message, 5600, "worry");
      return;
    }
    const r = data as { state?: GardenState };
    if (r.state) onState(r.state);
    sfx.bloom();
    showToast(`The ${name.toLowerCase()} is whole again. The garden remembers. ✨`, 6500, "proud");
  };

  return (
    <div className="restore-bar">
      <div className="restore-head">
        <span className="decor-label">Restoration</span>
        <span className="restore-sub">Bring the old meadow back, piece by piece</span>
      </div>
      {zones.map((z) => (
        <div className={`restore-zone${z.unlocked ? "" : " locked"}`} key={z.key}>
          <div className="restore-zone-head">
            <b>
              {z.unlocked
                ? <Leaf size={14} strokeWidth={2.4} aria-hidden />
                : <Lock size={14} strokeWidth={2.4} aria-hidden />}{" "}
              {z.name}
            </b>
            <span>
              {z.unlocked
                ? z.blurb
                : `Opens at gardener level ${z.minLevel} — you are level ${state.level}.`}
            </span>
          </div>
          {z.unlocked && (
            <div className="restore-row">
              {z.fixtures.map((f) => (
                <div className={`restore-card${f.restored ? " done" : ""}`} key={f.key}>
                  <span className="restore-icon" aria-hidden>
                    {(() => {
                      const I = FIXTURE_ICON[f.key as keyof typeof FIXTURE_ICON] ?? Landmark;
                      return <I size={22} strokeWidth={2} />;
                    })()}
                  </span>
                  <div className="restore-meta">
                    <b>{f.name}</b>
                    <span>{f.restored ? "Restored — it suits the place." : f.blurb}</span>
                  </div>
                  {f.restored ? (
                    <span className="restore-done"><Check size={17} strokeWidth={3} aria-hidden /></span>
                  ) : (
                    <button
                      className={`btn small${state.dewdrops < f.cost ? " dim" : ""}`}
                      disabled={busy !== null}
                      onClick={() => restore(f.key, f.name)}
                    >
                      <Droplets size={14} strokeWidth={2.6} aria-hidden /> {f.cost}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

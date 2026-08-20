"use client";

import { useEffect, useState } from "react";
import { Droplets, Nut, FlaskConical, Gift } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { sfx } from "@/game/audio";
import { GUIDE_NAME } from "@/game/guide";
import type { GardenState } from "@/lib/types";
import GuidePortrait from "./GuidePortrait";

type GiftOption = { key: string; name: string; blurb: string };
type GiftState = { weekStart: string; claimed: boolean; options: GiftOption[] };

const OPTION_ICON = { dew: Droplets, fertilizer: Nut, tonic: FlaskConical } as const;

/**
 * Granny's basket: one free pick per local week. Once claimed it stays
 * out of the way until the next week begins.
 */
export default function WeeklyGift({
  refreshKey,
  onState,
  showToast,
  preview,
}: {
  refreshKey: number;
  onState: (s: GardenState) => void;
  showToast: (msg: string, ms?: number, mood?: "happy" | "cheer" | "worry" | "proud" | "sleepy") => void;
  /** Render from fixed data instead of the RPC (dev fixtures only). */
  preview?: GiftState;
}) {
  const [gift, setGift] = useState<GiftState | null>(preview ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (preview) return;
    createClient().rpc("get_weekly_gift").then(({ data }) => {
      if (data) setGift(data as GiftState);
    });
  }, [refreshKey, preview]);

  if (!gift || gift.claimed) return null;

  const claim = async (key: string) => {
    if (busy) return;
    setBusy(true);
    sfx.click();
    const { data, error } = await createClient().rpc("claim_weekly_gift", { p_choice: key });
    setBusy(false);
    if (error) {
      showToast(error.message, 5600, "worry");
      return;
    }
    const r = data as { state?: GardenState };
    setGift({ ...gift, claimed: true });
    if (r.state) onState(r.state);
    sfx.grow();
    showToast("Take it, dear — you earn the rest yourself. Now stay a moment; the garden is lovely today. 🧺", 6500, "cheer");
  };

  return (
    <div className="gift-bar">
      <div className="gift-head">
        <GuidePortrait mood="cheer" size={46} />
        <div className="gift-title">
          <b><Gift size={14} strokeWidth={2.6} aria-hidden /> {GUIDE_NAME}&rsquo;s weekly basket</b>
          <span>Pick one — the basket refills every Monday.</span>
        </div>
      </div>
      <div className="gift-options">
        {gift.options.map((o) => {
          const Icon = OPTION_ICON[o.key as keyof typeof OPTION_ICON] ?? Gift;
          return (
            <button className="gift-card" key={o.key} disabled={busy} onClick={() => claim(o.key)}>
              <Icon size={22} strokeWidth={2} aria-hidden />
              <b>{o.name}</b>
              <span>{o.blurb}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Droplets, Flower2, Hourglass, Leaf, CircleAlert, Skull } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { TodayBrief as Brief } from "@/lib/types";

const ICON: Record<string, typeof Leaf> = {
  dead: Skull,
  dying: CircleAlert,
  window: Hourglass,
  thirsty: Droplets,
  harvest: Flower2,
};


/**
 * The same decision the reminder email uses, shown in-app the moment you
 * arrive — so the nudge is useful even for players who never enable email.
 */
export default function TodayBrief({ refreshKey }: { refreshKey: number }) {
  const [brief, setBrief] = useState<Brief | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("get_today_brief");
    if (data) setBrief(data as Brief);
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);


  // A finished task must leave the screen. This card used to render an
  // "Everything is tended" state that sat there forever — directly beneath
  // NextStep's own "Everything is tended", so the player was told twice, in
  // near-identical words, that there was nothing to tell them.
  if (!brief?.need) return null;
  const Icon = ICON[brief.need.kind] ?? Leaf;

  return (
    <div className="brief">
      <div className={`brief-main k-${brief.need.kind}`}>
        <span className="brief-icon"><Icon size={24} strokeWidth={2.4} aria-hidden /></span>
        <div className="brief-text">
          <b>{brief.need.title}</b>
          <span>{brief.need.body}</span>
        </div>
      </div>

    </div>
  );
}

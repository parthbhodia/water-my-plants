"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { ShowcaseGarden } from "@/lib/types";
import GardenCard from "./GardenCard";
import SectionMark from "./SectionMark";

/** Real gardens on the landing page — proof rather than promise. */
export default function Showcase() {
  const [gardens, setGardens] = useState<ShowcaseGarden[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("get_showcase", { p_limit: 3 }).then(({ data }) => {
      setGardens((data as ShowcaseGarden[]) ?? []);
    });
  }, []);

  if (!gardens || gardens.length === 0) return null;

  return (
    <section className="showcase">
      <SectionMark section="showcase" />
      <h2>Gardens growing right now</h2>
      <p className="showcase-sub">
        Every one of these belongs to a real gardener who showed up day after day.
        Yours starts as a single seed.
      </p>
      <div className="showcase-row">
        {gardens.map((g) => <GardenCard key={g.name} g={g} />)}
      </div>
    </section>
  );
}

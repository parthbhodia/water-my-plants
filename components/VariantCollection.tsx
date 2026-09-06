"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { VARIANTS } from "@/lib/variants";
import PlantIcon from "./PlantIcon";

/**
 * Which rare variants this gardener has brought in. Found ones show the real
 * painter output; the rest stay silhouetted, so the shelf has visible gaps.
 */
export default function VariantCollection() {
  const [found, setFound] = useState<string[] | null>(null);

  useEffect(() => {
    createClient().rpc("get_variant_collection").then(({ data }) => {
      setFound((data as string[]) ?? []);
    });
  }, []);

  if (found === null) return null;

  return (
    <div className="variants">
      <h3>Rare variants</h3>
      <p className="hof-hint">
        Rolled when a plant reaches full bloom. Bring one in without missing a single day and the
        odds roughly triple — they are never for sale.
      </p>
      <div className="variant-row">
        {VARIANTS.map((v) => {
          const has = found.includes(v.key);
          return (
            <div className={`variant-card${has ? " found" : ""}`} key={v.key}>
              <span className="vc-art" aria-hidden>
                {has
                  ? <PlantIcon species="lily" stage={6} size={72} variant={v.key} />
                  : <Lock size={22} strokeWidth={2.2} />}
              </span>
              <b>{has ? v.name : "???"}</b>
              <span className="vc-rarity">{v.rarity}</span>
              {has && <span className="vc-blurb">{v.blurb}</span>}
            </div>
          );
        })}
      </div>
      <p className="vc-count">{found.length} of {VARIANTS.length} found</p>
    </div>
  );
}

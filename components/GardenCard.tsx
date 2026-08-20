"use client";

import { useEffect, useRef } from "react";
import { paintGardenCard } from "@/game/scenecard";
import type { ShowcaseGarden } from "@/lib/types";
import AvatarPreview from "./AvatarPreview";

/**
 * A real player's garden, painted with the same code the game uses — so the
 * landing page shows what people have actually grown, not a mockup.
 */
export default function GardenCard({ g }: { g: ShowcaseGarden }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const W = 380, H = 210;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = "100%"; cv.style.aspectRatio = `${W} / ${H}`;
    const c = cv.getContext("2d");
    if (!c) return;
    c.scale(dpr, dpr);
    paintGardenCard(c, W, H, g.plants, g.decor ?? [], g.name);
  }, [g]);

  return (
    <figure className="garden-card">
      <canvas ref={ref} aria-label={`${g.name}'s garden`} />
      <figcaption>
        <span className="gc-av"><AvatarPreview avatar={g.avatar} size={38} /></span>
        <span className="gc-meta">
          <b>{g.name}</b>
          <span>
            Lv {g.level} · {g.blooms} bloom{g.blooms === 1 ? "" : "s"} · tending{" "}
            {g.daysTending} day{g.daysTending === 1 ? "" : "s"}
          </span>
        </span>
        <span className="gc-value">{g.value}</span>
      </figcaption>
    </figure>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { SPECIES_BY_KEY } from "@/lib/species";
import { drawPlant } from "@/game/plants";
import { lg, rgrad, ell, blob } from "@/game/draw";
import type { ShowcaseGarden } from "@/lib/types";
import AvatarPreview from "./AvatarPreview";

const POND_WOB = [0.05, -0.03, 0.045, 0.02, -0.045, 0.035, -0.02, 0.05, -0.035, 0.025];

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

    // sky + ground
    c.fillStyle = lg(c, 0, 0, 0, H, [[0, "#a5d8f0"], [0.55, "#cfeade"], [1, "#bfe4c2"]]);
    c.fillRect(0, 0, W, H);
    c.fillStyle = lg(c, 0, H * 0.48, 0, H, [[0, "#9ad78e"], [0.5, "#77c274"], [1, "#54a45e"]]);
    c.beginPath();
    c.moveTo(0, H * 0.56);
    c.quadraticCurveTo(W * 0.3, H * 0.49, W * 0.62, H * 0.53);
    c.quadraticCurveTo(W * 0.85, H * 0.56, W, H * 0.5);
    c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();

    // pond
    c.save();
    c.fillStyle = "rgba(20,60,45,.18)";
    blob(c, W * 0.5, H * 0.79, 118, 30, POND_WOB, 1.1); c.fill();
    c.fillStyle = rgrad(c, W * 0.5, H * 0.76, 120,
      [[0, "#2f86ad"], [0.6, "#57b0d4"], [1, "#83cde8"]]);
    blob(c, W * 0.5, H * 0.78, 112, 27, POND_WOB, 1); c.fill();
    c.fillStyle = "rgba(255,255,255,.18)";
    ell(c, W * 0.42, H * 0.74, 54, 9); c.fill();
    c.restore();

    // Lay water species in the pond and land species along the front grass,
    // so a card reads like a garden rather than a row of icons.
    const water = g.plants.filter((p) => SPECIES_BY_KEY[p.species]?.needsPlot === "water").slice(0, 3);
    const land = g.plants.filter((p) => SPECIES_BY_KEY[p.species]?.needsPlot !== "water").slice(0, 4);

    const place = (
      list: typeof g.plants,
      y: number,
      x0: number,
      x1: number,
      scale: number
    ) => {
      list.forEach((p, i) => {
        const sp = SPECIES_BY_KEY[p.species];
        if (!sp) return;
        const t = list.length === 1 ? 0.5 : i / (list.length - 1);
        c.save();
        c.translate(x0 + (x1 - x0) * t, y);
        c.scale(scale, scale);
        drawPlant(c, sp, { stage: p.stage });
        c.restore();
      });
    };

    place(water, H * 0.79, W * 0.36, W * 0.64, 0.5);
    place(land, H * 0.95, W * 0.1, W * 0.9, 0.58);

    // foreground grass fringe
    c.strokeStyle = "rgba(47,116,66,.45)";
    c.lineWidth = 2; c.lineCap = "round";
    for (let i = 0; i < 40; i++) {
      const gx = (i / 40) * W + ((i * 37) % 9);
      const gh = 7 + ((i * 13) % 9);
      c.beginPath(); c.moveTo(gx, H); c.lineTo(gx + ((i % 3) - 1) * 3, H - gh); c.stroke();
    }
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

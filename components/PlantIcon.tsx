"use client";

import { useEffect, useRef } from "react";
import { drawPlant } from "@/game/plants";
import { SPECIES_BY_KEY, type SpeciesDef } from "@/lib/species";

/** Small canvas thumbnail using the same painter as the garden. */
export default function PlantIcon({
  species,
  stage = 6,
  size = 34,
  wilted,
  dead,
}: {
  species: string | SpeciesDef;
  stage?: number;
  size?: number;
  wilted?: boolean;
  dead?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const sp = typeof species === "string" ? SPECIES_BY_KEY[species] : species;
    if (!sp) return;

    const dpr = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 3);
    const box = 150; // logical units the drawing may occupy
    const scale = (size / box) * dpr;
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);
    cv.style.width = `${size}px`;
    cv.style.height = `${size}px`;

    const c = cv.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, cv.width, cv.height);
    c.save();
    c.scale(scale, scale);
    c.translate(box / 2, box * 0.92);
    drawPlant(c, sp, { stage, wilted, dead });
    c.restore();
  }, [species, stage, size, wilted, dead]);

  return <canvas ref={ref} className="plant-icon" />;
}

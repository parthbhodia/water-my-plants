"use client";

import { useEffect, useRef } from "react";
import { paintGuide, GUIDE_SIZE, type GuideMood } from "@/game/guide";

/** Granny Fern's portrait, painted with the shared Canvas2D painter. */
export default function GuidePortrait({
  mood = "happy",
  size = 64,
}: {
  mood?: GuideMood;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 3);
    const scale = (size / GUIDE_SIZE) * dpr;
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);
    cv.style.width = `${size}px`;
    cv.style.height = `${size}px`;
    const c = cv.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, cv.width, cv.height);
    c.save();
    c.scale(scale, scale);
    paintGuide(c, mood);
    c.restore();
  }, [mood, size]);

  return <canvas ref={ref} className="guide-portrait" aria-hidden />;
}

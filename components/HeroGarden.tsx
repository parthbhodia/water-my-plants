"use client";

import { useEffect, useRef, useState } from "react";
import { paintGardenCard } from "@/game/scenecard";
import { drawPlant } from "@/game/plants";
import { SPECIES_BY_KEY } from "@/lib/species";
import { GUIDE_NAME } from "@/game/guide";
import GuidePortrait from "./GuidePortrait";

const W = 460;
const H = 260;
// The hero plant stands front-and-centre on the lawn.
const PX = W * 0.5;
const PY = H * 0.99;

type Phase = "thirsty" | "pouring" | "grown" | "done";

/**
 * The landing page's proof-of-play: a real thirsty sunflower, painted by
 * the game's own painter, that the visitor can water once. The second tap
 * teaches the one-drink-a-day rule.
 */
export default function HeroGarden() {
  const ref = useRef<HTMLCanvasElement>(null);
  const phase = useRef<Phase>("thirsty");
  const pourAt = useRef(0);
  const [bubble, setBubble] = useState<string | null>(null);
  const [mood, setMood] = useState<"cheer" | "happy">("cheer");

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext("2d");
    if (!c) return;

    // cache the backdrop once — only the hero plant and effects repaint
    const off = document.createElement("canvas");
    off.width = W * dpr; off.height = H * dpr;
    const oc = off.getContext("2d")!;
    oc.scale(dpr, dpr);
    paintGardenCard(oc, W, H, [
      { species: "lily", stage: 5 },
      { species: "fern", stage: 4 },
      { species: "cactus", stage: 5 },
    ], [{ slot: 0, item: "decor_lantern" }], "hero");

    const t0 = performance.now();
    const sparkles: Array<{ x: number; y: number; vx: number; vy: number; born: number }> = [];
    let sparked = false;
    let raf = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const t = (now - t0) / 1000;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(off, 0, 0);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);

      const p = phase.current;
      const grownK =
        p === "grown" || p === "done"
          ? Math.min(1, (now - pourAt.current - 700) / 400)
          : 0;

      // the hero sunflower, breathing gently; a little pop as it grows
      c.save();
      c.translate(PX, PY);
      c.rotate(Math.sin(t * 1.4) * 0.012);
      const pop = grownK > 0 && grownK < 1 ? 1 + Math.sin(grownK * Math.PI) * 0.08 : 1;
      c.scale(1.12 * pop, 1.12 * pop);
      drawPlant(c, SPECIES_BY_KEY.sunflower, { stage: grownK > 0.4 ? 4 : 3 });
      c.restore();

      if (p === "thirsty") {
        // bobbing droplet ask
        const by = Math.sin(t * 2.6) * 5;
        const dx = PX, dy = H * 0.42 + by;
        c.fillStyle = "rgba(255,255,255,.85)";
        c.beginPath(); c.arc(dx, dy, 15, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#57b0d4";
        c.beginPath();
        c.moveTo(dx, dy - 8);
        c.quadraticCurveTo(dx + 7.5, dy + 1, dx, dy + 7);
        c.quadraticCurveTo(dx - 7.5, dy + 1, dx, dy - 8);
        c.fill();
      }

      if (p === "pouring") {
        const k = (now - pourAt.current) / 700;
        if (k >= 1) {
          phase.current = "grown";
        } else {
          c.fillStyle = "#6fc4e8";
          for (let i = 0; i < 7; i++) {
            const dk = (k + i * 0.13) % 1;
            const dx = PX + ((i * 53) % 40) - 20;
            const dy = H * 0.42 + dk * (PY - 80 - H * 0.42);
            c.beginPath(); c.arc(dx, dy, 3, 0, Math.PI * 2); c.fill();
          }
        }
      }

      if ((p === "grown" || p === "done") && !sparked) {
        sparked = true;
        for (let i = 0; i < 14; i++) {
          sparkles.push({
            x: PX + (Math.random() - 0.5) * 70,
            y: PY - 60 - Math.random() * 60,
            vx: (Math.random() - 0.5) * 40,
            vy: -30 - Math.random() * 50,
            born: now,
          });
        }
      }

      for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i];
        const age = (now - s.born) / 900;
        if (age >= 1) { sparkles.splice(i, 1); continue; }
        c.fillStyle = `rgba(255,224,120,${1 - age})`;
        c.beginPath();
        c.arc(s.x + s.vx * age, s.y + s.vy * age + 40 * age * age, 2.6 * (1 - age * 0.5), 0, Math.PI * 2);
        c.fill();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const tap = () => {
    if (phase.current === "thirsty") {
      phase.current = "pouring";
      pourAt.current = performance.now();
      setMood("cheer");
      setBubble("There you go, love. Come back tomorrow and she'll be taller still.");
    } else if (phase.current === "grown") {
      phase.current = "done";
      setMood("happy");
      setBubble("One drink a day is plenty — that's the whole game. Go plant your own.");
    }
  };

  return (
    <div className="hero-garden">
      <canvas
        ref={ref}
        style={{ width: "100%", aspectRatio: `${W} / ${H}`, cursor: "pointer", display: "block" }}
        onPointerDown={tap}
        role="button"
        aria-label="Water the thirsty sunflower"
      />
      {!bubble && <span className="hg-hint">Tap the droplet — water her</span>}
      {bubble && (
        <div className="hg-bubble">
          <GuidePortrait mood={mood} size={44} />
          <div className="hg-bubble-text">
            <b>{GUIDE_NAME}</b>
            <p>{bubble}</p>
          </div>
        </div>
      )}
    </div>
  );
}

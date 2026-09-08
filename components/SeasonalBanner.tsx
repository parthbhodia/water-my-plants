"use client";

import { useEffect, useRef, useState } from "react";
import { SPECIES_BY_KEY } from "@/lib/species";
import { PITCH } from "@/lib/guides";
import { seasonPicked } from "@/lib/analytics";
import { PHASE_NAME, PHASE_PALETTE, type YearPhase } from "@/lib/yearphase";
import { drawPlant, bloomScale } from "@/game/plants";
import { lg } from "@/game/draw";

/**
 * The four calendar plants, in the weather that lets you sow them.
 *
 * They are the only things in the game a player cannot simply decide to grow,
 * and the picker above could only say so in a chip. That undersells the one
 * genuinely nice thing about them: the garden looks different in each phase.
 * So this is the whole yard turning over — one canvas, painted from the same
 * `PHASE_PALETTE` the real scene uses, so it cannot drift from what a spring
 * garden actually looks like in the game.
 *
 * The seasons MELT into each other rather than cutting: every colour in the
 * palette is interpolated across the handover, the outgoing plant fades down
 * as the incoming one grows in, and the drifting petals/leaves/snow already in
 * flight keep falling as their own kind while the new weather starts. A cut
 * would read as four separate pictures; this reads as one garden and a year
 * going past, which is the entire point.
 *
 * `prefers-reduced-motion` keeps the pictures and the tabs and drops the
 * travel: no loop, no drift, no auto-advance.
 */

const PHASES: YearPhase[] = ["spring", "summer", "autumn", "winter"];

/** Long enough to look at, short enough that nobody leaves before winter. */
const DWELL_MS = 5200;
const MELT_MS = 1400;

const BLURB: Record<YearPhase, string> = {
  spring: "The trees come into blossom and everything is in a hurry.",
  summer: "Long light, warm soil, and the bees have opinions.",
  autumn: "The greens burn down to amber, and the leaves let go.",
  winter: "Everything goes quiet under the snow — and she flowers anyway.",
};

// ---------- colour maths ----------

function hex(c: string): [number, number, number, number] {
  if (c.startsWith("rgba") || c.startsWith("rgb")) {
    const n = c.replace(/[^\d.,]/g, "").split(",").map(Number);
    return [n[0] || 0, n[1] || 0, n[2] || 0, n[3] ?? 1];
  }
  const h = c.replace("#", "");
  const v = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16), 1];
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1, a1] = hex(a);
  const [r2, g2, b2, a2] = hex(b);
  const k = (x: number, y: number) => Math.round(x + (y - x) * t);
  const al = a1 + (a2 - a1) * t;
  return `rgba(${k(r1, r2)},${k(g1, g2)},${k(b1, b2)},${al.toFixed(3)})`;
}

const mixArr = (a: string[], b: string[], t: number) => a.map((c, i) => mix(c, b[i] ?? c, t));

// ---------- drifting weather ----------

type Kind = "petal" | "leaf" | "snow" | "mote";
type Drop = {
  x: number; y: number; vx: number; vy: number; r: number; a: number; spin: number;
  kind: Kind;
  /** Last season's weather clears in under a second; a petal falls for nine. */
  fade: number;
};

/** Summer's palette has no drift, but a still summer looks broken beside three moving seasons. */
const KIND: Record<YearPhase, Kind> = { spring: "petal", summer: "mote", autumn: "leaf", winter: "snow" };

/** The real palette leaves `flower` null for spring and summer — the scene has
 *  its own wildflower textures there. The banner needs one colour to scatter. */
const BLOOM: Record<YearPhase, string> = {
  spring: "#f6b8d4", summer: "#ffe07a", autumn: "#efdcb0", winter: "#ffffff",
};

function paintDrop(c: CanvasRenderingContext2D, d: Drop) {
  c.save();
  c.globalAlpha = d.fade;
  c.translate(d.x, d.y);
  c.rotate(d.a);
  switch (d.kind) {
    case "petal":
      c.fillStyle = "rgba(255,198,224,.92)";
      c.beginPath(); c.ellipse(0, 0, d.r * 1.5, d.r * 0.72, 0, 0, Math.PI * 2); c.fill();
      break;
    case "leaf":
      c.fillStyle = "rgba(214,142,60,.9)";
      c.beginPath();
      c.moveTo(-d.r * 1.6, 0);
      c.quadraticCurveTo(0, -d.r * 1.1, d.r * 1.6, 0);
      c.quadraticCurveTo(0, d.r * 1.1, -d.r * 1.6, 0);
      c.fill();
      break;
    case "snow":
      c.fillStyle = "rgba(255,255,255,.95)";
      c.beginPath(); c.arc(0, 0, d.r * 0.85, 0, Math.PI * 2); c.fill();
      break;
    default: // mote — summer pollen, lit from the sun side
      c.fillStyle = "rgba(255,236,158,.85)";
      c.beginPath(); c.arc(0, 0, d.r * 0.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = "rgba(255,246,206,.28)";
      c.beginPath(); c.arc(0, 0, d.r * 1.8, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

function spawn(kind: Kind, W: number, H: number, seeded: boolean): Drop {
  const slow = kind === "mote";
  return {
    x: Math.random() * W,
    y: seeded ? Math.random() * H : -12 - Math.random() * 40,
    vx: (Math.random() - 0.5) * (slow ? 10 : 26) - (kind === "leaf" ? 14 : 0),
    vy: slow ? -6 - Math.random() * 10 : 22 + Math.random() * 34,
    r: (slow ? 1.6 : 2.6) + Math.random() * 2.4,
    a: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 2.4,
    kind,
    fade: 1,
  };
}

// ---------- the yard ----------

/** Only what the banner paints. The real palette's tuples resist interpolation. */
type Pal = {
  sky: string[]; hillFar: string[]; distantTree: string;
  ground: string[]; fringe: string; bush: string[]; flower: string;
};

/** Deterministic 0..1 — a hedge of identical blobs is a bar, not a hedge. */
const wob = (i: number, salt: number) => (((i * 2654435761) ^ (salt * 40503)) >>> 8) % 1000 / 1000;

function paintYard(c: CanvasRenderingContext2D, W: number, H: number, p: Pal, sun: number) {
  const HZ = H * 0.52;

  c.fillStyle = lg(c, 0, 0, 0, HZ + 8, [[0, p.sky[0]], [0.55, p.sky[1]], [1, p.sky[2]]]);
  c.fillRect(0, 0, W, HZ + 10);

  c.save();
  c.globalAlpha = sun;
  const g = c.createRadialGradient(W * 0.14, H * 0.04, 0, W * 0.14, H * 0.04, H * 0.62);
  g.addColorStop(0, "rgba(255,247,206,.85)");
  g.addColorStop(1, "rgba(255,244,196,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, W, HZ + 10);
  c.restore();

  c.fillStyle = lg(c, 0, HZ - H * 0.16, 0, HZ, [[0, p.hillFar[0]], [1, p.hillFar[1]]]);
  c.beginPath(); c.ellipse(W * 0.24, HZ + H * 0.04, W * 0.4, H * 0.15, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(W * 0.82, HZ + H * 0.05, W * 0.38, H * 0.13, 0, 0, Math.PI * 2); c.fill();

  // A treeline, not a row of identical bubbles: crowns overlap into one mass,
  // each with its own height and its own trunk under it.
  c.fillStyle = p.distantTree;
  for (let i = 0; i < 15; i++) {
    const x = W * (0.01 + i * 0.071 + wob(i, 3) * 0.03);
    const s = 0.7 + wob(i, 5) * 0.75;
    const top = HZ - H * 0.045 * s - H * 0.02;
    // trunk first, and all the way down to the horizon — drawn after the crown
    // it poked out sideways between the two side lobes as a little T
    c.fillRect(x - W * 0.0022 * s, top, W * 0.0044 * s, HZ - top);
    c.beginPath(); c.ellipse(x, top, W * 0.019 * s, H * 0.05 * s, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(x - W * 0.014 * s, top + H * 0.022 * s, W * 0.013 * s, H * 0.032 * s, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(x + W * 0.014 * s, top + H * 0.02 * s, W * 0.012 * s, H * 0.03 * s, 0, 0, Math.PI * 2); c.fill();
  }

  c.fillStyle = lg(c, 0, HZ, 0, H, [[0, p.ground[0]], [0.45, p.ground[1]], [1, p.ground[2]]]);
  c.beginPath();
  c.moveTo(0, HZ + 2);
  c.quadraticCurveTo(W * 0.36, HZ - 5, W * 0.7, HZ + 3);
  c.quadraticCurveTo(W * 0.88, HZ + 7, W, HZ);
  c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();

  // A low hedge along the horizon. Uniform blobs at one height drew a solid
  // sausage bar straight across the frame; the silhouette has to break up.
  c.fillStyle = p.bush[2];
  for (let i = 0; i < 44; i++) {
    const x = (i / 43) * (W + 44) - 22;
    const h = H * (0.022 + wob(i, 11) * 0.03);
    c.beginPath(); c.ellipse(x, HZ + H * 0.05 - h * 0.3, W * 0.015, h, 0, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = p.bush[1];
  for (let i = 0; i < 44; i++) {
    const x = (i / 43) * (W + 44) - 22 + (wob(i, 17) - 0.5) * W * 0.012;
    const h = H * (0.015 + wob(i, 23) * 0.024);
    c.beginPath(); c.ellipse(x, HZ + H * 0.042 - h * 0.5, W * 0.011, h, 0, 0, Math.PI * 2); c.fill();
  }

  // Tufts and blooms across the open ground, thinning toward the horizon, or
  // the middle of the picture is a flat green field.
  for (let i = 0; i < 46; i++) {
    const u = ((i * 137) % 1000) / 1000;
    const v = ((i * 613) % 1000) / 1000;
    const x = u * W;
    const y = HZ + H * (0.1 + v * v * 0.82);
    const k = 0.45 + v * 0.75;
    c.strokeStyle = p.fringe;
    c.lineWidth = 1.5 * k;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2.4 * k, y - 7 * k); c.stroke();
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + 2.6 * k, y - 8 * k); c.stroke();
    if (i % 3 === 0) {
      c.fillStyle = p.flower;
      c.beginPath(); c.arc(x + 1.5 * k, y - 8 * k, 2.1 * k, 0, Math.PI * 2); c.fill();
    }
  }

  c.strokeStyle = p.fringe;
  c.lineWidth = Math.max(1.6, W * 0.0022);
  c.lineCap = "round";
  for (let i = 0; i < 52; i++) {
    const x = (i / 52) * W + ((i * 31) % 9);
    const h = H * 0.03 + ((i * 13) % 11);
    c.beginPath(); c.moveTo(x, H); c.lineTo(x + ((i % 3) - 1) * 3, H - h); c.stroke();
  }
}

/** One plant, swaying about its own base. A rotation about the top would uproot it. */
function paintPlant(
  c: CanvasRenderingContext2D,
  key: string, x: number, y: number, px: number, lean: number, alpha: number
) {
  const sp = SPECIES_BY_KEY[key];
  if (!sp || alpha <= 0.004) return;
  c.save();
  c.globalAlpha = alpha;
  c.translate(x, y);
  c.rotate(lean);
  c.fillStyle = "rgba(30,60,40,.16)";
  c.beginPath(); c.ellipse(0, 2, px * 0.16, px * 0.05, 0, 0, Math.PI * 2); c.fill();
  const s = bloomScale(sp.form, px);
  c.scale(s, s);
  drawPlant(c, sp, { stage: 6 });
  c.restore();
}

export default function SeasonalBanner() {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLCanvasElement>(null);
  // The loop reads these; React re-renders only the caption and the tabs.
  const target = useRef(0);
  const shown = useRef(0);
  const mixT = useRef(1);
  const held = useRef(0);

  useEffect(() => { target.current = idx; }, [idx]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const c = cv.getContext("2d");
    if (!c) return;

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let drops: Drop[] = [];
    let raf = 0;
    let last = performance.now();
    let W = 0, H = 0;

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const box = cv.getBoundingClientRect();
      W = Math.max(1, Math.round(box.width));
      H = Math.max(1, Math.round(box.height));
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(cv);

    if (!calm) {
      const k = KIND[PHASES[0]];
      for (let i = 0; i < 34; i++) drops.push(spawn(k, W, H, true));
    }

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // advance the year on its own, unless a tap has just steered it
      if (!calm) {
        held.current += dt * 1000;
        if (mixT.current >= 1 && held.current > DWELL_MS) {
          target.current = (target.current + 1) % PHASES.length;
          setIdx(target.current);
          held.current = 0;
        }
      }
      if (target.current !== shown.current && mixT.current >= 1) mixT.current = 0;
      if (mixT.current < 1) {
        mixT.current = Math.min(1, mixT.current + (calm ? 1 : dt * (1000 / MELT_MS)));
        if (mixT.current >= 1) shown.current = target.current;
      }

      const from = PHASES[shown.current];
      const to = PHASES[target.current];
      const raw = mixT.current;
      const t = raw * raw * (3 - 2 * raw); // ease, so the melt has no seam at either end
      const a = PHASE_PALETTE[from];
      const b = PHASE_PALETTE[to];
      const pal: Pal = {
        sky: mixArr(a.sky, b.sky, t),
        hillFar: mixArr(a.hillFar, b.hillFar, t),
        distantTree: mix(a.distantTree, b.distantTree, t),
        ground: mixArr(a.ground, b.ground, t),
        fringe: mix(a.fringe, b.fringe, t),
        bush: mixArr(a.bush, b.bush, t),
        flower: mix(BLOOM[from], BLOOM[to], t),
      };

      c.clearRect(0, 0, W, H);
      // winter's light is flat; spring and summer get the sun
      const sunOf = (p: YearPhase) => (p === "winter" ? 0.25 : p === "autumn" ? 0.6 : 1);
      paintYard(c, W, H, pal, sunOf(from) + (sunOf(to) - sunOf(from)) * t);

      const base = H * 0.93;
      const big = H * 0.74;
      const sway = calm ? 0 : Math.sin(now / 900) * 0.028;
      const keyOf = (p: YearPhase) =>
        ({ spring: "blossom", summer: "lavender", autumn: "pumpkin", winter: "snowdrop" })[p];

      // companions, out of phase with the hero so the row is not a metronome
      for (const [dx, sc, ph] of [[-0.29, 0.62, 1.7], [0.3, 0.68, 0.8], [-0.44, 0.44, 2.6]] as const) {
        paintPlant(c, keyOf(from), W * (0.5 + dx), base, big * sc,
          calm ? 0 : Math.sin(now / 900 + ph) * 0.03, 1 - t);
        paintPlant(c, keyOf(to), W * (0.5 + dx), base, big * sc,
          calm ? 0 : Math.sin(now / 900 + ph) * 0.03, t);
      }
      // the hero grows in as the outgoing one lets go
      paintPlant(c, keyOf(from), W * 0.5, base, big * (1 - t * 0.12), sway, 1 - t);
      paintPlant(c, keyOf(to), W * 0.5, base, big * (0.88 + t * 0.12), sway, t);

      if (!calm) {
        const want = KIND[to];
        while (drops.length < 36) drops.push(spawn(want, W, H, false));
        drops = drops.filter((d) => {
          // Last season's weather clears in under a second. Left to fall out of
          // frame on its own, spring petals were still drifting through autumn
          // eight seconds after the leaves started.
          if (d.kind !== want) d.fade -= dt * 1.6;
          if (d.fade <= 0) return false;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          d.a += d.spin * dt;
          if (d.kind !== "snow" && d.kind !== "mote") d.x += Math.sin(now / 700 + d.y * 0.03) * 22 * dt;
          paintDrop(c, d);
          return d.y < H + 20 && d.y > -60 && d.x > -40 && d.x < W + 40;
        });
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  const phase = PHASES[idx];
  const key = { spring: "blossom", summer: "lavender", autumn: "pumpkin", winter: "snowdrop" }[phase];
  const sp = SPECIES_BY_KEY[key];

  return (
    <div className={`sb sb-${phase}`}>
      <div className="sb-stage">
        <canvas ref={ref} className="sb-canvas" aria-hidden />
        <p className="sb-tag">
          <b>{PHASE_NAME[phase]}</b>
          <span>{BLURB[phase]}</span>
        </p>
      </div>

      <div className="sb-tabs" role="tablist" aria-label="Turn of the year">
        {PHASES.map((p, i) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={i === idx}
            className={`sb-tab t-${p}${i === idx ? " on" : ""}`}
            onClick={() => { setIdx(i); held.current = 0; seasonPicked(p); }}
          >
            {PHASE_NAME[p]}
          </button>
        ))}
      </div>

      <p className="sb-now" aria-live="polite">
        <b>{sp?.name}</b> — {PITCH[key]?.line} Free to sow, {PHASE_NAME[phase].toLowerCase()} only.
      </p>
    </div>
  );
}

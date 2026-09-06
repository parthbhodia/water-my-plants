// ============================================================
// Miniature garden vignette used by the landing page: showcase
// cards and the hero. Same painters as the game, composed into
// a postcard so even a one-day-old garden looks like a place.
// ============================================================

import { type Ctx, lg, rgrad, ell, blob } from "./draw";
import { drawPlant } from "./plants";
import { drawDecor } from "./decor";
import { SPECIES_BY_KEY } from "@/lib/species";

const POND_WOB = [0.05, -0.03, 0.045, 0.02, -0.045, 0.035, -0.02, 0.05, -0.035, 0.025];

export type CardPlant = { species: string; stage: number };

/** Deterministic per-garden variation so every card differs a little. */
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
};

function cloud(c: Ctx, x: number, y: number, s: number) {
  c.fillStyle = "rgba(255,255,255,.85)";
  ell(c, x, y, 26 * s, 10 * s); c.fill();
  ell(c, x - 14 * s, y + 3 * s, 15 * s, 8 * s); c.fill();
  ell(c, x + 15 * s, y + 2 * s, 17 * s, 8 * s); c.fill();
}

function tree(c: Ctx, x: number, y: number, s: number) {
  c.fillStyle = "rgba(20,55,38,.22)";
  ell(c, x, y + 2, 16 * s, 5 * s); c.fill();
  c.fillStyle = lg(c, x, y - 30 * s, x, y, [[0, "#8a5f3c"], [1, "#63422a"]]);
  c.fillRect(x - 2.6 * s, y - 26 * s, 5.2 * s, 26 * s);
  c.fillStyle = rgrad(c, x - 5 * s, y - 38 * s, 26 * s, [[0, "#7cc98a"], [1, "#3e8e52"]]);
  ell(c, x, y - 36 * s, 20 * s, 17 * s); c.fill();
  c.fillStyle = "rgba(255,255,255,.18)";
  ell(c, x - 7 * s, y - 42 * s, 8 * s, 6 * s); c.fill();
}

function fencerun(c: Ctx, W: number, y: number) {
  for (const ry of [y + 6, y + 14]) {
    c.fillStyle = "rgba(60,80,60,.12)"; c.fillRect(0, ry + 2, W, 2);
    c.fillStyle = lg(c, 0, ry, 0, ry + 4, [[0, "#f0e4c4"], [1, "#d1c096"]]);
    c.fillRect(0, ry, W, 4);
  }
  for (let x = 6; x < W; x += 22) {
    c.fillStyle = lg(c, x, 0, x + 8, 0, [[0, "#f6ecd2"], [1, "#cdbc95"]]);
    c.beginPath();
    c.moveTo(x, y + 2); c.lineTo(x + 8, y + 2); c.lineTo(x + 8, y + 22);
    c.lineTo(x, y + 22); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(x, y + 2); c.lineTo(x + 8, y + 2); c.lineTo(x + 4, y - 4); c.closePath(); c.fill();
  }
}

function wildflower(c: Ctx, x: number, y: number, hue: number) {
  const colors = ["#f7a8c4", "#ffd76e", "#b79ae0", "#ff9d76"];
  c.strokeStyle = "#3e8e52"; c.lineWidth = 1.4;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 7); c.stroke();
  c.fillStyle = colors[hue % colors.length];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ell(c, x + Math.cos(a) * 2.6, y - 7 + Math.sin(a) * 2.6, 1.7, 1.7); c.fill();
  }
  c.fillStyle = "#fff3c4"; ell(c, x, y - 7, 1.4, 1.4); c.fill();
}

function koi(c: Ctx, x: number, y: number, flip: number) {
  c.save();
  c.translate(x, y); c.scale(flip, 1);
  c.fillStyle = "rgba(255,140,80,.85)";
  ell(c, 0, 0, 7, 2.6); c.fill();
  c.beginPath(); c.moveTo(6, 0); c.lineTo(11, -2.5); c.lineTo(11, 2.5); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,255,255,.7)"; ell(c, -2, -0.6, 2, 1); c.fill();
  c.restore();
}

/**
 * Paints the whole vignette. `decor` is slot->item; `seed` varies the
 * scatter so two gardens never look copy-pasted.
 */
export type CardOpts = {
  /**
   * A showcase card is a 380x210 postcard and caps at 3+4 plants so it does
   * not turn to soup. The landing page's "day ninety" panel is far bigger
   * and looks half-empty at those caps — `dense` raises them and splits the
   * land plants into a staggered back and front row.
   */
  dense?: boolean;
  /**
   * Multiplies plant size. The "day one" panel holds a single seedling, and
   * at the normal scale a stage-1 sprout in a 420x300 frame is a speck — the
   * caption promised a seed and you could not see one.
   */
  plantScale?: number;
};

export function paintGardenCard(
  c: Ctx,
  W: number,
  H: number,
  plants: CardPlant[],
  decor: Array<{ slot: number; item: string }>,
  seedStr: string,
  opts: CardOpts = {}
) {
  const seed = hash(seedStr || "garden");
  const dense = !!opts.dense;
  const pScale = opts.plantScale ?? 1;

  // sky + far hill + ground
  c.fillStyle = lg(c, 0, 0, 0, H, [[0, "#a5d8f0"], [0.55, "#cfeade"], [1, "#bfe4c2"]]);
  c.fillRect(0, 0, W, H);
  cloud(c, W * (0.18 + (seed % 5) * 0.03), H * 0.14, 0.8);
  cloud(c, W * (0.66 + (seed % 3) * 0.04), H * 0.09, 1);

  c.fillStyle = "rgba(140,200,150,.5)";
  ell(c, W * 0.75, H * 0.52, W * 0.5, H * 0.16); c.fill();
  c.fillStyle = "rgba(120,190,140,.45)";
  ell(c, W * 0.15, H * 0.54, W * 0.42, H * 0.14); c.fill();

  c.fillStyle = lg(c, 0, H * 0.48, 0, H, [[0, "#9ad78e"], [0.5, "#77c274"], [1, "#54a45e"]]);
  c.beginPath();
  c.moveTo(0, H * 0.56);
  c.quadraticCurveTo(W * 0.3, H * 0.49, W * 0.62, H * 0.53);
  c.quadraticCurveTo(W * 0.85, H * 0.56, W, H * 0.5);
  c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();

  // fence + flanking trees behind everything
  fencerun(c, W, H * 0.44);
  tree(c, W * 0.09, H * 0.62, 1.05);
  tree(c, W * 0.93, H * 0.6, 0.85);

  // pond
  c.save();
  c.fillStyle = "rgba(20,60,45,.18)";
  blob(c, W * 0.5, H * 0.79, 118, 30, POND_WOB, 1.1); c.fill();
  c.fillStyle = lg(c, 0, H * 0.62, 0, H * 0.94,
    [[0, "#e8c9a0"], [1, "#caa87a"]]);
  blob(c, W * 0.5, H * 0.78, 120, 30, POND_WOB, 1.05); c.fill();
  c.fillStyle = rgrad(c, W * 0.5, H * 0.76, 120,
    [[0, "#2f86ad"], [0.6, "#57b0d4"], [1, "#83cde8"]]);
  blob(c, W * 0.5, H * 0.78, 112, 27, POND_WOB, 1); c.fill();
  c.fillStyle = "rgba(255,255,255,.18)";
  ell(c, W * 0.42, H * 0.74, 54, 9); c.fill();
  // resident koi and a stray pad, so the pond is never bare
  koi(c, W * 0.56, H * 0.8, 1);
  koi(c, W * 0.44, H * 0.84, -1);
  c.fillStyle = "#58b368";
  ell(c, W * 0.63, H * 0.73, 8, 3.4); c.fill();
  c.restore();

  // plants: water species float, land species line the front
  const water = plants.filter((p) => SPECIES_BY_KEY[p.species]?.needsPlot === "water").slice(0, dense ? 4 : 3);
  const land = plants.filter((p) => SPECIES_BY_KEY[p.species]?.needsPlot !== "water").slice(0, dense ? 9 : 4);

  const place = (list: CardPlant[], y: number, x0: number, x1: number, scale: number) => {
    list.forEach((p, i) => {
      const sp = SPECIES_BY_KEY[p.species];
      if (!sp) return;
      const t = list.length === 1 ? 0.5 : i / (list.length - 1);
      c.save();
      c.translate(x0 + (x1 - x0) * t, y);
      c.scale(scale * pScale, scale * pScale);
      drawPlant(c, sp, { stage: p.stage });
      c.restore();
    });
  };
  place(water, H * 0.79, W * 0.36, W * 0.64, 0.5);
  if (dense && land.length > 4) {
    // Back row smaller and higher, front row larger — the size difference is
    // what reads as depth, and the stagger stops them lining up like a fence.
    const back = land.filter((_, i) => i % 2 === 1);
    const front = land.filter((_, i) => i % 2 === 0);
    place(back, H * 0.7, W * 0.1, W * 0.9, 0.46);
    place(front, H * 0.97, W * 0.06, W * 0.94, 0.66);
  } else {
    // A scaled-up single seedling grows DOWNWARD from its baseline, so at
    // 1.9x the sprout was half under the bottom edge of the canvas. Lift the
    // row by whatever the extra scale added.
    place(land, H * (0.95 - (pScale - 1) * 0.12), W * 0.12, W * 0.88, 0.58);
  }

  // placed ornaments, shrunk onto the lawn
  decor.slice(0, dense ? 6 : 4).forEach((d, i) => {
    c.save();
    const spread = dense ? 0.15 : 0.22;
    c.translate(W * (0.1 + i * spread) + ((seed >> (i + 2)) % 14), H * (dense ? 0.63 : 0.66));
    c.scale(dense ? 0.5 : 0.42, dense ? 0.5 : 0.42);
    drawDecor(c, d.item);
    c.restore();
  });

  // wildflowers fill the gaps — more of them the emptier the garden is
  const n = 7 + Math.max(0, 4 - land.length) * 3;
  for (let i = 0; i < n; i++) {
    const fx = ((seed >> (i % 20)) % 100) / 100;
    const x = W * (0.06 + fx * 0.88);
    const y = H * (0.6 + (((seed >> (i % 13)) % 40) / 100) * 0.55);
    // keep out of the pond
    const dx = (x - W * 0.5) / 125; const dy = (y - H * 0.78) / 34;
    if (dx * dx + dy * dy < 1.25) continue;
    if (i % 3 === 0) wildflower(c, x, y, seed + i);
    else {
      c.strokeStyle = "rgba(47,116,66,.5)"; c.lineWidth = 1.6; c.lineCap = "round";
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2, y - 6); c.stroke();
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 2, y - 7); c.stroke();
    }
  }

  // foreground grass fringe
  c.strokeStyle = "rgba(47,116,66,.45)";
  c.lineWidth = 2; c.lineCap = "round";
  for (let i = 0; i < 40; i++) {
    const gx = (i / 40) * W + ((i * 37) % 9);
    const gh = 7 + ((i * 13) % 9);
    c.beginPath(); c.moveTo(gx, H); c.lineTo(gx + ((i % 3) - 1) * 3, H - gh); c.stroke();
  }

  // postcard vignette
  c.fillStyle = "rgba(255,255,255,0)";
  const vg = c.createRadialGradient(W / 2, H / 2, H * 0.5, W / 2, H / 2, H * 1.1);
  vg.addColorStop(0, "rgba(31,61,45,0)");
  vg.addColorStop(1, "rgba(31,61,45,.16)");
  c.fillStyle = vg;
  c.fillRect(0, 0, W, H);
}

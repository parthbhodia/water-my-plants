// ============================================================
// Miniature garden vignette used by the landing page: showcase
// cards and the hero. Same painters as the game, composed into
// a postcard so even a one-day-old garden looks like a place.
// ============================================================

import { type Ctx, lg, rgrad, ell, blob } from "./draw";
import { drawPlant, plantHeightPx } from "./plants";
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
  /**
   * The landing page's "day one / day ninety" pair. A showcase postcard is a
   * real player's garden and must keep painting exactly as it always has, so
   * the richer composition — higher horizon, off-centre pond, three depth
   * bands, contact shadows, directional light — is a separate path rather
   * than a pile of flags threaded through the old one. `GardenCard` and
   * `HeroGarden` never pass it and are byte-identical to before.
   */
  lush?: boolean;
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
  if (opts.lush) { paintLushCard(c, W, H, plants, decor, seedStr, opts); return; }

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

// ============================================================
// The lush composition — the landing page's "day one / day
// ninety" pair only. Everything below is additive; the painter
// above is untouched so real players' showcase postcards and
// the hero garden keep rendering exactly as they always have.
// ============================================================


/** Soft ground shadow. Without one, a plant is pasted onto the lawn rather than standing in it. */
function contact(c: Ctx, x: number, y: number, w: number, a = 0.2) {
  c.fillStyle = `rgba(24,58,38,${a})`;
  ell(c, x, y + 1.5, w, Math.max(2, w * 0.32));
  c.fill();
}

/** A far tree: canopy only, and tall enough to clear the fence it stands behind. */
function farTree(c: Ctx, x: number, y: number, s: number) {
  c.fillStyle = "#5f9c6d";
  c.fillRect(x - 1.8 * s, y - 16 * s, 3.6 * s, 16 * s);
  c.fillStyle = "#74b07e";
  ell(c, x, y - 30 * s, 18 * s, 15 * s); c.fill();
  ell(c, x - 13 * s, y - 22 * s, 12 * s, 10 * s); c.fill();
  ell(c, x + 14 * s, y - 23 * s, 13 * s, 11 * s); c.fill();
}

/**
 * A flowering hedge along the fence. The bare strip of lawn under the fence was
 * the emptiest part of the picture, and a garden this old would have planted it.
 */
function hedgerow(c: Ctx, W: number, y: number, seed: number) {
  c.fillStyle = "rgba(24,58,38,.14)";
  c.beginPath(); c.ellipse(W / 2, y + 9, W * 0.54, 6, 0, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 30; i++) {
    const x = (i / 29) * (W + 40) - 20;
    const h = 9 + ((seed >> (i % 9)) % 5);
    c.fillStyle = i % 2 ? "#559f62" : "#4a9257";
    ell(c, x, y + (i % 3) - 1, 17, h); c.fill();
  }
  c.fillStyle = "rgba(126,192,134,.6)";
  for (let i = 0; i < 30; i++) ell(c, (i / 29) * (W + 40) - 24, y - 4, 11, 4), c.fill();
  for (let i = 0; i < 26; i++) {
    const x = (((seed >> (i % 17)) % 1000) / 1000) * W;
    c.fillStyle = i % 3 ? "rgba(255,248,214,.85)" : "rgba(247,180,206,.85)";
    ell(c, x, y - 3 + ((i * 7) % 9) - 4, 1.9, 1.9); c.fill();
  }
}

/**
 * A prepared bed: turned earth with a mulched rim. This is what turns twelve
 * plants scattered across a lawn into a garden somebody actually laid out.
 */
function bed(c: Ctx, x: number, y: number, rx: number, ry: number) {
  c.fillStyle = "rgba(20,50,32,.16)";
  ell(c, x, y + 3, rx * 1.04, ry * 1.1); c.fill();
  c.fillStyle = "#b39468";
  ell(c, x, y, rx, ry); c.fill();
  c.fillStyle = lg(c, x, y - ry, x, y + ry, [[0, "#8a6644"], [1, "#69492e"]]);
  ell(c, x, y, rx * 0.88, ry * 0.78); c.fill();
  c.fillStyle = "rgba(255,238,200,.12)";
  ell(c, x - rx * 0.22, y - ry * 0.32, rx * 0.5, ry * 0.28); c.fill();
  // a few clods, so it is turned earth rather than a flat brown disc
  c.fillStyle = "rgba(52,34,20,.22)";
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    ell(c, x + Math.cos(a) * rx * 0.5, y + Math.sin(a) * ry * 0.45, rx * 0.07, ry * 0.1); c.fill();
  }
}

/** Low underplanting: leaf tufts and a few small flowers so no bed is bare earth. */
function groundCover(c: Ctx, x: number, y: number, rx: number, ry: number, seed: number, k: number) {
  // A cheap LCG, because bit-shifting the seed gave only a handful of distinct
  // radii and every tuft landed on the same ring around a still-bare middle.
  let st = (seed ^ 0x9e3779b9) >>> 0;
  const rnd = () => ((st = (Math.imul(st, 1664525) + 1013904223) >>> 0) / 4294967296);
  const tufts: Array<[number, number, number]> = [];
  for (let i = 0; i < 34; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 0.94; // sqrt spreads them evenly over the area
    tufts.push([x + Math.cos(a) * rx * r, y + Math.sin(a) * ry * r, (5 + rnd() * 5) * k]);
  }
  tufts.sort((p, q) => p[1] - q[1]);
  tufts.forEach(([gx, gy, h], i) => {
    c.fillStyle = i % 2 ? "rgba(74,150,84,.92)" : "rgba(96,174,102,.92)";
    ell(c, gx, gy - h * 0.35, 4.6 * k, h * 0.6); c.fill();
    ell(c, gx - 3.4 * k, gy - h * 0.15, 3 * k, h * 0.4); c.fill();
    ell(c, gx + 3.4 * k, gy - h * 0.2, 3 * k, h * 0.42); c.fill();
    if (i % 4 === 0) {
      c.fillStyle = ["#f7a8c4", "#ffd76e", "#b79ae0", "#fff3d0"][i % 4];
      ell(c, gx, gy - h * 0.9, 2 * k, 2 * k); c.fill();
    }
  });
}

/** Big out-of-focus leaves reaching in from a corner: you are standing IN the garden. */
function frondCorner(c: Ctx, x: number, y: number, s: number, dir: number) {
  c.save();
  c.translate(x, y);
  c.scale(dir * s, s);
  for (let i = 0; i < 4; i++) {
    const a = -0.15 - i * 0.42;
    c.save();
    c.rotate(a);
    c.fillStyle = i % 2 ? "rgba(32,80,50,.6)" : "rgba(42,96,60,.55)";
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(70, -34, 132, -12);
    c.quadraticCurveTo(74, 12, 0, 0);
    c.closePath(); c.fill();
    c.restore();
  }
  c.restore();
}

function butterfly(c: Ctx, x: number, y: number, s: number, col: string) {
  c.fillStyle = col;
  ell(c, x - 2.4 * s, y - 1.5 * s, 2.6 * s, 1.9 * s); c.fill();
  ell(c, x + 2.4 * s, y - 1.5 * s, 2.6 * s, 1.9 * s); c.fill();
  c.fillStyle = "rgba(60,45,30,.8)";
  ell(c, x, y, 0.8 * s, 2.2 * s); c.fill();
}

/** Where a bed sits and how big its plants read at that distance. */
type Bed = { cx: number; cy: number; rx: number; ry: number; s: number; n: number };

function paintLushCard(
  c: Ctx,
  W: number,
  H: number,
  plants: CardPlant[],
  decor: Array<{ slot: number; item: string }>,
  seedStr: string,
  opts: CardOpts
) {
  const seed = hash(seedStr || "garden");
  const pScale = opts.plantScale ?? 1;
  /** Deterministic jitter in [-1,1] — even spacing is what made the old row read as a shelf. */
  const jit = (i: number, salt: number) => ((((seed >> (i % 11)) ^ (salt * 2654435761)) >>> 0) % 200) / 100 - 1;

  // The horizon sits high: the old card gave 56% of the frame to empty sky,
  // and a garden picture is about the ground.
  const HZ = H * 0.36;
  const pcx = W * 0.78, pcy = H * 0.86, prx = W * 0.19, pry = prx * 0.28;

  // ---- sky, with one sun in the upper left ----------------------------
  c.fillStyle = lg(c, 0, 0, 0, HZ + 20, [[0, "#8fd0ef"], [0.6, "#c2e7ee"], [1, "#e6f3df"]]);
  c.fillRect(0, 0, W, HZ + 24);
  c.fillStyle = rgrad(c, W * 0.17, H * 0.02, H * 0.44,
    [[0, "rgba(255,247,208,.8)"], [0.4, "rgba(255,244,198,.26)"], [1, "rgba(255,240,190,0)"]]);
  c.fillRect(0, 0, W, HZ + 24);
  cloud(c, W * (0.3 + (seed % 5) * 0.02), H * 0.11, 0.85);
  cloud(c, W * (0.76 + (seed % 3) * 0.03), H * 0.06, 1.05);
  cloud(c, W * 0.53, H * 0.19, 0.55);

  // ---- far hills + treeline -------------------------------------------
  c.fillStyle = "rgba(148,204,168,.8)";
  ell(c, W * 0.26, HZ + H * 0.03, W * 0.42, H * 0.11); c.fill();
  c.fillStyle = "rgba(128,192,152,.85)";
  ell(c, W * 0.84, HZ + H * 0.04, W * 0.4, H * 0.1); c.fill();
  c.globalAlpha = 0.55;
  for (let i = 0; i < 7; i++) {
    farTree(c, W * (0.04 + i * 0.16) + jit(i, 3) * W * 0.028, HZ + 4, 0.95 + ((seed >> i) % 5) * 0.1);
  }
  c.globalAlpha = 1;

  // ---- ground ----------------------------------------------------------
  c.fillStyle = lg(c, 0, HZ, 0, H, [[0, "#a6de97"], [0.4, "#7fc97b"], [1, "#4c9c58"]]);
  c.beginPath();
  c.moveTo(0, HZ + 2);
  c.quadraticCurveTo(W * 0.34, HZ - 4, W * 0.66, HZ + 3);
  c.quadraticCurveTo(W * 0.86, HZ + 7, W, HZ - 1);
  c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();

  // aerial haze where far meets near — distance is air, not only size
  const hz = c.createLinearGradient(0, HZ - 26, 0, HZ + H * 0.13);
  hz.addColorStop(0, "rgba(219,240,238,.62)");
  hz.addColorStop(1, "rgba(219,240,238,0)");
  c.fillStyle = hz;
  c.fillRect(0, HZ - 26, W, H * 0.14 + 26);

  // ---- fence, standing ON the ground line, with its hedge --------------
  // It used to be painted above the horizon, hanging in the sky, which is most
  // of why the top of the card read as detached from the garden below it.
  fencerun(c, W, HZ - 22);
  hedgerow(c, W, HZ + H * 0.055, seed);
  tree(c, W * 0.06, HZ + H * 0.16, 1.2);
  tree(c, W * 0.96, HZ + H * 0.13, 1);

  // ---- pond, off centre in the near right ------------------------------
  c.save();
  c.fillStyle = "rgba(20,60,45,.18)";
  blob(c, pcx, pcy + 3, prx, pry, POND_WOB, 1.08); c.fill();
  c.fillStyle = lg(c, 0, pcy - pry, 0, pcy + pry, [[0, "#e8c9a0"], [1, "#c39f70"]]);
  blob(c, pcx, pcy, prx, pry, POND_WOB, 1.05); c.fill();
  c.fillStyle = rgrad(c, pcx - prx * 0.2, pcy - pry * 0.4, prx * 1.2,
    [[0, "#2f86ad"], [0.55, "#57b0d4"], [1, "#8ad2ea"]]);
  blob(c, pcx, pcy, prx, pry, POND_WOB, 1); c.fill();
  c.fillStyle = "rgba(255,255,255,.22)"; // glare, thrown away from the sun
  ell(c, pcx - prx * 0.36, pcy - pry * 0.4, prx * 0.4, pry * 0.24); c.fill();
  koi(c, pcx + prx * 0.36, pcy + pry * 0.15, 1);
  koi(c, pcx - prx * 0.44, pcy + pry * 0.5, -1);
  c.restore();

  // ---- a path, so the eye has a way in ---------------------------------
  c.save();
  c.fillStyle = lg(c, 0, HZ, 0, H, [[0, "#cdc3ab"], [1, "#e3dac6"]]);
  c.beginPath();
  c.moveTo(W * 0.055, H + 4);
  c.quadraticCurveTo(W * 0.1, H * 0.74, W * 0.205, HZ + H * 0.13);
  c.lineTo(W * 0.235, HZ + H * 0.13);
  c.quadraticCurveTo(W * 0.16, H * 0.74, W * 0.135, H + 4);
  c.closePath(); c.fill();
  c.fillStyle = "rgba(120,100,70,.14)";
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    ell(c, W * (0.095 + t * 0.125), H - t * (H - HZ - H * 0.13),
      (1 - t * 0.7) * W * 0.032, 3.4 - t * 2); c.fill();
  }
  c.restore();

  // ---- the beds --------------------------------------------------------
  const land = plants.filter((p) => SPECIES_BY_KEY[p.species]?.needsPlot !== "water").slice(0, 11);
  const water = plants.filter((p) => SPECIES_BY_KEY[p.species]?.needsPlot === "water");

  const put = (p: CardPlant, x: number, y: number, s: number) => {
    const sp = SPECIES_BY_KEY[p.species];
    if (!sp) return;
    // Shadow width tracks the plant's real height, not its scale — a sprout and
    // a sunflower at the same scale do not cast the same shadow.
    contact(c, x, y, Math.max(4, plantHeightPx(sp.form, p.stage, s) * 0.34), 0.2);
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    drawPlant(c, sp, { stage: p.stage });
    c.restore();
  };

  // Three beds at three distances. Size falloff between them is what carries
  // depth; clustering is what stops twelve plants reading as twelve objects.
  const BEDS: Bed[] = land.length <= 2
    ? [{ cx: W * 0.3, cy: H * 0.76, rx: W * 0.075, ry: H * 0.04, s: 0.78 * pScale, n: land.length }]
    : [
      { cx: W * 0.115, cy: H * 0.6, rx: W * 0.095, ry: H * 0.052, s: 0.58, n: 3 },
      { cx: W * 0.44, cy: H * 0.63, rx: W * 0.105, ry: H * 0.055, s: 0.64, n: 3 },
      { cx: W * 0.87, cy: H * 0.61, rx: W * 0.082, ry: H * 0.048, s: 0.6, n: 2 },
      { cx: W * 0.33, cy: H * 0.9, rx: W * 0.135, ry: H * 0.068, s: 0.88, n: 3 },
    ];

  const byHeight = [...land].sort(
    (a, z) => plantHeightPx(SPECIES_BY_KEY[z.species]?.form ?? "tall", z.stage, 1)
      - plantHeightPx(SPECIES_BY_KEY[a.species]?.form ?? "tall", a.stage, 1));
  let cursor = 0;
  const filled = [...BEDS].sort((a, z) => a.cy - z.cy).map((b) => {
    const take = byHeight.slice(cursor, cursor + b.n);
    cursor += b.n;
    return { b, take };
  });
  filled.forEach(({ b, take }, bi) => {
    if (!take.length) return;
    bed(c, b.cx, b.cy, b.rx, b.ry);
    // A day-one bed is turned earth and one sprout. Underplanting it would hand
    // the newcomer a garden they have not grown yet, which is the exact contrast
    // this pair of pictures exists to draw.
    if (land.length > 2) groundCover(c, b.cx, b.cy, b.rx, b.ry, seed + bi * 7, b.s / 0.72);
    // Two sub-rows inside the bed: back smaller and higher, front larger.
    const back = take.filter((_, i) => i % 2 === 1);
    const front = take.filter((_, i) => i % 2 === 0);
    const row = (list: CardPlant[], dy: number, ds: number) =>
      list.forEach((p, i) => {
        const t = list.length === 1 ? 0.5 : i / (list.length - 1);
        const x = b.cx + (t - 0.5) * b.rx * 1.7 + jit(i + bi * 4, 11) * b.rx * 0.09;
        const y = b.cy + dy + jit(i + bi * 4, 17) * b.ry * 0.18;
        put(p, x, y, b.s * ds * (1 + jit(i + bi * 4, 23) * 0.09));
      });
    row(back, -b.ry * 0.45, 0.84);
    row(front, b.ry * 0.42, 1);
  });

  // ---- the namesake ----------------------------------------------------
  // The game is called Lily Days, and the lily used to be a speck at the back
  // of the pond. She is the hero of the picture now: front of the water, the
  // largest single plant in it, with the light gathered behind her.
  const hero = water.find((p) => p.species === "lily") ?? water[0];
  const rest = water.filter((p) => p !== hero);
  rest.forEach((p, i) =>
    put(p, pcx + (i - (rest.length - 1) / 2) * prx * 0.5, pcy - pry * 0.6, 0.42 * pScale));
  if (hero) {
    const hx = pcx - prx * 0.26, hy = pcy + pry * 0.12;
    const hs = 1.15 * pScale;
    c.fillStyle = rgrad(c, hx, hy - 18, prx * 0.5,
      [[0, "rgba(255,251,218,.55)"], [1, "rgba(255,251,218,0)"]]);
    ell(c, hx, hy - 18, prx * 0.5, prx * 0.38); c.fill();
    c.strokeStyle = "rgba(255,255,255,.42)";
    c.lineWidth = 1.6;
    ell(c, hx, hy + 3, prx * 0.3, prx * 0.09); c.stroke();
    ell(c, hx, hy + 5, prx * 0.42, prx * 0.12); c.stroke();
    const sp = SPECIES_BY_KEY[hero.species];
    if (sp) {
      c.save();
      c.translate(hx, hy);
      c.scale(hs, hs);
      drawPlant(c, sp, { stage: hero.stage });
      c.restore();
    }
  }

  // ---- ornaments, scattered through the lawn rather than lined up -------
  const SPOTS: Array<[number, number]> = [
    [0.27, 0.56], [0.6, 0.56], [0.66, 0.71], [0.97, 0.71], [0.05, 0.8], [0.53, 0.79],
  ];
  decor.slice(0, SPOTS.length)
    .map((d, i) => ({ d, x: W * SPOTS[i][0], y: H * SPOTS[i][1], s: 0.32 + (SPOTS[i][1] - 0.52) * 1.15 }))
    .sort((a, z) => a.y - z.y) // nearer draws over farther
    .forEach(({ d, x, y, s }) => {
      contact(c, x, y, 24 * s, 0.16);
      c.save();
      c.translate(x, y);
      c.scale(s, s);
      drawDecor(c, d.item);
      c.restore();
    });

  // ---- flowers grow in drifts, not in a uniform sprinkle ----------------
  const DRIFTS: Array<[number, number]> = [[0.17, 0.72], [0.58, 0.8], [0.71, 0.62], [0.94, 0.94]];
  DRIFTS.forEach(([dx, dy], d) => {
    for (let i = 0; i < 8; i++) {
      const x = W * dx + jit(i, d * 5 + 1) * W * 0.055;
      const y = H * dy + jit(i, d * 5 + 2) * H * 0.05;
      const ox = (x - pcx) / (prx * 1.12), oy = (y - pcy) / (pry * 1.5);
      if (ox * ox + oy * oy < 1) continue; // never in the water
      if (i % 3 === 0) wildflower(c, x, y, seed + i + d);
      else {
        c.strokeStyle = "rgba(47,116,66,.5)"; c.lineWidth = 1.6; c.lineCap = "round";
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2, y - 6); c.stroke();
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + 2, y - 7); c.stroke();
      }
    }
  });
  butterfly(c, W * 0.24, H * 0.5, 1.2, "rgba(255,214,120,.95)");
  butterfly(c, W * 0.55, H * 0.6, 1, "rgba(246,168,200,.95)");
  butterfly(c, W * 0.83, H * 0.52, 1.1, "rgba(255,236,180,.95)");

  // ---- one light direction over the whole yard --------------------------
  const warm = c.createLinearGradient(0, HZ, W * 0.85, H);
  warm.addColorStop(0, "rgba(255,244,206,.18)");
  warm.addColorStop(1, "rgba(255,244,206,0)");
  c.fillStyle = warm;
  c.fillRect(0, HZ, W, H - HZ);
  const cool = c.createLinearGradient(W, H, W * 0.3, HZ);
  cool.addColorStop(0, "rgba(52,96,132,.14)");
  cool.addColorStop(1, "rgba(52,96,132,0)");
  c.fillStyle = cool;
  c.fillRect(0, HZ, W, H - HZ);

  // ---- foreground framing ------------------------------------------------
  frondCorner(c, -W * 0.01, H * 1.02, (H / 300) * 0.8, 1);
  frondCorner(c, W * 1.02, H * 1.05, (H / 300) * 0.62, -1);
  c.strokeStyle = "rgba(30,74,48,.42)";
  c.lineWidth = 2.4; c.lineCap = "round";
  for (let i = 0; i < 44; i++) {
    const gx = (i / 44) * W + ((i * 37) % 9);
    const gh = 8 + ((i * 13) % 11);
    c.beginPath(); c.moveTo(gx, H); c.lineTo(gx + ((i % 3) - 1) * 3, H - gh); c.stroke();
  }

  // ---- postcard vignette --------------------------------------------------
  const vg = c.createRadialGradient(W / 2, H * 0.5, H * 0.46, W / 2, H * 0.52, H * 1.15);
  vg.addColorStop(0, "rgba(31,61,45,0)");
  vg.addColorStop(1, "rgba(31,61,45,.2)");
  c.fillStyle = vg;
  c.fillRect(0, 0, W, H);
}

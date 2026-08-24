// ============================================================
// Parametric plant painter — one function per growth "form".
// Everything is drawn from the plant's base point (0,0) upward, so the
// same code serves the Phaser scene, the seed picker and the journal.
// ============================================================

import { type Ctx, lg, rgrad, rr, ell, petalPath } from "./draw";
import type { PlantForm, SpeciesDef } from "@/lib/species";

export type PlantLook = {
  stage: number;   // 0..6
  wilted?: boolean;
  /** cosmetic rare variant, if this plant rolled one at bloom */
  variant?: string | null;
  dead?: boolean;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Desaturate + brown-shift a hex colour for wilted/dead states. */
function fade(hex: string, amount: number, toward = [122, 108, 78]): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number, t: number) => Math.round(c + (t - c) * amount);
  return `rgb(${mix(r, toward[0])},${mix(g, toward[1])},${mix(b, toward[2])})`;
}

type Pal = { leaf: string; leafDark: string; accent: string; accent2: string };

function palette(sp: SpeciesDef, look: PlantLook): Pal {
  const amt = look.dead ? 0.85 : look.wilted ? 0.42 : 0;
  if (!amt) return sp.colors;
  return {
    leaf: fade(sp.colors.leaf, amt),
    leafDark: fade(sp.colors.leafDark, amt),
    accent: fade(sp.colors.accent, amt * 0.8),
    accent2: fade(sp.colors.accent2, amt * 0.8),
  };
}

// ---------- shared early stages ----------

/** A tiny contented face — full blooms only, so joy reads as earned. */
function bloomFace(c: Ctx, x: number, y: number, s: number, ink = "rgba(60,38,20,0.85)") {
  c.save();
  c.translate(x, y);
  c.strokeStyle = ink;
  c.lineWidth = Math.max(1.1, s * 0.16);
  c.lineCap = "round";
  // closed, delighted eyes
  c.beginPath(); c.arc(-s * 0.55, -s * 0.15, s * 0.32, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  c.beginPath(); c.arc(s * 0.55, -s * 0.15, s * 0.32, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  // little smile
  c.beginPath(); c.arc(0, s * 0.25, s * 0.4, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
  // blush
  c.fillStyle = "rgba(240,130,120,0.4)";
  ell(c, -s * 0.85, s * 0.25, s * 0.24, s * 0.16); c.fill();
  ell(c, s * 0.85, s * 0.25, s * 0.24, s * 0.16); c.fill();
  c.restore();
}

function drawSeed(c: Ctx, p: Pal) {
  c.fillStyle = "rgba(30,60,40,0.32)";
  ell(c, 0, 2, 10, 3.5); c.fill();
  c.fillStyle = rgrad(c, -3, -4, 11, [[0, "#c9a86a"], [0.55, "#9c7a4a"], [1, "#6d5232"]]);
  ell(c, 0, -3, 7, 5.5); c.fill();
  c.fillStyle = "rgba(255,240,210,0.7)";
  ell(c, -2.4, -4.6, 2.4, 1.6); c.fill();
  void p;
}

function drawSprout(c: Ctx, p: Pal, h = 22) {
  c.strokeStyle = lg(c, 0, 0, 0, -h, [[0, p.leafDark], [1, p.leaf]]);
  c.lineWidth = 3; c.lineCap = "round";
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(1, -h * 0.6, 0, -h); c.stroke();
  for (const dir of [-1, 1]) {
    c.save();
    c.translate(0, -h * 0.82);
    c.rotate(dir * 0.7);
    c.fillStyle = dir < 0 ? p.leafDark : p.leaf;
    ell(c, dir * 8, 0, 8, 3.8); c.fill();
    c.restore();
  }
}

// ---------- form painters (stages 2..6) ----------

/** Lily: floating pads, then a bud, then an open bloom. */
function formPad(c: Ctx, p: Pal, t: number, stage: number) {
  const pad = (x: number, y: number, r: number) => {
    c.fillStyle = "rgba(10,50,70,0.32)";
    ell(c, x + 2, y + 3, r, r * 0.36); c.fill();
    c.fillStyle = rgrad(c, x - r * 0.35, y - r * 0.2, r * 1.6,
      [[0, p.leaf], [0.6, p.leaf], [1, p.leafDark]]);
    ell(c, x, y, r, r * 0.38); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.26)"; c.lineWidth = 1.2;
    for (const a of [-0.5, 0.2, 0.9, 2.0]) {
      c.beginPath(); c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.3); c.stroke();
    }
    c.fillStyle = "#3d95bd";
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - r, y - r * 0.14); c.lineTo(x - r, y + r * 0.14);
    c.closePath(); c.fill();
  };
  pad(0, 0, 20 + t * 26);
  if (t > 0.35) pad(34 + t * 12, 6, 10 + t * 8);
  if (t > 0.7) pad(-40 - t * 8, 7, 9 + t * 6);

  if (stage >= 4 && stage < 6) {
    const h = 26 + (stage - 4) * 14;
    c.strokeStyle = p.leafDark; c.lineWidth = 3; c.lineCap = "round";
    c.beginPath(); c.moveTo(2, -2); c.quadraticCurveTo(4, -h * 0.6, 3, -h); c.stroke();
    c.save(); c.translate(3, -h);
    c.fillStyle = lg(c, 0, 4, 0, -20, [[0, p.leafDark], [1, stage === 5 ? p.accent : p.leaf]]);
    petalPath(c, 11, 22); c.fill();
    c.restore();
  }
  if (stage === 6) {
    c.strokeStyle = p.leafDark; c.lineWidth = 3.5;
    c.beginPath(); c.moveTo(0, -2); c.lineTo(0, -34); c.stroke();
    c.save(); c.translate(0, -46);
    c.fillStyle = "rgba(120,40,80,0.15)"; ell(c, 0, 42, 24, 6); c.fill();
    for (let k = 0; k < 8; k++) {
      c.save(); c.rotate((k * Math.PI) / 4 + 0.39);
      c.fillStyle = lg(c, 0, 0, 0, -28, [[0, p.accent2], [0.6, p.accent], [1, "#ffffff"]]);
      petalPath(c, 11, 28); c.fill();
      c.restore();
    }
    for (let k = 0; k < 5; k++) {
      c.save(); c.rotate((k * Math.PI) / 2.5 + 0.7);
      c.fillStyle = lg(c, 0, 0, 0, -16, [[0, p.accent2], [1, p.accent]]);
      petalPath(c, 8, 17); c.fill();
      c.restore();
    }
    c.fillStyle = rgrad(c, -1, -1, 9, [[0, "#fff2bf"], [0.6, "#ffd76e"], [1, "#eaa93e"]]);
    ell(c, 0, 0, 7.5, 7.5); c.fill();
    bloomFace(c, 0, 0.5, 4.6);
    c.restore();
  }
}

/** Sunflower: thick stalk, broad leaves, a heavy head that nods when open. */
function formTall(c: Ctx, p: Pal, t: number, stage: number) {
  const h = 34 + t * 78;
  c.strokeStyle = lg(c, 0, 0, 0, -h, [[0, p.leafDark], [1, p.leaf]]);
  c.lineWidth = 5 - t; c.lineCap = "round";
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-3, -h * 0.5, 0, -h); c.stroke();

  const leaves = 2 + Math.round(t * 3);
  for (let i = 0; i < leaves; i++) {
    const ly = -h * (0.28 + (i / leaves) * 0.5);
    const dir = i % 2 === 0 ? -1 : 1;
    c.save(); c.translate(0, ly); c.rotate(dir * 0.55);
    c.fillStyle = i % 2 ? p.leaf : p.leafDark;
    ell(c, dir * 15, 0, 15, 6.5); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.22)"; c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(dir * 28, 0); c.stroke();
    c.restore();
  }

  if (stage >= 4) {
    const open = stage === 6;
    const r = open ? 20 : 10 + (stage - 4) * 3;
    c.save(); c.translate(0, -h - (open ? 6 : 2));
    if (open) {
      for (let k = 0; k < 16; k++) {
        c.save(); c.rotate((k / 16) * Math.PI * 2);
        c.fillStyle = k % 2 ? p.accent : p.accent2;
        petalPath(c, 8, r * 1.5); c.fill();
        c.restore();
      }
      c.fillStyle = rgrad(c, -3, -3, r, [[0, "#8a5a2a"], [1, "#4f3216"]]);
      ell(c, 0, 0, r * 0.62, r * 0.62); c.fill();
      c.fillStyle = "rgba(255,220,150,0.25)";
      ell(c, -r * 0.2, -r * 0.2, r * 0.22, r * 0.22); c.fill();
      bloomFace(c, 0, 1, r * 0.34, "rgba(255,228,170,0.9)");
    } else {
      c.fillStyle = rgrad(c, -2, -3, r * 1.4, [[0, p.leaf], [1, p.leafDark]]);
      ell(c, 0, 0, r, r * 1.1); c.fill();
      if (stage === 5) {
        c.fillStyle = p.accent;
        ell(c, 0, -r * 0.5, r * 0.55, r * 0.35); c.fill();
      }
    }
    c.restore();
  }
}

/** Fern: arching fronds with pinnae along each spine. */
function formFrond(c: Ctx, p: Pal, t: number, stage: number) {
  const n = 3 + Math.round(t * 3);
  const len = 34 + t * 46;
  for (let i = 0; i < n; i++) {
    const spread = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2; // -1..1
    const lean = spread * 0.55;
    const l = len * (1 - Math.abs(spread) * 0.18);
    // tip curls outward and over: real arch, not a straight ray
    const tipX = Math.sin(lean) * l * 0.85 + spread * 10;
    const tipY = -Math.cos(lean) * l * 0.82;
    const ctrlX = Math.sin(lean) * l * 0.25;
    const ctrlY = -l * 0.62;

    c.strokeStyle = p.leafDark; c.lineWidth = 2.2; c.lineCap = "round";
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY); c.stroke();

    const pin = 5 + Math.round(t * 3);
    for (let k = 1; k <= pin; k++) {
      const f = k / (pin + 0.6);
      const u = 1 - f;
      // point + tangent along the quadratic
      const px = u * u * 0 + 2 * u * f * ctrlX + f * f * tipX;
      const py = u * u * 0 + 2 * u * f * ctrlY + f * f * tipY;
      const tx = 2 * (u * ctrlX + f * (tipX - ctrlX));
      const ty = 2 * (u * ctrlY + f * (tipY - ctrlY));
      const ang = Math.atan2(ty, tx);
      const size = (1 - f * 0.72) * (7 + t * 5);
      for (const d of [-1, 1]) {
        c.save();
        c.translate(px, py);
        c.rotate(ang + d * 1.15);
        c.fillStyle = k % 2 ? p.leaf : p.accent2;
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(size * 0.7, -size * 0.42, size * 1.5, 0);
        c.quadraticCurveTo(size * 0.7, size * 0.32, 0, 0);
        c.closePath(); c.fill();
        c.restore();
      }
    }
    // curled fiddlehead at the tip while young
    if (t < 0.55) {
      c.strokeStyle = p.leaf; c.lineWidth = 2.2;
      c.beginPath(); c.arc(tipX, tipY, 3.6, 0, Math.PI * 1.6); c.stroke();
    }
  }
  if (stage === 6) {
    c.fillStyle = "rgba(150,95,45,0.6)";
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 1.4 - Math.PI * 0.7;
      ell(c, Math.sin(a) * 30, -len * 0.5 - Math.cos(a) * 10, 1.9, 1.9); c.fill();
    }
  }
}

/** Cactus: ribbed barrel with arms and spines; crowns with a flower. */
function formSucculent(c: Ctx, p: Pal, t: number, stage: number) {
  const h = 26 + t * 46;
  const w = 11 + t * 8;
  const body = (x: number, y: number, bw: number, bh: number) => {
    c.fillStyle = lg(c, x - bw, 0, x + bw, 0, [[0, p.leafDark], [0.4, p.leaf], [1, p.leafDark]]);
    rr(c, x - bw, y - bh, bw * 2, bh, bw); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.18)"; c.lineWidth = 1.4;
    for (const rx of [-0.45, 0, 0.45]) {
      c.beginPath();
      c.moveTo(x + rx * bw, y - bh * 0.92);
      c.lineTo(x + rx * bw, y - bh * 0.08);
      c.stroke();
    }
    // spines
    c.strokeStyle = "rgba(250,245,220,0.8)"; c.lineWidth = 1;
    for (let k = 0; k < Math.round(bh / 9); k++) {
      const sy = y - bh * 0.15 - k * 9;
      for (const d of [-1, 1]) {
        c.beginPath(); c.moveTo(x + d * bw * 0.85, sy);
        c.lineTo(x + d * (bw + 4), sy - 2); c.stroke();
      }
    }
  };
  body(0, 0, w, h);
  if (t > 0.45) {
    body(-w - 7, -h * 0.3, 6, h * 0.5);
    c.fillStyle = p.leafDark;
    rr(c, -w - 6, -h * 0.34, 8, 8, 3); c.fill();
  }
  if (t > 0.75) {
    body(w + 7, -h * 0.42, 6, h * 0.42);
  }
  if (stage === 6) {
    c.save(); c.translate(0, -h - 2);
    for (let k = 0; k < 7; k++) {
      c.save(); c.rotate((k / 7) * Math.PI * 2);
      c.fillStyle = lg(c, 0, 0, 0, -13, [[0, p.accent2], [1, p.accent]]);
      petalPath(c, 6, 13); c.fill();
      c.restore();
    }
    c.fillStyle = "#ffe08a"; ell(c, 0, 0, 4, 4); c.fill();
    c.restore();
  }
}

/** Moonflower: climbing vine with heart leaves and white trumpets. */
function formVine(c: Ctx, p: Pal, t: number, stage: number) {
  const h = 30 + t * 70;
  // trellis pole
  c.fillStyle = "rgba(120,95,60,0.75)";
  rr(c, -2, -h - 6, 4, h + 6, 2); c.fill();
  // spiralling vine
  c.strokeStyle = p.leaf; c.lineWidth = 3.4; c.lineCap = "round";
  c.beginPath();
  for (let i = 0; i <= 40; i++) {
    const f = i / 40;
    const y = -h * f;
    const x = Math.sin(f * Math.PI * 3.2) * (7 + f * 4);
    i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
  }
  c.stroke();
  const leaves = 3 + Math.round(t * 4);
  for (let i = 0; i < leaves; i++) {
    const f = (i + 0.6) / (leaves + 0.6);
    const y = -h * f;
    const x = Math.sin(f * Math.PI * 3.2) * (7 + f * 4);
    const d = Math.cos(f * Math.PI * 3.2) > 0 ? 1 : -1;
    c.save(); c.translate(x, y); c.rotate(d * 0.5);
    c.fillStyle = i % 2 ? p.leaf : p.leafDark;
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(d * 18, -10, d * 21, 8, 0, 13);
    c.bezierCurveTo(d * 6, 6, d * 6, 4, 0, 0);
    c.closePath(); c.fill();
    c.restore();
  }
  if (stage >= 5) {
    const blooms = stage === 6 ? 3 : 1;
    for (let i = 0; i < blooms; i++) {
      const f = 0.45 + i * 0.22;
      const y = -h * f;
      const x = Math.sin(f * Math.PI * 3.2) * (7 + f * 4);
      c.save(); c.translate(x, y);
      c.rotate(-0.5 + i * 0.4);
      // moonlit halo so white petals stay legible on a pale ground
      c.fillStyle = "rgba(150,170,220,0.28)";
      ell(c, 0, -13, 17, 15); c.fill();
      c.fillStyle = rgrad(c, 0, -16, 20, [[0, "#ffffff"], [0.55, p.accent], [1, p.accent2]]);
      c.beginPath();
      c.moveTo(0, 0);
      c.bezierCurveTo(-17, -9, -16, -24, 0, -24);
      c.bezierCurveTo(16, -24, 17, -9, 0, 0);
      c.closePath(); c.fill();
      c.strokeStyle = "rgba(150,140,200,0.45)"; c.lineWidth = 1.2;
      c.stroke();
      // five-point star fold of the trumpet
      c.strokeStyle = "rgba(160,150,205,0.5)"; c.lineWidth = 1;
      for (const a2 of [-1.0, -0.5, 0, 0.5, 1.0]) {
        c.beginPath(); c.moveTo(0, -2);
        c.lineTo(Math.sin(a2) * 15, -22 + Math.abs(a2) * 3); c.stroke();
      }
      c.fillStyle = "rgba(255,235,150,0.9)";
      ell(c, 0, -6, 3.4, 2.6); c.fill();
      c.restore();
    }
  }
}

/** Tomato: bushy foliage that sets green fruit, ripening to red. */
function formBush(c: Ctx, p: Pal, t: number, stage: number) {
  const h = 24 + t * 44;
  c.strokeStyle = p.leafDark; c.lineWidth = 3.2; c.lineCap = "round";
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -h); c.stroke();
  const clumps = 3 + Math.round(t * 3);
  for (let i = 0; i < clumps; i++) {
    const f = (i + 1) / (clumps + 1);
    const y = -h * f;
    const d = i % 2 ? 1 : -1;
    c.strokeStyle = p.leafDark; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, y); c.lineTo(d * 17, y - 6); c.stroke();
    for (let k = 0; k < 3; k++) {
      c.fillStyle = k % 2 ? p.leaf : p.leafDark;
      c.save();
      c.translate(d * (7 + k * 6), y - 6 - k * 2);
      c.rotate(d * 0.3 + k * 0.4);
      ell(c, 0, 0, 8 - k, 4.4); c.fill();
      c.restore();
    }
  }
  if (stage >= 4) {
    const fruit = stage === 6 ? 5 : stage - 3;
    for (let i = 0; i < fruit; i++) {
      const d = i % 2 ? 1 : -1;
      const fy = -h * (0.35 + (i / 5) * 0.5);
      const ripe = stage === 6 || i < stage - 4;
      const r = 5 + (ripe ? 1.6 : 0);
      c.fillStyle = rgrad(c, d * 12 - 2, fy - 2, r * 2,
        ripe ? [[0, "#ff8a72"], [0.55, p.accent], [1, p.accent2]]
             : [[0, "#a8d08a"], [1, "#6f9c52"]]);
      ell(c, d * 12, fy, r, r); c.fill();
      if (ripe) {
        c.fillStyle = "rgba(255,255,255,0.5)";
        ell(c, d * 12 - r * 0.35, fy - r * 0.4, r * 0.3, r * 0.2); c.fill();
      }
      c.fillStyle = p.leafDark;
      ell(c, d * 12, fy - r * 0.85, 2.6, 1.4); c.fill();
      if (stage === 6 && i === 0) bloomFace(c, d * 12, fy + r * 0.1, r * 0.55, "rgba(120,30,20,0.8)");
    }
  }
}

/** Ghost orchid: sparse roots, one arching spike, spidery white flowers. */
function formOrchid(c: Ctx, p: Pal, t: number, stage: number) {
  // clinging roots
  c.strokeStyle = p.leafDark; c.lineWidth = 2; c.lineCap = "round";
  for (const d of [-1, 1]) {
    c.beginPath(); c.moveTo(0, 0);
    c.quadraticCurveTo(d * 12, -4, d * (10 + t * 8), 4); c.stroke();
  }
  const h = 34 + t * 56;
  c.strokeStyle = lg(c, 0, 0, 0, -h, [[0, p.leafDark], [1, p.leaf]]);
  c.lineWidth = 3.2;
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(10, -h * 0.6, 4, -h); c.stroke();
  for (let i = 0; i < 2 + Math.round(t * 2); i++) {
    const f = (i + 1) / 4;
    c.save(); c.translate(Math.sin(f * 2) * 6, -h * f * 0.7); c.rotate(-0.5 + i * 0.4);
    c.fillStyle = i % 2 ? p.leaf : p.leafDark;
    ell(c, 12, 0, 14, 5); c.fill();
    c.restore();
  }
  if (stage >= 5) {
    const n = stage === 6 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      c.save();
      c.translate(4 + i * 4, -h + 4 + i * 20);
      const sc = stage === 6 ? 1.55 : 1.0;
      c.scale(sc, sc);
      // two long trailing tails + three upper petals
      c.fillStyle = "rgba(150,175,205,0.22)";
      ell(c, 0, -4, 17, 16); c.fill();
      c.strokeStyle = p.accent2; c.lineWidth = 2.2; c.lineCap = "round";
      for (const d of [-1, 1]) {
        c.beginPath(); c.moveTo(0, 2);
        c.quadraticCurveTo(d * 9, 13, d * 6, 26); c.stroke();
      }
      for (const a of [-0.85, 0, 0.85]) {
        c.save(); c.rotate(a);
        c.fillStyle = lg(c, 0, 2, 0, -16, [[0, p.accent2], [1, p.accent]]);
        petalPath(c, 7, 17); c.fill();
        c.strokeStyle = "rgba(150,160,190,0.4)"; c.lineWidth = 0.9;
        petalPath(c, 7, 17); c.stroke();
        c.restore();
      }
      c.fillStyle = p.accent;
      ell(c, 0, 3, 7, 5.5); c.fill();
      c.strokeStyle = "rgba(150,160,190,0.4)"; c.lineWidth = 0.9;
      ell(c, 0, 3, 7, 5.5); c.stroke();
      c.fillStyle = "rgba(230,220,120,0.8)";
      ell(c, 0, 1, 2.2, 1.6); c.fill();
      c.restore();
    }
  }
}

/** Bonsai: thickening trunk with layered foliage pads. */
function formTree(c: Ctx, p: Pal, t: number, stage: number) {
  const h = 26 + t * 40;
  const tw = 4 + t * 5;
  // pot
  c.fillStyle = lg(c, -20, 0, 20, 0, [[0, "#8a5a44"], [0.5, "#a9705a"], [1, "#7d4f3c"]]);
  c.beginPath();
  c.moveTo(-19, 0); c.lineTo(19, 0); c.lineTo(15, 13); c.lineTo(-15, 13);
  c.closePath(); c.fill();
  c.fillStyle = "rgba(255,255,255,0.16)";
  rr(c, -17, 1, 34, 3, 1.5); c.fill();
  c.fillStyle = "#4a3b2a";
  ell(c, 0, 0, 17, 3.4); c.fill();

  // trunk, leaning
  c.save();
  c.fillStyle = lg(c, -tw, 0, tw, 0, [[0, p.accent2], [0.5, p.accent], [1, p.accent2]]);
  c.beginPath();
  c.moveTo(-tw, 0);
  c.quadraticCurveTo(-tw + 6, -h * 0.5, tw + 2, -h);
  c.lineTo(tw + 2 + tw * 0.7, -h);
  c.quadraticCurveTo(tw + 8, -h * 0.5, tw, 0);
  c.closePath(); c.fill();
  c.restore();

  const pads = 1 + Math.round(t * 3);
  for (let i = 0; i < pads; i++) {
    const f = i / Math.max(1, pads - 1);
    const px = (i % 2 ? -1 : 1) * (12 + i * 5) * (0.4 + t);
    const py = -h * (0.55 + f * 0.5) - 4;
    const pr = (14 + t * 12) * (1 - i * 0.12);
    c.strokeStyle = p.accent2; c.lineWidth = 2;
    c.beginPath(); c.moveTo(tw * 0.4, py + 8); c.lineTo(px * 0.7, py + 2); c.stroke();
    c.fillStyle = "rgba(25,60,38,0.3)";
    ell(c, px + 2, py + 4, pr, pr * 0.4); c.fill();
    c.fillStyle = rgrad(c, px - pr * 0.3, py - pr * 0.3, pr * 1.5,
      [[0, "#8ed48a"], [0.55, p.leaf], [1, p.leafDark]]);
    ell(c, px, py, pr, pr * 0.46); c.fill();
    c.fillStyle = "rgba(235,255,225,0.22)";
    ell(c, px - pr * 0.3, py - pr * 0.14, pr * 0.4, pr * 0.16); c.fill();
  }
  if (stage === 6) {
    c.fillStyle = "rgba(255,215,110,0.9)";
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ell(c, Math.cos(a) * 26, -h - 12 + Math.sin(a) * 9, 2, 2); c.fill();
    }
  }
}

const FORMS: Record<PlantForm, (c: Ctx, p: Pal, t: number, stage: number) => void> = {
  pad: formPad,
  tall: formTall,
  frond: formFrond,
  succulent: formSucculent,
  vine: formVine,
  bush: formBush,
  orchid: formOrchid,
  tree: formTree,
};

/**
 * Draws a plant at the current canvas origin, growing upward.
 * Stages 0–1 are shared (seed, sprout); 2–6 are species-specific.
 */
/** Cosmetic overlay for a rare variant. Applied once, after the species
 *  painter, so all eight forms inherit it without eight separate edits. */
function paintVariant(c: Ctx, variant: string, stage: number) {
  if (stage < 3) return; // too small to read; let it show as it fills out
  const spread = 26 + stage * 7;
  c.save();
  if (variant === "dewkissed") {
    // beads of dew catching the light
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.4;
      const r = spread * (0.4 + ((i * 7) % 5) / 9);
      const bx = Math.cos(a) * r;
      const by = -spread * 0.7 + Math.sin(a) * r * 0.6;
      c.fillStyle = "rgba(150,220,255,0.55)";
      ell(c, bx, by + 0.7, 3.6, 3.6); c.fill();
      c.fillStyle = "rgba(232,250,255,0.95)";
      ell(c, bx, by, 3, 3); c.fill();
      c.fillStyle = "rgba(255,255,255,1)";
      ell(c, bx - 1, by - 1.1, 1.1, 1.1); c.fill();
    }
  } else if (variant === "variegated") {
    // cream streaks brushed through the foliage
    c.globalAlpha = 0.85;
    c.lineCap = "round";
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const x = Math.cos(a) * spread * 0.52;
      const y = -spread * 0.7 + Math.sin(a) * spread * 0.4;
      c.strokeStyle = "#fffdf0";
      c.lineWidth = 4.2;
      c.beginPath();
      c.moveTo(x - 5.5, y - 3.5);
      c.quadraticCurveTo(x, y, x + 6.5, y + 3.5);
      c.stroke();
      c.strokeStyle = "#f6e6a8";
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(x - 5.5, y - 3.5);
      c.quadraticCurveTo(x, y, x + 6.5, y + 3.5);
      c.stroke();
    }
    c.globalAlpha = 1;
  } else if (variant === "moonlit") {
    // a pale halo that lingers
    c.fillStyle = rgrad(c, 0, -spread * 0.7, spread * 1.15, [
      [0, "rgba(220,212,255,0.42)"], [0.6, "rgba(200,190,255,0.16)"], [1, "rgba(200,190,255,0)"]]);
    ell(c, 0, -spread * 0.7, spread * 1.15, spread * 0.95);
    c.fill();
    c.fillStyle = "rgba(238,234,255,0.85)";
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ell(c, Math.cos(a) * spread * 0.8, -spread * 0.7 + Math.sin(a) * spread * 0.5, 1.4, 1.4);
      c.fill();
    }
  } else if (variant === "golden") {
    // gilt edging plus a warm glow
    c.fillStyle = rgrad(c, 0, -spread * 0.7, spread * 1.2, [
      [0, "rgba(255,215,110,0.34)"], [0.65, "rgba(255,196,70,0.12)"], [1, "rgba(255,196,70,0)"]]);
    ell(c, 0, -spread * 0.7, spread * 1.2, spread);
    c.fill();
    c.globalAlpha = 0.75;
    c.strokeStyle = "#ffd76e";
    c.lineWidth = 1.6;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.2;
      const x = Math.cos(a) * spread * 0.62;
      const y = -spread * 0.7 + Math.sin(a) * spread * 0.44;
      c.beginPath();
      c.arc(x, y, 5.5, a - 1.1, a + 1.1);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.fillStyle = "rgba(255,246,200,0.95)";
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.9;
      ell(c, Math.cos(a) * spread * 0.5, -spread * 0.85 + Math.sin(a) * spread * 0.3, 1.6, 1.6);
      c.fill();
    }
  }
  c.restore();
}

export function drawPlant(c: Ctx, sp: SpeciesDef, look: PlantLook) {
  const p = palette(sp, look);
  const stage = Math.max(0, Math.min(6, look.stage));

  c.save();
  if (look.dead) c.globalAlpha = 0.75;
  if (look.wilted && !look.dead) {
    c.translate(0, 2);
    c.rotate(0.09); // droop
  }
  if (look.dead) c.rotate(0.22);

  if (stage === 0) {
    drawSeed(c, p);
  } else if (stage === 1) {
    drawSprout(c, p, sp.form === "pad" ? 18 : 24);
  } else {
    const t = clamp01((stage - 2) / 4);
    FORMS[sp.form](c, p, t, stage);
  }

  // a rare variant reads over whatever the species drew
  if (look.variant && !look.dead) paintVariant(c, look.variant, stage);

  c.restore();
}

/**
 * Roughly how tall each form draws, in logical units, so a celebration can
 * show every species at the same on-screen presence — a lily is short and a
 * sunflower is tall, but both should fill the moment equally.
 */
const NOMINAL_HEIGHT: Record<PlantForm, number> = {
  pad: 62, tall: 150, frond: 88, succulent: 82,
  vine: 108, bush: 78, orchid: 98, tree: 92,
};

/**
 * How tall this form stands in the yard at a given stage, in scene pixels.
 * The variant dressing orbits the plant's optical centre, and a lily pad and
 * a sunflower are nothing like the same height — a fixed offset leaves the
 * effect hanging in mid-air over the short ones.
 */
export function plantHeightPx(form: PlantForm, stage: number, spriteScale = 0.5): number {
  const grown = 0.28 + 0.72 * Math.min(1, Math.max(0, stage) / 6);
  return NOMINAL_HEIGHT[form] * grown * spriteScale * 2;
}

/** Sprite scale that renders `form` at about `targetPx` tall. */
export function bloomScale(form: PlantForm, targetPx = 300): number {
  return targetPx / (NOMINAL_HEIGHT[form] * 2);
}

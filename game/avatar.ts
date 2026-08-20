// ============================================================
// Gardener avatar: palettes + the painter used by both the Phaser
// scene (sprite frames) and the React customizer preview.
// Everything is drawn with Canvas2D — no asset files.
// ============================================================

import { type Ctx, lg, rgrad, rr, ell } from "./draw";

export type Avatar = { skin: number; hair: number; hairdo: number; hat: number; outfit: number };

export const DEFAULT_AVATAR: Avatar = { skin: 0, hair: 0, hairdo: 0, hat: 0, outfit: 0 };

export type Skin = { name: string; hi: string; mid: string; lo: string; blush: string };
export const SKINS: Skin[] = [
  { name: "Porcelain", hi: "#ffeeda", mid: "#ffd9b3", lo: "#eec096", blush: "rgba(247,150,150,0.6)" },
  { name: "Light",     hi: "#ffe4bd", mid: "#f7c894", lo: "#dda870", blush: "rgba(240,140,140,0.55)" },
  { name: "Tan",       hi: "#f6cd9a", mid: "#e8b477", lo: "#c9945a", blush: "rgba(225,120,110,0.5)" },
  { name: "Olive",     hi: "#e2b785", mid: "#c9975f", lo: "#a87844", blush: "rgba(200,105,95,0.45)" },
  { name: "Brown",     hi: "#c08a5a", mid: "#a06a40", lo: "#7f5030", blush: "rgba(170,85,75,0.4)" },
  { name: "Deep",      hi: "#8b5c39", mid: "#6d4526", lo: "#52321b", blush: "rgba(150,70,60,0.35)" },
];

export type Hairdo = { name: string };
export const HAIRDOS: Hairdo[] = [
  { name: "Cropped" },
  { name: "Long" },
  { name: "Ponytail" },
  { name: "Buns" },
];

export type Hair = { name: string; hi: string; lo: string };
export const HAIRS: Hair[] = [
  { name: "Chestnut", hi: "#8a6440", lo: "#5b3d25" },
  { name: "Raven",    hi: "#403631", lo: "#221c19" },
  { name: "Wheat",    hi: "#f0cd7e", lo: "#c99f47" },
  { name: "Auburn",   hi: "#c4603a", lo: "#8e3d22" },
  { name: "Silver",   hi: "#e2e2dc", lo: "#b3b3ab" },
  { name: "Blossom",  hi: "#f7a8c4", lo: "#d4718f" },
];

export type Outfit = {
  name: string;
  shirtHi: string; shirtMid: string; shirtLo: string;
  ovHi: string; ovMid: string; ovLo: string; strap: string;
  bootHi: string; bootLo: string;
};
export const OUTFITS: Outfit[] = [
  { name: "Classic", shirtHi: "#f5a678", shirtMid: "#e58f65", shirtLo: "#cf7850",
    ovHi: "#84a0cb", ovMid: "#6f8ab3", ovLo: "#597097", strap: "#5a7299", bootHi: "#a06b45", bootLo: "#6d4628" },
  { name: "Meadow", shirtHi: "#fbeecb", shirtMid: "#f2e0b0", shirtLo: "#dcc68f",
    ovHi: "#78c489", ovMid: "#57a768", ovLo: "#3f8850", strap: "#387a47", bootHi: "#9a6a45", bootLo: "#68452a" },
  { name: "Berry", shirtHi: "#fffaf2", shirtMid: "#f6ecdd", shirtLo: "#ded1bf",
    ovHi: "#e79ab8", ovMid: "#d4789c", ovLo: "#b25a7c", strap: "#a04f6e", bootHi: "#8f6a52", bootLo: "#5f4534" },
  { name: "Dusk", shirtHi: "#8fd6da", shirtMid: "#6bbcc2", shirtLo: "#4d9aa1",
    ovHi: "#9b8cd6", ovMid: "#7d6cbd", ovLo: "#61519c", strap: "#584a8c", bootHi: "#7d6a58", bootLo: "#52443a" },
  { name: "Sunny", shirtHi: "#ffffff", shirtMid: "#f3f1e8", shirtLo: "#d9d6c8",
    ovHi: "#f5cc63", ovMid: "#e0b03d", ovLo: "#bd8f26", strap: "#a87e21", bootHi: "#a4744a", bootLo: "#6f4a2c" },
  { name: "Slate", shirtHi: "#cfd6e0", shirtMid: "#b4bdc9", shirtLo: "#939ead",
    ovHi: "#68727f", ovMid: "#515a66", ovLo: "#3b434d", strap: "#333a42", bootHi: "#6d5f52", bootLo: "#443b33" },
];

export type HatStyle = { name: string; kind: "straw" | "none" | "cap" | "crown" | "beanie"; a: string; b: string; c: string };
export const HATS: HatStyle[] = [
  { name: "Straw hat",    kind: "straw",  a: "#f5dd94", b: "#e8c268", c: "#c98d4b" },
  { name: "Bare head",    kind: "none",   a: "", b: "", c: "" },
  { name: "Ball cap",     kind: "cap",    a: "#ee8a72", b: "#d05a45", c: "#a8402f" },
  { name: "Flower crown", kind: "crown",  a: "#f7a8c4", b: "#ffd76e", c: "#8ed69b" },
  { name: "Cozy beanie",  kind: "beanie", a: "#7fbfd6", b: "#4f97b5", c: "#f2f6f8" },
];

export const PALETTES = { SKINS, HAIRS, HAIRDOS, HATS, OUTFITS };

/** Clamp arbitrary input (e.g. from the DB) to a renderable avatar. */
export function safeAvatar(a: Partial<Avatar> | null | undefined): Avatar {
  const pick = (v: unknown, len: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(len - 1, Math.floor(v))) : 0;
  return {
    skin: pick(a?.skin, SKINS.length),
    hair: pick(a?.hair, HAIRS.length),
    hairdo: pick((a as Partial<Avatar> | null | undefined)?.hairdo, HAIRDOS.length),
    hat: pick(a?.hat, HATS.length),
    outfit: pick(a?.outfit, OUTFITS.length),
  };
}

export type Pose = {
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  blink?: boolean;
  /** watering can placement, in frame-logical coords */
  can?: { x: number; y: number; tilt: number };
};

// ---- Frame geometry (logical units; textures are painted at 2x) ----
export const FRAME_W = 120;
export const FRAME_H = 104;
export const BODY_CX = 48;   // body centre -> sprite origin x = BODY_CX / FRAME_W
export const FEET_LY = 100;  // feet line   -> sprite origin y = FEET_LY / FRAME_H

/** Spout tip of the tilted can in the `pour_1` frame, as an offset from the sprite origin. */
export const SPOUT_OFFSET = { x: 58, y: -60 };

export const POSES: Array<[string, Pose]> = [
  ["g_idle_0", { legL: 0, legR: 0, armL: 0.12, armR: -0.12 }],
  ["g_idle_1", { legL: 0, legR: 0, armL: 0.12, armR: -0.12, blink: true }],
  ["g_walk_0", { legL: -0.5, legR: 0.5, armL: 0.55, armR: -0.4 }],
  ["g_walk_1", { legL: -0.18, legR: 0.18, armL: 0.2, armR: -0.15 }],
  ["g_walk_2", { legL: 0.5, legR: -0.5, armL: -0.4, armR: 0.55 }],
  ["g_walk_3", { legL: 0.18, legR: -0.18, armL: -0.15, armR: 0.2 }],
  // Pouring: right arm reaches up-forward to the can, can tilts spout DOWN-forward.
  ["g_pour_0", { legL: -0.08, legR: 0.12, armL: 0.3, armR: -1.75, can: { x: 74, y: 36, tilt: 0.14 } }],
  ["g_pour_1", { legL: -0.08, legR: 0.12, armL: 0.3, armR: -1.85, can: { x: 74, y: 34, tilt: 0.6 } }],
];

/**
 * Paints the gardener into a FRAME_W x FRAME_H logical box (feet at BODY_CX, FEET_LY).
 * Caller is responsible for any scaling (textures use c.scale(2, 2)).
 */
export function paintGardener(c: Ctx, p: Pose, av: Avatar) {
  const skin = SKINS[av.skin] ?? SKINS[0];
  const hair = HAIRS[av.hair] ?? HAIRS[0];
  const hat = HATS[av.hat] ?? HATS[0];
  const fit = OUTFITS[av.outfit] ?? OUTFITS[0];
  const cx = BODY_CX;

  // ---- legs ----
  const leg = (hipX: number, ang: number) => {
    c.save();
    c.translate(hipX, 66);
    c.rotate(ang);
    c.fillStyle = lg(c, -5.5, 0, 5.5, 0, [[0, fit.ovHi], [0.5, fit.ovMid], [1, fit.ovLo]]);
    rr(c, -5.5, 0, 11, 28, 5); c.fill();
    c.fillStyle = lg(c, 0, 24, 0, 33, [[0, fit.bootHi], [1, fit.bootLo]]);
    rr(c, -6.5, 24, 15, 9, 4); c.fill();
    c.fillStyle = "rgba(255,255,255,0.25)";
    rr(c, -5, 25, 12, 3, 2); c.fill();
    c.restore();
  };
  leg(cx - 8, p.legL);
  leg(cx + 8, p.legR);

  // ---- torso ----
  c.fillStyle = lg(c, cx - 19, 0, cx + 19, 0, [[0, fit.shirtHi], [0.5, fit.shirtMid], [1, fit.shirtLo]]);
  rr(c, cx - 19, 36, 38, 22, 9); c.fill();
  c.fillStyle = lg(c, cx - 17, 44, cx + 17, 72, [[0, fit.ovHi], [0.55, fit.ovMid], [1, fit.ovLo]]);
  rr(c, cx - 17, 44, 34, 28, 8); c.fill();
  c.fillStyle = "rgba(255,255,255,0.14)";
  rr(c, cx - 14, 46, 12, 22, 6); c.fill();
  c.fillStyle = fit.strap;
  c.fillRect(cx - 12, 36, 6, 12); c.fillRect(cx + 6, 36, 6, 12);
  c.fillStyle = rgrad(c, cx - 9, 45, 4, [[0, "#ffe9a8"], [1, "#e5b93e"]]);
  ell(c, cx - 9, 46, 2.2, 2.2); c.fill();
  c.fillStyle = rgrad(c, cx + 9, 45, 4, [[0, "#ffe9a8"], [1, "#e5b93e"]]);
  ell(c, cx + 9, 46, 2.2, 2.2); c.fill();
  c.fillStyle = fit.strap;
  rr(c, cx - 7, 52, 14, 10, 4); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.25)"; c.lineWidth = 1.4;
  rr(c, cx - 7, 52, 14, 10, 4); c.stroke();

  // ---- arms ----
  const arm = (shX: number, ang: number, front: boolean) => {
    c.save();
    c.translate(shX, 42);
    c.rotate(ang);
    c.fillStyle = front
      ? lg(c, -4.5, 0, 4.5, 0, [[0, fit.shirtHi], [1, fit.shirtLo]])
      : fit.shirtLo;
    rr(c, -4.5, 0, 9, 24, 4.5); c.fill();
    c.fillStyle = rgrad(c, -1, 22, 7, [[0, skin.hi], [1, skin.mid]]);
    ell(c, 0, 24, 4.5, 4.5); c.fill();
    c.restore();
  };
  arm(cx - 16, p.armL, false);
  arm(cx + 16, p.armR, true);

  // ---- watering can (spout points down-forward when tilted) ----
  if (p.can) {
    c.save();
    c.translate(p.can.x, p.can.y);
    c.rotate(p.can.tilt);
    c.fillStyle = lg(c, -2, -9, -2, 8, [[0, "#c4e0ee"], [0.5, "#9ec9dd"], [1, "#79aec6"]]);
    rr(c, -2, -9, 22, 17, 5); c.fill();
    c.fillStyle = "rgba(255,255,255,0.5)";
    rr(c, 1, -7, 4, 12, 2); c.fill();
    c.fillStyle = "#7fb0c9";
    c.beginPath(); c.moveTo(19, -4); c.lineTo(30, -13); c.lineTo(24, 1); c.closePath(); c.fill();
    c.fillStyle = "#6a9cb5"; ell(c, 29, -13, 3.5, 2); c.fill();
    c.strokeStyle = "#7fa8bd"; c.lineWidth = 3;
    c.beginPath(); c.arc(8, -10, 7, Math.PI, 0, false); c.stroke();
    c.restore();
  }

  // ---- hair (behind the face) ----
  const hairdo = HAIRDOS[(av as Avatar).hairdo ?? 0] ? ((av as Avatar).hairdo ?? 0) : 0;
  c.fillStyle = rgrad(c, cx - 5, 16, 22, [[0, hair.hi], [1, hair.lo]]);
  ell(c, cx, 22, 15.5, 15.5); c.fill();

  if (hairdo === 1) {
    // long: soft falls down both shoulders
    c.fillStyle = lg(c, 0, 20, 0, 52, [[0, hair.hi], [1, hair.lo]]);
    c.beginPath();
    c.moveTo(cx - 15, 18);
    c.quadraticCurveTo(cx - 20, 34, cx - 17, 50);
    c.quadraticCurveTo(cx - 12, 53, cx - 9, 49);
    c.quadraticCurveTo(cx - 13, 34, cx - 11, 22);
    c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(cx + 15, 18);
    c.quadraticCurveTo(cx + 20, 34, cx + 17, 50);
    c.quadraticCurveTo(cx + 12, 53, cx + 9, 49);
    c.quadraticCurveTo(cx + 13, 34, cx + 11, 22);
    c.closePath(); c.fill();
  } else if (hairdo === 2) {
    // ponytail swinging off to one side
    c.fillStyle = lg(c, 0, 14, 0, 46, [[0, hair.hi], [1, hair.lo]]);
    c.beginPath();
    c.moveTo(cx + 12, 14);
    c.quadraticCurveTo(cx + 24, 20, cx + 21, 42);
    c.quadraticCurveTo(cx + 18, 46, cx + 15, 42);
    c.quadraticCurveTo(cx + 16, 26, cx + 8, 16);
    c.closePath(); c.fill();
    c.fillStyle = hair.lo;
    ell(c, cx + 11, 15, 3, 3); c.fill();
  } else if (hairdo === 3) {
    // two round buns above the ears
    c.fillStyle = rgrad(c, cx - 14, 10, 8, [[0, hair.hi], [1, hair.lo]]);
    ell(c, cx - 13, 12, 5.5, 5.5); c.fill();
    c.fillStyle = rgrad(c, cx + 12, 10, 8, [[0, hair.hi], [1, hair.lo]]);
    ell(c, cx + 13, 12, 5.5, 5.5); c.fill();
  }
  if (hat.kind === "none" || hat.kind === "crown") {
    // fuller hair so an uncovered head doesn't read as bald
    c.fillStyle = hair.lo;
    ell(c, cx, 17, 16, 12); c.fill();
    c.fillStyle = hair.hi;
    ell(c, cx - 6, 14, 8, 6); c.fill();
    c.beginPath();
    c.moveTo(cx - 15, 20);
    c.quadraticCurveTo(cx - 10, 8, cx + 4, 10);
    c.quadraticCurveTo(cx + 14, 12, cx + 15, 22);
    c.quadraticCurveTo(cx + 6, 14, cx - 15, 20);
    c.closePath(); c.fill();
  }

  // ---- face ----
  c.fillStyle = rgrad(c, cx - 5, 19, 20, [[0, skin.hi], [0.7, skin.mid], [1, skin.lo]]);
  ell(c, cx, 24, 14, 14); c.fill();
  c.fillStyle = skin.blush;
  ell(c, cx - 8.5, 28, 3, 2.4); c.fill(); ell(c, cx + 8.5, 28, 3, 2.4); c.fill();
  if (p.blink) {
    c.strokeStyle = "#2f2a26"; c.lineWidth = 2; c.lineCap = "round";
    c.beginPath(); c.moveTo(cx - 8, 24); c.lineTo(cx - 3, 24); c.stroke();
    c.beginPath(); c.moveTo(cx + 3, 24); c.lineTo(cx + 8, 24); c.stroke();
  } else {
    c.fillStyle = "#2f2a26";
    ell(c, cx - 5.5, 24, 2.2, 2.4); c.fill(); ell(c, cx + 5.5, 24, 2.2, 2.4); c.fill();
    c.fillStyle = "rgba(255,255,255,0.9)";
    ell(c, cx - 4.8, 23.2, 0.8, 0.8); c.fill(); ell(c, cx + 6.2, 23.2, 0.8, 0.8); c.fill();
  }
  c.strokeStyle = "rgba(120,60,50,0.75)"; c.lineWidth = 2; c.lineCap = "round";
  c.beginPath(); c.arc(cx, 27.5, 5, 0.35, Math.PI - 0.35, false); c.stroke();

  // ---- hat ----
  if (hat.kind === "straw") {
    c.fillStyle = "rgba(120,80,30,0.3)";
    ell(c, cx, 15.5, 21, 5.5); c.fill();
    c.fillStyle = lg(c, cx - 21, 8, cx + 21, 18, [[0, hat.a], [0.55, hat.b], [1, hat.c]]);
    ell(c, cx, 13, 21, 5.5); c.fill();
    c.fillStyle = rgrad(c, cx - 4, 5, 16, [[0, hat.a], [0.7, hat.b], [1, hat.c]]);
    ell(c, cx, 8, 12, 7); c.fill();
    c.fillStyle = hat.c;
    c.fillRect(cx - 12, 8, 24, 4);
  } else if (hat.kind === "cap") {
    c.fillStyle = "rgba(60,30,20,0.25)";
    ell(c, cx + 8, 15, 15, 4); c.fill();
    c.fillStyle = lg(c, cx + 2, 12, cx + 22, 18, [[0, hat.b], [1, hat.c]]);
    c.beginPath(); c.ellipse(cx + 8, 13.5, 15, 4.5, 0, 0, Math.PI, false); c.fill();
    c.fillStyle = rgrad(c, cx - 5, 4, 20, [[0, hat.a], [0.65, hat.b], [1, hat.c]]);
    c.beginPath(); c.ellipse(cx, 13, 14, 12, 0, Math.PI, 0, false); c.fill();
    c.fillStyle = "rgba(255,255,255,0.28)";
    ell(c, cx - 5, 6, 5, 3.4); c.fill();
    c.fillStyle = hat.c;
    ell(c, cx, 1.5, 2.2, 2.2); c.fill();
  } else if (hat.kind === "beanie") {
    c.fillStyle = rgrad(c, cx - 5, 4, 20, [[0, hat.a], [0.65, hat.b], [1, hat.b]]);
    c.beginPath(); c.ellipse(cx, 14, 14.5, 13, 0, Math.PI, 0, false); c.fill();
    c.fillStyle = lg(c, cx - 15, 0, cx + 15, 0, [[0, hat.b], [0.5, hat.a], [1, hat.b]]);
    rr(c, cx - 15, 11, 30, 7, 3.5); c.fill();
    c.fillStyle = "rgba(255,255,255,0.3)";
    rr(c, cx - 12, 12.5, 8, 2, 1); c.fill();
    c.fillStyle = hat.c;
    ell(c, cx, 0, 4, 4); c.fill();
  } else if (hat.kind === "crown") {
    const cols = [hat.a, hat.b, hat.c, hat.a, hat.b];
    for (let k = 0; k < 5; k++) {
      const t = -0.15 + (k / 4) * (Math.PI + 0.3);
      const fx = cx - Math.cos(t) * 15;
      const fy = 15 - Math.sin(t) * 11;
      c.fillStyle = cols[k];
      for (let q = 0; q < 5; q++) {
        const a2 = (q / 5) * Math.PI * 2;
        ell(c, fx + Math.cos(a2) * 2.4, fy + Math.sin(a2) * 2.4, 1.9, 1.9); c.fill();
      }
      c.fillStyle = "#ffe9a8";
      ell(c, fx, fy, 1.5, 1.5); c.fill();
    }
  }
}

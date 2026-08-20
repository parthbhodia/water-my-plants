// ============================================================
// Granny Fern — the neighbour who talks you through the game.
// A portrait bust painted with Canvas2D, same idiom as avatar.ts:
// palette + parametric painter, no asset files. Used by the React
// speech bubble (toasts, tutorial, daily brief).
// ============================================================

import { type Ctx, lg, ell, rr } from "./draw";

export type GuideMood = "happy" | "cheer" | "worry" | "proud" | "sleepy";

export const GUIDE_NAME = "Granny Fern";

/** Square portrait frame; callers scale via canvas size. */
export const GUIDE_SIZE = 120;

export function paintGuide(c: Ctx, mood: GuideMood = "happy") {
  const CX = 60;

  c.save();

  // soft round backdrop so the portrait reads on any surface
  c.fillStyle = lg(c, 0, 8, 0, 118, [[0, "#e9f6ec"], [1, "#cfe9d6"]]);
  ell(c, CX, 62, 54, 54);
  c.fill();
  c.strokeStyle = "rgba(62,142,82,.35)";
  c.lineWidth = 3;
  ell(c, CX, 62, 54, 54);
  c.stroke();

  // clip everything below to the medallion
  ell(c, CX, 62, 52, 52);
  c.clip();

  // ---- shoulders: moss-green cardigan + apron strap ----
  c.fillStyle = lg(c, 0, 88, 0, 120, [[0, "#78a86c"], [1, "#557d4c"]]);
  ell(c, CX, 124, 46, 34);
  c.fill();
  // collar
  c.fillStyle = "#f4eddc";
  ell(c, CX, 104, 15, 9);
  c.fill();
  // apron straps
  c.strokeStyle = "#c9803f";
  c.lineWidth = 7;
  c.beginPath(); c.moveTo(CX - 20, 124); c.lineTo(CX - 10, 100); c.stroke();
  c.beginPath(); c.moveTo(CX + 20, 124); c.lineTo(CX + 10, 100); c.stroke();

  // ---- head ----
  const skinHi = "#ffe9cf", skinMid = "#f7d3a8", skinLo = "#dbb283";
  c.fillStyle = lg(c, 0, 40, 0, 96, [[0, skinHi], [0.65, skinMid], [1, skinLo]]);
  ell(c, CX, 68, 26, 28);
  c.fill();
  // ears
  c.fillStyle = skinMid;
  ell(c, CX - 26, 70, 4.5, 6); c.fill();
  ell(c, CX + 26, 70, 4.5, 6); c.fill();

  // laugh-line cheeks
  c.fillStyle = "rgba(240,150,140,.4)";
  ell(c, CX - 15, 78, 6, 4); c.fill();
  ell(c, CX + 15, 78, 6, 4); c.fill();

  // ---- silver hair: side sweeps + bun peeking over the hat brim ----
  const hairHi = "#e8e6de", hairLo = "#bdbbb0";
  c.fillStyle = lg(c, 0, 48, 0, 80, [[0, hairHi], [1, hairLo]]);
  c.beginPath();
  c.moveTo(CX - 26, 60);
  c.quadraticCurveTo(CX - 30, 76, CX - 22, 84);
  c.quadraticCurveTo(CX - 26, 66, CX - 18, 56);
  c.closePath(); c.fill();
  c.beginPath();
  c.moveTo(CX + 26, 60);
  c.quadraticCurveTo(CX + 30, 76, CX + 22, 84);
  c.quadraticCurveTo(CX + 26, 66, CX + 18, 56);
  c.closePath(); c.fill();

  // ---- straw sun hat with a little fern sprig ----
  c.fillStyle = lg(c, 0, 30, 0, 56, [[0, "#f5dd94"], [1, "#e0bd62"]]);
  ell(c, CX, 52, 40, 11);       // brim
  c.fill();
  c.fillStyle = lg(c, 0, 18, 0, 50, [[0, "#f8e4a6"], [1, "#e5c46e"]]);
  c.beginPath();
  c.moveTo(CX - 24, 50);
  c.quadraticCurveTo(CX - 22, 22, CX, 20);
  c.quadraticCurveTo(CX + 22, 22, CX + 24, 50);
  c.closePath(); c.fill();
  // band
  c.fillStyle = "#7ba86e";
  rr(c, CX - 24, 43, 48, 7, 3); c.fill();
  // fern sprig on the band
  c.strokeStyle = "#3e8e52";
  c.lineWidth = 2;
  c.beginPath(); c.moveTo(CX + 12, 46); c.quadraticCurveTo(CX + 20, 38, CX + 26, 36); c.stroke();
  c.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) {
    const t = 0.3 + i * 0.18;
    const px = CX + 12 + (26 - 12) * t;
    const py = 46 - 9 * t;
    c.beginPath(); c.moveTo(px, py); c.lineTo(px - 3, py - 4); c.stroke();
    c.beginPath(); c.moveTo(px, py); c.lineTo(px + 1, py - 5); c.stroke();
  }

  // ---- face by mood ----
  const browY = mood === "worry" ? 58 : 60;
  const browTilt = mood === "worry" ? 3 : mood === "cheer" ? -1.5 : 0;
  c.strokeStyle = "#a9a79c";
  c.lineWidth = 2.6;
  c.lineCap = "round";
  c.beginPath(); c.moveTo(CX - 16, browY + browTilt); c.quadraticCurveTo(CX - 11, browY - 3, CX - 6, browY + (mood === "worry" ? -1 : 0)); c.stroke();
  c.beginPath(); c.moveTo(CX + 6, browY + (mood === "worry" ? -1 : 0)); c.quadraticCurveTo(CX + 11, browY - 3, CX + 16, browY + browTilt); c.stroke();

  // round glasses
  c.strokeStyle = "#8a6a4a";
  c.lineWidth = 2.2;
  ell(c, CX - 11, 68, 8.5, 8); c.stroke();
  ell(c, CX + 11, 68, 8.5, 8); c.stroke();
  c.beginPath(); c.moveTo(CX - 2.5, 67); c.quadraticCurveTo(CX, 65.4, CX + 2.5, 67); c.stroke();
  c.fillStyle = "rgba(255,255,255,.28)";
  ell(c, CX - 11, 68, 8, 7.5); c.fill();
  ell(c, CX + 11, 68, 8, 7.5); c.fill();

  // eyes
  c.fillStyle = "#4a3a2c";
  if (mood === "cheer" || mood === "proud") {
    // closed, delighted arcs
    c.strokeStyle = "#4a3a2c";
    c.lineWidth = 2.4;
    c.beginPath(); c.arc(CX - 11, 69, 4.5, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    c.beginPath(); c.arc(CX + 11, 69, 4.5, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  } else if (mood === "sleepy") {
    c.strokeStyle = "#4a3a2c";
    c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(CX - 15, 69); c.quadraticCurveTo(CX - 11, 71.5, CX - 7, 69); c.stroke();
    c.beginPath(); c.moveTo(CX + 7, 69); c.quadraticCurveTo(CX + 11, 71.5, CX + 15, 69); c.stroke();
  } else {
    ell(c, CX - 11, 69, 2.6, 3); c.fill();
    ell(c, CX + 11, 69, 2.6, 3); c.fill();
    c.fillStyle = "rgba(255,255,255,.85)";
    ell(c, CX - 12, 68, 0.9, 1); c.fill();
    ell(c, CX + 10, 68, 0.9, 1); c.fill();
  }

  // nose
  c.strokeStyle = "rgba(160,110,70,.6)";
  c.lineWidth = 2;
  c.beginPath(); c.moveTo(CX, 72); c.quadraticCurveTo(CX + 2.5, 76, CX, 78); c.stroke();

  // mouth
  c.lineWidth = 2.4;
  c.strokeStyle = "#8a4a3a";
  if (mood === "cheer") {
    c.fillStyle = "#8a4a3a";
    c.beginPath(); c.arc(CX, 84, 6, 0, Math.PI); c.closePath(); c.fill();
    c.fillStyle = "#e88a8a";
    ell(c, CX, 87.5, 3.4, 1.8); c.fill();
  } else if (mood === "worry") {
    c.beginPath(); c.moveTo(CX - 5, 86.5); c.quadraticCurveTo(CX, 84, CX + 5, 86.5); c.stroke();
  } else if (mood === "sleepy") {
    ell(c, CX, 85.5, 2.6, 3.2);
    c.stroke();
  } else {
    // happy / proud: warm closed smile
    c.beginPath(); c.moveTo(CX - 6.5, 83); c.quadraticCurveTo(CX, 88.5, CX + 6.5, 83); c.stroke();
  }

  c.restore();
}

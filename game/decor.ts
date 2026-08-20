// Garden ornaments, drawn from the plant's base point upward like everything else.

import { type Ctx, lg, rgrad, rr, ell } from "./draw";

export type DecorKey =
  | "decor_lantern" | "decor_bench" | "decor_birdbath"
  | "decor_koi" | "decor_gnome" | "decor_arch";

/** Slot anchors: four along the fence, four in the near foreground. */
export const DECOR_SLOTS: Array<{ x: number; y: number; back: boolean }> = [
  { x: 240, y: 418, back: true },
  { x: 420, y: 415, back: true },
  { x: 620, y: 418, back: true },
  { x: 880, y: 424, back: true },
  { x: 150, y: 574, back: false },
  { x: 380, y: 580, back: false },
  { x: 700, y: 578, back: false },
  { x: 930, y: 570, back: false },
];

const shadow = (c: Ctx, rx: number) => {
  c.fillStyle = "rgba(20,55,38,.28)";
  ell(c, 2, 2, rx, rx * 0.32); c.fill();
};

function lantern(c: Ctx) {
  shadow(c, 17);
  c.fillStyle = lg(c, -13, 0, 13, 0, [[0, "#cfd6cd"], [0.5, "#a9b2aa"], [1, "#7f8880"]]);
  rr(c, -13, -8, 26, 8, 3); c.fill();                     // base
  c.fillStyle = "#98a199";
  rr(c, -6, -26, 12, 19, 3); c.fill();                    // post
  c.fillStyle = lg(c, -16, -46, 16, -30, [[0, "#c6cec5"], [1, "#8d968e"]]);
  rr(c, -16, -46, 32, 17, 4); c.fill();                   // light box
  c.fillStyle = "rgba(255,225,140,.85)";
  rr(c, -11, -43, 22, 11, 2); c.fill();                   // window
  c.fillStyle = "#7f8880";
  c.beginPath(); c.moveTo(-19, -46); c.lineTo(19, -46); c.lineTo(0, -60); c.closePath(); c.fill();
  c.fillStyle = "#98a199"; ell(c, 0, -61, 4, 3); c.fill();
}

function bench(c: Ctx) {
  shadow(c, 30);
  const wood = lg(c, 0, -30, 0, -6, [[0, "#b98a5c"], [1, "#8a613b"]]);
  c.fillStyle = "#6d4a2c";
  rr(c, -24, -16, 5, 16, 2); c.fill();
  rr(c, 19, -16, 5, 16, 2); c.fill();                     // legs
  c.fillStyle = wood;
  rr(c, -28, -20, 56, 6, 3); c.fill();                    // seat
  rr(c, -28, -34, 56, 5, 2.5); c.fill();                  // back slat
  rr(c, -28, -26, 56, 4, 2); c.fill();
  c.fillStyle = "#6d4a2c";
  rr(c, -25, -36, 4, 18, 2); c.fill();
  rr(c, 21, -36, 4, 18, 2); c.fill();                     // back posts
  c.fillStyle = "rgba(255,255,255,.2)";
  rr(c, -26, -19, 52, 2, 1); c.fill();
}

function birdbath(c: Ctx) {
  shadow(c, 20);
  c.fillStyle = lg(c, -12, 0, 12, 0, [[0, "#dfe3da"], [0.5, "#b9bfb4"], [1, "#8f968b"]]);
  rr(c, -12, -8, 24, 8, 3); c.fill();
  rr(c, -5, -30, 10, 23, 3); c.fill();
  c.fillStyle = lg(c, -20, -38, 20, -28, [[0, "#e6eae0"], [1, "#a8b0a3"]]);
  ell(c, 0, -34, 20, 7); c.fill();
  c.fillStyle = rgrad(c, -4, -36, 18, [[0, "#a5dcf2"], [1, "#4f9fc4"]]);
  ell(c, 0, -35, 15, 4.6); c.fill();
  c.fillStyle = "rgba(255,255,255,.6)";
  ell(c, -5, -36, 5, 1.6); c.fill();
}

function gnome(c: Ctx) {
  shadow(c, 13);
  c.fillStyle = lg(c, -10, 0, 10, 0, [[0, "#6fa4d6"], [1, "#4577ac"]]);
  rr(c, -10, -20, 20, 20, 7); c.fill();                   // body
  c.fillStyle = "#e8c9a8";
  ell(c, 0, -25, 8, 7); c.fill();                         // face
  c.fillStyle = "#f2f2ee";
  c.beginPath(); c.moveTo(-7, -23); c.quadraticCurveTo(0, -6, 7, -23); c.closePath(); c.fill();
  c.fillStyle = lg(c, 0, -46, 0, -28, [[0, "#e05a4a"], [1, "#b23c2f"]]);
  c.beginPath(); c.moveTo(-11, -29); c.lineTo(11, -29); c.lineTo(0, -50); c.closePath(); c.fill();
  c.fillStyle = "#2f2a26";
  ell(c, -3, -27, 1.3, 1.5); c.fill(); ell(c, 3, -27, 1.3, 1.5); c.fill();
}

function arch(c: Ctx) {
  shadow(c, 34);
  c.strokeStyle = lg(c, -30, 0, 30, 0, [[0, "#9fae9a"], [1, "#75846f"]]);
  c.lineWidth = 6; c.lineCap = "round";
  c.beginPath(); c.moveTo(-26, 0); c.lineTo(-26, -46); c.stroke();
  c.beginPath(); c.moveTo(26, 0); c.lineTo(26, -46); c.stroke();
  c.beginPath(); c.arc(0, -46, 26, Math.PI, 0); c.stroke();
  // climbing roses
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const a = Math.PI + t * Math.PI;
    const x = Math.cos(a) * 26;
    const y = -46 + Math.sin(a) * 26;
    c.fillStyle = i % 3 === 0 ? "#ee7fa9" : i % 3 === 1 ? "#f7a8c4" : "#6cc17b";
    ell(c, x, y, 4.5, 4); c.fill();
  }
  for (const sx of [-26, 26]) {
    for (let k = 0; k < 4; k++) {
      c.fillStyle = k % 2 ? "#58b368" : "#3e8e52";
      ell(c, sx + (k % 2 ? 5 : -5), -8 - k * 11, 5, 3.4); c.fill();
    }
  }
}

/** Koi always swim in the pond, wherever their slot happens to be. */
export function drawKoi(c: Ctx, t: number) {
  for (let i = 0; i < 3; i++) {
    const a = t / 2600 + (i * Math.PI * 2) / 3;
    const x = Math.cos(a) * 96;
    const y = Math.sin(a) * 26;
    const flip = Math.sin(a) > 0 ? 1 : -1;
    c.save();
    c.translate(x, y);
    c.rotate(Math.cos(a) * 0.25);
    c.scale(flip, 1);
    c.fillStyle = "rgba(255,255,255,.22)";
    ell(c, 0, 3, 15, 5); c.fill();
    c.fillStyle = i === 1 ? "#f5f1e6" : "#f08a4a";
    ell(c, 0, 0, 13, 5.2); c.fill();
    c.fillStyle = i === 1 ? "#e0623f" : "#ffd7a8";
    ell(c, -3, -1, 5, 3); c.fill();
    c.fillStyle = i === 1 ? "#f5f1e6" : "#f08a4a";
    c.beginPath(); c.moveTo(12, 0); c.lineTo(20, -5); c.lineTo(20, 5); c.closePath(); c.fill();
    c.restore();
  }
}

const PAINTERS: Record<string, (c: Ctx) => void> = {
  decor_lantern: lantern,
  decor_bench: bench,
  decor_birdbath: birdbath,
  decor_gnome: gnome,
  decor_arch: arch,
};

export function drawDecor(c: Ctx, key: string) {
  PAINTERS[key]?.(c);
}

export const DECOR_NAMES: Record<string, string> = {
  decor_lantern: "Stone Lantern",
  decor_bench: "Garden Bench",
  decor_birdbath: "Bird Bath",
  decor_koi: "Koi Fish",
  decor_gnome: "Garden Gnome",
  decor_arch: "Rose Arch",
};

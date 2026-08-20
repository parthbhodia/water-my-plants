// ============================================================
// Restorable fixtures — the ruins along the fence line and the
// finished pieces they become. Each painter draws into a 110x110
// box with the ground line at (55, 104), both states from the
// same hand so the transformation reads as repair, not replacement.
// ============================================================

import { type Ctx, lg, ell, rr } from "./draw";

export type FixtureDef = {
  key: string;
  zone: string;
  x: number;
  y: number;
  paint: (c: Ctx, restored: boolean) => void;
};

export const FIX_W = 110;
export const FIX_H = 110;
export const FIX_BX = 55;   // base centre x
export const FIX_BY = 104;  // ground line y

const stone = (c: Ctx, y0: number, y1: number) =>
  lg(c, 0, y0, 0, y1, [[0, "#d9d5c8"], [0.6, "#b8b3a4"], [1, "#918c7d"]]);
const oldStone = (c: Ctx, y0: number, y1: number) =>
  lg(c, 0, y0, 0, y1, [[0, "#b1ae9f"], [0.6, "#94907f"], [1, "#6f6b5c"]]);

function ivy(c: Ctx, x: number, y: number, n: number) {
  c.fillStyle = "#4e7d4a";
  for (let i = 0; i < n; i++) {
    ell(c, x + Math.sin(i * 2.1) * 7, y + i * 5, 4.2, 3);
    c.fill();
  }
}

function crack(c: Ctx, x: number, y: number, len: number) {
  c.strokeStyle = "rgba(50,45,35,.55)";
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + len * 0.3, y + len * 0.4);
  c.lineTo(x + len * 0.1, y + len * 0.75);
  c.stroke();
}

function groundShadow(c: Ctx, rx: number) {
  c.fillStyle = "rgba(20,55,38,.3)";
  ell(c, FIX_BX, FIX_BY, rx, rx * 0.28);
  c.fill();
}

// ---- Stone Fountain ----
function fountain(c: Ctx, restored: boolean) {
  groundShadow(c, 30);
  const S = restored ? stone : oldStone;
  // basin
  c.fillStyle = S(c, 82, 104);
  ell(c, FIX_BX, 92, 30, 11); c.fill();
  c.fillStyle = restored ? "#7fc8e8" : "#8a8574";
  ell(c, FIX_BX, 90, 25, 8); c.fill();
  // pedestal + bowl
  c.fillStyle = S(c, 58, 88);
  rr(c, FIX_BX - 5, 62, 10, 26, 3); c.fill();
  c.fillStyle = S(c, 52, 66);
  ell(c, FIX_BX, 60, 17, 6); c.fill();
  c.fillStyle = restored ? "#a5dcf2" : "#94907f";
  ell(c, FIX_BX, 58.5, 13, 4.2); c.fill();
  // crown
  c.fillStyle = S(c, 40, 56);
  rr(c, FIX_BX - 2.5, 42, 5, 14, 2); c.fill();
  ell(c, FIX_BX, 42, 4.5, 3); c.fill();

  if (restored) {
    // arcs of water from the crown
    c.strokeStyle = "rgba(160,220,245,.9)";
    c.lineWidth = 2;
    for (const dir of [-1, 1]) {
      c.beginPath();
      c.moveTo(FIX_BX, 43);
      c.quadraticCurveTo(FIX_BX + dir * 13, 46, FIX_BX + dir * 15, 58);
      c.stroke();
    }
    c.fillStyle = "rgba(255,255,255,.8)";
    ell(c, FIX_BX - 14, 58, 1.6, 1.6); c.fill();
    ell(c, FIX_BX + 14, 58, 1.6, 1.6); c.fill();
    // gleam
    c.fillStyle = "rgba(255,255,255,.5)";
    ell(c, FIX_BX - 9, 88, 6, 1.8); c.fill();
  } else {
    crack(c, FIX_BX - 18, 86, 12);
    crack(c, FIX_BX + 8, 60, 8);
    ivy(c, FIX_BX - 12, 56, 5);
    // tilted crown, dry leaves in the basin
    c.fillStyle = "#8a6a3f";
    ell(c, FIX_BX + 9, 89, 4, 1.8); c.fill();
    ell(c, FIX_BX - 6, 91, 3.4, 1.6); c.fill();
  }
}

// ---- Willow Swing ----
function swing(c: Ctx, restored: boolean) {
  groundShadow(c, 26);
  const wood = (y0: number, y1: number) =>
    lg(c, 0, y0, 0, y1, [[0, "#a8794c"], [1, "#7a5432"]]);
  // A-frame posts
  c.strokeStyle = restored ? "#8a6138" : "#6e5a44";
  c.lineWidth = 5;
  c.lineCap = "round";
  c.beginPath(); c.moveTo(FIX_BX - 24, FIX_BY); c.lineTo(FIX_BX - 12, 40); c.stroke();
  c.beginPath(); c.moveTo(FIX_BX + 24, FIX_BY); c.lineTo(FIX_BX + 12, 40); c.stroke();
  // crossbar
  c.fillStyle = wood(36, 44);
  rr(c, FIX_BX - 22, 36, 44, 6, 3); c.fill();

  if (restored) {
    // ropes + seat, hanging true
    c.strokeStyle = "#d9c49a";
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(FIX_BX - 8, 42); c.lineTo(FIX_BX - 8, 78); c.stroke();
    c.beginPath(); c.moveTo(FIX_BX + 8, 42); c.lineTo(FIX_BX + 8, 78); c.stroke();
    c.fillStyle = wood(76, 84);
    rr(c, FIX_BX - 12, 77, 24, 5, 2); c.fill();
    // flowering vine on the crossbar
    c.fillStyle = "#6cc17b";
    for (let i = 0; i < 6; i++) { ell(c, FIX_BX - 18 + i * 7, 35, 3.4, 2.6); c.fill(); }
    c.fillStyle = "#f7a8c4";
    ell(c, FIX_BX - 14, 33, 2, 2); c.fill();
    ell(c, FIX_BX + 6, 34, 2, 2); c.fill();
  } else {
    // one snapped rope, seat dangling vertically
    c.strokeStyle = "#b3a184";
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(FIX_BX - 8, 42); c.lineTo(FIX_BX - 7, 60); c.stroke(); // frayed stub
    c.beginPath(); c.moveTo(FIX_BX + 8, 42); c.lineTo(FIX_BX + 6, 82); c.stroke();
    c.save();
    c.translate(FIX_BX + 6, 82);
    c.rotate(1.25);
    c.fillStyle = wood(-3, 3);
    rr(c, -12, -2.5, 24, 5, 2); c.fill();
    c.restore();
    crack(c, FIX_BX - 18, 44, 9);
    ivy(c, FIX_BX + 14, 44, 4);
  }
}

// ---- Wishing Well ----
function well(c: Ctx, restored: boolean) {
  groundShadow(c, 27);
  const S = restored ? stone : oldStone;
  // ring
  c.fillStyle = S(c, 74, 104);
  ell(c, FIX_BX, 88, 24, 11); c.fill();
  c.fillStyle = "#2e2a22";
  ell(c, FIX_BX, 85, 17, 7); c.fill();
  // masonry hints
  c.strokeStyle = "rgba(60,55,45,.35)";
  c.lineWidth = 1.2;
  for (const dx of [-14, -3, 8]) {
    c.beginPath(); c.moveTo(FIX_BX + dx, 92); c.lineTo(FIX_BX + dx + 2, 99); c.stroke();
  }

  if (restored) {
    // posts + little roof + winch and bucket
    c.strokeStyle = "#8a6138";
    c.lineWidth = 4;
    c.beginPath(); c.moveTo(FIX_BX - 18, 84); c.lineTo(FIX_BX - 18, 52); c.stroke();
    c.beginPath(); c.moveTo(FIX_BX + 18, 84); c.lineTo(FIX_BX + 18, 52); c.stroke();
    c.fillStyle = lg(c, 0, 34, 0, 56, [[0, "#d97f62"], [1, "#b2543c"]]);
    c.beginPath();
    c.moveTo(FIX_BX - 26, 54); c.lineTo(FIX_BX, 34); c.lineTo(FIX_BX + 26, 54);
    c.lineTo(FIX_BX + 19, 54); c.lineTo(FIX_BX, 42); c.lineTo(FIX_BX - 19, 54);
    c.closePath(); c.fill();
    c.strokeStyle = "#6e4a2a";
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(FIX_BX - 20, 66); c.lineTo(FIX_BX + 20, 66); c.stroke();
    c.strokeStyle = "#d9c49a";
    c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(FIX_BX, 66); c.lineTo(FIX_BX, 76); c.stroke();
    c.fillStyle = "#a8794c";
    rr(c, FIX_BX - 4, 76, 8, 6, 1.5); c.fill();
  } else {
    // stub posts, collapsed roof plank, weeds
    c.strokeStyle = "#6e5a44";
    c.lineWidth = 4;
    c.beginPath(); c.moveTo(FIX_BX - 18, 84); c.lineTo(FIX_BX - 16, 62); c.stroke();
    c.beginPath(); c.moveTo(FIX_BX + 18, 84); c.lineTo(FIX_BX + 17, 72); c.stroke();
    c.save();
    c.translate(FIX_BX + 2, 70); c.rotate(-0.5);
    c.fillStyle = "#7a5432";
    rr(c, -16, -2.5, 32, 5, 2); c.fill();
    c.restore();
    crack(c, FIX_BX - 16, 88, 10);
    ivy(c, FIX_BX + 12, 78, 4);
    c.fillStyle = "#5e8a52";
    ell(c, FIX_BX - 20, 100, 5, 3); c.fill();
  }
}

// ---- Rose Arch ----
function arch(c: Ctx, restored: boolean) {
  groundShadow(c, 25);
  // the iron arc
  c.strokeStyle = restored ? "#5a6b5e" : "#6e5f4a";
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(FIX_BX - 22, FIX_BY);
  c.lineTo(FIX_BX - 22, 62);
  c.quadraticCurveTo(FIX_BX - 22, 40, FIX_BX, 40);
  c.quadraticCurveTo(FIX_BX + 22, 40, FIX_BX + 22, 62);
  c.lineTo(FIX_BX + 22, FIX_BY);
  c.stroke();
  // lattice rungs
  c.lineWidth = 2;
  for (const ry of [58, 72, 86]) {
    c.beginPath(); c.moveTo(FIX_BX - 22, ry); c.lineTo(FIX_BX - 15, ry - 4); c.stroke();
    c.beginPath(); c.moveTo(FIX_BX + 22, ry); c.lineTo(FIX_BX + 15, ry - 4); c.stroke();
  }

  if (restored) {
    // climbing roses over the whole arc
    const along = (t: number) => {
      const x = FIX_BX + Math.sin((t - 0.5) * Math.PI) * 22;
      const y = t < 0.2 || t > 0.8 ? 62 + (Math.abs(t - 0.5) - 0.3) * 2 * 84 : 40 + Math.abs(t - 0.5) * 44;
      return { x, y };
    };
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const p = along(t);
      c.fillStyle = "#5e9e5a";
      ell(c, p.x, p.y, 4.4, 3.4); c.fill();
    }
    for (let i = 0; i < 8; i++) {
      const t = 0.08 + (i / 7) * 0.84;
      const p = along(t);
      c.fillStyle = i % 2 ? "#ee7fa9" : "#f7a8c4";
      ell(c, p.x + (i % 3) - 1, p.y - 2, 2.6, 2.6); c.fill();
      c.fillStyle = "#ffd76e";
      ell(c, p.x + (i % 3) - 1, p.y - 2, 0.9, 0.9); c.fill();
    }
  } else {
    // rust spots and one dead tendril
    c.fillStyle = "#8a5a3a";
    for (const [rx, ry] of [[-22, 70], [-22, 92], [22, 64], [22, 84], [-8, 41]] as const) {
      ell(c, FIX_BX + rx, ry, 2.2, 2.6); c.fill();
    }
    c.strokeStyle = "#7d6a4a";
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(FIX_BX - 22, FIX_BY);
    c.quadraticCurveTo(FIX_BX - 26, 80, FIX_BX - 20, 68);
    c.stroke();
    ivy(c, FIX_BX - 22, 88, 3);
  }
}

/** Anchors sit along the fence line, above the low pond plots. */
export const FIXTURES: FixtureDef[] = [
  { key: "fountain", zone: "glade",  x: 540, y: 387, paint: fountain },
  { key: "swing",    zone: "glade",  x: 614, y: 387, paint: swing },
  { key: "well",     zone: "meadow", x: 382, y: 387, paint: well },
  { key: "arch",     zone: "meadow", x: 452, y: 389, paint: arch },
];

/** Zone fog patches: centre + radii for the soft cover while locked. */
export const ZONE_FOG: Record<string, { x: number; y: number; rx: number; ry: number }> = {
  glade:  { x: 578, y: 362, rx: 86, ry: 46 },
  meadow: { x: 418, y: 362, rx: 82, ry: 46 },
};

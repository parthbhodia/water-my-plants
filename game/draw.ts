// Shared Canvas2D helpers — used by the Phaser scene and the React avatar preview.

export type Ctx = CanvasRenderingContext2D;
export type Stop = [number, string];

export function lg(c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: Stop[]) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

export function rgrad(c: Ctx, x: number, y: number, r: number, stops: Stop[]) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

export function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export function ell(c: Ctx, x: number, y: number, rx: number, ry: number) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.closePath();
}

/** smooth organic closed blob through wobbled ellipse points */
export function blob(c: Ctx, cx: number, cy: number, rx: number, ry: number, wob: number[], scale = 1) {
  const n = wob.length;
  const pts: Array<[number, number]> = wob.map((w, k) => {
    const a = (k / n) * Math.PI * 2;
    return [cx + Math.cos(a) * rx * (1 + w) * scale, cy + Math.sin(a) * ry * (1 + w) * scale];
  });
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  c.beginPath();
  const m0 = mid(pts[n - 1], pts[0]);
  c.moveTo(m0[0], m0[1]);
  for (let k = 0; k < n; k++) {
    const p = pts[k];
    const m = mid(p, pts[(k + 1) % n]);
    c.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  c.closePath();
}

/** teardrop petal pointing up from origin */
export function petalPath(c: Ctx, w: number, h: number) {
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(w * 0.58, -h * 0.22, w * 0.52, -h * 0.82, 0, -h);
  c.bezierCurveTo(-w * 0.52, -h * 0.82, -w * 0.58, -h * 0.22, 0, 0);
  c.closePath();
}

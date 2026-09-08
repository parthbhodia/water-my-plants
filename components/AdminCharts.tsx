/**
 * The chart primitives for the admin funnel page.
 *
 * Every chart here carries ONE series, so none of them needs a legend — the
 * heading names the series — and none of them may borrow a second hue to look
 * busier. Colour is doing the "magnitude" job in all four, so it is one hue
 * throughout, and identity never rests on colour alone: the marks that matter
 * are directly labelled, and the page keeps the same numbers in a table.
 *
 * Labels are *selective*. A number on every point is the fastest way to make a
 * 30-day line unreadable, so a line labels its peak and its last value and a
 * bar chart labels its peak — the rest is in the tooltip and the table.
 */

const GRID = "#e1e0d9";
const BASE = "#c3c2b7";
const HUE = "#2a78d6";

/** Bar with rounded data-end only — the baseline end stays square, anchored. */
function barPath(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

// ---------------------------------------------------------------- line

export type Point = { x: string; y: number; hint?: string };

export function LineChart({
  points,
  unit = "",
  asPercent = false,
}: {
  points: Point[];
  unit?: string;
  asPercent?: boolean;
}) {
  if (points.length < 2) return <p className="adm-empty">Not enough days yet.</p>;

  // T has to clear the peak label, which is drawn 12px above the highest point:
  // a scroll container computes overflow-y to `auto`, not `visible`, so anything
  // painted outside the viewBox gets clipped rather than overhanging.
  const W = 880, H = 246, L = 46, R = 46, T = 28, B = 30;
  const iw = W - L - R, ih = H - T - B;
  const max = Math.max(1, ...points.map((p) => p.y));
  const nice = asPercent ? 100 : niceTop(max);
  const px = (i: number) => L + (i / (points.length - 1)) * iw;
  const py = (v: number) => T + ih - (v / nice) * ih;

  const line = points.map((p, i) => `${i ? "L" : "M"}${px(i)},${py(p.y)}`).join(" ");
  const area = `${line} L${px(points.length - 1)},${T + ih} L${px(0)},${T + ih} Z`;

  const peak = points.reduce((a, p, i) => (p.y > points[a].y ? i : a), 0);
  const last = points.length - 1;
  const marked = new Set([peak, last]);

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={points.map((p) => `${p.x}: ${p.y}${unit}`).join(", ")}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={T + ih * f} y2={T + ih * f} stroke={f === 1 ? BASE : GRID} strokeWidth={1} />
            <text className="ch-tick" x={L - 8} y={T + ih * f + 4} textAnchor="end">
              {fmt(nice * (1 - f))}{asPercent ? "%" : ""}
            </text>
          </g>
        ))}

        <path d={area} fill={HUE} opacity={0.12} />
        <path d={line} fill="none" stroke={HUE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => (
          <g key={p.x} className="ch-pt">
            <title>{`${p.hint ?? p.x}: ${fmt(p.y)}${asPercent ? "%" : unit}`}</title>
            {/* Hit target bigger than the mark. */}
            <circle cx={px(i)} cy={py(p.y)} r={10} fill="transparent" />
            {marked.has(i) && <circle cx={px(i)} cy={py(p.y)} r={4.5} fill={HUE} stroke="#fcfcfb" strokeWidth={2} />}
          </g>
        ))}

        {[...marked].map((i) => (
          <text
            key={`lbl-${i}`}
            className="ch-val"
            x={Math.min(W - R - 4, Math.max(L, px(i)))}
            y={py(points[i].y) - 12}
            textAnchor={i === last ? "end" : "middle"}
          >
            {fmt(points[i].y)}{asPercent ? "%" : ""}
          </text>
        ))}

        {[0, Math.floor(last / 2), last].map((i) => (
          <text key={`x-${i}`} className="ch-tick" x={px(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}>
            {points[i].x}
          </text>
        ))}
      </svg>
    </figure>
  );
}

// ---------------------------------------------------------------- bars

export type Bar = { label: string; value: number; hint?: string };

export function BarChart({ bars, unit = "" }: { bars: Bar[]; unit?: string }) {
  if (!bars.length) return <p className="adm-empty">Nothing recorded yet.</p>;

  const W = 880, H = 220, L = 46, R = 12, T = 24, B = 28;
  const iw = W - L - R, ih = H - T - B;
  const nice = niceTop(Math.max(1, ...bars.map((b) => b.value)));
  const slot = iw / bars.length;
  const bw = Math.max(3, slot - 2); // 2px surface gap between neighbours
  const peak = bars.reduce((a, b, i) => (b.value > bars[a].value ? i : a), 0);

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={bars.map((b) => `${b.label}: ${b.value}${unit}`).join(", ")}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={T + ih * f} y2={T + ih * f} stroke={f === 1 ? BASE : GRID} strokeWidth={1} />
            <text className="ch-tick" x={L - 8} y={T + ih * f + 4} textAnchor="end">{fmt(nice * (1 - f))}</text>
          </g>
        ))}

        {bars.map((b, i) => {
          const h = (b.value / nice) * ih;
          const x = L + i * slot + (slot - bw) / 2;
          return (
            <g key={b.label} className="ch-pt">
              <title>{`${b.hint ?? b.label}: ${fmt(b.value)}${unit}`}</title>
              <rect x={L + i * slot} y={T} width={slot} height={ih} fill="transparent" />
              {b.value > 0 && <path d={barPath(x, T + ih - h, bw, h)} fill={HUE} opacity={i === peak ? 1 : 0.72} />}
              {i === peak && b.value > 0 && (
                <text className="ch-val" x={x + bw / 2} y={T + ih - h - 8} textAnchor="middle">
                  {fmt(b.value)}
                </text>
              )}
            </g>
          );
        })}

        {bars.map((b, i) =>
          bars.length <= 12 || i % 3 === 0 ? (
            <text key={`t-${b.label}`} className="ch-tick" x={L + i * slot + slot / 2} y={H - 8} textAnchor="middle">
              {b.label}
            </text>
          ) : null
        )}
      </svg>
    </figure>
  );
}

// ---------------------------------------------------- horizontal bars

export function RowBars({ bars, unit = "" }: { bars: Bar[]; unit?: string }) {
  if (!bars.length) return <p className="adm-empty">Nothing planted yet.</p>;
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <ul className="rowbars">
      {bars.map((b) => (
        <li key={b.label}>
          <b>{b.label}</b>
          <span className="rb-track">
            <span className="rb-fill" style={{ width: `${Math.max(2, (b.value / max) * 100)}%` }} />
          </span>
          <em>{fmt(b.value)}{unit}</em>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- utils

/** A round number at or above the max, so the top gridline reads as a value. */
function niceTop(v: number) {
  if (v <= 5) return Math.max(1, Math.ceil(v));
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / (mag / 2)) * (mag / 2);
}

function fmt(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(v < 10 ? 1 : 0);
}

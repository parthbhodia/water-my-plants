/**
 * The funnel as flow, not as four separate numbers.
 *
 * A bar list answers "how many reached each step". It cannot answer the
 * question that actually decides what to fix — *where did the others go* — and
 * it draws each stage as an independent quantity when the whole point is that
 * they are one stream losing volume. Every person entering on the left leaves
 * through exactly one branch on the right, so the widths are conserved and the
 * biggest gap in the picture IS the biggest problem.
 *
 * Colour does one job here. The surviving stream is an **ordinal ramp** — one
 * hue, light to dark, deepening with each stage cleared — because the stages
 * are ordered. The drop-offs are a **neutral**, deliberately recessive: they
 * are not an error state, and painting three of four branches alarm-red would
 * both misread the data and drown the stream you are meant to follow. Every
 * band is directly labelled, so nothing is carried by colour alone.
 *
 * Steps are the validated blue ordinal ramp (250/350/450/550): monotone
 * lightness, adjacent ΔL ≥ 0.06, single hue, and the light end clears the 2:1
 * floor against the page (2.06:1). Do not lighten the first step past #86b6ef.
 */

export type FunnelStep = { label: string; n: number; lost?: string };

const W = 880;
const H = 330;
const PAD_T = 46; // headroom for the two label lines above every node
const PAD_B = 26;
const NODE_W = 13;
const GAP = 16; // surface gap between the stream and the branch that left it

/** Ordinal ramp — deepens as the stream survives more stages. */
const RAMP = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab"];
const DROP = "#d8d5ca";
const DROP_EDGE = "#c3c2b7";

/** A flow ribbon: two cubics, mirrored, closed into a band. */
function ribbon(x0: number, y0: number, x1: number, y1: number, h0: number, h1: number) {
  const xm = (x0 + x1) / 2;
  return [
    `M${x0},${y0}`,
    `C${xm},${y0} ${xm},${y1} ${x1},${y1}`,
    `L${x1},${y1 + h1}`,
    `C${xm},${y1 + h1} ${xm},${y0 + h0} ${x0},${y0 + h0}`,
    "Z",
  ].join(" ");
}

export default function FunnelSankey({ steps }: { steps: FunnelStep[] }) {
  const total = steps[0]?.n ?? 0;
  if (!total || steps.length < 2) {
    return <p className="adm-empty">Not enough data to draw the funnel yet.</p>;
  }

  const usable = H - PAD_T - PAD_B - GAP;
  const scale = usable / total;
  const LABEL_GUTTER = 232;
  const colX = (i: number) => (i * (W - NODE_W - LABEL_GUTTER)) / (steps.length - 1) + 8;

  const nodes = steps.map((s, i) => ({
    ...s,
    x: colX(i),
    y: PAD_T,
    h: Math.max(s.n > 0 ? 2 : 0, s.n * scale),
    fill: RAMP[Math.min(i, RAMP.length - 1)],
  }));

  return (
    <figure className="sankey">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaSummary(steps)}>
        {/* Ribbons first: nodes and labels must sit on top of them. */}
        {nodes.slice(1).map((n, k) => {
          const prev = nodes[k];
          const lost = prev.n - n.n;
          const lostH = lost * scale;
          const dropY = PAD_T + n.h + GAP;
          return (
            <g key={`flow-${n.label}`}>
              <path
                d={ribbon(prev.x + NODE_W, prev.y, n.x, n.y, n.h, n.h)}
                fill={n.fill}
                opacity={0.42}
              />
              {lost > 0 && (
                <path
                  d={ribbon(prev.x + NODE_W, prev.y + n.h, n.x, dropY, lostH, lostH)}
                  fill={DROP}
                  opacity={0.75}
                />
              )}
            </g>
          );
        })}

        {nodes.map((n, i) => (
          <g key={n.label}>
            <title>{`${n.label}: ${n.n} of ${total} (${Math.round((n.n / total) * 100)}%)`}</title>
            <rect x={n.x} y={n.y} width={NODE_W} height={n.h} rx={4} fill={n.fill} />
            <text className="sk-name" x={n.x} y={n.y - 25}>{n.label}</text>
            <text className="sk-val" x={n.x} y={n.y - 9}>
              {n.n}
              <tspan className="sk-pct" dx={6}>{Math.round((n.n / total) * 100)}%</tspan>
            </text>
            {/* The branch that left between the previous stage and this one. */}
            {i > 0 && nodes[i - 1].n - n.n > 0 && (
              <g>
                <rect
                  x={n.x}
                  y={PAD_T + n.h + GAP}
                  width={NODE_W}
                  height={(nodes[i - 1].n - n.n) * scale}
                  rx={4}
                  fill={DROP}
                  stroke={DROP_EDGE}
                />
                <text
                  className="sk-drop"
                  x={n.x + NODE_W + 8}
                  y={PAD_T + n.h + GAP + Math.max(11, ((nodes[i - 1].n - n.n) * scale) / 2 + 4)}
                >
                  {nodes[i - 1].n - n.n} {n.lost ?? "left"}
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}

function ariaSummary(steps: FunnelStep[]) {
  const total = steps[0].n;
  return (
    "Funnel flow. " +
    steps
      .map((s) => `${s.label}: ${s.n} of ${total}`)
      .join(". ") +
    "."
  );
}

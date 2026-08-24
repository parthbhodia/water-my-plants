// Client mirror of the `species` table. The database stays the authority for
// validation; this carries only what the UI and renderer need.

export type PlotKind = "any" | "sun" | "shade" | "water";
export type PlantForm = "pad" | "tall" | "frond" | "succulent" | "vine" | "bush" | "orchid" | "tree";

export type SpeciesDef = {
  key: string;
  name: string;
  blurb: string;
  form: PlantForm;
  cadenceDays: number;
  windowStart: number | null;
  windowEnd: number | null;
  needsPlot: PlotKind;
  feedsRequired: number;
  prunesRequired: number;
  maturesDays: number;
  points: number;
  unlockCost: number;
  overwaterable: boolean;
  /** leaf/stem, secondary, bloom — drives the painter */
  colors: { leaf: string; leafDark: string; accent: string; accent2: string };
};

export const SPECIES: SpeciesDef[] = [
  {
    key: "lily", name: "Water Lily", form: "pad",
    blurb: "Floats in the pond and asks only that you show up.",
    cadenceDays: 1, windowStart: null, windowEnd: null, needsPlot: "water",
    feedsRequired: 0, prunesRequired: 0, maturesDays: 7, points: 10,
    unlockCost: 0, overwaterable: false,
    colors: { leaf: "#58b368", leafDark: "#3a8a4e", accent: "#f7a8c4", accent2: "#ee7fa9" },
  },
  {
    key: "sunflower", name: "Sunflower", form: "tall",
    blurb: "Grows tall, but only drinks while the sun is up.",
    cadenceDays: 1, windowStart: 6, windowEnd: 20, needsPlot: "sun",
    feedsRequired: 0, prunesRequired: 0, maturesDays: 10, points: 18,
    unlockCost: 0, overwaterable: false,
    colors: { leaf: "#5faa4e", leafDark: "#3d7c39", accent: "#ffd23f", accent2: "#e8a11c" },
  },
  {
    key: "fern", name: "Woodland Fern", form: "frond",
    blurb: "Scorches in the sun. Give it shade and a drink every other day.",
    cadenceDays: 2, windowStart: null, windowEnd: null, needsPlot: "shade",
    feedsRequired: 0, prunesRequired: 0, maturesDays: 8, points: 16,
    unlockCost: 0, overwaterable: false,
    colors: { leaf: "#4e9e63", leafDark: "#2f6f45", accent: "#8fd48a", accent2: "#6cc17b" },
  },
  {
    key: "cactus", name: "Desert Cactus", form: "succulent",
    blurb: "Thrives on neglect — water it early and the roots rot.",
    cadenceDays: 3, windowStart: null, windowEnd: null, needsPlot: "sun",
    feedsRequired: 0, prunesRequired: 0, maturesDays: 12, points: 24,
    unlockCost: 0, overwaterable: true,
    colors: { leaf: "#6faa6a", leafDark: "#4a7d49", accent: "#f2789b", accent2: "#d9527c" },
  },
  {
    key: "moonflower", name: "Moonflower", form: "vine",
    blurb: "Opens after dusk. Daytime water runs straight off.",
    cadenceDays: 1, windowStart: 18, windowEnd: 6, needsPlot: "any",
    feedsRequired: 0, prunesRequired: 0, maturesDays: 9, points: 26,
    unlockCost: 500, overwaterable: false,
    colors: { leaf: "#4f9e79", leafDark: "#347a5c", accent: "#f4f0ff", accent2: "#cdc2f0" },
  },
  {
    key: "tomato", name: "Heirloom Tomato", form: "bush",
    blurb: "Hungry as well as thirsty — feed it three times.",
    cadenceDays: 1, windowStart: null, windowEnd: null, needsPlot: "sun",
    feedsRequired: 3, prunesRequired: 0, maturesDays: 14, points: 32,
    unlockCost: 700, overwaterable: false,
    colors: { leaf: "#559a4a", leafDark: "#38702f", accent: "#e8503f", accent2: "#b93225" },
  },
  {
    key: "orchid", name: "Ghost Orchid", form: "orchid",
    blurb: "Shade, patience and four feedings. Miss too long and it is gone.",
    cadenceDays: 2, windowStart: null, windowEnd: null, needsPlot: "shade",
    feedsRequired: 4, prunesRequired: 0, maturesDays: 18, points: 60,
    unlockCost: 1400, overwaterable: false,
    colors: { leaf: "#3f8f6e", leafDark: "#2a6b52", accent: "#fbfdff", accent2: "#d8e7f5" },
  },
  {
    key: "bonsai", name: "Bonsai Pine", form: "tree",
    blurb: "A month of care and four prunings shape it properly.",
    cadenceDays: 2, windowStart: null, windowEnd: null, needsPlot: "any",
    feedsRequired: 0, prunesRequired: 4, maturesDays: 30, points: 85,
    unlockCost: 2500, overwaterable: false,
    colors: { leaf: "#4d8f5c", leafDark: "#2f6b40", accent: "#8a5f3c", accent2: "#63422a" },
  },
];

export const SPECIES_BY_KEY: Record<string, SpeciesDef> = Object.fromEntries(
  SPECIES.map((s) => [s.key, s])
);

export const PLOT_LABEL: Record<PlotKind, string> = {
  any: "Any plot",
  sun: "Sunny plot",
  shade: "Shaded plot",
  water: "Pond",
};

/** Human-readable care contract, e.g. "Every 2 days · shade · feed x4". */
export function careSummary(s: SpeciesDef): string {
  const bits: string[] = [];
  bits.push(s.cadenceDays === 1 ? "Daily" : `Every ${s.cadenceDays} days`);
  if (s.windowStart !== null) {
    const h = (n: number) => `${String(n).padStart(2, "0")}:00`;
    bits.push(`${h(s.windowStart)}–${h(s.windowEnd ?? 0)}`);
  }
  if (s.needsPlot !== "any") bits.push(PLOT_LABEL[s.needsPlot].toLowerCase());
  if (s.feedsRequired) bits.push(`feed ×${s.feedsRequired}`);
  if (s.prunesRequired) bits.push(`prune ×${s.prunesRequired}`);
  return bits.join(" · ");
}

export function windowOpen(s: SpeciesDef, hour: number): boolean {
  if (s.windowStart === null || s.windowEnd === null) return true;
  return s.windowStart < s.windowEnd
    ? hour >= s.windowStart && hour < s.windowEnd
    : hour >= s.windowStart || hour < s.windowEnd;
}

/** Can this plant take a drink right now? The one source of truth. */
export function canWaterNow(
  plant: { thirsty: boolean; isBloomed: boolean; dead: boolean; species: string } | null | undefined,
  hour: number
): boolean {
  if (!plant || plant.isBloomed || plant.dead || !plant.thirsty) return false;
  const sp = SPECIES_BY_KEY[plant.species];
  return !!sp && windowOpen(sp, hour);
}

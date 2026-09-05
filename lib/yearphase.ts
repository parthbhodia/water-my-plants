/**
 * The turn of the year — spring, summer, autumn, winter.
 *
 * Deliberately NOT called a "season". `seasonNumber` already means the
 * weekly league season everywhere else in this codebase, and two meanings of
 * one word is how a league bug hides in plain sight.
 *
 * Nothing here touches gameplay, and it should stay that way. A species that
 * only blooms in October locks a November newcomer out for eleven months —
 * the exact "you are too late" problem the consistency league was rebuilt to
 * remove, except no amount of good care fixes it. This is weather. It
 * changes what the garden looks like and nothing about what it asks of you.
 */

export type YearPhase = "spring" | "summer" | "autumn" | "winter";

/**
 * Zones that sit below the equator, so their April is autumn.
 *
 * The player's IANA zone is frozen server-side and is the only location
 * signal the game has — there is no latitude to read. A short list of
 * clearly-southern, populated zones beats a clever guess: everything not
 * listed falls through to northern, and for the genuinely equatorial zones
 * (Nairobi, Guayaquil, Singapore) either answer is equally wrong, because
 * they do not have these four seasons at all.
 */
const SOUTHERN_PREFIX = ["Australia/", "Antarctica/", "America/Argentina/"];
const SOUTHERN_ZONE = new Set([
  "Pacific/Auckland", "Pacific/Chatham", "Pacific/Fiji", "Pacific/Norfolk",
  "Pacific/Noumea", "Pacific/Port_Moresby", "Pacific/Tongatapu", "Pacific/Apia",
  "America/Sao_Paulo", "America/Santiago", "America/Montevideo", "America/La_Paz",
  "America/Asuncion", "America/Punta_Arenas", "America/Bahia", "America/Recife",
  "America/Fortaleza", "America/Lima", "America/Campo_Grande", "America/Cuiaba",
  "Africa/Johannesburg", "Africa/Windhoek", "Africa/Harare", "Africa/Lusaka",
  "Africa/Maputo", "Africa/Gaborone", "Africa/Luanda", "Africa/Kinshasa",
  "Africa/Dar_es_Salaam", "Africa/Lubumbashi", "Africa/Blantyre",
  "Indian/Antananarivo", "Indian/Mauritius", "Indian/Reunion",
  "Atlantic/Stanley",
]);

export function isSouthern(timezone: string | null | undefined): boolean {
  if (!timezone) return false;
  return (
    SOUTHERN_ZONE.has(timezone) ||
    SOUTHERN_PREFIX.some((p) => timezone.startsWith(p))
  );
}

/**
 * Which phase a player is in. `today` is the server's YYYY-MM-DD in that
 * player's own frozen timezone — never `new Date()`, which is the browser's
 * idea of the date and can be a day out at the edges.
 *
 * Meteorological boundaries (whole months), not astronomical ones: nobody
 * feels a solstice, and "spring started on the 20th" is a fact about an
 * orbit, not about a garden.
 */
export function yearPhase(today: string, timezone: string): YearPhase {
  const month = Number(today.slice(5, 7));
  const north: YearPhase =
    month >= 3 && month <= 5 ? "spring"
    : month >= 6 && month <= 8 ? "summer"
    : month >= 9 && month <= 11 ? "autumn"
    : "winter";
  if (!isSouthern(timezone)) return north;
  const FLIP: Record<YearPhase, YearPhase> = {
    spring: "autumn", summer: "winter", autumn: "spring", winter: "summer",
  };
  return FLIP[north];
}

/** What falls through the air, if anything. Summer is already busy with butterflies. */
export type Drift = "petal" | "leaf" | "snow" | null;

export type PhasePalette = {
  /** three stops, top of sky to horizon */
  sky: [string, string, string];
  hillFar: [string, string];
  hillNear: [string, string];
  distantTree: string;
  /** three stops, horizon to foreground */
  ground: [string, string, string];
  /** grain strokes: shadow, highlight */
  grain: [string, string];
  fringe: string;
  /** canopy leaf clusters: shaded, mid, lit — and the lit-orb variants */
  leaf: [string, string, string];
  leafLit: [string, string, string];
  /** blossom or frost specks on the canopy; null in summer */
  fleck: string | null;
  bush: [string, string, string];
  /** foreground blades: base, mid, tip */
  blade: [string, string, string];
  /** overrides the three wildflower colourways; null keeps them */
  flower: [string, string] | null;
  drift: Drift;
};

export const PHASE_PALETTE: Record<YearPhase, PhasePalette> = {
  // Summer is the garden exactly as it was drawn — this is the palette the
  // whole art pass was tuned against, so it stays the reference.
  summer: {
    sky: ["#6fb9e8", "#a5d8f0", "#ddf2e6"],
    hillFar: ["#cfe8d4", "#aed3bc"],
    hillNear: ["#a9d6a4", "#84bd88"],
    distantTree: "rgba(94,160,110,0.55)",
    ground: ["#94d387", "#6fbc71", "#4f9e5c"],
    grain: ["rgba(37,102,58,0.20)", "rgba(214,255,205,0.20)"],
    fringe: "rgba(47,116,66,0.5)",
    leaf: ["#96d98e", "#57b166", "#357f47"],
    leafLit: ["#b2e6a8", "#74c47c", "#478f56"],
    fleck: null,
    bush: ["#84cf84", "#54ab62", "#357f47"],
    blade: ["#2f7a45", "#4f9e5c", "#8ed48a"],
    flower: null,
    drift: null,
  },
  // Spring: everything a shade yellower and newer, and the trees in blossom.
  spring: {
    sky: ["#8cc9ee", "#bfe4f4", "#eaf7e4"],
    hillFar: ["#d9edd0", "#b8dcb6"],
    hillNear: ["#bbe0a4", "#8ec98a"],
    distantTree: "rgba(120,180,120,0.5)",
    ground: ["#a8de8c", "#82c976", "#5aa85e"],
    grain: ["rgba(48,112,62,0.18)", "rgba(226,255,210,0.24)"],
    fringe: "rgba(58,126,72,0.45)",
    leaf: ["#b6e79a", "#7cc471", "#4b9153"],
    leafLit: ["#d2f0b4", "#95d485", "#5aa25f"],
    fleck: "rgba(255,214,232,0.85)",
    bush: ["#a3dc92", "#6dbc69", "#48934f"],
    blade: ["#3d8a4e", "#5fae64", "#a8e295"],
    flower: null,
    drift: "petal",
  },
  // Autumn: the greens burn down to amber and russet, and leaves let go.
  autumn: {
    sky: ["#7fb0d4", "#bcd4e0", "#f0e7cf"],
    hillFar: ["#e0dcc0", "#c4bc9c"],
    hillNear: ["#c9b877", "#a8975c"],
    distantTree: "rgba(160,120,60,0.55)",
    ground: ["#c2c07a", "#a3a462", "#7f8a4e"],
    grain: ["rgba(96,80,36,0.22)", "rgba(255,240,190,0.20)"],
    fringe: "rgba(104,92,44,0.5)",
    leaf: ["#e8bf6a", "#cf8f3f", "#9a5c28"],
    leafLit: ["#f6d98c", "#e0a94f", "#b06f2e"],
    fleck: "rgba(255,232,180,0.6)",
    bush: ["#d9b268", "#b98442", "#8a5628"],
    blade: ["#7a6a34", "#a8974c", "#d8cf86"],
    flower: ["#efdcb0", "#c39a52"],
    drift: "leaf",
  },
  // Winter: colour drains out, the light goes flat and blue, snow falls.
  winter: {
    sky: ["#9fb6cc", "#c6d4de", "#e8eef0"],
    hillFar: ["#e6ecee", "#ccd8da"],
    hillNear: ["#cfdcd6", "#adc0ba"],
    distantTree: "rgba(130,150,146,0.5)",
    ground: ["#dfe8e4", "#c2d1cc", "#a3b5b0"],
    grain: ["rgba(90,110,108,0.16)", "rgba(255,255,255,0.32)"],
    fringe: "rgba(120,140,136,0.4)",
    leaf: ["#a8bfb2", "#7d9a8c", "#5a7568"],
    leafLit: ["#cfdcd2", "#9db4a6", "#72897c"],
    fleck: "rgba(255,255,255,0.9)",
    bush: ["#bccdc4", "#93a89c", "#6d8177"],
    blade: ["#7c908a", "#a3b5ad", "#dfe8e2"],
    flower: ["#ffffff", "#d3dee4"],
    drift: "snow",
  },
};

/** Granny's one line when the garden turns over. */
export const PHASE_NOTE: Record<YearPhase, string> = {
  spring: "Spring's in, love — the trees are in blossom and everything is in a hurry. 🌸",
  summer: "Summer proper now. Long light, warm soil, and the bees have opinions. ☀️",
  autumn: "Autumn's come. The willows have gone gold and the leaves are letting go. 🍂",
  winter: "Winter's here — everything's gone quiet under the snow. Keep showing up, love. ❄️",
};

export const PHASE_NAME: Record<YearPhase, string> = {
  spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter",
};

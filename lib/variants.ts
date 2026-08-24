// Cosmetic plant variants, rolled server-side at bloom. Never purchasable —
// the only way to improve the odds is to grow a plant without missing a day.

export type VariantKey = "dewkissed" | "variegated" | "moonlit" | "golden";

export type VariantDef = {
  key: VariantKey;
  name: string;
  blurb: string;
  /** rough share of all variant rolls, for the almanac */
  rarity: string;
  /** overlay tint used by the painter */
  tint: string;
};

export const VARIANTS: VariantDef[] = [
  {
    key: "dewkissed", name: "Dew-kissed",
    blurb: "Beaded with morning dew that never quite dries.",
    rarity: "Common", tint: "#bfe9ff",
  },
  {
    key: "variegated", name: "Variegated",
    blurb: "Cream streaks run through every leaf.",
    rarity: "Uncommon", tint: "#fff6d8",
  },
  {
    key: "moonlit", name: "Moonlit",
    blurb: "Holds a pale glow long after dusk.",
    rarity: "Rare", tint: "#dcd4ff",
  },
  {
    key: "golden", name: "Golden",
    blurb: "Every edge lined in gold. One in fifty, at best.",
    rarity: "Legendary", tint: "#ffd76e",
  },
];

export const VARIANT_BY_KEY: Record<string, VariantDef> = Object.fromEntries(
  VARIANTS.map((v) => [v.key, v])
);

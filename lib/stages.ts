export type StageInfo = {
  name: string;
  emoji: string;
  blurb: string;
};

export const STAGES: StageInfo[] = [
  { name: "Seed",        emoji: "🫘", blurb: "A sleepy little seed resting in the shallows. Everything starts here." },
  { name: "Sprout",      emoji: "🌱", blurb: "A brave green shoot peeks above the water. Hello, world!" },
  { name: "Young Pad",   emoji: "🍃", blurb: "The first tiny lily pad unfurls and learns to float." },
  { name: "Lily Pad",    emoji: "🪷", blurb: "A proper pad now — frogs are starting to take notice." },
  { name: "Budding",     emoji: "🌾", blurb: "A shy green bud rises on its stem, holding a secret." },
  { name: "Blushing Bud",emoji: "🌷", blurb: "Pink peeks through! The bud is almost ready to open." },
  { name: "Full Bloom",  emoji: "🌸", blurb: "The lily opens wide — grown one gentle day at a time." },
];

export const FINAL_STAGE = STAGES.length - 1; // 6

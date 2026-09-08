// Long-form, crawlable copy for the marketing pages. Kept apart from
// `lib/species.ts` so the game data stays a lean mirror of the database while
// the words that earn search traffic can grow freely.

import { SPECIES, SPECIES_BY_KEY, type SpeciesDef } from "./species";

export type SpeciesGuide = {
  key: string;
  /** Used in <title> and the H1 — written the way somebody would search it. */
  headline: string;
  /** Meta description. One sentence, under ~155 characters. */
  summary: string;
  /** The care contract in plain sentences, one paragraph per idea. */
  body: string[];
  /** Short, scannable do/don't pairs. */
  tips: string[];
  difficulty: Difficulty;
};

export type Difficulty = "Beginner" | "Steady" | "Demanding" | "Expert";

/**
 * The one-line pitch on the landing page's plant picker.
 *
 * The picker used to print `careSummary()` — "Daily · sunny plot · feed ×3" —
 * under every plant, which is a specification, not an invitation. It told a
 * visitor who had never planted anything that all twelve of these would want
 * something from them, and gave no reason to want any particular one. These
 * lines say what the plant is *like*; the schedule is still there, demoted to
 * a chip, where somebody comparing two plants can find it.
 *
 * Every species has an entry, including the four seasonals, which have no
 * long-form guide yet and were rendering an empty difficulty pill.
 */
export const PITCH: Record<string, { line: string; difficulty: Difficulty }> = {
  lily: { line: "The one to start with. No clock, no fuss.", difficulty: "Beginner" },
  sunflower: { line: "Drinks in daylight, and is asleep by eight.", difficulty: "Beginner" },
  fern: { line: "Every other day, and keep her out of the sun.", difficulty: "Steady" },
  lavender: { line: "Dry, stony and sun-baked. Do not fuss over her.", difficulty: "Steady" },
  snowdrop: { line: "Flowers in the cold, while nothing else dares.", difficulty: "Steady" },
  cactus: { line: "The one you can kill with kindness.", difficulty: "Steady" },
  moonflower: { line: "Opens after dark. A night-shift plant.", difficulty: "Steady" },
  tomato: { line: "Water her and feed her, three times over.", difficulty: "Demanding" },
  pumpkin: { line: "She eats, and eats, and eats.", difficulty: "Demanding" },
  blossom: { line: "One cut, while she is bare. Get it wrong and you have lost the year.", difficulty: "Demanding" },
  orchid: { line: "Shade, patience, and four feedings.", difficulty: "Expert" },
  bonsai: { line: "A month of care and four careful cuts.", difficulty: "Expert" },
};

/** Easiest first — the picker is answering "where do I start?". */
export const PITCH_ORDER: Difficulty[] = ["Beginner", "Steady", "Demanding", "Expert"];

export const GUIDES: SpeciesGuide[] = [
  {
    key: "lily",
    headline: "Water Lily — the plant to start with",
    summary:
      "The water lily is Lily Days' starter plant: one watering a day, no time window, seven days to bloom. Here is how to grow one.",
    body: [
      "The water lily floats in the pond and asks for exactly one thing: that you turn up. Water it once a day, at any hour you like, and it advances one growth stage. Seven waterings and it blooms.",
      "It is the only plant with no time window and no side quests — no feeding, no pruning, nothing to overwater. That makes it the plant to learn the rhythm on, and the plant to keep in the pond permanently once you have learned it.",
      "Because it lives in the pond it needs a water plot. Those are the round plots in the middle of the yard; a lily cannot be planted in soil.",
    ],
    tips: [
      "Plant one on your first day. It is free and it teaches the daily loop.",
      "There is no wrong hour — water it whenever you open the game.",
      "A bloomed lily keeps scoring for your league every day it stays alive.",
    ],
    difficulty: "Beginner",
  },
  {
    key: "sunflower",
    headline: "Sunflower — daylight watering only",
    summary:
      "Sunflowers in Lily Days only drink between 06:00 and 20:00 on your own clock. Ten days of daylight waterings gets you a bloom.",
    body: [
      "The sunflower is the first plant that cares what time it is. Water it between 06:00 and 20:00 and it grows; try outside those hours and the water simply runs off — no progress, no penalty, just a wasted trip.",
      "It takes ten daily waterings to bloom, and it needs a sunny plot. Sunny plots are the ones out in the open grass, away from the shade of the house and the trees.",
      "If your schedule means you usually play late at night, the sunflower is the plant that will quietly stall. Pair it with a moonflower, which wants the opposite hours, and between them you will always have something to water.",
    ],
    tips: [
      "The window is measured on your local clock, not UTC — travel does not shift it.",
      "Water in the morning if you can. It leaves the whole day as a buffer.",
      "Missing the window is not damage. Missing the day is.",
    ],
    difficulty: "Beginner",
  },
  {
    key: "fern",
    headline: "Woodland Fern — every other day, in the shade",
    summary:
      "The woodland fern scorches in the sun and wants water only every second day. A guide to Lily Days' first every-other-day plant.",
    body: [
      "The fern breaks the daily habit on purpose. Its cadence is two days: water it, and it will not want anything again until the day after tomorrow. Turning up in between does nothing at all.",
      "It needs a shaded plot — the ones tucked beside the house and under the trees. Put it in full sun and you simply will not be allowed to plant it there.",
      "Four waterings spread across eight days is a longer commitment than it first looks. The fern rewards players who check the garden every day and read what is actually due, rather than watering everything on reflex.",
    ],
    tips: [
      "Check the day's brief before you water — the fern will often not be on it.",
      "Its overdue clock also runs on two-day steps, so it forgives a late day better than a daily plant.",
      "Shade plots are limited. Decide between fern and orchid before you plant.",
    ],
    difficulty: "Steady",
  },
  {
    key: "cactus",
    headline: "Desert Cactus — the plant you can kill with kindness",
    summary:
      "The desert cactus is the one plant in Lily Days that punishes early watering. Water it every third day, never sooner.",
    body: [
      "Every other plant ignores a watering it did not need. The cactus does not. Water it before its third day and the roots rot: it loses health, and enough early waterings will kill it outright.",
      "This is the plant that turns Lily Days from a habit into a game. You have to remember which day it is on, resist the urge to top it up, and come back on the right one.",
      "The payoff is twenty-four points a bloom, and a twelve-day schedule that only asks four visits of you. It wants a sunny plot.",
    ],
    tips: [
      "If in doubt, skip it. Late costs you a little; early costs you health.",
      "Overwatering is the only self-inflicted damage in the game — nothing else works this way.",
      "Its plot chip shows when it is genuinely due. Trust the chip, not your memory.",
    ],
    difficulty: "Steady",
  },
  {
    key: "moonflower",
    headline: "Moonflower — a night-shift plant",
    summary:
      "Moonflowers only open after dusk. Water between 18:00 and 06:00 on your own clock, every day, for nine days.",
    body: [
      "The moonflower inverts the sunflower. Its window runs from 18:00 through to 06:00 — it crosses midnight, so a late-night watering and an early-morning one both count.",
      "Daytime water runs straight off the closed vine. Nine night waterings bring it to bloom, and it will grow in any plot, sun or shade.",
      "It costs 500 dewdrops to unlock, which is a few days of steady tending. It is the first plant that makes your actual daily routine — when you really open the game — part of the strategy.",
    ],
    tips: [
      "If you play in the evening anyway, this is the most convenient plant in the game.",
      "The window crosses midnight, so 23:30 and 05:30 are both fine.",
      "Grow it alongside a sunflower so one of them is always waterable.",
    ],
    difficulty: "Steady",
  },
  {
    key: "tomato",
    headline: "Heirloom Tomato — water it and feed it",
    summary:
      "The heirloom tomato is Lily Days' first plant that needs fertiliser: fourteen daily waterings plus three feedings.",
    body: [
      "The tomato is hungry as well as thirsty. Alongside fourteen daily waterings it needs three feedings, and fertiliser is bought from the shop with dewdrops you earned tending everything else.",
      "That makes it the first plant with a real economy attached. You cannot rush it by playing more in one day; you can only bring it forward by having kept a good garden beforehand.",
      "It wants a sunny plot and pays thirty-two points for a bloom — roughly double a sunflower.",
    ],
    tips: [
      "Buy fertiliser before you plant, so a feeding day never catches you short.",
      "Feeding does not replace the day's watering. It is an extra action.",
      "Fourteen days is two full weeks — it will span more than one league season.",
    ],
    difficulty: "Demanding",
  },
  {
    key: "orchid",
    headline: "Ghost Orchid — shade, patience and four feedings",
    summary:
      "The ghost orchid takes eighteen days, four feedings and a shaded plot. The hardest plant in Lily Days short of the bonsai.",
    body: [
      "The ghost orchid waters every second day, needs four feedings, and takes eighteen days to reach bloom. It only grows in shade.",
      "Sixty points makes it the second most valuable plant in the game, and its long cadence means a single forgotten week can undo a fortnight of work — an orchid left too long is gone for good.",
      "It is the plant that separates gardeners who show up from gardeners who plan. Start one when you know the next three weeks look calm.",
    ],
    tips: [
      "Stock four fertiliser before you plant, not as you go.",
      "Every-other-day cadence means its due days drift across the week — read the brief.",
      "Keep a revival tonic in the shed if you are running one seriously.",
    ],
    difficulty: "Expert",
  },
  {
    key: "bonsai",
    headline: "Bonsai Pine — a month of care and four prunings",
    summary:
      "Thirty days, four prunings and watering every second day. The bonsai pine is the long game in Lily Days, worth 85 points.",
    body: [
      "The bonsai pine is the endgame plant: thirty days to maturity, watering every second day, and four separate prunings to shape it properly.",
      "Eighty-five points is the biggest single score in the game, and because league seasons run weekly, a bonsai you keep alive scores for you across four consecutive seasons rather than one.",
      "It will grow in any plot. What it really needs is a month of you not disappearing.",
    ],
    tips: [
      "Pruning shears are a shop tool, not a consumable — buy once, use forever.",
      "Plant it early in your gardening life. It compounds.",
      "A dead bonsai costs you fifteen points as well as the month. Protect it.",
    ],
    difficulty: "Expert",
  },
];

export const GUIDE_BY_KEY: Record<string, SpeciesGuide> = Object.fromEntries(
  GUIDES.map((g) => [g.key, g])
);

/** Guide plus the live game data behind it. Throws if the two drift apart. */
export function guideWithSpecies(key: string): { guide: SpeciesGuide; species: SpeciesDef } | null {
  const guide = GUIDE_BY_KEY[key];
  const species = SPECIES_BY_KEY[key];
  if (!guide || !species) return null;
  return { guide, species };
}

/** Every species has a guide — keeps the sitemap and the game in step. */
export const GUIDE_KEYS = SPECIES.map((s) => s.key).filter((k) => k in GUIDE_BY_KEY);

export type Faq = { q: string; a: string };

export const FAQS: Faq[] = [
  {
    q: "Is Lily Days free to play?",
    a: "Yes. Lily Days is free, there are no adverts, and nothing in it can be bought with real money. Seeds, fertiliser, tools and ornaments are all paid for with dewdrops you earn by tending your garden.",
  },
  {
    q: "How long does a turn take?",
    a: "About a minute. You water the plants that are due, and that is the day done. The game is built around one short visit a day rather than long sessions.",
  },
  {
    q: "What happens if I miss a day?",
    a: "The plant wilts and your streak resets, but nothing is lost immediately — one watering brings a wilted plant straight back. A plant only dies once it is four of its own care cycles overdue, and a revival tonic from the shop can rescue even that. Plants that have already bloomed never die.",
  },
  {
    q: "Can I water a plant twice to make it grow faster?",
    a: "No. Each plant accepts one watering per day and ignores the rest, so there is no way to rush growth by playing more. The desert cactus goes further and loses health if you water it early.",
  },
  {
    q: "How does the game handle different time zones?",
    a: "Your day is your day. Lily Days stores the time zone you signed up in and runs every deadline on your local clock, so a player in Sydney and a player in Chicago each get their own midnight. The server keeps the time, so changing your device clock does nothing.",
  },
  {
    q: "How does the weekly league work?",
    a: "You are grouped with gardeners on roughly the same clock as you and ranked by garden score for a seven-day season. Top finishers are promoted, the bottom are relegated, and then the board resets. Your garden never resets — only the ranking does.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. Lily Days runs in the browser. It is also a progressive web app, so you can add it to your phone's home screen and it will open like an ordinary app.",
  },
  {
    q: "How many plants are there?",
    a: "Eight species, each with a different care contract — different watering cadence, different time windows, different plot types, and some needing fertiliser or pruning as well as water.",
  },
];

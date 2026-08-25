import type { Avatar } from "@/game/avatar";

export type PlantState = {
  id: string;
  plotIdx: number;
  species: string;
  stage: number;
  growth: number;
  watersNeeded: number;
  feedsDone: number;
  prunesDone: number;
  plantedOn: string;
  lastCareOn: string | null;
  dayNumber: number;
  overdueDays: number;
  thirsty: boolean;
  wilted: boolean;
  health: number;
  dead: boolean;
  isBloomed: boolean;
  variant: string | null;
  streak: number;
};

export type PlotState = {
  idx: number;
  kind: "sun" | "shade" | "water";
  unlocked: boolean;
  plant: PlantState | null;
};

export type FixtureState = {
  key: string;
  name: string;
  blurb: string;
  cost: number;
  restored: boolean;
};

export type ZoneState = {
  key: string;
  name: string;
  blurb: string;
  minLevel: number;
  unlocked: boolean;
  fixtures: FixtureState[];
};

export type GardenState = {
  gardenId: string;
  gardenName: string;
  plotCount: number;
  displayName: string | null;
  friendCode: string | null;
  avatar: Avatar;
  dewdrops: number;
  today: string;
  hour: number;
  timezone: string;
  plots: PlotState[];
  unlockedSpecies: string[];
  inventory: Record<string, number>;
  decor: Record<string, string>;
  level: number;
  nameChanged: boolean;
  clientTimezone?: string;
  timezoneMismatch?: boolean;
  canChangeTimezone?: boolean;
  timezoneChangeableOn?: string;
  gardenScore: number;
  /** Total dewdrops ever earned — never spent down; this is what levels you. */
  lifetimeEarned?: number;
  /** Lifetime earned needed for the current level, and for the next one. */
  levelFloor?: number;
  nextLevelAt?: number;
  completedCount: number;
  tutorialDone: boolean;
  zones: ZoneState[];
};

export type TendAction = "water" | "feed" | "prune";

export type TendResult = {
  status:
    | "watered" | "fed" | "pruned"
    | "already" | "not_thirsty" | "wrong_window"
    | "overwatered" | "not_needed" | "bloomed" | "dead" | "too_soon"
    | "no_item" | "error";
  reason?: string;
  grew?: boolean;
  bloomedNow?: boolean;
  wasWilted?: boolean;
  dewEarned?: number;
  species?: string;
  plotIdx?: number;
  nextDue?: string;
  readyAt?: string;
  item?: string;
  variant?: string | null;
  windowStart?: number | null;
  windowEnd?: number | null;
  state?: GardenState;
};

export type CompletedLily = {
  id: number;
  days_taken: number;
  waters: number;
  perfect: boolean;
  completed_at: string;
  species_id: number | null;
  variant: string | null;
};

export type LeagueMember = {
  rank: number;
  name: string;
  avatar: Avatar;
  score: number;
  plants: number;
  isMe: boolean;
};

export type LeagueState = {
  seasonNumber: number;
  startsOn: string;
  endsOn: string;
  daysLeft: number;
  tier: number;
  tierName: string;
  bandLabel: string;
  myRank: number | null;
  myScore: number;
  size: number;
  promoteN: number;
  relegateFrom: number | null;
  members: LeagueMember[];
  lastSeason: { rank: number; movement: number; tierName: string } | null;
};

export type CareMark = "full" | "partial" | "rest" | "missed" | "future";

export type CareWeek = {
  seasonNumber: number;
  startsOn: string;
  marks: Array<{ day: string; weekday: string; mark: CareMark }>;
  metDays: number;
  tended: number;
  score: number;
};

export type HofEntry = {
  rank: number;
  name: string;
  avatar: Avatar;
  value: number;
  isMe: boolean;
};

export type HallOfFame = {
  me: {
    level: number;
    lifetimeEarned: number;
    nextLevelAt: number;
    blooms: number;
    bestStreak: number;
    gardenValue: number;
    gardeningSince: string;
    daysTending: number;
  };
  blooms: HofEntry[];
  streaks: HofEntry[];
  gardens: HofEntry[];
  levels: HofEntry[];
};

export type ShopItem = {
  key: string;
  name: string;
  blurb: string;
  kind: "species" | "consumable" | "tool";
  cost: number;
  maxQty: number | null;
  species: string | null;
  owned: number;
  affordable: boolean;
};

export type ShopState = { dewdrops: number; items: ShopItem[] };

export type TodayBrief = {
  need: { kind: string; count: number; title: string; body: string } | null;
  emailEnabled: boolean;
  nudgeHour: number;
};

export type Friend = {
  id: string;
  name: string;
  avatar: Avatar;
  level: number;
  gardenValue: number;
  needsHelp: number;
  visitedToday: boolean;
};

export type FriendsState = { friendCode: string; friends: Friend[] };

export type ShowcaseGarden = {
  name: string;
  avatar: Avatar;
  level: number;
  value: number;
  blooms: number;
  daysTending: number;
  plants: Array<{ species: string; stage: number; plotIdx: number }>;
  decor: Array<{ slot: number; item: string }>;
};

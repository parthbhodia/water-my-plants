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
  streak: number;
};

export type PlotState = {
  idx: number;
  kind: "sun" | "shade" | "water";
  unlocked: boolean;
  plant: PlantState | null;
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
  clientTimezone?: string;
  timezoneMismatch?: boolean;
  canChangeTimezone?: boolean;
  timezoneChangeableOn?: string;
  gardenScore: number;
  completedCount: number;
};

export type TendAction = "water" | "feed" | "prune";

export type TendResult = {
  status:
    | "watered" | "fed" | "pruned"
    | "already" | "not_thirsty" | "wrong_window"
    | "overwatered" | "not_needed" | "bloomed" | "dead" | "too_soon" | "error";
  reason?: string;
  grew?: boolean;
  bloomedNow?: boolean;
  wasWilted?: boolean;
  dewEarned?: number;
  species?: string;
  plotIdx?: number;
  nextDue?: string;
  readyAt?: string;
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

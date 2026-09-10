import type { YearPhase } from "./yearphase";
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

/**
 * The next bed, priced and gated. Both gates are re-checked server-side in
 * `break_ground` — these fields only decide what the button says.
 */
export type NextPlot = {
  idx: number;
  cost: number;
  minLevel: number;
  kind: PlotState["kind"];
  levelOk: boolean;
  dewOk: boolean;
  dewToGo: number;
  /** lifetime dewdrops the required level starts at */
  levelAt: number;
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
  /**
   * What may go in the ground TODAY. A seasonal species is simply absent
   * outside its phase — the server decides, so no client can offer a seed
   * that `plant_seed` is about to refuse.
   */
  unlockedSpecies: string[];
  /** The server's own reading of the turn of the year, so the UI agrees with it. */
  yearPhase?: YearPhase;
  /** The next bed that can be bought, or null once the whole garden is theirs. */
  nextPlot?: NextPlot | null;
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
  /**
   * Present only when this garden is one the caller may currently walk into.
   * Absent is the normal case and means the row is not a link — the board
   * never advertises a door that `enter_garden` would refuse.
   */
  uid?: string | null;
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

/**
 * Somebody else's garden, as the server is willing to show it.
 *
 * It is deliberately `GardenState`-SHAPED rather than a trimmed-down type of
 * its own: the scene's `setGarden` takes a state document and repaints from
 * it, so keeping the shape means visiting needs no second renderer. The
 * private half is *blanked* server-side rather than omitted — `dewdrops` 0,
 * `inventory` {}, `unlockedSpecies` [], `nextPlot` null, `friendCode` null —
 * so nothing here can leak, and nothing downstream has to null-check a key
 * that used to always exist.
 *
 * `today` and `hour` are the HOST's, on their frozen timezone. A visitor in
 * Tokyo must see a Berlin garden's day, or the screen and `rescue_plant`
 * disagree about which plants are thirsty.
 */
export type GardenView = GardenState & {
  /**
   * The host's user id — NOT `gardenId`, which is the `gardens` row and is
   * what every RPC here would reject. `rescue_plant` takes this.
   */
  hostUid: string;
  /** Who is looking, and what they may do while they are here. */
  viewer: {
    /** Whether a rescue is available right now (not self, not used today). */
    canRescue: boolean;
    /** They have already helped here today — one visit per host per day. */
    rescuedToday: boolean;
    /** How many plants are actually in trouble, so the UI can say so. */
    needsHelp: number;
  };
};

/** A garden you are allowed to walk into, as offered by the picker. */
export type VisitTarget = {
  uid: string;
  name: string;
  avatar: Avatar;
  level: number;
  gardenValue: number;
  needsHelp: number;
  /** Which list this came from — drives the analytics literal, nothing else. */
  source: VisitSource;
};

/** Bounded set: this is what `gardenVisited` is allowed to report. */
export type VisitSource = "friend" | "showcase" | "hof" | "daily";

export type NoticeKind = "visit" | "rescue" | "care" | "gift" | "season";

/**
 * One line in the bell.
 *
 * Social notices (`visit`, `rescue`) are rows in `notifications` and can be
 * marked read. The rest are DERIVED live from state the game already keeps —
 * `pending_care`, the weekly gift, last season's placing — so there is no
 * cron, no backfill and nothing to keep in sync; they simply stop being
 * returned once the condition clears. `read` is always true for those.
 */
export type Notice = {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string | null;
  /** Display name of whoever did it. Never an address. */
  actorName: string | null;
  actorAvatar: Avatar | null;
  /**
   * Set only when their garden is one this player may currently walk into, so
   * the notice can offer "visit back" — the return leg is most of why anyone
   * looks in on anybody. Null otherwise, and `enter_garden` re-checks anyway.
   */
  actorUid: string | null;
  plotIdx: number | null;
  createdAt: string;
  read: boolean;
};

export type NoticeState = { unread: number; items: Notice[] };

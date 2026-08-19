import type { Avatar } from "@/game/avatar";

export type GardenState = {
  plantId: string;
  avatar: Avatar;
  stage: number; // 0..6
  dayNumber: number;
  plantedOn: string;
  lastWateredOn: string | null;
  wateredToday: boolean;
  wilted: boolean;
  streak: number;
  waters: number;
  missedDays: number;
  isBloomed: boolean;
  completedCount: number;
  today: string;
  timezone: string;
};

export type WaterResult = {
  status: "watered" | "already" | "bloomed" | "error";
  grew?: boolean;
  bloomedNow?: boolean;
  wasWilted?: boolean;
  state?: GardenState;
};

export type CompletedLily = {
  id: number;
  days_taken: number;
  waters: number;
  perfect: boolean;
  completed_at: string;
};

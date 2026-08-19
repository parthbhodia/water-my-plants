import type { GardenState } from "./types";

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const welcomeNew = [
  "A tiny seed settles into the pond. Water it every day and watch it grow!",
  "Welcome to your pond! Your lily seed is ready for its very first drink.",
];

const welcomeBack = [
  "You came back! Your lily has been waiting for you. 💚",
  "Welcome back, gardener. The pond missed your footsteps.",
  "A new day, a new drop of care. Your lily perks up as you arrive.",
];

const welcomeWatered = [
  "All watered for today — your lily is happily soaking it in. See you tomorrow!",
  "Nothing left to do but enjoy the pond. Come back tomorrow for the next drink!",
];

const welcomeWilted = [
  "Oh no — your lily drooped a little while you were away. A drink will cheer it right up!",
  "Your lily missed you! It's a bit wilty, but one watering will fix everything.",
];

const afterWater = [
  "Glug glug… ahh! Your lily wiggles happily. See you tomorrow! 🌙",
  "That hit the spot! The lily stands a little taller now.",
  "Fresh water, happy roots. Come back tomorrow for more growing!",
  "The lily sways a thank-you. Same time tomorrow?",
];

const afterGrow = [
  "It grew! A whole new stage — your daily care is working. ✨",
  "Sparkles! Your lily just reached a new stage of growth!",
  "Look at that — one more step on the journey to full bloom!",
];

const afterRecover = [
  "Phew! The lily perks back up. Growth continues — try not to skip days!",
  "Back from the brink! Your lily forgives you completely. 💧",
];

const already = [
  "Already watered today! Lilies grow on patience — come back tomorrow. 🌙",
  "One drink a day is plenty. Your lily is savoring it!",
  "The pond is full of today's love already. See you tomorrow!",
];

const bloom = [
  "🌸 FULL BLOOM! Your lily opens its petals to the sky. You did this, one day at a time!",
  "🌸 It bloomed!! Every single day of care is in these petals. Beautiful work, gardener.",
];

export function welcomeMessage(s: GardenState): string {
  if (s.isBloomed) return "Your lily is in full bloom! Admire it — or plant a new seed. 🌸";
  if (s.wilted) return pick(welcomeWilted);
  if (s.wateredToday) return pick(welcomeWatered);
  if (s.dayNumber <= 1 && s.waters === 0) return pick(welcomeNew);
  return pick(welcomeBack);
}

export function waterMessage(status: string, grew?: boolean, bloomedNow?: boolean, wasWilted?: boolean): string {
  if (bloomedNow) return pick(bloom);
  if (status === "already") return pick(already);
  if (wasWilted) return pick(afterRecover);
  if (grew) return Math.random() < 0.5 ? pick(afterGrow) : pick(afterWater);
  return pick(afterWater);
}

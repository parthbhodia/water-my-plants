import type { GardenState, TendResult } from "./types";
import { SPECIES_BY_KEY } from "./species";

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const hour12 = (h: number | null | undefined) =>
  h === null || h === undefined ? "" : `${String(h).padStart(2, "0")}:00`;

export function welcomeMessage(s: GardenState): string {
  const planted = s.plots.filter((p) => p.plant).length;
  const thirsty = s.plots.filter((p) => p.plant?.thirsty && !p.plant?.isBloomed && !p.plant?.dead).length;
  const dead = s.plots.filter((p) => p.plant?.dead).length;
  const bloomed = s.plots.filter((p) => p.plant?.isBloomed).length;

  if (planted === 0)
    return "Empty plots, endless promise. Tap a plot to plant your first seed! 🌱";
  if (dead > 0)
    return `${dead === 1 ? "One plant didn't make it" : `${dead} plants didn't make it`} while you were away. Clear the plot and start again. 🥀`;
  if (thirsty > 0)
    return `${thirsty} ${thirsty === 1 ? "plant needs" : "plants need"} you today. Let's get watering! 💧`;
  if (bloomed > 0)
    return `${bloomed} ${bloomed === 1 ? "bloom is" : "blooms are"} ready to harvest. Beautiful work! 🌸`;
  return pick([
    "Everything is watered and happy. See you tomorrow! 🌙",
    "Your garden is thriving. Nothing left to do today.",
    "All tended. The garden hums along without you now.",
  ]);
}

export function tendMessage(r: TendResult): string {
  const sp = r.species ? SPECIES_BY_KEY[r.species] : undefined;
  const name = sp?.name ?? "It";

  switch (r.status) {
    case "watered":
      if (r.bloomedNow)
        return `🌸 ${name} reached full bloom! +${r.dewEarned} dewdrops. Harvest it to free the plot.`;
      if (r.wasWilted) return `${name} perks back up. Try not to leave it so long! +${r.dewEarned} 💧`;
      if (r.grew) return pick([
        `${name} grew a stage! +${r.dewEarned} dewdrops ✨`,
        `Fresh water, new growth. +${r.dewEarned} dewdrops`,
      ]);
      return `Watered. +${r.dewEarned} dewdrops`;
    case "fed":
      return `${name} has been fed. +${r.dewEarned} dewdrops 🌰`;
    case "pruned":
      return `${name} is looking sharp. +${r.dewEarned} dewdrops ✂️`;
    case "already":
      return r.reason ?? "Already tended today. Come back tomorrow! 🌙";
    case "not_thirsty":
      return sp
        ? `${name} drinks every ${sp.cadenceDays} days — it isn't thirsty yet.`
        : "Not thirsty yet.";
    case "wrong_window":
      return sp?.windowStart === 18
        ? `${name} only drinks after dusk. Come back between ${hour12(r.windowStart)} and ${hour12(r.windowEnd)}. 🌙`
        : `${name} only drinks between ${hour12(r.windowStart)} and ${hour12(r.windowEnd)}. ☀️`;
    case "overwatered":
      return `💀 Too much! ${name} likes dry roots — you've damaged it. Wait for it to be thirsty next time.`;
    case "not_needed":
      return r.reason ?? "Nothing to do there.";
    case "bloomed":
      return `${name} is already in full bloom. Harvest it!`;
    case "dead":
      return `${name} is gone. Clear the plot to plant again.`;
    default:
      return "Hmm, that didn't work. Try again!";
  }
}

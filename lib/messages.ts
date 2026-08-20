import type { GardenState, TendResult } from "./types";
import type { GuideMood } from "@/game/guide";
import { SPECIES_BY_KEY } from "./species";

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const hour12 = (h: number | null | undefined) =>
  h === null || h === undefined ? "" : `${String(h).padStart(2, "0")}:00`;

/** The player's first name, ready to drop into a sentence — or "" if unset. */
function firstName(s: GardenState): string {
  const n = (s.displayName ?? "").trim().split(/\s+/)[0] ?? "";
  return n.length > 1 && n.length <= 16 ? n : "";
}

export function welcomeMessage(s: GardenState): string {
  const planted = s.plots.filter((p) => p.plant).length;
  const thirsty = s.plots.filter((p) => p.plant?.thirsty && !p.plant?.isBloomed && !p.plant?.dead).length;
  const dead = s.plots.filter((p) => p.plant?.dead).length;
  const bloomed = s.plots.filter((p) => p.plant?.isBloomed).length;
  const name = firstName(s);
  const dear = name || "dear";

  if (planted === 0)
    return `Empty plots, endless promise${name ? `, ${name}` : ""}. Tap a plot to plant your first seed! 🌱`;
  if (dead > 0)
    return `${dead === 1 ? "One plant didn't make it" : `${dead} plants didn't make it`} while you were away, ${dear}. Clear the plot and start again. 🥀`;
  if (thirsty > 0)
    return `${name ? `${name}, ` : ""}${thirsty} ${thirsty === 1 ? "plant needs" : "plants need"} you today. Let's get watering! 💧`;
  if (bloomed > 0)
    return `${name ? `${name}! ` : ""}${bloomed} ${bloomed === 1 ? "bloom is" : "blooms are"} ready to harvest. Beautiful work! 🌸`;
  return pick([
    `All watered and happy, ${dear}. Stay a while — watch them sway and listen to the music. 🌿`,
    "Everything is thriving. Pull up the bench and enjoy your garden a moment.",
    "All tended. The koi are out and the music is lovely — no need to rush off.",
  ]);
}

export function tendMessage(r: TendResult, playerName?: string | null): string {
  const sp = r.species ? SPECIES_BY_KEY[r.species] : undefined;
  const name = sp?.name ?? "It";
  const who = (playerName ?? "").trim().split(/\s+/)[0] ?? "";
  const you = who.length > 1 && who.length <= 16 ? who : "";

  switch (r.status) {
    case "watered":
      if (r.bloomedNow)
        return `🌸 ${you ? `${you}, you did it — ` : ""}${name} reached full bloom! +${r.dewEarned} dewdrops. Harvest it to free the plot.`;
      if (r.wasWilted) return `${name} perks back up. Try not to leave it so long! +${r.dewEarned} 💧`;
      if (r.grew) return pick([
        `${name} grew a stage${you ? `, ${you}` : ""}! +${r.dewEarned} dewdrops ✨`,
        `Fresh water, new growth. +${r.dewEarned} dewdrops`,
        `There she goes${you ? `, ${you}` : ""} — a whole new stage. +${r.dewEarned} 💧`,
      ]);
      return `Watered. +${r.dewEarned} dewdrops`;
    case "fed":
      return `${name} has been fed. +${r.dewEarned} dewdrops 🌰`;
    case "pruned":
      return `${name} is looking sharp. +${r.dewEarned} dewdrops ✂️`;
    case "already":
      return r.reason ?? "She's had her drink for today. Stay and watch her sway — or see how the neighbours are doing. 🌿";
    case "not_thirsty":
      return sp
        ? `${name} drinks every ${sp.cadenceDays} days — it isn't thirsty yet.`
        : "Not thirsty yet.";
    case "wrong_window":
      return sp?.windowStart === 18
        ? `${name} only drinks after dusk. Come back between ${hour12(r.windowStart)} and ${hour12(r.windowEnd)}. 🌙`
        : `${name} only drinks between ${hour12(r.windowStart)} and ${hour12(r.windowEnd)}. ☀️`;
    case "too_soon":
      return `Steady on — ${name} was watered very recently. Try again after ${r.readyAt}.`;
    case "overwatered":
      return `💀 Too much! ${name} likes dry roots — you've damaged it. Wait for it to be thirsty next time.`;
    case "no_item":
      return r.reason ?? "You are missing something for that — check the shop.";
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

/** Which face Granny Fern pulls for a welcome. */
export function welcomeMood(s: GardenState): GuideMood {
  const dead = s.plots.some((p) => p.plant?.dead);
  const thirsty = s.plots.some((p) => p.plant?.thirsty && !p.plant?.isBloomed && !p.plant?.dead);
  const bloomed = s.plots.some((p) => p.plant?.isBloomed);
  if (dead) return "worry";
  if (bloomed) return "proud";
  if (thirsty) return "happy";
  return s.hour >= 21 || s.hour < 5 ? "sleepy" : "happy";
}

/** Which face goes with a tend outcome. */
export function tendMood(r: TendResult): GuideMood {
  switch (r.status) {
    case "watered":
    case "fed":
    case "pruned":
      return r.bloomedNow ? "proud" : r.grew ? "cheer" : "happy";
    case "overwatered":
    case "dead":
    case "error":
      return "worry";
    case "already":
    case "too_soon":
      return "sleepy";
    default:
      return "happy";
  }
}

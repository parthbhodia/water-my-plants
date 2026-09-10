import type { GardenState } from "./types";
import { SPECIES_BY_KEY, windowOpen } from "./species";

/**
 * The single most useful next action in a garden, by priority.
 *
 * Lifted out of `components/NextStep.tsx` because it now has a second reader:
 * the notification bell derives its "your garden wants something" line from
 * exactly this decision. Two copies of a priority ladder is how the panel and
 * the bell end up disagreeing about which plant is in the most trouble — and
 * `TodayBrief` was already deleted once for telling a player the same thing
 * twice in different words.
 *
 * Deliberately client-side, from the state document the app already holds.
 * The server has its own `pending_care` for the email nudges; that runs on a
 * schedule and answers a different question (what is worth an email at 9am),
 * so it is not the thing an on-screen panel should be waiting on.
 */
export type StepKind = "dead" | "dying" | "thirsty" | "empty" | "harvest";

export type NextStepInfo = {
  kind: StepKind;
  title: string;
  body: string;
  cta: string;
  idx: number;
  /** Acting on this one means opening the seed picker, not selecting a plant. */
  plant: boolean;
};

export function nextStep(state: GardenState): NextStepInfo | null {
  const plots = state.plots.filter((p) => p.unlocked);

  // Death comes first. A dead plant matched none of the branches below — it
  // is not dying, not thirsty, not bloomed, and the plot is not empty because
  // a corpse still occupies it — so a garden full of dead plants used to fall
  // through to "Everything is tended".
  const dead = plots.find((p) => p.plant?.dead);
  const dying = plots.find(
    (p) => p.plant && !p.plant.dead && !p.plant.isBloomed && p.plant.overdueDays >= 3
  );
  const thirsty = plots.find((p) => {
    const sp = p.plant ? SPECIES_BY_KEY[p.plant.species] : null;
    return (
      p.plant && sp && p.plant.thirsty && !p.plant.isBloomed && !p.plant.dead &&
      windowOpen(sp, state.hour)
    );
  });
  const bloomed = plots.find((p) => p.plant?.isBloomed);
  const empty = plots.find((p) => !p.plant);

  if (dead) {
    const sp = SPECIES_BY_KEY[dead.plant!.species];
    const tonics = state.inventory?.tonic ?? 0;
    return {
      kind: "dead", idx: dead.idx, plant: false,
      title: `Your ${sp?.name ?? "plant"} didn't make it`,
      body: tonics > 0
        ? `Plot ${dead.idx + 1} — you have a revival tonic. Use it, or clear the bed and start again.`
        : `Plot ${dead.idx + 1} — a revival tonic from the Shop brings her back, or clear the bed and plant something new.`,
      cta: "Go see",
    };
  }
  if (dying) {
    const sp = SPECIES_BY_KEY[dying.plant!.species];
    const pond = sp?.needsPlot === "water";
    return {
      kind: "dying", idx: dying.idx, plant: false,
      title: pond ? "Top up the pond — today or never" : `Water the ${sp?.name} — today or never`,
      body: pond
        ? "One more day at this level and she strands on the mud."
        : "One more dry day and she is gone for good.",
      cta: "Save her",
    };
  }
  if (thirsty) {
    const sp = SPECIES_BY_KEY[thirsty.plant!.species];
    // She floats — she is not thirsty. The pond is low.
    const pond = sp?.needsPlot === "water";
    return {
      kind: "thirsty", idx: thirsty.idx, plant: false,
      title: pond ? "The pond needs topping up" : `Your ${sp?.name} is thirsty`,
      body: pond
        ? `Plot ${thirsty.idx + 1} — a can over the side holds the level for the day.`
        : `Plot ${thirsty.idx + 1} — one drink is all it takes today.`,
      cta: pond ? "Go top up" : "Go water",
    };
  }
  if (empty) {
    const kindWord =
      empty.kind === "water" ? "the pond" : empty.kind === "shade" ? "a shaded plot" : "a sunny plot";
    return {
      kind: "empty", idx: empty.idx, plant: true,
      title: "Plant something new",
      body: `Plot ${empty.idx + 1} is ${kindWord} and empty — pick a seed that likes it there.`,
      cta: "Choose a seed",
    };
  }
  if (bloomed) {
    return {
      kind: "harvest", idx: bloomed.idx, plant: false,
      title: "A bloom is ready to harvest",
      body: `Plot ${bloomed.idx + 1} — bank the points and free the plot.`,
      cta: "Go harvest",
    };
  }
  return null;
}

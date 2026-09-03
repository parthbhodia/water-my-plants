"use client";

import { Sprout, Droplets, Flower2, CircleAlert, Sparkles, Skull } from "lucide-react";
import type { GardenState } from "@/lib/types";
import { SPECIES_BY_KEY, windowOpen } from "@/lib/species";

/**
 * The single most useful next action, always visible above the plot chips.
 * A lost player should never have to wonder what to do — or where.
 */
export default function NextStep({
  state,
  onGo,
}: {
  state: GardenState;
  /** Selects the plot and, for empty ones, opens the seed picker. */
  onGo: (plotIdx: number, plant: boolean) => void;
}) {
  const plots = state.plots.filter((p) => p.unlocked);

  // Death comes first. A dead plant matched none of the branches below —
  // it is not dying, not thirsty, not bloomed, and the plot is not empty
  // because a corpse still occupies it — so a garden full of dead plants
  // fell through to "Everything is tended".
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

  let step: { icon: typeof Sprout; kind: string; title: string; body: string; cta: string; idx: number; plant: boolean } | null = null;

  if (dead) {
    const sp = SPECIES_BY_KEY[dead.plant!.species];
    const tonics = state.inventory?.tonic ?? 0;
    step = { icon: Skull, kind: "dead", idx: dead.idx, plant: false,
      title: `Your ${sp?.name ?? "plant"} didn't make it`,
      body: tonics > 0
        ? `Plot ${dead.idx + 1} — you have a revival tonic. Use it, or clear the bed and start again.`
        : `Plot ${dead.idx + 1} — a revival tonic from the Shop brings her back, or clear the bed and plant something new.`,
      cta: "Go see" };
  } else if (dying) {
    const sp = SPECIES_BY_KEY[dying.plant!.species];
    step = { icon: CircleAlert, kind: "dying", idx: dying.idx, plant: false,
      title: `Water the ${sp?.name} — today or never`,
      body: "One more dry day and she is gone for good.", cta: "Save her" };
  } else if (thirsty) {
    const sp = SPECIES_BY_KEY[thirsty.plant!.species];
    step = { icon: Droplets, kind: "thirsty", idx: thirsty.idx, plant: false,
      title: `Your ${sp?.name} is thirsty`,
      body: `Plot ${thirsty.idx + 1} — one drink is all it takes today.`, cta: "Go water" };
  } else if (empty) {
    const kindWord = empty.kind === "water" ? "the pond" : empty.kind === "shade" ? "a shaded plot" : "a sunny plot";
    step = { icon: Sprout, kind: "empty", idx: empty.idx, plant: true,
      title: "Plant something new",
      body: `Plot ${empty.idx + 1} is ${kindWord} and empty — pick a seed that likes it there.`,
      cta: "Choose a seed" };
  } else if (bloomed) {
    step = { icon: Flower2, kind: "harvest", idx: bloomed.idx, plant: false,
      title: "A bloom is ready to harvest",
      body: `Plot ${bloomed.idx + 1} — bank the points and free the plot.`, cta: "Go harvest" };
  }

  if (!step) {
    return (
      <div className="next-step k-done">
        <span className="ns-icon"><Sparkles size={20} strokeWidth={2.4} aria-hidden /></span>
        <div className="ns-text">
          <b>Everything is tended</b>
          <span>Stay a while — watch them sway, or put a record on.</span>
        </div>
      </div>
    );
  }

  const Icon = step.icon;
  return (
    <button className={`next-step k-${step.kind}`} onClick={() => onGo(step.idx, step.plant)}>
      <span className="ns-icon"><Icon size={20} strokeWidth={2.4} aria-hidden /></span>
      <div className="ns-text">
        <b>{step.title}</b>
        <span>{step.body}</span>
      </div>
      <span className="ns-cta">{step.cta}</span>
    </button>
  );
}

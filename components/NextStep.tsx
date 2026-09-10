"use client";

import { Sprout, Droplets, Flower2, CircleAlert, Sparkles, Skull } from "lucide-react";
import type { GardenState } from "@/lib/types";
import { nextStep, type StepKind } from "@/lib/nextstep";

const ICON: Record<StepKind, typeof Sprout> = {
  dead: Skull, dying: CircleAlert, thirsty: Droplets, empty: Sprout, harvest: Flower2,
};

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
  // The ladder itself lives in lib/nextstep.ts — the notification bell reads
  // the same decision, and two copies of a priority order is how the panel
  // and the bell end up naming different plants as the urgent one.
  const step = nextStep(state);

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

  const Icon = ICON[step.kind];
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

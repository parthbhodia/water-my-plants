"use client";

import { Droplets, Sparkles } from "lucide-react";
import type { GardenState } from "@/lib/types";
import { SPECIES_BY_KEY, canWaterNow } from "@/lib/species";

/**
 * Watering lives on the stage, not inside the pull-up sheet. One thumb-sized
 * button for the selected plant, and — when the day has a real round to do —
 * one that waters everything due, in sequence.
 */
export default function WaterFab({
  state,
  selected,
  busy,
  roundLeft,
  onWater,
  onWaterAll,
}: {
  state: GardenState;
  selected: number;
  busy: boolean;
  /** >0 while a water-all round is running */
  roundLeft: number;
  onWater: (i: number) => void;
  onWaterAll: () => void;
}) {
  const due = state.plots.filter((p) => p.unlocked && canWaterNow(p.plant, state.hour));
  const cur = state.plots[selected];
  const curCan = canWaterNow(cur?.plant, state.hour);
  const sp = cur?.plant ? SPECIES_BY_KEY[cur.plant.species] : null;

  if (roundLeft > 0) {
    return (
      <div className="water-fab-wrap">
        <div className="water-fab round">
          <span className="wf-spin"><Droplets size={22} strokeWidth={2.6} aria-hidden /></span>
          <span className="wf-label">Watering… {roundLeft} to go</span>
        </div>
      </div>
    );
  }

  if (due.length === 0) return null;

  return (
    <div className="water-fab-wrap">
      {due.length > 1 && (
        <button
          className="water-fab all"
          disabled={busy}
          onClick={onWaterAll}
          aria-label={`Water all ${due.length} thirsty plants`}
        >
          <Sparkles size={19} strokeWidth={2.6} aria-hidden />
          <span className="wf-label">Water all {due.length}</span>
        </button>
      )}
      <button
        className="water-fab"
        disabled={busy}
        onClick={() => onWater(curCan ? selected : due[0].idx)}
        aria-label="Water this plant"
      >
        <Droplets size={24} strokeWidth={2.6} aria-hidden />
        <span className="wf-label">
          {curCan ? `Water ${sp?.name.split(" ").pop() ?? "it"}` : `Water plot ${due[0].idx + 1}`}
        </span>
      </button>
    </div>
  );
}

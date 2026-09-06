"use client";

import {
  Sun, CloudSun, Waves, Droplets, Nut, Scissors, FlaskConical,
  Flower2, Sprout, Skull, Plus, Clock, CircleAlert,
} from "lucide-react";
import type { GardenState, PlotState, TendAction } from "@/lib/types";
import { SPECIES_BY_KEY, canWaterNow, PLOT_LABEL } from "@/lib/species";
import PlantIcon from "./PlantIcon";

const KIND_ICON = { sun: Sun, shade: CloudSun, water: Waves } as const;

/** Stage progress as seven little leaves filling in. */
function StageDots({ stage, total = 7 }: { stage: number; total?: number }) {
  return (
    <span className="stage-dots" aria-label={`stage ${stage + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i <= stage ? "on" : ""} />
      ))}
    </span>
  );
}

export default function PlotBar({
  state,
  selected,
  busy,
  onSelect,
  onTend,
  onPlant,
  onClear,
  onRevive,
}: {
  state: GardenState;
  selected: number;
  busy: boolean;
  onSelect: (i: number) => void;
  onTend: (i: number, a: TendAction) => void;
  onPlant: (p: PlotState) => void;
  onClear: (i: number) => void;
  onRevive: (i: number) => void;
}) {
  const plots = state.plots.filter((p) => p.unlocked);
  const cur = state.plots[selected];
  const plant = cur?.plant ?? null;
  const sp = plant ? SPECIES_BY_KEY[plant.species] : null;

  const canWater = canWaterNow(plant, state.hour);
  const needsFeed = !!plant && !!sp && sp.feedsRequired > plant.feedsDone && !plant.dead;
  const needsPrune = !!plant && !!sp && sp.prunesRequired > plant.prunesDone && !plant.dead;
  const clearable = !!plant && (plant.isBloomed || plant.dead);

  return (
    <div className="plotbar">
      <div className="plot-chips">
        {plots.map((p) => {
          const pl = p.plant;
          const psp = pl ? SPECIES_BY_KEY[pl.species] : null;
          const lastDay = !!pl && !pl.dead && !pl.isBloomed && pl.overdueDays >= 3;
          const chipState = !pl
            ? "empty"
            : pl.dead ? "dead"
            : pl.isBloomed ? "bloom"
            : lastDay ? "dying"
            : pl.thirsty ? "thirsty"
            : "ok";
          const Kind = KIND_ICON[p.kind];
          return (
            <button
              key={p.idx}
              className={`plot-chip s-${chipState} ${p.idx === selected ? "sel" : ""}`}
              onClick={() => onSelect(p.idx)}
              title={`Plot ${p.idx + 1} — ${PLOT_LABEL[p.kind]}`}
            >
              <span className="chip-kind"><Kind size={12} strokeWidth={2.4} aria-hidden /></span>
              {pl && (
                <span className="chip-badge" aria-hidden>
                  {pl.dead ? <Skull size={12} /> :
                   pl.isBloomed ? <Flower2 size={12} /> :
                   lastDay ? <CircleAlert size={12} /> :
                   pl.thirsty ? <Droplets size={12} /> : <Clock size={12} />}
                </span>
              )}
              <span className="chip-art">
                {pl ? (
                  <PlantIcon species={pl.species} stage={pl.stage} size={66} wilted={pl.wilted} dead={pl.dead} />
                ) : (
                  <Plus size={22} strokeWidth={2.4} className="chip-empty" aria-hidden />
                )}
              </span>
              <span className="chip-name">{pl ? psp?.name.split(" ").pop() : "Plant"}</span>
              {pl && !pl.dead && <StageDots stage={pl.stage} />}
            </button>
          );
        })}
      </div>

    </div>
  );
}

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
                  <PlantIcon species={pl.species} stage={pl.stage} size={52} wilted={pl.wilted} dead={pl.dead} />
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

      {cur && (
        <div className="plot-actions">
          <div className="plot-status-card">
            {plant && sp ? (
              <>
                <b>{sp.name}</b>
                <span className="ps-line">
                  {plant.dead ? (
                    "Died — clear the plot, or revive it with a tonic."
                  ) : plant.isBloomed ? (
                    "Full bloom! Harvest to free the plot."
                  ) : (
                    <>
                      Day {plant.dayNumber} · stage {plant.stage + 1} of 7
                      {plant.overdueDays >= 3
                        ? " · last chance — she dies tonight!"
                        : plant.wilted
                        ? ` · wilting, ${plant.overdueDays}d late`
                        : plant.thirsty
                        ? " · thirsty now"
                        : " · watered for today ✓"}
                      {sp.feedsRequired ? ` · fed ${plant.feedsDone}/${sp.feedsRequired}` : ""}
                      {sp.prunesRequired ? ` · pruned ${plant.prunesDone}/${sp.prunesRequired}` : ""}
                    </>
                  )}
                </span>
              </>
            ) : (
              <>
                <b>{PLOT_LABEL[cur.kind]}</b>
                <span className="ps-line">Empty and ready for a seed.</span>
              </>
            )}
          </div>
          <div className="plot-buttons">
            {!plant && (
              <button className="btn small" disabled={busy} onClick={() => onPlant(cur)}>
                <Sprout size={15} strokeWidth={2.4} aria-hidden /> Plant here
              </button>
            )}
            {plant && !clearable && (
              <>
                <button
                  className={`btn blue small ${canWater ? "" : "dim"}`}
                  disabled={busy}
                  onClick={() => onTend(selected, "water")}
                >
                  <Droplets size={15} strokeWidth={2.4} aria-hidden /> Water
                </button>
                {needsFeed && (
                  <button className="btn small" disabled={busy} onClick={() => onTend(selected, "feed")}>
                    <Nut size={15} strokeWidth={2.4} aria-hidden /> Feed
                  </button>
                )}
                {needsPrune && (
                  <button className="btn small" disabled={busy} onClick={() => onTend(selected, "prune")}>
                    <Scissors size={15} strokeWidth={2.4} aria-hidden /> Prune
                  </button>
                )}
              </>
            )}
            {plant?.dead && (state.inventory?.tonic ?? 0) > 0 && (
              <button className="btn small" disabled={busy} onClick={() => onRevive(selected)}>
                <FlaskConical size={15} strokeWidth={2.4} aria-hidden /> Revive ({state.inventory.tonic})
              </button>
            )}
            {clearable && (
              <button className="btn pink small" disabled={busy} onClick={() => onClear(selected)}>
                <Flower2 size={15} strokeWidth={2.4} aria-hidden />{" "}
                {plant?.isBloomed ? "Harvest" : "Clear plot"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

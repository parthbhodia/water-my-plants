"use client";

import type { GardenState, PlotState, TendAction } from "@/lib/types";
import { SPECIES_BY_KEY, windowOpen, PLOT_LABEL } from "@/lib/species";
import PlantIcon from "./PlantIcon";

const KIND_ICON = { sun: "☀️", shade: "🌥️", water: "💦" } as const;

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

  const canWater =
    !!plant && !!sp && plant.thirsty && !plant.isBloomed && !plant.dead && windowOpen(sp, state.hour);
  const needsFeed = !!plant && !!sp && sp.feedsRequired > plant.feedsDone && !plant.dead;
  const needsPrune = !!plant && !!sp && sp.prunesRequired > plant.prunesDone && !plant.dead;
  const clearable = !!plant && (plant.isBloomed || plant.dead);

  let statusLine = "";
  if (!cur) statusLine = "";
  else if (!plant) statusLine = `${PLOT_LABEL[cur.kind]} · empty`;
  else if (plant.dead) statusLine = `${sp?.name} · died — clear the plot`;
  else if (plant.isBloomed) statusLine = `${sp?.name} · full bloom! harvest to free the plot`;
  else {
    const bits = [`${sp?.name}`, `day ${plant.dayNumber}`, `stage ${plant.stage + 1}/7`];
    if (plant.wilted) bits.push(`wilting (${plant.overdueDays}d late)`);
    else if (!plant.thirsty) bits.push("not thirsty yet");
    if (sp && sp.feedsRequired) bits.push(`fed ${plant.feedsDone}/${sp.feedsRequired}`);
    if (sp && sp.prunesRequired) bits.push(`pruned ${plant.prunesDone}/${sp.prunesRequired}`);
    statusLine = bits.join(" · ");
  }

  return (
    <div className="plotbar">
      <div className="plot-chips">
        {plots.map((p) => {
          const pl = p.plant;
          const state2 = !pl
            ? "empty"
            : pl.dead ? "dead"
            : pl.isBloomed ? "bloom"
            : pl.thirsty ? "thirsty"
            : "ok";
          return (
            <button
              key={p.idx}
              className={`plot-chip s-${state2} ${p.idx === selected ? "sel" : ""}`}
              onClick={() => onSelect(p.idx)}
              title={`Plot ${p.idx + 1} — ${PLOT_LABEL[p.kind]}`}
            >
              <span className="chip-kind">{KIND_ICON[p.kind]}</span>
              {pl ? (
                <PlantIcon species={pl.species} stage={pl.stage} size={30} wilted={pl.wilted} dead={pl.dead} />
              ) : (
                <span className="chip-empty">+</span>
              )}
              <span className="chip-n">{p.idx + 1}</span>
            </button>
          );
        })}
      </div>

      <div className="plot-actions">
        <span className="plot-status">{statusLine}</span>
        <div className="plot-buttons">
          {!plant && cur && (
            <button className="btn small" disabled={busy} onClick={() => onPlant(cur)}>
              🌱 Plant here
            </button>
          )}
          {plant && !clearable && (
            <>
              <button
                className={`btn blue small ${canWater ? "" : "dim"}`}
                disabled={busy}
                onClick={() => onTend(selected, "water")}
              >
                💧 Water
              </button>
              {needsFeed && (
                <button className="btn small" disabled={busy} onClick={() => onTend(selected, "feed")}>
                  🌰 Feed
                </button>
              )}
              {needsPrune && (
                <button className="btn small" disabled={busy} onClick={() => onTend(selected, "prune")}>
                  ✂️ Prune
                </button>
              )}
            </>
          )}
          {plant?.dead && (state.inventory?.tonic ?? 0) > 0 && (
            <button className="btn small" disabled={busy} onClick={() => onRevive(selected)}>
              🧪 Revive ({state.inventory.tonic})
            </button>
          )}
          {clearable && (
            <button className="btn pink small" disabled={busy} onClick={() => onClear(selected)}>
              {plant?.isBloomed ? "🌸 Harvest" : "🥀 Clear plot"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

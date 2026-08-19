"use client";

import { SPECIES, careSummary, PLOT_LABEL, type SpeciesDef } from "@/lib/species";
import type { PlotState } from "@/lib/types";
import PlantIcon from "./PlantIcon";

export default function SeedPicker({
  plot,
  unlocked,
  dewdrops,
  onPlant,
  onClose,
  busy,
}: {
  plot: PlotState;
  unlocked: string[];
  dewdrops: number;
  onPlant: (key: string) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const fits = (s: SpeciesDef) => s.needsPlot === "any" || s.needsPlot === plot.kind;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="journal" onClick={(e) => e.stopPropagation()}>
        <div className="journal-head">
          <h2>🌱 Plant in plot {plot.idx + 1}</h2>
          <button className="btn ghost small" onClick={onClose}>✕ close</button>
        </div>
        <p className="journal-sub">
          This is a <b>{PLOT_LABEL[plot.kind].toLowerCase()}</b>. Each species wants something
          different — pick one whose needs you can actually keep up with.
        </p>

        <div className="seed-grid">
          {SPECIES.map((s) => {
            const isUnlocked = unlocked.includes(s.key);
            const ok = fits(s) && isUnlocked;
            return (
              <button
                key={s.key}
                className={`seed-card ${ok ? "" : "seed-off"}`}
                disabled={!ok || busy}
                onClick={() => ok && onPlant(s.key)}
              >
                <div className="seed-art">
                  <PlantIcon species={s} stage={6} size={54} />
                </div>
                <h4>{s.name}</h4>
                <p className="seed-care">{careSummary(s)}</p>
                <p className="seed-blurb">{s.blurb}</p>
                <div className="seed-foot">
                  <span className="seed-pts">{s.points} pts</span>
                  {!isUnlocked ? (
                    <span className="seed-lock">🔒 {s.unlockCost} dew</span>
                  ) : !fits(s) ? (
                    <span className="seed-lock">needs {PLOT_LABEL[s.needsPlot].toLowerCase()}</span>
                  ) : (
                    <span className="seed-go">Plant →</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <p className="journal-sub" style={{ marginTop: 14, marginBottom: 0 }}>
          You have <b>{dewdrops} 💧 dewdrops</b>. Locked species arrive with the Shop.
        </p>
      </div>
    </div>
  );
}

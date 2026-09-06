"use client";

import { SPECIES, careSummary, PLOT_LABEL, type SpeciesDef } from "@/lib/species";
import { PLANT_FACTS } from "@/lib/plantfacts";
import { Droplets, CalendarDays, TriangleAlert } from "lucide-react";
import type { PlotState } from "@/lib/types";
import { PHASE_NAME, type YearPhase } from "@/lib/yearphase";
import PlantIcon from "./PlantIcon";

export default function SeedPicker({
  plot,
  unlocked,
  dewdrops,
  phase,
  onPlant,
  onClose,
  busy,
}: {
  plot: PlotState;
  unlocked: string[];
  /** The server's turn of the year — what a seasonal seed is measured against. */
  phase?: YearPhase;
  dewdrops: number;
  onPlant: (key: string) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const fits = (s: SpeciesDef) => s.needsPlot === "any" || s.needsPlot === plot.kind;
  // A seasonal seed is left ON the shelf, greyed, with the month it comes
  // back. Hiding it entirely would mean a player never learns it exists —
  // and finding out a garden has four plants you have never seen is most of
  // the pleasure of them.
  const inSeason = (s: SpeciesDef) => !s.phase || !phase || s.phase === phase;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="journal" onClick={(e) => e.stopPropagation()}>
        <div className="journal-head">
          <h2>🌱 Plant in plot {plot.idx + 1}</h2>
          <button className="btn ghost small" onClick={onClose}>✕ close</button>
        </div>
        <p className="journal-sub">
          This is a <b>{PLOT_LABEL[plot.kind].toLowerCase()}</b>. Every one of these is a
          promise to show up — check what it asks for before you plant it, not after.
        </p>

        <div className="seed-grid">
          {SPECIES.map((s) => {
            const seasonal = !!s.phase;
            const here = inSeason(s);
            // `unlocked` already excludes out-of-season seasonals, so a
            // seasonal seed is never "not bought" — only "not yet".
            const isUnlocked = unlocked.includes(s.key) || (seasonal && !here);
            const ok = fits(s) && isUnlocked && here;
            return (
              <button
                key={s.key}
                className={`seed-card ${ok ? "" : "seed-off"}`}
                disabled={!ok || busy}
                onClick={() => ok && onPlant(s.key)}
              >
                <div className="seed-art">
                  <PlantIcon species={s} stage={6} size={76} />
                </div>
                <h4>{s.name}</h4>
                {/*
                  What you are signing up for, before you sign up for it.
                  The care contract used to be one grey line under the name,
                  read as decoration, and the first time most players learned
                  what a plant actually wanted was the day it died. This says
                  the commitment in the units that matter — how often, for how
                  long, how many visits in total — and names the one way this
                  particular plant is usually lost.
                */}
                <p className="seed-ask">
                  <Droplets size={13} strokeWidth={2.7} aria-hidden />
                  {s.cadenceDays === 1 ? "Every day" : `Every ${s.cadenceDays} days`}
                  <span className="seed-ask-sep">·</span>
                  <CalendarDays size={13} strokeWidth={2.7} aria-hidden />
                  {s.maturesDays} days to bloom
                </p>
                <p className="seed-visits">
                  About {Math.max(1, Math.round(s.maturesDays / s.cadenceDays))} visits in all
                  {s.feedsRequired > 0 && `, plus ${s.feedsRequired} feeds`}
                  {s.prunesRequired > 0 && `, plus ${s.prunesRequired} prunes`}.
                </p>
                {PLANT_FACTS[s.key]?.tooMuch && s.overwaterable && (
                  <p className="seed-warn">
                    <TriangleAlert size={13} strokeWidth={2.7} aria-hidden />
                    Watering early hurts this one.
                  </p>
                )}
                <p className="seed-care">{careSummary(s)}</p>
                <p className="seed-blurb">{s.blurb}</p>
                <div className="seed-foot">
                  <span className="seed-pts">{s.points} pts</span>
                  {seasonal && !here ? (
                    <span className="seed-lock">back in {PHASE_NAME[s.phase!]}</span>
                  ) : !isUnlocked ? (
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

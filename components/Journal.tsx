"use client";

import { SPECIES, careSummary, PLOT_LABEL } from "@/lib/species";
import type { CompletedLily, GardenState } from "@/lib/types";
import PlantIcon from "./PlantIcon";
import { PHASE_NAME, yearPhase } from "@/lib/yearphase";
import VariantCollection from "./VariantCollection";

export default function Journal({
  state,
  completed,
  onClose,
}: {
  state: GardenState;
  completed: CompletedLily[] | null;
  onClose: () => void;
}) {
  const phase = state.yearPhase ?? yearPhase(state.today, state.timezone);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="journal" onClick={(e) => e.stopPropagation()}>
        <div className="journal-head">
          <h2>📖 Almanac</h2>
          <button className="btn ghost small" onClick={onClose}>✕ close</button>
        </div>
        <p className="journal-sub">
          Every species and what it asks of you. Locked entries arrive with the
          Shop; the four seasonal ones come round with the year.
        </p>

        <div className="journal-grid">
          {SPECIES.map((s) => {
            // A seasonal species is never bought, so "Unlock for 0 dewdrops"
            // would be nonsense. Out of season it is simply waiting, and the
            // almanac says so — this is the one place a player can see the
            // whole year's planting at once.
            const seasonal = !!s.phase;
            const here = !s.phase || s.phase === phase;
            const unlocked = state.unlockedSpecies.includes(s.key) || (seasonal && !here);
            return (
              <div key={s.key} className={`stage-card ${unlocked && here ? "" : "locked"}`}>
                <span className="stage-num">{s.points} pts</span>
                <div className="art">
                  <PlantIcon species={s} stage={6} size={72} />
                </div>
                <h4>{s.name}</h4>
                <p className="seed-care">{careSummary(s)}</p>
                <p>
                  {seasonal && !here
                    ? `${s.blurb} Back in ${PHASE_NAME[s.phase!]}.`
                    : unlocked
                    ? s.blurb
                    : `Unlock for ${s.unlockCost} dewdrops.`}
                </p>
                <p className="seed-care">Matures in {s.maturesDays} days · {PLOT_LABEL[s.needsPlot]}</p>
              </div>
            );
          })}
        </div>

        <VariantCollection />

        <div className="gallery">
          <h3>🌸 Harvest record</h3>
          {completed === null ? (
            <p className="gallery-empty">Leafing through the pages…</p>
          ) : completed.length === 0 ? (
            <p className="gallery-empty">
              Nothing harvested yet — your first full bloom will be pressed into these pages.
            </p>
          ) : (
            <div className="gallery-row">
              {completed.map((c, i) => {
                const sp = SPECIES.find((s) => s.key && completed && c.species_id === SPECIES.indexOf(s) + 1);
                return (
                  <span key={c.id} className="gallery-chip">
                    🌸 {sp?.name ?? `Bloom #${completed.length - i}`} · {c.days_taken} days
                    {c.perfect ? " · perfect ✨" : ""}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

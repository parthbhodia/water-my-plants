"use client";

import { STAGES } from "@/lib/stages";
import type { CompletedLily, GardenState } from "@/lib/types";
import StageArt from "./StageArt";

export default function Journal({
  state,
  completed,
  onClose,
}: {
  state: GardenState;
  completed: CompletedLily[] | null;
  onClose: () => void;
}) {
  const everBloomed = state.completedCount > 0;
  const maxUnlocked = everBloomed ? 6 : state.stage;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="journal" onClick={(e) => e.stopPropagation()}>
        <div className="journal-head">
          <h2>📖 Lily Almanac</h2>
          <button className="btn ghost small" onClick={onClose}>✕ close</button>
        </div>
        <p className="journal-sub">
          Every stage your care has unlocked. Water daily to reveal them all!
        </p>
        <div className="journal-grid">
          {STAGES.map((s, i) => {
            const unlocked = i <= maxUnlocked;
            return (
              <div key={s.name} className={`stage-card ${unlocked ? "" : "locked"}`}>
                <span className="stage-num">Stage {i + 1}</span>
                <div className="art">
                  <StageArt stage={i} size={84} />
                </div>
                <h4>{unlocked ? `${s.emoji} ${s.name}` : "? ? ?"}</h4>
                <p>{unlocked ? s.blurb : "Keep watering to discover this stage…"}</p>
              </div>
            );
          })}
        </div>

        <div className="gallery">
          <h3>🌸 Bloom Gallery</h3>
          {completed === null ? (
            <p className="gallery-empty">Leafing through the pages…</p>
          ) : completed.length === 0 ? (
            <p className="gallery-empty">
              No blooms yet — your first fully-grown lily will be pressed into these pages.
            </p>
          ) : (
            <div className="gallery-row">
              {completed.map((c, i) => (
                <span key={c.id} className="gallery-chip">
                  🌸 Lily #{completed.length - i} · {c.days_taken} days
                  {c.perfect ? " · perfect ✨" : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { STAGES, FINAL_STAGE } from "@/lib/stages";
import type { GardenState } from "@/lib/types";

export default function Hud({
  state,
  muted,
  onJournal,
  onToggleMute,
  onSignOut,
}: {
  state: GardenState;
  muted: boolean;
  onJournal: () => void;
  onToggleMute: () => void;
  onSignOut: () => void;
}) {
  const stage = STAGES[Math.min(state.stage, FINAL_STAGE)];
  return (
    <div className="hud-top">
      <div className="hud-card">
        <div className="hud-day">☀️ Day {state.dayNumber}</div>
        <div className="hud-stage">
          {stage.emoji} {stage.name}
          {state.wilted ? " · 🥀 thirsty!" : ""}
        </div>
        <div className="hud-progress" title={`Stage ${state.stage + 1} of ${STAGES.length}`}>
          {STAGES.map((_, i) => (
            <span
              key={i}
              className={`hud-dot ${i === FINAL_STAGE ? "bloom-dot" : ""} ${i <= state.stage ? "on" : ""}`}
            />
          ))}
        </div>
        {state.streak > 1 && <div className="hud-streak">🔥 {state.streak}-day streak</div>}
      </div>
      <div className="hud-buttons">
        <button className="hud-icon-btn" onClick={onJournal} title="Journal">📖</button>
        <button className="hud-icon-btn" onClick={onToggleMute} title={muted ? "Unmute" : "Mute"}>
          {muted ? "🔇" : "🔊"}
        </button>
        <button className="hud-icon-btn" onClick={onSignOut} title="Sign out">🚪</button>
      </div>
    </div>
  );
}

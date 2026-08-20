"use client";

import type { GardenState } from "@/lib/types";

export default function Hud({
  state,
  muted,
  onJournal,
  onStudio,
  onLeague,
  onToggleMute,
  onSignOut,
}: {
  state: GardenState;
  muted: boolean;
  onJournal: () => void;
  onStudio: () => void;
  onLeague: () => void;
  onToggleMute: () => void;
  onSignOut: () => void;
}) {
  const live = state.plots.filter((p) => p.plant && !p.plant.dead).length;
  const todo = state.plots.filter(
    (p) => p.plant && p.plant.thirsty && !p.plant.isBloomed && !p.plant.dead
  ).length;

  return (
    <div className="hud-top">
      <div className="hud-card">
        <div className="hud-day">🌿 {state.gardenName}</div>
        <div className="hud-stage">
          {state.displayName ?? "Gardener"} · {live}/{state.plotCount} plots growing
        </div>
        <div className="hud-statrow">
          <button className="stat score tappable" onClick={onLeague} title="View your league">
            🏆 {state.gardenScore}
          </button>
          <span className="stat dew" title="Dewdrops">💧 {state.dewdrops}</span>
          {todo > 0 && <span className="stat todo">{todo} need care</span>}
        </div>
      </div>
      <div className="hud-buttons">
        <button className="hud-icon-btn" onClick={onLeague} title="League">🏆</button>
        <button className="hud-icon-btn" onClick={onJournal} title="Almanac">📖</button>
        <button className="hud-icon-btn" onClick={onStudio} title="Profile & gardener">🎨</button>
        <button className="hud-icon-btn" onClick={onToggleMute} title={muted ? "Unmute" : "Mute"}>
          {muted ? "🔇" : "🔊"}
        </button>
        <button className="hud-icon-btn" onClick={onSignOut} title="Sign out">🚪</button>
      </div>
    </div>
  );
}

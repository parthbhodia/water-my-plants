"use client";

import {
  Skull, Leaf, Trophy, Droplets, BookOpen, Palette, CircleHelp, Volume2, VolumeX, LogOut, Music, Music2,
} from "lucide-react";
import type { GardenState } from "@/lib/types";

export default function Hud({
  state,
  muted,
  onJournal,
  onStudio,
  onLeague,
  onHelp,
  onToggleMute,
  onToggleMusic,
  musicOn,
  musicName,
  onSignOut,
  dewPulse,
}: {
  state: GardenState;
  muted: boolean;
  onJournal: () => void;
  onStudio: () => void;
  onLeague: () => void;
  onHelp: () => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  musicOn: boolean;
  musicName: string;
  onSignOut: () => void;
  /** Bumped when a reward lands, so the counter can flash. */
  dewPulse?: number;
}) {
  const live = state.plots.filter((p) => p.plant && !p.plant.dead).length;
  // Each dead plant costs 15 points, which is why the trophy can go negative.
  // A bare "-60" with no stated cause reads as a broken counter.
  const lost = state.plots.filter((p) => p.plant?.dead).length;
  const todo = state.plots.filter(
    (p) => p.plant && p.plant.thirsty && !p.plant.isBloomed && !p.plant.dead
  ).length;

  return (
    <div className="hud-top">
      <div className="hud-card">
        <div className="hud-day"><Leaf size={16} strokeWidth={2.4} aria-hidden /> {state.gardenName}</div>
        <div className="hud-stage">
          {state.displayName ?? "Gardener"} · {live}/{state.plotCount} plots growing
          {lost > 0 && (
            <span className="hud-lost">
              <Skull size={12} strokeWidth={2.6} aria-hidden /> {lost} lost
            </span>
          )}
        </div>
        <div className="hud-statrow">
          <button className="stat score tappable" onClick={onLeague}
            title={lost > 0
              ? `Garden score. ${lost} lost plant${lost === 1 ? "" : "s"} cost you ${lost * 15} points — clear or revive them to stop the drain.`
              : "Garden score — view your league"}>
            <Trophy size={13} strokeWidth={2.6} aria-hidden /> {state.gardenScore}
          </button>
          <span className={`stat dew${dewPulse ? " banked" : ""}`} key={`dew-${dewPulse ?? 0}`} title="Dewdrops"><Droplets size={13} strokeWidth={2.6} aria-hidden /> {state.dewdrops}</span>
          {todo > 0 && <span className="stat todo">{todo} need care</span>}
        </div>
      </div>
      <div className="hud-buttons">
        <button className="hud-icon-btn hud-desk" onClick={onLeague} title="League"><Trophy size={19} strokeWidth={2.2} aria-hidden /></button>
        <button className="hud-icon-btn hud-desk" onClick={onJournal} title="Almanac"><BookOpen size={19} strokeWidth={2.2} aria-hidden /></button>
        <button className="hud-icon-btn hud-desk" onClick={onStudio} title="Profile & gardener"><Palette size={19} strokeWidth={2.2} aria-hidden /></button>
        <button className="hud-icon-btn" onClick={onHelp} title="How to play"><CircleHelp size={19} strokeWidth={2.2} aria-hidden /></button>
        <button
          className="hud-icon-btn"
          onClick={onToggleMusic}
          title={musicOn ? `Playing "${musicName}" — press for the next record` : "Put a record on"}
          style={musicOn ? undefined : { opacity: 0.55 }}
        >
          {musicOn ? <Music size={19} strokeWidth={2.2} aria-hidden /> : <Music2 size={19} strokeWidth={2.2} aria-hidden />}
        </button>
        <button className="hud-icon-btn" onClick={onToggleMute} title={muted ? "Unmute" : "Mute"}>
          {muted ? <VolumeX size={19} strokeWidth={2.2} aria-hidden /> : <Volume2 size={19} strokeWidth={2.2} aria-hidden />}
        </button>
        <button className="hud-icon-btn hud-desk" onClick={onSignOut} title="Sign out"><LogOut size={19} strokeWidth={2.2} aria-hidden /></button>
      </div>
    </div>
  );
}

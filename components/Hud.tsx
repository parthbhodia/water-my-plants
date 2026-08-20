"use client";

import {
  Leaf, Trophy, Droplets, BookOpen, Palette, CircleHelp, Volume2, VolumeX, LogOut, Music, Music2,
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
  onSignOut,
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
  onSignOut: () => void;
}) {
  const live = state.plots.filter((p) => p.plant && !p.plant.dead).length;
  const todo = state.plots.filter(
    (p) => p.plant && p.plant.thirsty && !p.plant.isBloomed && !p.plant.dead
  ).length;

  return (
    <div className="hud-top">
      <div className="hud-card">
        <div className="hud-day"><Leaf size={16} strokeWidth={2.4} aria-hidden /> {state.gardenName}</div>
        <div className="hud-stage">
          {state.displayName ?? "Gardener"} · {live}/{state.plotCount} plots growing
        </div>
        <div className="hud-statrow">
          <button className="stat score tappable" onClick={onLeague} title="View your league">
            <Trophy size={13} strokeWidth={2.6} aria-hidden /> {state.gardenScore}
          </button>
          <span className="stat dew" title="Dewdrops"><Droplets size={13} strokeWidth={2.6} aria-hidden /> {state.dewdrops}</span>
          {todo > 0 && <span className="stat todo">{todo} need care</span>}
        </div>
      </div>
      <div className="hud-buttons">
        <button className="hud-icon-btn" onClick={onLeague} title="League"><Trophy size={19} strokeWidth={2.2} aria-hidden /></button>
        <button className="hud-icon-btn" onClick={onJournal} title="Almanac"><BookOpen size={19} strokeWidth={2.2} aria-hidden /></button>
        <button className="hud-icon-btn" onClick={onStudio} title="Profile & gardener"><Palette size={19} strokeWidth={2.2} aria-hidden /></button>
        <button className="hud-icon-btn" onClick={onHelp} title="How to play"><CircleHelp size={19} strokeWidth={2.2} aria-hidden /></button>
        <button
          className="hud-icon-btn"
          onClick={onToggleMusic}
          title={musicOn ? "Music off" : "Music on"}
          style={musicOn ? undefined : { opacity: 0.55 }}
        >
          {musicOn ? <Music size={19} strokeWidth={2.2} aria-hidden /> : <Music2 size={19} strokeWidth={2.2} aria-hidden />}
        </button>
        <button className="hud-icon-btn" onClick={onToggleMute} title={muted ? "Unmute" : "Mute"}>
          {muted ? <VolumeX size={19} strokeWidth={2.2} aria-hidden /> : <Volume2 size={19} strokeWidth={2.2} aria-hidden />}
        </button>
        <button className="hud-icon-btn" onClick={onSignOut} title="Sign out"><LogOut size={19} strokeWidth={2.2} aria-hidden /></button>
      </div>
    </div>
  );
}

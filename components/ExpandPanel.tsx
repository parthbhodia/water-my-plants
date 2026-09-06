"use client";

import { Sprout, Lock, Droplets, Sun, Cloud, Waves, Check } from "lucide-react";
import type { GardenState } from "@/lib/types";

const KIND_ICON = { sun: Sun, shade: Cloud, water: Waves } as const;
const KIND_WORD = {
  sun: "a sunny bed", shade: "a shaded bed", water: "a corner of the pond",
} as const;

/**
 * Breaking new ground — the only thing in the game that makes the garden
 * itself bigger.
 *
 * Every garden shipped at four plots and nothing could ever raise that,
 * while the scene drew a padlock on the fifth. This is the panel behind that
 * padlock.
 *
 * Two gates, and they are different on purpose. Dewdrops are what you spend;
 * gardener level is what you cannot, because it rises with LIFETIME earnings
 * and is never reduced by spending. So a player who has hoarded can afford
 * the next bed but still has to have shown up for it — the same thesis as
 * the consistency league, applied to the one thing you buy with the garden.
 */
export default function ExpandPanel({
  state,
  busy,
  onBreakGround,
}: {
  state: GardenState;
  busy: boolean;
  onBreakGround: () => void;
}) {
  const next = state.nextPlot;

  // The whole garden is theirs. This is an ending, so it gets to say so.
  if (!next) {
    return (
      <section className="expand-card done">
        <header className="ex-head">
          <span className="ex-icon"><Check size={22} strokeWidth={2.6} aria-hidden /></span>
          <div>
            <b>Every bed is yours</b>
            <span className="ex-sub">All twelve, broken and planted. There is no more ground to take.</span>
          </div>
        </header>
      </section>
    );
  }

  const Kind = KIND_ICON[next.kind];
  const ready = next.levelOk && next.dewOk;
  const toGoLevel = Math.max(0, next.levelAt - (state.lifetimeEarned ?? 0));

  return (
    <section className={`expand-card ${ready ? "ready" : ""}`}>
      <header className="ex-head">
        <span className="ex-icon">
          {ready ? <Sprout size={22} strokeWidth={2.6} aria-hidden />
                 : <Lock size={20} strokeWidth={2.6} aria-hidden />}
        </span>
        <div>
          <b>Break new ground — plot {next.idx + 1}</b>
          <span className="ex-sub">
            <Kind size={13} strokeWidth={2.6} aria-hidden /> {KIND_WORD[next.kind]}, waiting past the fence.
          </span>
        </div>
      </header>

      <div className="ex-gates">
        <div className={`ex-gate ${next.dewOk ? "met" : ""}`}>
          <span className="ex-gate-k"><Droplets size={15} strokeWidth={2.6} aria-hidden /> {next.cost} dewdrops</span>
          <span className="ex-gate-v">
            {next.dewOk ? "saved up" : `${next.dewToGo} more to save`}
          </span>
        </div>
        <div className={`ex-gate ${next.levelOk ? "met" : ""}`}>
          <span className="ex-gate-k"><Sprout size={15} strokeWidth={2.6} aria-hidden /> Gardener level {next.minLevel}</span>
          <span className="ex-gate-v">
            {next.levelOk
              ? `you are level ${state.level}`
              : `about ${toGoLevel} more dewdrops of tending`}
          </span>
        </div>
      </div>

      <button className="btn" disabled={!ready || busy} onClick={onBreakGround}>
        <Sprout size={16} strokeWidth={2.4} aria-hidden />{" "}
        {ready ? `Break ground (${next.cost})` : "Not yet"}
      </button>

      {!next.levelOk && (
        <p className="ex-note">
          Level rises with every dewdrop you have <i>ever</i> earned, and
          spending never takes it back — so keep tending and this opens on its own.
        </p>
      )}
    </section>
  );
}

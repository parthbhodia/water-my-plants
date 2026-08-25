"use client";

import { Droplets, Lock, Sparkles } from "lucide-react";
import type { GardenState } from "@/lib/types";

/**
 * What "gardener level" actually is, said out loud.
 *
 * It rises with *lifetime* dewdrops — every drop you have ever earned by
 * tending, never reduced by spending. So it is a pure record of care given,
 * which is why it can gate the overgrown corners without turning them into
 * something you buy. Before this, the number simply appeared next to your
 * name with no bar, no threshold and no stated purpose.
 */
export default function LevelBar({
  state,
  compact = false,
}: {
  state: GardenState;
  compact?: boolean;
}) {
  const earned = state.lifetimeEarned;
  const floor = state.levelFloor;
  const next = state.nextLevelAt;
  // older sessions may still hold a state document without the bounds
  if (earned === undefined || floor === undefined || next === undefined) return null;

  const span = Math.max(1, next - floor);
  const done = Math.min(span, Math.max(0, earned - floor));
  const pct = Math.round((done / span) * 100);
  const toGo = Math.max(0, next - earned);

  // the nearest corner this level is still holding shut
  const nextZone = (state.zones ?? [])
    .filter((z) => !z.unlocked)
    .sort((a, b) => a.minLevel - b.minLevel)[0];

  return (
    <section className={`level-bar${compact ? " compact" : ""}`} aria-label="Gardener level">
      <div className="lb-top">
        <span className="lb-badge">{state.level}</span>
        <div className="lb-id">
          <b>Level {state.level} gardener</b>
          <span>
            {toGo} more <Droplets size={12} strokeWidth={2.8} aria-hidden /> earned
            to reach level {state.level + 1}
          </span>
        </div>
      </div>

      <div className="lb-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="lb-fill" style={{ width: `${pct}%` }} />
      </div>

      {!compact && (
        <p className="lb-what">
          <Sparkles size={13} strokeWidth={2.5} aria-hidden />
          Your level counts every dewdrop you have <b>ever</b> earned by tending —
          spending never lowers it. It is a record of care, not a balance.
        </p>
      )}

      {nextZone && (
        <p className="lb-next">
          <Lock size={13} strokeWidth={2.6} aria-hidden />
          <span>
            Level {nextZone.minLevel} opens <b>{nextZone.name}</b> — {nextZone.blurb}
          </span>
        </p>
      )}
    </section>
  );
}

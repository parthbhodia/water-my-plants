"use client";

import { Trophy } from "lucide-react";
import CareWeek from "./CareWeek";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { LeagueState } from "@/lib/types";
import AvatarPreview from "./AvatarPreview";

const TIER_COLOR = ["#a97142", "#8d9aa4", "#c9a227", "#2c7d68", "#c9527a"];

/**
 * Always-on standings beside the garden. The weekly league is the competitive
 * pulse, so on a wide screen it should be visible without going looking for it.
 */
export default function LeagueRail({
  refreshKey,
  onOpenFull,
}: {
  refreshKey: number;
  onOpenFull: () => void;
}) {
  const [league, setLeague] = useState<LeagueState | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_league");
    if (error) setFailed(true);
    else setLeague(data as LeagueState);
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);

  if (failed) return null;

  return (
    <aside className="rail" aria-label="League standings">
      <div className="rail-head">
        <span className="rail-title"><Trophy size={15} strokeWidth={2.4} aria-hidden /> League</span>
        {league && (
          <span className="rail-days">
            {league.daysLeft === 0 ? "Final day" : `${league.daysLeft}d left`}
          </span>
        )}
      </div>

      {!league ? (
        <p className="rail-empty">Counting blooms…</p>
      ) : (
        <>
          <div className="rail-sub">
            <span className="tier-badge" style={{ background: TIER_COLOR[league.tier] }}>
              {league.tierName}
            </span>
            <span className="rail-season">Season {league.seasonNumber}</span>
          </div>

          <div className="rail-me">
            <b>#{league.myRank ?? "–"}</b>
            <span>
              of {league.size} · {league.myScore} pts
            </span>
          </div>

          <CareWeek refreshKey={refreshKey} />

          <ol className="board-list rail-list">
            {league.members.slice(0, 10).map((m) => {
              const up = league.promoteN > 0 && m.rank <= league.promoteN;
              const down = league.relegateFrom !== null && m.rank >= league.relegateFrom;
              return (
                <li
                  key={m.rank}
                  className={`board-row compact ${m.isMe ? "me" : ""} ${up ? "up" : down ? "down" : ""}`}
                >
                  <span className="board-rank">{m.rank}</span>
                  <span className="board-av"><AvatarPreview avatar={m.avatar} size={28} /></span>
                  <span className="board-name">{m.name}</span>
                  <span className="board-score">{m.score}</span>
                </li>
              );
            })}
          </ol>

          {league.size === 1 && (
            <p className="rail-empty">
              You&apos;re the only gardener in this league so far. More will join as they
              start playing on your clock.
            </p>
          )}

          <button className="btn ghost small rail-more" onClick={onOpenFull}>
            All time &amp; neighbours →
          </button>
        </>
      )}
    </aside>
  );
}

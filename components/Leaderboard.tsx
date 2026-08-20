"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { LeagueState } from "@/lib/types";
import AvatarPreview from "./AvatarPreview";

const TIER_COLOR = ["#a97142", "#8d9aa4", "#c9a227", "#2c7d68", "#c9527a"];

export default function Leaderboard({ onClose }: { onClose: () => void }) {
  const [league, setLeague] = useState<LeagueState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("get_league").then(({ data, error }) => {
      if (error) setError(error.message);
      else setLeague(data as LeagueState);
    });
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="journal board" onClick={(e) => e.stopPropagation()}>
        <div className="journal-head">
          <h2>🏆 League</h2>
          <button className="btn ghost small" onClick={onClose}>✕ close</button>
        </div>

        {error && <p className="gallery-empty">Couldn&apos;t load the league: {error}</p>}
        {!league && !error && <p className="gallery-empty">Counting everyone&apos;s blooms…</p>}

        {league && (
          <>
            <div className="season-bar">
              <div>
                <span className="tier-badge" style={{ background: TIER_COLOR[league.tier] }}>
                  {league.tierName}
                </span>
                <span className="season-meta">
                  Season {league.seasonNumber} · {league.bandLabel}
                </span>
              </div>
              <div className="season-left">
                {league.daysLeft === 0
                  ? "Final day!"
                  : `${league.daysLeft} day${league.daysLeft === 1 ? "" : "s"} left`}
              </div>
            </div>

            <p className="journal-sub">
              You&apos;re ranked against {league.size} gardener{league.size === 1 ? "" : "s"} on a
              similar clock, so the deadline lands at a similar local hour for everyone.
              {league.promoteN > 0
                ? ` Top ${league.promoteN} promote${league.relegateFrom ? `, bottom ${league.size - league.relegateFrom + 1} relegate` : ""}.`
                : " This league needs more gardeners before anyone can promote."}
            </p>

            {league.lastSeason && (
              <p className="last-season">
                Last season you finished <b>#{league.lastSeason.rank}</b> in{" "}
                {league.lastSeason.tierName}
                {league.lastSeason.movement === 1
                  ? " — promoted! 🎉"
                  : league.lastSeason.movement === -1
                  ? " — relegated."
                  : "."}
              </p>
            )}

            <ol className="board-list">
              {league.members.map((m) => {
                const promoting = league.promoteN > 0 && m.rank <= league.promoteN;
                const relegating =
                  league.relegateFrom !== null && m.rank >= league.relegateFrom;
                return (
                  <li
                    key={m.rank}
                    className={`board-row ${m.isMe ? "me" : ""} ${
                      promoting ? "up" : relegating ? "down" : ""
                    }`}
                  >
                    <span className="board-rank">{m.rank}</span>
                    <span className="board-av">
                      <AvatarPreview avatar={m.avatar} size={40} />
                    </span>
                    <span className="board-name">
                      {m.name}
                      {m.isMe && <em> · you</em>}
                    </span>
                    <span className="board-plants">
                      {m.plants} 🌱
                    </span>
                    <span className="board-score">{m.score}</span>
                  </li>
                );
              })}
            </ol>

            <p className="journal-sub" style={{ marginTop: 14, marginBottom: 0 }}>
              Score rewards <b>consistency</b>: living plants weighted by health, your best
              streak, variety harvested, minus anything you let die. Planting more than you
              can tend loses points.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

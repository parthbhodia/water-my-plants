"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { HallOfFame, HofEntry, LeagueState } from "@/lib/types";
import AvatarPreview from "./AvatarPreview";

const TIER_COLOR = ["#a97142", "#8d9aa4", "#c9a227", "#2c7d68", "#c9527a"];

type Tab = "week" | "alltime";

const BOARDS: Array<{ key: keyof Omit<HallOfFame, "me">; title: string; unit: string; hint: string }> = [
  { key: "blooms", title: "🌸 Lifetime blooms", unit: "", hint: "every plant ever brought to full bloom" },
  { key: "streaks", title: "🔥 Longest streak", unit: "d", hint: "most consecutive days of care" },
  { key: "gardens", title: "🌿 Garden value", unit: "", hint: "what's alive and healthy right now" },
  { key: "levels", title: "⭐ Gardener level", unit: "", hint: "earned from every act of care" },
];

function Row({ e, unit }: { e: HofEntry; unit: string }) {
  return (
    <li className={`board-row compact ${e.isMe ? "me" : ""}`}>
      <span className="board-rank">{e.rank}</span>
      <span className="board-av"><AvatarPreview avatar={e.avatar} size={32} /></span>
      <span className="board-name">{e.name}{e.isMe && <em> · you</em>}</span>
      <span className="board-score">{e.value}{unit}</span>
    </li>
  );
}

export default function Leaderboard() {
  const [tab, setTab] = useState<Tab>("week");
  const [league, setLeague] = useState<LeagueState | null>(null);
  const [hof, setHof] = useState<HallOfFame | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("get_league").then(({ data, error }) => {
      if (error) setError(error.message);
      else setLeague(data as LeagueState);
    });
    supabase.rpc("get_hall_of_fame").then(({ data }) => setHof(data as HallOfFame));
  }, []);

  return (
    <div className="board-panel">
        <div className="tabs">
          <button className={tab === "week" ? "on" : ""} onClick={() => setTab("week")}>
            This week
          </button>
          <button className={tab === "alltime" ? "on" : ""} onClick={() => setTab("alltime")}>
            All time
          </button>
        </div>

        {error && <p className="gallery-empty">Couldn&apos;t load: {error}</p>}

        {tab === "week" && (
          <>
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
                  Ranked against {league.size} gardener{league.size === 1 ? "" : "s"} on a similar
                  clock. Only this ranking resets on Monday — your garden, blooms and streaks are
                  yours forever.
                  {league.promoteN > 0
                    ? ` Top ${league.promoteN} promote${
                        league.relegateFrom ? `, bottom ${league.size - league.relegateFrom + 1} relegate` : ""
                      }.`
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
                    const up = league.promoteN > 0 && m.rank <= league.promoteN;
                    const down = league.relegateFrom !== null && m.rank >= league.relegateFrom;
                    return (
                      <li
                        key={m.rank}
                        className={`board-row ${m.isMe ? "me" : ""} ${up ? "up" : down ? "down" : ""}`}
                      >
                        <span className="board-rank">{m.rank}</span>
                        <span className="board-av"><AvatarPreview avatar={m.avatar} size={40} /></span>
                        <span className="board-name">{m.name}{m.isMe && <em> · you</em>}</span>
                        <span className="board-plants">{m.plants} 🌱</span>
                        <span className="board-score">{m.score}</span>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </>
        )}

        {tab === "alltime" && (
          <>
            {!hof && <p className="gallery-empty">Opening the records…</p>}
            {hof && (
              <>
                <div className="level-card">
                  <div className="level-badge">
                    <span className="lv">{hof.me.level}</span>
                    <span className="lv-label">Level</span>
                  </div>
                  <div className="level-facts">
                    <b>Tending for {hof.me.daysTending} day{hof.me.daysTending === 1 ? "" : "s"}</b>
                    <span>
                      {hof.me.blooms} bloom{hof.me.blooms === 1 ? "" : "s"} ·{" "}
                      {hof.me.bestStreak}-day best streak · garden worth {hof.me.gardenValue}
                    </span>
                    <div className="level-bar">
                      <div
                        style={{
                          width: `${Math.min(100, Math.round((hof.me.lifetimeEarned / Math.max(1, hof.me.nextLevelAt)) * 100))}%`,
                        }}
                      />
                    </div>
                    <span className="lv-next">
                      {hof.me.lifetimeEarned} / {hof.me.nextLevelAt} dew to level {hof.me.level + 1}
                    </span>
                  </div>
                </div>

                <p className="journal-sub">
                  These never reset. However a season goes, everything you have ever grown stays on
                  this page.
                </p>

                <div className="hof-grid">
                  {BOARDS.map((b) => (
                    <div key={b.key} className="hof-board">
                      <h3>{b.title}</h3>
                      <p className="hof-hint">{b.hint}</p>
                      {hof[b.key].length === 0 ? (
                        <p className="gallery-empty">Nobody yet — be the first.</p>
                      ) : (
                        <ol className="board-list">
                          {hof[b.key].map((e) => (
                            <Row key={`${b.key}-${e.rank}`} e={e} unit={b.unit} />
                          ))}
                        </ol>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
    </div>
  );
}
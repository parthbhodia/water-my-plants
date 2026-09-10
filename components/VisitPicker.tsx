"use client";

import { useCallback, useEffect, useState } from "react";
import { DoorOpen, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { VisitTarget } from "@/lib/types";
import AvatarPreview from "./AvatarPreview";

/**
 * Gardens you can walk into today.
 *
 * This exists because the friend-code was the ONLY door, and in the game's
 * whole lifetime it has been opened zero times — `friendships` has no rows.
 * A code you have to obtain out-of-band before anything happens is the same
 * dead end Animal Crossing's Dodo codes are. So the server offers a list:
 * your neighbours, gardens already on the public showcase, the Hall of Fame,
 * and the daily pick — `get_garden_of_the_day()`, which has been sitting in
 * the database, granted and callable, wired to absolutely nothing.
 *
 * The guest list itself is `visitable()` in Postgres and is re-checked by
 * `enter_garden`; this list is only what the server is willing to *suggest*.
 * A row here is never authorisation.
 */

const SOURCE_LABEL: Record<VisitTarget["source"], string> = {
  friend: "Neighbour",
  daily: "Garden of the day",
  hof: "Hall of Fame",
  showcase: "On the showcase",
};

export default function VisitPicker({
  onVisit,
  busy,
}: {
  onVisit: (t: VisitTarget) => void;
  busy: boolean;
}) {
  const [list, setList] = useState<VisitTarget[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await createClient().rpc("get_visitable");
    // The RPC is allowed not to exist yet — the client half of this feature
    // ships ahead of the migration. An empty list is the honest fallback; a
    // thrown error here would take the whole League tab down with it.
    setList(Array.isArray(data) ? (data as VisitTarget[]) : []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="visit-picker">
      <h3 className="vp-head">
        <Sparkles size={15} strokeWidth={2.6} aria-hidden /> Gardens open today
      </h3>

      {!list ? (
        <p className="gallery-empty">Looking down the lane…</p>
      ) : list.length === 0 ? (
        <p className="gallery-empty">
          No gardens are taking visitors yet. Yours will be on this list once it
          has something growing in it.
        </p>
      ) : (
        <ul className="friend-list">
          {list.map((t) => (
            <li key={t.uid} className={`friend-row ${t.needsHelp > 0 ? "needs" : ""}`}>
              <span className="board-av"><AvatarPreview avatar={t.avatar} size={40} /></span>
              <div className="friend-meta">
                <b>{t.name}</b>
                <span>
                  {SOURCE_LABEL[t.source] ?? "A gardener"} · Lv {t.level}
                  {t.needsHelp > 0 ? ` · ${t.needsHelp} needs help` : " · all well"}
                </span>
              </div>
              <button
                className={`btn small ${t.needsHelp > 0 ? "blue" : "ghost"}`}
                disabled={busy}
                onClick={() => onVisit(t)}
              >
                <DoorOpen size={15} strokeWidth={2.6} aria-hidden /> Visit
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

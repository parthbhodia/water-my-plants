"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { sfx } from "@/game/audio";
import type { CareMark, CareWeek as Week } from "@/lib/types";

const EMOJI: Record<CareMark, string> = {
  full: "🟩",
  partial: "🟨",
  rest: "🟦",
  missed: "⬜",
  future: "",
};

const TITLE: Record<CareMark, string> = {
  full: "Every plant that needed you got its water",
  partial: "Some of the due plants were watered",
  rest: "Nothing was due — a rest day",
  missed: "Plants were due and went dry",
  future: "Still to come",
};

/**
 * The week as seven marks. The league ranks on met days, so this is the
 * scoreboard and the thing worth pasting into a group chat.
 */
export default function CareWeek({ refreshKey }: { refreshKey?: number }) {
  const [week, setWeek] = useState<Week | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    createClient().rpc("get_care_week").then(({ data }) => {
      if (data) setWeek(data as Week);
    });
  }, [refreshKey]);

  const share = useCallback(async () => {
    if (!week) return;
    sfx.click();
    const grid = week.marks.map((m) => EMOJI[m.mark]).join("");
    const text =
      `Lily Days · week ${week.seasonNumber}\n${grid}\n` +
      `${week.metDays} day${week.metDays === 1 ? "" : "s"} where every plant got what it needed` +
      ` · ${week.tended} tended\nwaterlilly.app`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch {
      // the share sheet was dismissed — fall through to the clipboard
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2600);
    } catch {
      setCopied(false);
    }
  }, [week]);

  if (!week || week.marks.length === 0) return null;

  return (
    <div className="care-week">
      <div className="cw-head">
        <div className="cw-title">
          <b>Your week</b>
          <span>
            {week.metDays} of {week.marks.filter((m) => m.mark !== "future" && m.mark !== "rest").length}{" "}
            days met · {week.tended} tended
          </span>
        </div>
        <button className="btn ghost small cw-share" onClick={share}>
          {copied
            ? <><Check size={15} strokeWidth={2.8} aria-hidden /> Copied</>
            : <><Share2 size={15} strokeWidth={2.4} aria-hidden /> Share</>}
        </button>
      </div>
      <div className="cw-grid">
        {week.marks.map((m) => (
          <div key={m.day} className={`cw-day m-${m.mark}`} title={`${m.weekday} — ${TITLE[m.mark]}`}>
            <span className="cw-wd">{m.weekday}</span>
            <span className="cw-dot" aria-hidden />
            <span className="sr-only">{TITLE[m.mark]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

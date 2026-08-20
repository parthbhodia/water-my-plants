"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { TodayBrief as Brief } from "@/lib/types";

const ICON: Record<string, string> = {
  dying: "🥀",
  window: "⏳",
  thirsty: "💧",
  harvest: "🌸",
};

/**
 * The same decision the reminder email uses, shown in-app the moment you
 * arrive — so the nudge is useful even for players who never enable email.
 */
export default function TodayBrief({ refreshKey }: { refreshKey: number }) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("get_today_brief");
    if (data) setBrief(data as Brief);
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const save = async (enabled: boolean, hour: number) => {
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase.rpc("set_notification_prefs", {
      p_enabled: enabled,
      p_hour: hour,
    });
    if (data) setBrief(data as Brief);
    setSaving(false);
  };

  if (!brief) return null;

  return (
    <div className="brief">
      <div className={`brief-main ${brief.need ? `k-${brief.need.kind}` : "k-done"}`}>
        <span className="brief-icon">{brief.need ? ICON[brief.need.kind] ?? "🌿" : "✅"}</span>
        <div className="brief-text">
          <b>{brief.need ? brief.need.title : "Everything is tended"}</b>
          <span>
            {brief.need
              ? brief.need.body
              : "Nothing needs you right now. Come back tomorrow and keep the streak going."}
          </span>
        </div>
        <button className="brief-cog" onClick={() => setOpen((o) => !o)} title="Reminder settings">
          🔔
        </button>
      </div>

      {open && (
        <div className="brief-prefs">
          <label>
            <input
              type="checkbox"
              checked={brief.emailEnabled}
              disabled={saving}
              onChange={(e) => save(e.target.checked, brief.nudgeHour)}
            />
            Email me a reminder
          </label>
          <label className="brief-hour">
            at
            <select
              value={brief.nudgeHour}
              disabled={saving || !brief.emailEnabled}
              onChange={(e) => save(brief.emailEnabled, Number(e.target.value))}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
            your time
          </label>
        </div>
      )}
    </div>
  );
}

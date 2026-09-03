"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { TodayBrief as Brief } from "@/lib/types";

// morning, lunch, after work, evening — the hours people actually pick
const QUICK_HOURS = [8, 12, 17, 20];

/**
 * When Granny writes to you, and whether she writes at all.
 *
 * These controls used to live behind a cog on the Today card, which meant
 * they only existed while that card did — and that card now leaves as soon
 * as there is nothing to do. Settings belong with the player, not attached
 * to a transient piece of news.
 */
export default function ReminderSettings() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await createClient().rpc("get_today_brief");
    if (data) setBrief(data as Brief);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async (enabled: boolean, hour: number) => {
    setSaving(true);
    const { data } = await createClient().rpc("set_notification_prefs", {
      p_enabled: enabled,
      p_hour: hour,
    });
    if (data) {
      setBrief(data as Brief);
      setSaved(
        enabled
          ? `Lovely — I'll write to you at ${String(hour).padStart(2, "0")}:00.`
          : "No letters, then — I'll keep everything ready here."
      );
      setTimeout(() => setSaved(null), 3500);
    }
    setSaving(false);
  };

  if (!brief) return null;

  return (
    <section className="reminder-settings" aria-label="Reminder settings">
      <div className="rs-head">
        <span className="rs-title">
          {brief.emailEnabled
            ? <BellRing size={16} strokeWidth={2.4} aria-hidden />
            : <Bell size={16} strokeWidth={2.4} aria-hidden />}
          Reminders
        </span>
        <button
          className={`bp-toggle${brief.emailEnabled ? " on" : ""}`}
          role="switch"
          aria-checked={brief.emailEnabled}
          aria-label="Daily reminder email"
          disabled={saving}
          onClick={() => save(!brief.emailEnabled, brief.nudgeHour)}
        >
          <span className="bp-knob" />
        </button>
      </div>
      <p className="rs-sub">
        A note when something needs you — and only when something does.
      </p>

      {brief.emailEnabled && (
        <div className="bp-row">
          <span className="bp-label">Around</span>
          <div className="bp-hours">
            {QUICK_HOURS.map((h) => (
              <button
                key={h}
                className={`bp-hour${brief.nudgeHour === h ? " sel" : ""}`}
                disabled={saving}
                onClick={() => save(true, h)}
              >
                {String(h).padStart(2, "0")}:00
              </button>
            ))}
            <select
              className="bp-other"
              value={QUICK_HOURS.includes(brief.nudgeHour) ? "" : brief.nudgeHour}
              disabled={saving}
              onChange={(e) => e.target.value !== "" && save(true, Number(e.target.value))}
            >
              <option value="">other…</option>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
              ))}
            </select>
          </div>
        </div>
      )}
      {saved && <div className="bp-saved"><Check size={13} strokeWidth={3} aria-hidden /> {saved}</div>}
    </section>
  );
}

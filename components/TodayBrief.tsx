"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, Check, Droplets, Flower2, Hourglass, Leaf, CircleAlert } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { TodayBrief as Brief } from "@/lib/types";

const ICON: Record<string, typeof Leaf> = {
  dying: CircleAlert,
  window: Hourglass,
  thirsty: Droplets,
  harvest: Flower2,
};

// morning, lunch, after work, evening — the hours people actually pick
const QUICK_HOURS = [8, 12, 17, 20];

/**
 * The same decision the reminder email uses, shown in-app the moment you
 * arrive — so the nudge is useful even for players who never enable email.
 */
export default function TodayBrief({ refreshKey }: { refreshKey: number }) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

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
  const Icon = brief.need ? ICON[brief.need.kind] ?? Leaf : Check;

  return (
    <div className="brief">
      <div className={`brief-main ${brief.need ? `k-${brief.need.kind}` : "k-done"}`}>
        <span className="brief-icon"><Icon size={24} strokeWidth={2.4} aria-hidden /></span>
        <div className="brief-text">
          <b>{brief.need ? brief.need.title : "Everything is tended"}</b>
          <span>
            {brief.need
              ? brief.need.body
              : "Nothing needs you right now. Watch the garden sway, put a record on, or visit a neighbour."}
          </span>
        </div>
        <button
          className={`brief-cog${brief.emailEnabled ? " on" : ""}`}
          onClick={() => setOpen((o) => !o)}
          title="Reminder settings"
        >
          {brief.emailEnabled
            ? <BellRing size={17} strokeWidth={2.3} aria-hidden />
            : <Bell size={17} strokeWidth={2.3} aria-hidden />}
        </button>
      </div>

      {open && (
        <div className="brief-prefs">
          <div className="bp-row">
            <span className="bp-label">Daily reminder email</span>
            <button
              className={`bp-toggle${brief.emailEnabled ? " on" : ""}`}
              role="switch"
              aria-checked={brief.emailEnabled}
              disabled={saving}
              onClick={() => save(!brief.emailEnabled, brief.nudgeHour)}
            >
              <span className="bp-knob" />
            </button>
          </div>
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
        </div>
      )}
    </div>
  );
}

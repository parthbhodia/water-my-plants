"use client";

import { Sprout, Store, UserRound, Trophy } from "lucide-react";

export type PanelTab = "garden" | "shop" | "profile" | "league";

const TABS = [
  { key: "garden", Icon: Sprout, label: "Garden" },
  { key: "shop", Icon: Store, label: "Shop" },
  { key: "profile", Icon: UserRound, label: "Profile" },
  { key: "league", Icon: Trophy, label: "League" },
] as const;

export default function TabBar({
  active,
  onChange,
  badge,
}: {
  active: PanelTab;
  onChange: (t: PanelTab) => void;
  badge?: Partial<Record<PanelTab, number>>;
}) {
  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={active === t.key ? "on" : ""}
          onClick={() => onChange(t.key)}
          aria-current={active === t.key}
        >
          <span className="tb-icon"><t.Icon size={17} strokeWidth={2.4} aria-hidden /></span>
          <span className="tb-label">{t.label}</span>
          {badge?.[t.key] ? <span className="tb-badge">{badge[t.key]}</span> : null}
        </button>
      ))}
    </nav>
  );
}

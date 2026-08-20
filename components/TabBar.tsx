"use client";

export type PanelTab = "garden" | "shop" | "profile" | "league";

const TABS: Array<{ key: PanelTab; icon: string; label: string }> = [
  { key: "garden", icon: "🌿", label: "Garden" },
  { key: "shop", icon: "🛒", label: "Shop" },
  { key: "profile", icon: "👤", label: "Profile" },
  { key: "league", icon: "🏆", label: "League" },
];

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
          <span className="tb-icon">{t.icon}</span>
          <span className="tb-label">{t.label}</span>
          {badge?.[t.key] ? <span className="tb-badge">{badge[t.key]}</span> : null}
        </button>
      ))}
    </nav>
  );
}

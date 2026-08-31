"use client";

import { useCallback, useEffect, useState } from "react";
import { GUIDE_NAME } from "@/game/guide";
import GuidePortrait from "./GuidePortrait";

type Mark = { sel: string; text: string; place: "above" | "below" };

const MARKS: Mark[] = [
  { sel: ".plot-chips", text: "Your plots live here. Tap one to pick it.", place: "below" },
  { sel: ".plot-buttons", text: "And this waters whichever plot you picked.", place: "above" },
  { sel: ".tabbar", text: "Shop, your profile and the league live up here.", place: "below" },
  { sel: ".hud-card", text: "Dewdrops and points — you earn both by showing up.", place: "below" },
];

/**
 * A pointing pass over the real interface, run once right after the
 * tutorial: dim everything, ring the actual element, one line from Granny.
 */
export default function CoachMarks({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const measure = useCallback((idx: number) => {
    const el = document.querySelector(MARKS[idx]?.sel ?? "");
    if (!el) return null;
    el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    return el.getBoundingClientRect();
  }, []);

  useEffect(() => {
    // panel targets may live inside the mobile pull-up sheet — raise it first
    document.querySelector(".panel-wrap")?.classList.add("sheet-open");
    // wait out the sheet transition before measuring
    const t = setTimeout(() => setRect(measure(i)), 380);
    const r = measure(i);
    if (!r) {
      // element missing (e.g. tab hidden) — skip forward
      if (i < MARKS.length - 1) setI(i + 1);
      else onDone();
      return;
    }
    setRect(r);
    const onResize = () => setRect(measure(i));
    window.addEventListener("resize", onResize);
    return () => { clearTimeout(t); window.removeEventListener("resize", onResize); };
  }, [i, measure, onDone]);

  if (!rect) return null;
  const m = MARKS[i];
  const pad = 8;
  // flip whenever the preferred side has no room in the viewport
  const wantBelow = m.place === "below" && rect.bottom + 120 < window.innerHeight;
  const wantAbove = !wantBelow && rect.top > 120;
  const bubbleTop = wantBelow ? rect.bottom + 14 : wantAbove ? undefined : 12;
  const bubbleBottom = wantAbove ? window.innerHeight - rect.top + 14 : undefined;

  return (
    <div className="coach-overlay" onClick={() => (i < MARKS.length - 1 ? setI(i + 1) : onDone())}>
      <div
        className="coach-ring"
        style={{
          left: rect.left - pad,
          top: rect.top - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
        }}
      />
      <div
        className="coach-bubble"
        style={{
          top: bubbleTop,
          bottom: bubbleBottom,
          left: Math.min(Math.max(12, rect.left + rect.width / 2 - 150), window.innerWidth - 312),
        }}
      >
        <GuidePortrait mood="happy" size={42} />
        <div className="coach-text">
          <b>{GUIDE_NAME}</b>
          <p>{m.text}</p>
          <span className="coach-next">
            {i < MARKS.length - 1 ? `Tap to continue · ${i + 1}/${MARKS.length}` : "Tap to start gardening"}
          </span>
        </div>
      </div>
    </div>
  );
}

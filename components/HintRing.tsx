"use client";

import { useEffect, useState } from "react";

/** A pulsing halo pinned to a live element — points without blocking. */
export default function HintRing({ sel }: { sel: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(sel);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const id = setInterval(measure, 400); // buttons move as panels re-render
    window.addEventListener("resize", measure);
    return () => { clearInterval(id); window.removeEventListener("resize", measure); };
  }, [sel]);

  if (!rect) return null;
  return (
    <div
      className="hint-ring"
      style={{ left: rect.left - 7, top: rect.top - 7, width: rect.width + 14, height: rect.height + 14 }}
    />
  );
}

"use client";

import { useEffect, useRef } from "react";
import { seenSection, type Section } from "@/lib/analytics";

/**
 * Fires once when a landing-page section is actually looked at.
 *
 * Once, and only once: an IntersectionObserver left connected re-fires every
 * time somebody scrolls back up, which would make the most-scrolled-past
 * section look like the most popular one. It disconnects on the first hit.
 *
 * The test is "does this section overlap the middle half of the viewport",
 * not a threshold fraction: `#plants` is over 2000px tall and 40% of it never
 * fits on an 844px phone, so a threshold would have made the tallest sections
 * look like the ones nobody reaches.
 */
export default function SectionMark({ section }: { section: Section }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const host = el.parentElement ?? el;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        seenSection(section);
      },
      { threshold: 0, rootMargin: "-25% 0px -25% 0px" }
    );
    io.observe(host);
    return () => io.disconnect();
  }, [section]);

  return <span ref={ref} hidden aria-hidden />;
}

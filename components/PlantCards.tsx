"use client";

import Link from "next/link";
import { SPECIES, type SpeciesDef } from "@/lib/species";
import { PITCH, PITCH_ORDER } from "@/lib/guides";
import { PHASE_NAME } from "@/lib/yearphase";
import PlantIcon from "./PlantIcon";

/**
 * "Which one is mine?" — not "here are the specifications of all twelve".
 *
 * This section used to print a spec sheet: twelve identical cards, each one a
 * small picture over `careSummary()` ("Daily · sunny plot · feed ×3"), a bloom
 * time and a points number. Three things were wrong with that, all of them
 * visible to somebody who has never played:
 *
 * - It sold obligation. Before a visitor has planted anything, the first thing
 *   the page told them about plants was how much work each one would be.
 * - Nothing led. Twelve cards of equal weight in an arbitrary order is a table
 *   with pictures, and it does not answer the only question a newcomer has.
 * - "10 pts" means nothing to somebody who has not seen the league yet, and the
 *   four seasonals rendered an EMPTY difficulty pill, because they have no
 *   long-form guide.
 *
 * So: ordered easiest first, the plant's character on the front (`PITCH`), the
 * schedule demoted to chips where a comparison can still find it, points gone,
 * and the seasonals wearing the season that makes them interesting instead of a
 * blank badge.
 */

/** "Daily" is a rule; "a drink a day" is how a person says it. */
function rhythm(s: SpeciesDef): string {
  if (s.cadenceDays === 1) return "A drink a day";
  return `Every ${s.cadenceDays} days`;
}

/** The extra asks, only when there are any — an empty chip is worse than none. */
function extras(s: SpeciesDef): string | null {
  const bits: string[] = [];
  if (s.windowStart !== null && s.windowEnd !== null) {
    const h = (n: number) => `${String(n).padStart(2, "0")}:00`;
    bits.push(`${h(s.windowStart)}–${h(s.windowEnd)}`);
  }
  if (s.needsPlot === "water") bits.push("in the pond");
  else if (s.needsPlot === "sun") bits.push("full sun");
  else if (s.needsPlot === "shade") bits.push("shade");
  if (s.feedsRequired) bits.push(`feed ×${s.feedsRequired}`);
  if (s.prunesRequired) bits.push(`prune ×${s.prunesRequired}`);
  return bits.length ? bits.join(" · ") : null;
}

export default function PlantCards() {
  const ordered = [...SPECIES].sort((a, b) => {
    const da = PITCH_ORDER.indexOf(PITCH[a.key]?.difficulty ?? "Steady");
    const db = PITCH_ORDER.indexOf(PITCH[b.key]?.difficulty ?? "Steady");
    return da - db || a.maturesDays - b.maturesDays;
  });

  return (
    <div className="plant-cards">
      {ordered.map((s) => {
        const pitch = PITCH[s.key];
        const diff = pitch?.difficulty ?? "Steady";
        const more = extras(s);
        return (
          <Link href={`/plants/${s.key}`} className="plant-card" key={s.key}>
            <span className={`pc-diff d-${diff.toLowerCase()}`}>{diff}</span>

            <span className="pc-art" aria-hidden>
              <PlantIcon species={s.key} stage={6} size={104} />
            </span>

            <b>{s.name}</b>
            {s.phase ? (
              <span className={`pc-season p-${s.phase}`}>{PHASE_NAME[s.phase]} only</span>
            ) : null}

            <span className="pc-line">{pitch?.line}</span>

            <span className="pc-chips">
              <em>{rhythm(s)}</em>
              <em>{s.maturesDays} days</em>
              {more ? <em className="pc-more">{more}</em> : null}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

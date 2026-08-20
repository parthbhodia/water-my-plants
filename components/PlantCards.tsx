"use client";

import Link from "next/link";
import { SPECIES, careSummary } from "@/lib/species";
import { GUIDE_BY_KEY } from "@/lib/guides";
import PlantIcon from "./PlantIcon";

/**
 * The care contract as a wall of little portraits instead of a table:
 * every card is the plant painted by the game itself, one line of care,
 * and a difficulty chip. The full table lives on /plants for reference.
 */
export default function PlantCards() {
  return (
    <div className="plant-cards">
      {SPECIES.map((s) => {
        const diff = GUIDE_BY_KEY[s.key]?.difficulty ?? "";
        return (
          <Link href={`/plants/${s.key}`} className="plant-card" key={s.key}>
            <span className={`pc-diff d-${diff.toLowerCase()}`}>{diff}</span>
            <span className="pc-art" aria-hidden>
              <PlantIcon species={s.key} stage={6} size={72} />
            </span>
            <b>{s.name}</b>
            <span className="pc-care">{careSummary(s)}</span>
            <span className="pc-foot">
              <em>{s.maturesDays} days to bloom</em>
              <em className="pc-pts">{s.points} pts</em>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

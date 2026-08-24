"use client";

import { useState } from "react";
import {
  Droplets, Clock, Sun, Cloud, Waves, Sprout, Leaf, TriangleAlert, Sparkles, ChevronDown,
} from "lucide-react";
import { SPECIES_BY_KEY, windowOpen } from "@/lib/species";
import { PLANT_FACTS } from "@/lib/plantfacts";
import { VARIANT_BY_KEY } from "@/lib/variants";
import type { GardenState, PlantState } from "@/lib/types";
import PlantIcon from "./PlantIcon";

const PLOT_WORD = {
  sun: { icon: Sun, label: "full sun" },
  shade: { icon: Cloud, label: "shade" },
  water: { icon: Waves, label: "in the pond" },
  any: { icon: Leaf, label: "anywhere" },
} as const;

/** Whole days between two ISO dates. */
function daysBetween(a: string, b: string) {
  const ms = Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z");
  return Math.round(ms / 86400000);
}

/**
 * Everything about the plant you just tapped, in Granny's voice: what it is,
 * how far along, what it has actually asked for, and — before you can do any
 * harm — whether watering it right now would hurt it.
 *
 * The warning is the point. A cactus tap must never quietly rot the roots, so
 * the reason arrives *before* the action, not as a toast afterwards.
 */
export default function PlantCard({
  state,
  selected,
}: {
  state: GardenState;
  selected: number;
}) {
  const [openFact, setOpenFact] = useState(false);
  const plot = state.plots[selected];
  const plant: PlantState | null = plot?.plant ?? null;
  if (!plant) return null;
  const sp = SPECIES_BY_KEY[plant.species];
  if (!sp) return null;

  const fact = PLANT_FACTS[plant.species];
  const vdef = plant.variant ? VARIANT_BY_KEY[plant.variant] : undefined;
  const Plot = PLOT_WORD[sp.needsPlot];
  const inWindow = windowOpen(sp, state.hour);

  // days until the next drink is genuinely due
  const since = plant.lastCareOn ? daysBetween(plant.lastCareOn, state.today) : null;
  const dueIn = since === null ? 0 : Math.max(0, sp.cadenceDays - since);

  // the one case where a tap could do damage
  const wouldHarm = sp.overwaterable && !plant.thirsty && !plant.dead && !plant.isBloomed;
  const outOfWindow = plant.thirsty && !inWindow && !plant.dead && !plant.isBloomed;

  return (
    <section className="plant-card-live" aria-label={`${sp.name} details`}>
      <header className="pcl-head">
        <span className="pcl-art" aria-hidden>
          <PlantIcon species={sp.key} stage={plant.stage} size={62} />
        </span>
        <div className="pcl-id">
          <b>
            {sp.name}
            {vdef && <span className="pcl-variant" style={{ background: vdef.tint }}>{vdef.name}</span>}
          </b>
          <span className="pcl-sub">
            Plot {selected + 1} · day {plant.dayNumber} · stage {plant.stage} of 7
          </span>
          <span className="pcl-pips" aria-hidden>
            {Array.from({ length: 7 }, (_, k) => (
              <i key={k} className={k < plant.stage ? "on" : ""} />
            ))}
          </span>
        </div>
      </header>

      {wouldHarm && (
        <p className="pcl-warn" role="status">
          <TriangleAlert size={16} strokeWidth={2.5} aria-hidden />
          <span>
            <b>Not yet — he is still full.</b> {fact?.tooMuch}{" "}
            {dueIn > 0 && `Next drink in ${dueIn} day${dueIn === 1 ? "" : "s"}.`}
          </span>
        </p>
      )}

      {outOfWindow && (
        <p className="pcl-warn soft" role="status">
          <Clock size={16} strokeWidth={2.5} aria-hidden />
          <span>
            <b>Thirsty, but not now.</b> {sp.name} drinks{" "}
            {sp.windowStart !== null && sp.windowEnd !== null
              ? `between ${sp.windowStart}:00 and ${sp.windowEnd}:00`
              : "on its own schedule"}
            . Water outside that runs straight off.
          </span>
        </p>
      )}

      <dl className="pcl-rules">
        <div>
          <dt><Droplets size={14} strokeWidth={2.5} aria-hidden /> Drinks</dt>
          <dd>{sp.cadenceDays === 1 ? "every day" : `every ${sp.cadenceDays} days`}</dd>
        </div>
        <div>
          <dt><Plot.icon size={14} strokeWidth={2.5} aria-hidden /> Wants</dt>
          <dd>{Plot.label}</dd>
        </div>
        <div>
          <dt><Sprout size={14} strokeWidth={2.5} aria-hidden /> Blooms</dt>
          <dd>{Math.max(0, sp.maturesDays - plant.dayNumber)} days to go</dd>
        </div>
        {sp.feedsRequired > 0 && (
          <div>
            <dt><Leaf size={14} strokeWidth={2.5} aria-hidden /> Feeds</dt>
            <dd>{plant.feedsDone} of {sp.feedsRequired} done</dd>
          </div>
        )}
      </dl>

      {fact && (
        <>
          <p className="pcl-why">{fact.why}</p>
          <button
            className="pcl-more"
            onClick={() => setOpenFact((o) => !o)}
            aria-expanded={openFact}
          >
            <Sparkles size={14} strokeWidth={2.5} aria-hidden />
            {openFact ? "That's lovely" : "Tell me something about her"}
            <ChevronDown size={14} strokeWidth={2.6} className={openFact ? "flip" : ""} aria-hidden />
          </button>
          {openFact && <p className="pcl-fact">{fact.didYouKnow}</p>}
        </>
      )}
    </section>
  );
}

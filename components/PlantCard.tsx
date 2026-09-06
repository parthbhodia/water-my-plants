"use client";

import { useState } from "react";
import {
  Droplets, Clock, Sun, Cloud, Waves, Sprout, Leaf, TriangleAlert, Sparkles,
  ChevronDown, Flower2, FlaskConical, Nut, Scissors, ShoppingBasket, BellRing,
} from "lucide-react";
import { SPECIES_BY_KEY, windowOpen, canWaterNow, tendVerb } from "@/lib/species";
import { PLANT_FACTS, deathStory } from "@/lib/plantfacts";
import { VARIANT_BY_KEY } from "@/lib/variants";
import type { GardenState, PlotState, PlantState } from "@/lib/types";
import PlantIcon from "./PlantIcon";

const PLOT_WORD = {
  sun: { icon: Sun, label: "full sun" },
  shade: { icon: Cloud, label: "shade" },
  water: { icon: Waves, label: "in the pond" },
  any: { icon: Leaf, label: "anywhere" },
} as const;

const PLOT_LABEL = {
  sun: "A sunny plot", shade: "A shaded plot", water: "The pond",
} as const;

const DAY_WORDS = [
  "No days", "One day", "Two days", "Three days", "Four days", "Five days",
  "Six days", "Seven days", "Eight days", "Nine days", "Ten days",
  "Eleven days", "Twelve days", "Thirteen days", "Fourteen days",
];

/** "Ten days" lands heavier than "10d" when it is the whole sentence. */
function spellDays(n: number) {
  return DAY_WORDS[n] ?? `${n} days`;
}

function daysBetween(a: string, b: string) {
  return Math.round(
    (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000
  );
}

/**
 * The one card about the plot you have selected — identity, its state right
 * now, and the actions available on it.
 *
 * It shows what is TRUE of the plant today, not everything known about it.
 * It used to render the full care contract plus a botany essay regardless of
 * state, so a dead fern was handed "Drinks every 2 days · Blooms 0 days to
 * go" and a lesson on keeping ferns alive — advice for a plant that had
 * already died, filling the screen above the two buttons that actually
 * mattered. Reference material now lives behind a disclosure.
 */
export default function PlantCard({
  state,
  selected,
  busy,
  onTend,
  onPlant,
  onClear,
  onRevive,
  onShop,
  onReminders,
}: {
  state: GardenState;
  selected: number;
  busy: boolean;
  onTend: (i: number, action: "water" | "feed" | "prune") => void;
  onPlant: (p: PlotState) => void;
  onClear: (i: number) => void;
  onRevive: (i: number) => void;
  /** Route to the Shop with the tonic highlighted — never make them hunt. */
  onShop: () => void;
  onReminders: () => void;
}) {
  const [openDetail, setOpenDetail] = useState(false);
  const plot = state.plots[selected];
  if (!plot || !plot.unlocked) return null;

  const plant: PlantState | null = plot.plant ?? null;

  // ---- an empty bed: one line, one button ----
  if (!plant) {
    return (
      <section className="plant-card-live empty" aria-label="Empty plot">
        <header className="pcl-head">
          <span className="pcl-art dim" aria-hidden>
            <Sprout size={30} strokeWidth={2} />
          </span>
          <div className="pcl-id">
            <b>{PLOT_LABEL[plot.kind]}</b>
            <span className="pcl-sub">Plot {selected + 1} — empty and ready for a seed.</span>
          </div>
        </header>
        <div className="plot-buttons">
          <button className="btn small" disabled={busy} onClick={() => onPlant(plot)}>
            <Sprout size={15} strokeWidth={2.4} aria-hidden /> Plant here
          </button>
        </div>
      </section>
    );
  }

  const sp = SPECIES_BY_KEY[plant.species];
  if (!sp) return null;

  const fact = PLANT_FACTS[plant.species];
  const vdef = plant.variant ? VARIANT_BY_KEY[plant.variant] : undefined;
  const Plot = PLOT_WORD[sp.needsPlot];
  const inWindow = windowOpen(sp, state.hour);
  const canWater = canWaterNow(plant, state.hour);
  const tonics = state.inventory?.tonic ?? 0;

  const since = plant.lastCareOn ? daysBetween(plant.lastCareOn, state.today) : null;
  const dueIn = since === null ? 0 : Math.max(0, sp.cadenceDays - since);

  const wouldHarm = sp.overwaterable && !plant.thirsty && !plant.dead && !plant.isBloomed;
  const outOfWindow = plant.thirsty && !inWindow && !plant.dead && !plant.isBloomed;

  // ---- dead: nothing about care is true any more ----
  if (plant.dead) {
    const goneFor = plant.lastCareOn ? daysBetween(plant.lastCareOn, state.today) : null;
    const story = deathStory(sp, goneFor);
    return (
      <section className="plant-card-live gone" aria-label={`${sp.name} died`}>
        {/*
          A small skull chip beside the word "Gone" was two harsh marks doing
          one job, and still read as casual — the loss was announced in 12px
          while the plant sat greyed out at thumbnail size. Weight comes from
          scale and stillness, not from a scarier icon. So: a full-width
          muted band, the plant large and fallen inside it, the name at
          display size, and the span of neglect spelled out in words because
          "Ten days" lands heavier than "10d".
        */}
        <div className="pcl-mourn-band" aria-hidden>
          <span className="pcl-fallen">
            <PlantIcon species={sp.key} stage={plant.stage} size={92} dead />
          </span>
        </div>

        <div className="pcl-mourn-text">
          <b>{sp.name}</b>
          <span className="pcl-gone-line">
            {goneFor !== null
              ? `${spellDays(goneFor)} without water.`
              : "She did not make it."}
          </span>
          <span className="pcl-sub">Plot {selected + 1}</span>
        </div>

        {/*
          The number on its own meant nothing — thirteen days is a shrug to a
          cactus and fatal to a fern. This says what she asked for, how many
          drinks were actually missed, and the one change that prevents the
          next one. It is the only place in the game that does not soften.
        */}
        <div className={`pcl-post-mortem sev-${story.severity}`}>
          <p className="pcl-why">{story.why}</p>
          <p className="pcl-lesson">{story.lesson}</p>
        </div>

        <div className="plot-buttons">
          {tonics > 0 ? (
            <button className="btn small" disabled={busy} onClick={() => onRevive(selected)}>
              <FlaskConical size={15} strokeWidth={2.4} aria-hidden /> Revive her ({tonics})
            </button>
          ) : (
            <button className="btn small" disabled={busy} onClick={onShop}>
              <ShoppingBasket size={15} strokeWidth={2.4} aria-hidden /> Get a revival tonic
            </button>
          )}
          <button className="btn pink small" disabled={busy} onClick={() => onClear(selected)}>
            <Flower2 size={15} strokeWidth={2.4} aria-hidden /> Clear the plot
          </button>
          <button className="btn ghost small" onClick={onReminders}>
            <BellRing size={15} strokeWidth={2.4} aria-hidden /> Turn on reminders
          </button>
        </div>
      </section>
    );
  }

  // ---- alive: one status line, the actions, details on request ----
  // A plant floating in a pond is not thirsty and never will be, so it gets
  // the honest verb: what is running low there is the pond.
  const verb = tendVerb(sp);
  const pond = sp.needsPlot === "water";
  const statusLine = plant.isBloomed
    ? "In full bloom — harvest to free the plot."
    : plant.overdueDays >= 3
    ? "Last chance — she dies tonight."
    : plant.wilted
    ? pond
      ? `The level has dropped, ${plant.overdueDays} day${plant.overdueDays === 1 ? "" : "s"} now.`
      : `Wilting, ${plant.overdueDays} day${plant.overdueDays === 1 ? "" : "s"} late.`
    : plant.thirsty
    ? inWindow ? verb.due : "Thirsty, but not during these hours."
    : dueIn > 0
    ? pond
      ? `Topped up. The pond will want you again in ${dueIn} day${dueIn === 1 ? "" : "s"}.`
      : `Watered. Next drink in ${dueIn} day${dueIn === 1 ? "" : "s"}.`
    : pond ? "Topped up for today." : "Watered for today.";

  const tone = plant.isBloomed ? "bloom"
    : plant.overdueDays >= 3 ? "urgent"
    : plant.thirsty ? "thirsty" : "calm";

  return (
    <section className={`plant-card-live t-${tone}`} aria-label={`${sp.name} details`}>
      <header className="pcl-head">
        <span className="pcl-art" aria-hidden>
          <PlantIcon species={sp.key} stage={plant.stage} size={72} wilted={plant.wilted} />
        </span>
        <div className="pcl-id">
          <b>
            {sp.name}
            {vdef && <span className="pcl-tag" style={{ background: vdef.tint }}>{vdef.name}</span>}
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

      <p className={`pcl-status s-${tone}`}>{statusLine}</p>

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
            <b>Not during these hours.</b>{" "}
            {sp.windowStart !== null && sp.windowEnd !== null
              ? `She drinks between ${sp.windowStart}:00 and ${sp.windowEnd}:00.`
              : "She keeps her own schedule."}
          </span>
        </p>
      )}

      <div className="plot-buttons">
        {!plant.isBloomed && (
          <button
            className={`btn blue small ${canWater ? "" : "dim"}`}
            disabled={busy}
            onClick={() => onTend(selected, "water")}
          >
            <Droplets size={15} strokeWidth={2.4} aria-hidden /> {verb.button}
          </button>
        )}
        {!plant.isBloomed && sp.feedsRequired > plant.feedsDone && (
          <button className="btn small" disabled={busy} onClick={() => onTend(selected, "feed")}>
            <Nut size={15} strokeWidth={2.4} aria-hidden /> Feed ({plant.feedsDone}/{sp.feedsRequired})
          </button>
        )}
        {!plant.isBloomed && sp.prunesRequired > plant.prunesDone && (
          <button className="btn small" disabled={busy} onClick={() => onTend(selected, "prune")}>
            <Scissors size={15} strokeWidth={2.4} aria-hidden /> Prune
          </button>
        )}
        {plant.isBloomed && (
          <button className="btn pink small" disabled={busy} onClick={() => onClear(selected)}>
            <Flower2 size={15} strokeWidth={2.4} aria-hidden /> Harvest
          </button>
        )}
      </div>

      <button
        className="pcl-more"
        onClick={() => setOpenDetail((o) => !o)}
        aria-expanded={openDetail}
      >
        <Sparkles size={14} strokeWidth={2.5} aria-hidden />
        About the {sp.name}
        <ChevronDown size={14} strokeWidth={2.6} className={openDetail ? "flip" : ""} aria-hidden />
      </button>

      {openDetail && (
        <div className="pcl-detail">
          <dl className="pcl-rules">
            <div>
              <dt><Droplets size={14} strokeWidth={2.5} aria-hidden /> {pond ? "Topped up" : "Drinks"}</dt>
              <dd>{sp.cadenceDays === 1 ? "every day" : `every ${sp.cadenceDays} days`}</dd>
            </div>
            <div>
              <dt><Plot.icon size={14} strokeWidth={2.5} aria-hidden /> Wants</dt>
              <dd>{Plot.label}</dd>
            </div>
            <div>
              <dt><Sprout size={14} strokeWidth={2.5} aria-hidden /> Blooms</dt>
              <dd>
                {Math.max(0, sp.maturesDays - plant.dayNumber) || "any day now"}
                {sp.maturesDays - plant.dayNumber > 0 ? " days to go" : ""}
              </dd>
            </div>
          </dl>
          {fact && (
            <>
              <p className="pcl-why">{fact.why}</p>
              <p className="pcl-fact">{fact.didYouKnow}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

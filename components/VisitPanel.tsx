"use client";

import {
  Sun, CloudSun, Waves, Droplets, Flower2, Skull, Clock, CircleAlert, HandHeart, Sprout,
} from "lucide-react";
import type { GardenView } from "@/lib/types";
import { SPECIES_BY_KEY, PLOT_LABEL, needsRescue } from "@/lib/species";
import PlantIcon from "./PlantIcon";

const KIND_ICON = { sun: Sun, shade: CloudSun, water: Waves } as const;

/**
 * The pull-up sheet, while you are a guest.
 *
 * It replaces the tab bar entirely rather than adding a fifth tab. The four
 * tabs are all things you do to YOUR garden — plant, spend, dress up, compete
 * — and none of them mean anything from inside somebody else's. Leaving them
 * on screen greyed out would just be four dead controls.
 *
 * Their plots read exactly like your own chips, deliberately: a garden is a
 * garden. What is missing is every verb but one.
 */
export default function VisitPanel({
  view,
  selected,
  busy,
  onSelect,
  onRescue,
}: {
  view: GardenView;
  selected: number;
  busy: boolean;
  onSelect: (i: number) => void;
  onRescue: (plotIdx: number) => void;
}) {
  const plots = view.plots.filter((p) => p.unlocked);
  const struggling = plots.filter((p) => needsRescue(p.plant));
  const host = view.displayName ?? "This gardener";
  const first = host.split(" ")[0];

  return (
    <div className="visit-panel">
      <p className="journal-sub">
        {view.viewer.rescuedToday ? (
          <>You have already lent {first} a hand today. Come back tomorrow.</>
        ) : struggling.length > 0 ? (
          <>
            Rescuing a plant <b>stops the rot</b> and buys {first} time — it never
            grows anything, because only {first} can do that. One plant a day, and
            you both earn dewdrops.
          </>
        ) : (
          <>Nothing here needs saving. {first} has been keeping up.</>
        )}
      </p>

      <div className="plotbar">
        <div className="plot-chips">
          {plots.map((p) => {
            const pl = p.plant;
            const psp = pl ? SPECIES_BY_KEY[pl.species] : null;
            const lastDay = !!pl && !pl.dead && !pl.isBloomed && pl.overdueDays >= 3;
            const chipState = !pl
              ? "empty"
              : pl.dead ? "dead"
              : pl.isBloomed ? "bloom"
              : lastDay ? "dying"
              : pl.thirsty ? "thirsty"
              : "ok";
            const Kind = KIND_ICON[p.kind];
            return (
              <button
                key={p.idx}
                className={`plot-chip s-${chipState} ${p.idx === selected ? "sel" : ""}`}
                onClick={() => onSelect(p.idx)}
                title={`Plot ${p.idx + 1} — ${PLOT_LABEL[p.kind]}`}
              >
                <span className="chip-kind"><Kind size={12} strokeWidth={2.4} aria-hidden /></span>
                {pl && (
                  <span className="chip-badge" aria-hidden>
                    {pl.dead ? <Skull size={12} /> :
                     pl.isBloomed ? <Flower2 size={12} /> :
                     lastDay ? <CircleAlert size={12} /> :
                     pl.thirsty ? <Droplets size={12} /> : <Clock size={12} />}
                  </span>
                )}
                <span className="chip-art">
                  {pl ? (
                    <PlantIcon species={pl.species} stage={pl.stage} size={66} wilted={pl.wilted} dead={pl.dead} />
                  ) : (
                    <Sprout size={22} strokeWidth={2.4} className="chip-empty" aria-hidden />
                  )}
                </span>
                <span className="chip-name">{pl ? psp?.name.split(" ").pop() : "Bare"}</span>
              </button>
            );
          })}
        </div>
      </div>

      {struggling.length > 0 && !view.viewer.rescuedToday && (
        <ul className="visit-needs">
          {struggling.map((p) => {
            const sp = p.plant ? SPECIES_BY_KEY[p.plant.species] : null;
            const over = p.plant?.overdueDays ?? 0;
            return (
              <li key={p.idx} className="visit-need">
                <span className="visit-need-art">
                  <PlantIcon
                    species={p.plant!.species}
                    stage={p.plant!.stage}
                    size={40}
                    wilted={p.plant!.wilted}
                    dead={false}
                  />
                </span>
                <span className="friend-meta">
                  <b>{sp?.name ?? "A plant"} · plot {p.idx + 1}</b>
                  {/* The number, not an adjective. "Struggling" teaches
                      nothing; "four days past due" is checkable. */}
                  <span>{over} day{over === 1 ? "" : "s"} past its drink</span>
                </span>
                <button
                  className="btn small blue"
                  disabled={busy || !view.viewer.canRescue}
                  onClick={() => onRescue(p.idx)}
                >
                  <HandHeart size={15} strokeWidth={2.6} aria-hidden /> Rescue
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

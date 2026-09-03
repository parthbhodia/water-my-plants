"use client";

import { Flower2, FlaskConical, X, ShoppingBasket } from "lucide-react";
import { SPECIES_BY_KEY } from "@/lib/species";
import type { GardenState } from "@/lib/types";
import PlantIcon from "./PlantIcon";
import GuidePortrait from "./GuidePortrait";

const DAY_WORDS = [
  "No days", "One day", "Two days", "Three days", "Four days", "Five days",
  "Six days", "Seven days", "Eight days", "Nine days", "Ten days",
  "Eleven days", "Twelve days", "Thirteen days", "Fourteen days",
];
const spellDays = (n: number) => DAY_WORDS[n] ?? `${n} days`;

function daysBetween(a: string, b: string) {
  return Math.round(
    (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000
  );
}

/**
 * Tapping a dead plant used to do nothing you could see. onPlotTapped called
 * setSelected and stopped — and on a wide screen the card explaining it sits
 * below the fold, so the game's most confusing moment answered a tap with
 * silence.
 *
 * It now stops the world and says what happened, in Granny's voice, with both
 * ways forward as real buttons. Leaving is always available and never framed
 * as failure: "Leave her for now" is a legitimate choice, and the plot keeps
 * asking quietly in the scene.
 */
export default function GonePlantModal({
  state,
  plotIdx,
  busy,
  onRevive,
  onClear,
  onShop,
  onClose,
}: {
  state: GardenState;
  plotIdx: number | null;
  busy: boolean;
  onRevive: (i: number) => void;
  onClear: (i: number) => void;
  onShop: () => void;
  onClose: () => void;
}) {
  if (plotIdx === null) return null;
  const plant = state.plots[plotIdx]?.plant;
  if (!plant?.dead) return null;
  const sp = SPECIES_BY_KEY[plant.species];
  if (!sp) return null;

  const goneFor = plant.lastCareOn ? daysBetween(plant.lastCareOn, state.today) : null;
  const tonics = state.inventory?.tonic ?? 0;
  const first = (state.displayName ?? "").trim().split(/\s+/)[0] ?? "";
  const dear = first.length > 1 && first.length <= 16 ? first : "love";

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true"
         aria-label={`${sp.name} did not make it`}>
      <div className="gone-modal" onClick={(e) => e.stopPropagation()}>
        <button className="gm-close" onClick={onClose} aria-label="Close">
          <X size={20} strokeWidth={2.6} aria-hidden />
        </button>

        <div className="gm-band" aria-hidden>
          <span className="gm-fallen">
            <PlantIcon species={sp.key} stage={plant.stage} size={120} dead />
          </span>
        </div>

        <div className="gm-body">
          <h2>{sp.name}</h2>
          <p className="gm-gone">
            {goneFor !== null ? `${spellDays(goneFor)} without water.` : "She did not make it."}
          </p>

          <div className="gm-granny">
            <GuidePortrait mood="mourn" size={46} />
            <p>
              {tonics > 0
                ? `We can still bring her back, ${dear} — you've a tonic in the shed. Or clear the bed and let something new have the light.`
                : `It happens to every gardener, ${dear}. A revival tonic would bring her back, or we clear the bed and plant again. No wrong answer.`}
            </p>
          </div>

          <div className="gm-actions">
            {tonics > 0 ? (
              <button className="btn" disabled={busy}
                      onClick={() => { onRevive(plotIdx); onClose(); }}>
                <FlaskConical size={16} strokeWidth={2.4} aria-hidden /> Revive her ({tonics})
              </button>
            ) : (
              <button className="btn ghost" disabled={busy}
                      onClick={() => { onShop(); onClose(); }}>
                <ShoppingBasket size={16} strokeWidth={2.4} aria-hidden /> Find a tonic
              </button>
            )}
            <button className="btn pink" disabled={busy}
                    onClick={() => { onClear(plotIdx); onClose(); }}>
              <Flower2 size={16} strokeWidth={2.4} aria-hidden /> Clear the plot
            </button>
          </div>

          <button className="gm-later" onClick={onClose}>Leave her for now</button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { DoorOpen, HandHeart, Eye } from "lucide-react";
import type { GardenView } from "@/lib/types";
import { SPECIES_BY_KEY, needsRescue } from "@/lib/species";
import AvatarPreview from "./AvatarPreview";

/**
 * The chrome you wear while standing in somebody else's garden.
 *
 * Two pieces, and the split is the mobile rule, not a whim: the *identity*
 * goes at the top where the HUD lives, and the *action* goes bottom-right on
 * the stage where a thumb already is — the same place `WaterFab` sits, for
 * the same reason.
 *
 * It is chrome, not a modal. Nothing here calls `bridge.setFrozen`: freezing
 * would stop the gardener walking, and walking around their garden is the
 * entire reason anyone came. A visit that pinned you to one spot would be a
 * screenshot with extra steps.
 */
export default function VisitOverlay({
  view,
  selected,
  busy,
  onLeave,
  onRescue,
}: {
  view: GardenView;
  selected: number;
  busy: boolean;
  onLeave: () => void;
  onRescue: (plotIdx: number) => void;
}) {
  const host = view.displayName ?? "This gardener";
  const struggling = view.plots.filter((p) => p.unlocked && needsRescue(p.plant));

  // The button names the plant it will actually act on, which is not the
  // selected one when the selection is perfectly healthy. Same rule as
  // WaterFab: a button that silently retargets is a button that lies.
  const cur = view.plots[selected];
  const curNeeds = needsRescue(cur?.plant);
  const target = curNeeds ? cur : struggling[0];
  const targetSp = target?.plant ? SPECIES_BY_KEY[target.plant.species] : null;
  const shortName = targetSp?.name.split(" ").pop() ?? "it";

  return (
    <>
      <div className="visit-bar">
        <span className="visit-av">
          <AvatarPreview avatar={view.avatar} size={38} />
        </span>
        <span className="visit-who">
          <b>{host}&apos;s garden</b>
          <span>
            <Eye size={12} strokeWidth={2.8} aria-hidden />{" "}
            {struggling.length > 0
              ? `${struggling.length} plant${struggling.length === 1 ? "" : "s"} in trouble`
              : "Everything here is doing well"}
          </span>
        </span>
        <button className="btn small ghost visit-leave" onClick={onLeave}>
          <DoorOpen size={15} strokeWidth={2.6} aria-hidden /> Leave
        </button>
      </div>

      {/* Nothing to offer is said plainly rather than by showing a dead
          button: already helped today, or nothing here needs it. */}
      {view.viewer.rescuedToday ? (
        <div className="water-fab-wrap">
          <div className="water-fab round visit-done">
            <HandHeart size={20} strokeWidth={2.6} aria-hidden />
            <span className="wf-label">You have helped here today</span>
          </div>
        </div>
      ) : target && view.viewer.canRescue ? (
        <div className="water-fab-wrap">
          <button
            className="water-fab visit-rescue"
            disabled={busy}
            onClick={() => onRescue(target.idx)}
            aria-label={`Rescue the ${targetSp?.name ?? "plant"} in plot ${target.idx + 1}`}
          >
            <HandHeart size={24} strokeWidth={2.6} aria-hidden />
            <span className="wf-label">
              {curNeeds ? `Rescue ${shortName}` : `Rescue plot ${target.idx + 1}`}
            </span>
          </button>
        </div>
      ) : null}
    </>
  );
}

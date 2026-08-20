"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { sfx } from "@/game/audio";
import { SPECIES_BY_KEY, careSummary } from "@/lib/species";
import PlantIcon from "./PlantIcon";
import AvatarPreview from "./AvatarPreview";
import GuidePortrait from "./GuidePortrait";
import { GUIDE_NAME } from "@/game/guide";
import type { Avatar } from "@/game/avatar";

type Step = {
  key: string;
  title: string;
  body: string;
  art: "gardener" | "keys" | "species" | "calendar" | "timing" | "trophy";
  cta?: string;
};

const STEPS: Step[] = [
  {
    key: "welcome",
    title: "This patch of grass is yours",
    body:
      "Lily Days is a garden you tend a little every day. Nothing grows while you are away — it grows because you came back.",
    art: "gardener",
  },
  {
    key: "walk",
    title: "Walk over and get to work",
    body:
      "Steer your gardener with W A S D or the arrow keys — any direction, all around the yard. Click a plot (or tap its chip below the garden) to walk there, then press E or the Water button.",
    art: "keys",
  },
  {
    key: "seeds",
    title: "Every seed wants something different",
    body:
      "A lily only wants you to show up. A sunflower drinks in daylight. A cactus rots if you water it early. Read the card before you plant — the care line is the whole game.",
    art: "species",
  },
  {
    key: "daily",
    title: "One turn per plant, per day",
    body:
      "Water a plant and it grows a stage. Water it twice in a day and nothing happens — come back tomorrow. Miss its day and it wilts; miss too many and you lose it. Days follow your own clock, wherever you live.",
    art: "calendar",
  },
  {
    key: "timing",
    title: "Timing earns the rare ones",
    body:
      "Moonflowers only drink after dusk. Ferns scorch in the sun. Tomatoes want feeding, bonsai want pruning. Dewdrops from every good day buy seeds, fertiliser and decor in the Shop.",
    art: "timing",
  },
  {
    key: "compete",
    title: "You are already in a season",
    body:
      "Your garden scores points for every plant you keep alive and bloom. You are ranked against gardeners on roughly your own clock, and the board resets weekly — your garden never does.",
    art: "trophy",
    cta: "Plant my first seed",
  },
];

function Art({ kind, avatar }: { kind: Step["art"]; avatar: Avatar }) {
  if (kind === "gardener") {
    return (
      <div className="tut-art tut-art-gardener">
        <AvatarPreview avatar={avatar} size={132} />
      </div>
    );
  }
  if (kind === "keys") {
    return (
      <div className="tut-art">
        <div className="tut-keys">
          <span className="tut-key">W</span>
          <div className="tut-keyrow">
            <span className="tut-key">A</span>
            <span className="tut-key">S</span>
            <span className="tut-key">D</span>
          </div>
          <span className="tut-keynote">or ← ↑ ↓ →  ·  E to water</span>
        </div>
      </div>
    );
  }
  if (kind === "species") {
    return (
      <div className="tut-art tut-species">
        {["lily", "sunflower", "cactus"].map((k) => {
          const sp = SPECIES_BY_KEY[k];
          return (
            <div className="tut-sp" key={k}>
              <PlantIcon species={k} stage={5} size={66} />
              <b>{sp.name}</b>
              <span>{careSummary(sp)}</span>
            </div>
          );
        })}
      </div>
    );
  }
  if (kind === "calendar") {
    return (
      <div className="tut-art tut-days">
        {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d, i) => (
          <div className={`tut-day${i < 3 ? " on" : ""}`} key={d}>
            <span>{d}</span>
            <b>{i < 3 ? "💧" : "·"}</b>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "timing") {
    return (
      <div className="tut-art tut-species">
        {["moonflower", "tomato", "bonsai"].map((k) => {
          const sp = SPECIES_BY_KEY[k];
          return (
            <div className="tut-sp" key={k}>
              <PlantIcon species={k} stage={5} size={66} />
              <b>{sp.name}</b>
              <span>{careSummary(sp)}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="tut-art tut-trophy">
      <div className="tut-podium">
        <span className="tut-medal">🥈</span>
        <span className="tut-medal big">🏆</span>
        <span className="tut-medal">🥉</span>
      </div>
      <span className="tut-keynote">Weekly season · your garden keeps growing</span>
    </div>
  );
}

export default function Tutorial({
  avatar,
  onDone,
}: {
  avatar: Avatar;
  /** `plant` is true when the player finished on the final call to action. */
  onDone: (plant: boolean) => void;
}) {
  const [i, setI] = useState(0);
  const [closing, setClosing] = useState(false);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const finish = useCallback(
    (plant: boolean) => {
      if (closing) return;
      setClosing(true);
      sfx.click();
      // Fire and forget: the flag is a convenience, not something worth
      // blocking the player on if the network hiccups.
      void createClient().rpc("finish_tutorial");
      onDone(plant);
    },
    [closing, onDone]
  );

  const next = useCallback(() => {
    if (last) {
      finish(true);
      return;
    }
    sfx.click();
    setI((n) => n + 1);
  }, [last, finish]);

  const back = useCallback(() => {
    sfx.click();
    setI((n) => Math.max(0, n - 1));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") back();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [finish, next, back]);

  return (
    <div className="modal-overlay tut-overlay" role="dialog" aria-modal="true" aria-label="How to play">
      <div className="tut-card">
        <div className="tut-head">
          <div className="tut-guide">
            <GuidePortrait mood={i === STEPS.length - 1 ? "cheer" : "happy"} size={46} />
            <div className="tut-guide-id">
              <b>{GUIDE_NAME}</b>
              <span>How to play · {i + 1}/{STEPS.length}</span>
            </div>
          </div>
          <button className="tut-skip" onClick={() => finish(false)}>Skip</button>
        </div>

        <Art kind={step.art} avatar={avatar} />

        <h2 className="tut-title">{step.title}</h2>
        <p className="tut-body">{step.body}</p>

        <div className="tut-dots">
          {STEPS.map((s, n) => (
            <button
              key={s.key}
              className={`tut-dot${n === i ? " on" : ""}${n < i ? " past" : ""}`}
              aria-label={`Step ${n + 1}`}
              onClick={() => { sfx.click(); setI(n); }}
            />
          ))}
        </div>

        <div className="tut-actions">
          <button className="btn ghost small" onClick={back} disabled={i === 0}>Back</button>
          <button className="btn" onClick={next}>{step.cta ?? "Next"}</button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { paintGardenCard, type CardPlant } from "@/game/scenecard";

/**
 * "Day one, and day ninety" — the aspiration section on the landing page.
 *
 * The empty panel is what gives the full one meaning: a picture of a
 * finished garden on its own is just a nice drawing, and says nothing about
 * where it came from or that it is yours to earn. Side by side, the contrast
 * IS the message, and it stays honest — the ninety days are named, not
 * hidden, so nobody arrives expecting the garden to show up fully grown.
 *
 * They stay side by side at every width, shrinking together rather than
 * stacking. Stacked, you scroll from one to the other and compare from
 * memory, which is the one thing this section exists to avoid.
 *
 * Painted with the game's own painter, so it cannot drift from what the
 * game actually looks like. It is an illustration of a possible garden —
 * the Showcase directly below is where REAL players' gardens live, and the
 * two must not be confused for one another.
 */

const DAY1: CardPlant[] = [{ species: "sunflower", stage: 1 }];

const DAY90: CardPlant[] = [
  { species: "lily", stage: 6 },
  { species: "sunflower", stage: 6 },
  { species: "fern", stage: 6 },
  { species: "cactus", stage: 6 },
  { species: "moonflower", stage: 6 },
  { species: "tomato", stage: 6 },
  { species: "orchid", stage: 6 },
  { species: "bonsai", stage: 6 },
  { species: "lavender", stage: 6 },
  { species: "pumpkin", stage: 6 },
];

const DECOR = [
  "decor_arch", "decor_bench", "decor_birdbath",
  "decor_lantern", "decor_gnome", "decor_koi",
];

function Vignette({
  plants, decor, seed, w, h, dense, plantScale, label,
}: {
  plants: CardPlant[];
  decor: string[];
  seed: string;
  w: number;
  h: number;
  dense?: boolean;
  plantScale?: number;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.width = "100%";
    cv.style.aspectRatio = `${w} / ${h}`;
    const c = cv.getContext("2d");
    if (!c) return;
    c.scale(dpr, dpr);
    paintGardenCard(
      c, w, h, plants,
      decor.map((item, slot) => ({ slot, item })),
      seed,
      { dense, plantScale }
    );
  }, [plants, decor, seed, w, h, dense, plantScale]);

  return <canvas ref={ref} className="gj-canvas" aria-label={label} />;
}

export default function GrowthJourney() {
  return (
    <section className="lp-section gj" id="journey">
      <h2>Day one, and day ninety</h2>
      <p className="lp-sub">
        The same garden. The only thing in between is turning up for a minute a day.
      </p>

      <div className="gj-pair">
        <figure className="gj-panel gj-then">
          <Vignette
            plants={DAY1} decor={[]} seed="lily-day-one"
            w={420} h={300} plantScale={1.9}
            label="A new garden on day one: a pond and a single seedling"
          />
          <figcaption>
            <b>Day 1</b>
            <span>One pond, one seedling.</span>
          </figcaption>
        </figure>

        <span className="gj-arrow" aria-hidden>
          <ArrowRight size={22} strokeWidth={2.8} />
        </span>

        <figure className="gj-panel gj-now">
          <Vignette
            plants={DAY90} decor={DECOR} seed="lily-day-ninety"
            w={680} h={300} dense
            label="The same garden after ninety days: ten plants in bloom and six ornaments"
          />
          <figcaption>
            <b>Day 90</b>
            {/* Named, not just counted — the species are the plan. Trimmed
                to four and a count, because the full list of ten ran to six
                lines on a phone and swamped the picture it describes. */}
            <span>
              Ten in bloom and six ornaments — Sunflower, Ghost Orchid,
              Bonsai, Water Lily and six more.
            </span>
          </figcaption>
        </figure>
      </div>

      <p className="gj-foot">
        Ninety waterings, one at a time. Nothing here was bought with money —
        there is nothing to buy.
      </p>
    </section>
  );
}

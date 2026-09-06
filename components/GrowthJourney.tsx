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

/**
 * The game is called Lily Days, so day one is a lily — the pond and the first
 * pad on it. Starting the story on somebody else's seedling left the namesake
 * nowhere in the picture that sells the game.
 */
const DAY1: CardPlant[] = [
  { species: "lily", stage: 1 },
  { species: "sunflower", stage: 1 },
];

/** All twelve species. The collection IS the ninety days, so show the lot. */
const DAY90: CardPlant[] = [
  "lily", "orchid", "blossom", "moonflower", "bonsai", "lavender",
  "snowdrop", "sunflower", "fern", "cactus", "tomato", "pumpkin",
].map((species) => ({ species, stage: 6 }));

const DECOR = [
  "decor_arch", "decor_bench", "decor_birdbath",
  "decor_lantern", "decor_gnome", "decor_koi",
];

function Vignette({
  plants, decor, seed, w, h, lush, plantScale, label,
}: {
  plants: CardPlant[];
  decor: string[];
  seed: string;
  w: number;
  h: number;
  lush?: boolean;
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
      { lush, plantScale }
    );
  }, [plants, decor, seed, w, h, lush, plantScale]);

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
            w={420} h={300} lush plantScale={1.7}
            label="A new garden on day one: a pond with one lily pad and a seedling beside it"
          />
          <figcaption>
            <b>Day 1</b>
            <span>One pond, one lily pad.</span>
          </figcaption>
        </figure>

        <span className="gj-arrow" aria-hidden>
          <ArrowRight size={22} strokeWidth={2.8} />
        </span>

        <figure className="gj-panel gj-now">
          <Vignette
            plants={DAY90} decor={DECOR} seed="lily-day-ninety"
            w={680} h={300} lush
            label="The same garden after ninety days: all twelve species in bloom and six ornaments"
          />
          <figcaption>
            <b>Day 90</b>
            {/* Named, not just counted — the species are the plan. Trimmed
                to four and a count, because the full list ran to six lines on
                a phone and swamped the picture it describes. */}
            <span>
              All twelve in bloom — Water Lily, Ghost Orchid, Cherry Blossom,
              Moonflower and eight more.
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

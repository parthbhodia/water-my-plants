import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import PlantTable from "@/components/PlantTable";
import FaqList from "@/components/FaqList";
import JsonLd from "@/components/JsonLd";
import { FAQS } from "@/lib/guides";
import { SITE_NAME, SITE_URL, abs } from "@/lib/site";

export const metadata: Metadata = {
  title: "How to play Lily Days",
  description:
    "The full rules of Lily Days: how watering, growth stages, time windows, streaks, dewdrops, wilting and the weekly league all work.",
  alternates: { canonical: "/how-to-play" },
  openGraph: {
    title: "How to play Lily Days",
    description:
      "The full rules: watering, growth stages, time windows, streaks, dewdrops, wilting and the weekly league.",
    url: "/how-to-play",
  },
};

export default function HowToPlay() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "How to play Lily Days",
      description:
        "Plant a seed, water it once a day on its own schedule, and climb the weekly league.",
      totalTime: "PT1M",
      image: abs("/opengraph-image"),
      step: [
        {
          "@type": "HowToStep",
          name: "Plant a seed",
          text: "Choose an unlocked plot and a species. Water plots take water lilies, sunny plots take sunflowers, cactus and tomato, shaded plots take fern and orchid.",
        },
        {
          "@type": "HowToStep",
          name: "Water what is due",
          text: "Each plant accepts one watering per day and advances one growth stage. Some species only accept water inside a time window on your local clock.",
        },
        {
          "@type": "HowToStep",
          name: "Feed and prune where needed",
          text: "Tomato and orchid need fertiliser; the bonsai pine needs pruning. Both are bought from the shop with dewdrops earned by tending.",
        },
        {
          "@type": "HowToStep",
          name: "Come back tomorrow",
          text: "Growth only happens across real days. Keep a plant on schedule to build a streak and score for your weekly league.",
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "How to play", item: abs("/how-to-play") },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <>
      <SiteNav />
      <main className="doc">
        <JsonLd data={jsonLd} />

        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> <span aria-hidden>›</span> How to play
        </nav>

        <h1>How to play Lily Days</h1>
        <p className="doc-lede">
          Lily Days is a gardening game that takes about a minute a day. You plant
          seeds, water each one on its own schedule, and try to keep a whole
          garden healthy for longer than the people you are ranked against. This
          page is the complete set of rules.
        </p>

        <h2 id="daily-loop">The daily loop</h2>
        <p>
          Every plant accepts <strong>one watering per real day</strong>. Water it
          and it advances one growth stage; water it again the same day and
          nothing happens. There is no energy bar, no timer and no way to buy
          extra turns, so playing more in a single sitting cannot move you up the
          board. Coming back tomorrow is the only thing that does.
        </p>
        <p>
          A plant needs between four and fifteen waterings to bloom, depending on
          the species. The slowest, the bonsai pine, takes a month.
        </p>

        <h2 id="cadence">Cadence: not every plant wants water daily</h2>
        <p>
          Half the roster is on a longer cycle. A woodland fern, ghost orchid and
          bonsai pine all want water <strong>every second day</strong>, and the
          desert cactus every third. Watering them in between does nothing — with
          one important exception below.
        </p>

        <h2 id="windows">Time windows</h2>
        <p>
          Some plants only drink at certain hours, measured on{" "}
          <strong>your own local clock</strong>. A sunflower takes water between
          06:00 and 20:00. A moonflower only after dusk, from 18:00 through to
          06:00 the next morning. Outside the window the water runs off: no
          growth, but no damage either.
        </p>

        <h2 id="overwatering">Overwatering</h2>
        <p>
          The desert cactus is the one plant that punishes you for turning up too
          often. Water it before its third day and the roots rot — it loses health
          and, repeated enough, it dies. Every other species simply ignores water
          it did not need.
        </p>

        <h2 id="wilting">Wilting, death and rescue</h2>
        <p>
          Miss a plant&apos;s day and it wilts, and your streak on it resets. That is
          all — a single watering brings a wilted plant straight back to health.
          A plant only actually dies once it is <strong>four of its own care
          cycles</strong> overdue, which for a daily plant means four days and for
          the bonsai means over a week. A dead plant costs you fifteen points
          until you clear the plot, and a revival tonic from the shop can bring
          one back. Plants that have already bloomed cannot die.
        </p>

        <h2 id="dewdrops">Dewdrops and the shop</h2>
        <p>
          Tending earns dewdrops. Dewdrops buy new seed species, fertiliser for
          the tomato and orchid, pruning shears for the bonsai, revival tonics and
          ornaments for the yard. Nothing in Lily Days can be bought with real
          money — the shop is the reason to keep a garden running, not a way to
          skip one.
        </p>

        <h2 id="league">Seasons and the weekly league</h2>
        <p>
          Your garden has a score: every living plant contributes its species&apos;
          points, reduced the longer it has been overdue, and dead plants subtract.
          You are placed in a league with gardeners whose clocks are within a few
          hours of yours, so a season deadline lands at a similar local hour for
          everyone in it.
        </p>
        <p>
          A season runs seven days. At the end, the top finishers are promoted a
          tier, the bottom are relegated, and the board resets.{" "}
          <strong>Your garden is never reset</strong> — only the ranking is. There
          are permanent all-time boards too, for total blooms, longest streak,
          garden value and gardener level.
        </p>

        <h2 id="friends">Friends and visiting</h2>
        <p>
          Share your friend code and you can visit each other&apos;s gardens. A visit
          can rescue a friend&apos;s wilting plant, which protects their score — but it
          never advances their growth, so it cannot be used to farm progress with
          a second account.
        </p>

        <h2 id="plants">Every plant at a glance</h2>
        <p>
          The full care contract for all eight species. Each name links to a
          longer guide.
        </p>
        <PlantTable />

        <h2 id="faq">Questions, answered</h2>
        <FaqList items={FAQS} />

        <p className="doc-cta">
          <Link className="btn" href="/#play">Start your garden — it is free</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}

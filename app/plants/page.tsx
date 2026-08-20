import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import PlantTable from "@/components/PlantTable";
import JsonLd from "@/components/JsonLd";
import { GUIDES } from "@/lib/guides";
import { SPECIES_BY_KEY, careSummary } from "@/lib/species";
import { SITE_NAME, SITE_URL, abs } from "@/lib/site";

export const metadata: Metadata = {
  title: "All plants and their care schedules",
  description:
    "Every plant in Lily Days with its watering cadence, time window, plot type and extra care — water lily, sunflower, fern, cactus, moonflower, tomato, orchid and bonsai.",
  alternates: { canonical: "/plants" },
  openGraph: {
    title: "Every plant in Lily Days, and how to grow it",
    description:
      "Watering cadence, time windows, plot types and extra care for all eight species.",
    url: "/plants",
  },
};

export default function PlantsIndex() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "All plants in Lily Days",
      url: abs("/plants"),
      description:
        "Care guides for all eight plant species in the daily gardening game Lily Days.",
      hasPart: GUIDES.map((g) => ({
        "@type": "Article",
        headline: g.headline,
        url: abs(`/plants/${g.key}`),
        description: g.summary,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Plants", item: abs("/plants") },
      ],
    },
  ];

  return (
    <>
      <SiteNav />
      <main className="doc">
        <JsonLd data={jsonLd} />

        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> <span aria-hidden>›</span> Plants
        </nav>

        <h1>Every plant in Lily Days</h1>
        <p className="doc-lede">
          Eight species, and no two of them want the same thing. Some drink daily,
          some every third day; some only in daylight, one only after dark, and one
          rots if you water it early. Pick a plant to read its full guide.
        </p>

        <div className="guide-grid">
          {GUIDES.map((g) => {
            const s = SPECIES_BY_KEY[g.key];
            return (
              <article className="guide-card" key={g.key}>
                <span className={`diff diff-${g.difficulty.toLowerCase()}`}>
                  {g.difficulty}
                </span>
                <h2>
                  <Link href={`/plants/${g.key}`}>{s.name}</Link>
                </h2>
                <p className="guide-care">{careSummary(s)}</p>
                <p className="guide-blurb">{s.blurb}</p>
                <p className="guide-more">
                  <Link href={`/plants/${g.key}`}>
                    How to grow a {s.name.toLowerCase()} →
                  </Link>
                </p>
              </article>
            );
          })}
        </div>

        <h2 id="table">Care schedules side by side</h2>
        <PlantTable />

        <p className="doc-cta">
          <Link className="btn" href="/#play">Plant your first seed — free</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}

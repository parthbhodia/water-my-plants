import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import JsonLd from "@/components/JsonLd";
import { GUIDE_KEYS, GUIDES, guideWithSpecies } from "@/lib/guides";
import { PLOT_LABEL, careSummary } from "@/lib/species";
import { SITE_NAME, SITE_URL, abs } from "@/lib/site";

type Params = { species: string };

// Every guide is known at build time; render them all statically.
export const dynamicParams = false;
export function generateStaticParams(): Params[] {
  return GUIDE_KEYS.map((species) => ({ species }));
}

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { species } = await params;
  const hit = guideWithSpecies(species);
  if (!hit) return {};
  const path = `/plants/${species}`;
  return {
    title: hit.guide.headline,
    description: hit.guide.summary,
    alternates: { canonical: path },
    openGraph: {
      title: hit.guide.headline,
      description: hit.guide.summary,
      url: path,
      type: "article",
    },
  };
}

const hour = (n: number) => `${String(n).padStart(2, "0")}:00`;

export default async function PlantGuide(
  { params }: { params: Promise<Params> }
) {
  const { species } = await params;
  const hit = guideWithSpecies(species);
  if (!hit) notFound();
  const { guide, species: s } = hit;

  const others = GUIDES.filter((g) => g.key !== guide.key).slice(0, 4);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.headline,
      description: guide.summary,
      url: abs(`/plants/${guide.key}`),
      image: abs("/opengraph-image"),
      author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
      publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
      about: { "@type": "VideoGame", name: SITE_NAME, url: SITE_URL },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Plants", item: abs("/plants") },
        { "@type": "ListItem", position: 3, name: s.name, item: abs(`/plants/${guide.key}`) },
      ],
    },
  ];

  return (
    <>
      <SiteNav />
      <main className="doc">
        <JsonLd data={jsonLd} />

        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> <span aria-hidden>›</span>{" "}
          <Link href="/plants">Plants</Link> <span aria-hidden>›</span> {s.name}
        </nav>

        <h1>{guide.headline}</h1>
        <p className="doc-lede">{s.blurb}</p>

        <dl className="spec-strip">
          <div><dt>Water</dt><dd>{s.cadenceDays === 1 ? "Every day" : `Every ${s.cadenceDays} days`}</dd></div>
          <div>
            <dt>Window</dt>
            <dd>{s.windowStart === null ? "Any hour" : `${hour(s.windowStart)}–${hour(s.windowEnd ?? 0)}`}</dd>
          </div>
          <div><dt>Plot</dt><dd>{PLOT_LABEL[s.needsPlot]}</dd></div>
          <div><dt>Days to bloom</dt><dd>{s.maturesDays}</dd></div>
          <div><dt>Points</dt><dd>{s.points}</dd></div>
          <div><dt>Difficulty</dt><dd>{guide.difficulty}</dd></div>
        </dl>
        <p className="spec-summary">In short: {careSummary(s)}.</p>

        {guide.body.map((para) => (
          <p key={para.slice(0, 32)}>{para}</p>
        ))}

        <h2>Tips</h2>
        <ul className="tip-list">
          {guide.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        <h2>Other plants to grow</h2>
        <ul className="also-list">
          {others.map((g) => (
            <li key={g.key}>
              <Link href={`/plants/${g.key}`}>{g.headline}</Link>
            </li>
          ))}
        </ul>

        <p className="doc-cta">
          <Link className="btn" href="/#play">Grow one yourself — play free</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}

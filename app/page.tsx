import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AuthForm from "@/components/AuthForm";
import HeroGarden from "@/components/HeroGarden";
import WeekStrip from "@/components/WeekStrip";
import GrannyPledge from "@/components/GrannyPledge";
import StepRow from "@/components/StepRow";
import { Reveal } from "@/components/motion/Reveal";
import { ParallaxLayer } from "@/components/motion/Parallax";
import Showcase from "@/components/Showcase";
import GrowthJourney from "@/components/GrowthJourney";
import PlantCards from "@/components/PlantCards";
import FaqList from "@/components/FaqList";
import SiteFooter from "@/components/SiteFooter";
import JsonLd from "@/components/JsonLd";
import { FAQS } from "@/lib/guides";
import { SITE_NAME, SITE_URL, abs } from "@/lib/site";

export const metadata: Metadata = {
  title: "Lily Days — a free daily gardening game you play in a minute",
  description:
    "Grow a garden one watering a day. Eight species, each on its own schedule, a weekly league against gardeners on your clock, and no adverts or in-app purchases.",
  alternates: { canonical: "/" },
};

const STEPS = [
  { icon: "sprout", title: "Plant a seed", body: "Free lilies are forgiving. Ghost orchids are not." },
  { icon: "droplets", title: "One water a day", body: "Each plant takes one drink and ignores the rest." },
  { icon: "trophy", title: "Climb the league", body: "Weekly seasons. The board resets — your garden never does." },
] as const;

export default async function LandingPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/garden");

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "VideoGame",
      name: SITE_NAME,
      url: SITE_URL,
      description:
        "A free daily gardening game. Water eight species, each on its own schedule, and climb a weekly league of gardeners on your own clock.",
      genre: ["Casual", "Simulation", "Gardening"],
      gamePlatform: ["Web browser", "Progressive Web App"],
      applicationCategory: "Game",
      operatingSystem: "Any (web browser)",
      playMode: "SinglePlayer",
      inLanguage: "en",
      image: abs("/opengraph-image"),
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
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
    <main className="landing">
      <JsonLd data={jsonLd} />

      <ParallaxLayer speed={-0.22} className="landing-clouds">
        <span className="cloud c1" />
        <span className="cloud c2" />
        <span className="cloud c3" />
      </ParallaxLayer>

      <section className="hero" id="play">
        <div className="hero-copy">
          <p className="eyebrow">Free · no adverts · plays in your browser</p>
          <h1>
            Lily <span className="accent">Days</span>
          </h1>
          <p className="tagline">
            A garden that grows because you showed up. One watering a day —
            eight species, each on its own schedule, and a weekly league.
          </p>
          <HeroGarden />
          <p className="hero-links">
            <Link href="/how-to-play">How to play</Link> ·{" "}
            <Link href="/plants">Plant guides</Link>
          </p>
          <p className="hero-note">On a phone, turn it sideways — the garden fills the screen in landscape.</p>
        </div>
        <div className="hero-auth">
          <AuthForm />
        </div>
      </section>

      <section className="lp-section" id="how">
        <Reveal>
          <h2>Three steps, then a minute a day</h2>
        </Reveal>
        <StepRow steps={STEPS} />
      </section>

      <section className="lp-section" id="plants">
        <Reveal>
          <h2>Every plant wants something different</h2>
          <p className="lp-sub">
            Tap any card for its <Link href="/plants">full guide</Link>.
          </p>
        </Reveal>
        <PlantCards />
      </section>

      <GrowthJourney />

      <Showcase />

      <section className="lp-section" id="week">
        <Reveal>
          <h2>A week in your garden</h2>
        </Reveal>
        <WeekStrip />
      </section>

      <section className="lp-section" id="faq">
        <Reveal>
          <h2>Questions, answered</h2>
        </Reveal>
        <FaqList items={FAQS} />
      </section>

      <GrannyPledge />

      <SiteFooter />
    </main>
  );
}

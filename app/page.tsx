import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AuthForm from "@/components/AuthForm";
import StageArt from "@/components/StageArt";
import Showcase from "@/components/Showcase";
import PlantTable from "@/components/PlantTable";
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
  {
    n: "1",
    icon: "🌱",
    title: "Plant a seed",
    body:
      "Pick a plot and a species. A water lily is free and forgiving; a ghost orchid will test you for eighteen days.",
  },
  {
    n: "2",
    icon: "💧",
    title: "Come back tomorrow",
    body:
      "Each plant takes one watering per day and ignores the rest. There is no way to rush it, so a turn takes about a minute.",
  },
  {
    n: "3",
    icon: "🏆",
    title: "Climb the league",
    body:
      "Your garden scores every day it stays healthy. Seasons run a week; the board resets, your garden never does.",
  },
];

const PILLARS = [
  {
    icon: "⏱️",
    title: "One minute a day",
    body:
      "Lily Days is built to be finished, not farmed. Water what is due and close the tab — there is nothing to grind and no timer nagging you back.",
  },
  {
    icon: "🧭",
    title: "Eight different contracts",
    body:
      "The sunflower drinks in daylight, the moonflower after dusk, the fern every other day and the cactus rots if you are early. Learning them is the game.",
  },
  {
    icon: "🌍",
    title: "Your clock, your day",
    body:
      "Deadlines run on the time zone you signed up in, so a player in Sydney and a player in Chicago each get a fair midnight. The server keeps time — device clocks do nothing.",
  },
  {
    icon: "🎨",
    title: "Drawn entirely in code",
    body:
      "Every leaf, cloud, firefly and sound effect is generated at runtime. No sprite sheets, no downloads — the whole garden loads in seconds.",
  },
  {
    icon: "💧",
    title: "Earned, never bought",
    body:
      "Seeds, fertiliser, tools and ornaments cost dewdrops you earn by tending. There is no real-money shop and no advertising anywhere.",
  },
  {
    icon: "📱",
    title: "Installs like an app",
    body:
      "Add Lily Days to your home screen and it opens full-screen, offline-tolerant, exactly like a native app — without an app store in the way.",
  },
];

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

      <div className="landing-clouds" aria-hidden>
        <span className="cloud c1" />
        <span className="cloud c2" />
        <span className="cloud c3" />
      </div>

      <section className="hero" id="play">
        <div className="hero-copy">
          <div className="hero-art" aria-hidden>
            <div className="hero-pond">
              <StageArt stage={6} size={150} />
            </div>
          </div>
          <p className="eyebrow">Free · no adverts · plays in your browser</p>
          <h1>
            Lily <span className="accent">Days</span>
          </h1>
          <p className="tagline">
            A daily gardening game you finish in a minute. Grow eight species —
            each wanting something different — and climb a weekly league against
            gardeners on your own clock.
          </p>
          <ul className="feature-list">
            <li>🌿 8 species, each with its own watering schedule</li>
            <li>💧 One water per day — the server keeps time, no cheating</li>
            <li>🏆 A weekly league of gardeners on your clock</li>
            <li>🌸 Bloom, harvest, and grow something harder</li>
          </ul>
          <p className="hero-links">
            New here? Read <Link href="/how-to-play">how to play</Link> or browse
            the <Link href="/plants">plant guides</Link>.
          </p>
        </div>
        <div className="hero-auth">
          <AuthForm />
        </div>
      </section>

      <section className="lp-section" id="how">
        <h2>How Lily Days works</h2>
        <p className="lp-sub">
          Three steps, then a minute a day. No tutorial to sit through — though
          there is one waiting if you want it.
        </p>
        <ol className="step-row">
          {STEPS.map((s) => (
            <li className="step-card" key={s.n}>
              <span className="step-icon" aria-hidden>{s.icon}</span>
              <span className="step-n">Step {s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-section" id="plants">
        <h2>Every plant wants something different</h2>
        <p className="lp-sub">
          The care contract is the whole game. Here is all of it, in one table —
          or read the <Link href="/plants">full guide for any plant</Link>.
        </p>
        <PlantTable />
      </section>

      <Showcase />

      <section className="lp-section" id="why">
        <h2>Why people keep coming back</h2>
        <div className="pillar-grid">
          {PILLARS.map((p) => (
            <article className="pillar" key={p.title}>
              <span className="pillar-icon" aria-hidden>{p.icon}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section" id="faq">
        <h2>Questions, answered</h2>
        <FaqList items={FAQS} />
      </section>

      <section className="lp-cta">
        <h2>Your first seed takes ten seconds</h2>
        <p>
          Sign up with an email and a password. No card, no download, no advert
          before you play.
        </p>
        <a className="btn" href="#play">Start your garden</a>
      </section>

      <SiteFooter />
    </main>
  );
}

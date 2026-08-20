import Link from "next/link";

/** Header for the marketing pages. Real <a> links so crawlers follow them. */
export default function SiteNav() {
  return (
    <header className="site-nav">
      <Link href="/" className="site-brand">
        <span aria-hidden>🌸</span> Lily&nbsp;<span className="accent">Days</span>
      </Link>
      <nav aria-label="Primary">
        <Link href="/how-to-play">How to play</Link>
        <Link href="/plants">Plants</Link>
        <Link href="/#play" className="nav-cta">Play free</Link>
      </nav>
    </header>
  );
}

import Link from "next/link";
import { SPECIES } from "@/lib/species";

/**
 * Footer doubles as the site's internal link graph — every guide page is one
 * hop from every other page, which is how the deeper pages get crawled at all.
 */
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="foot-cols">
        <div className="foot-col">
          <h3>Lily Days</h3>
          <p>
            A free daily gardening game. One watering a day, eight species, and a
            weekly league of gardeners on your own clock.
          </p>
        </div>
        <div className="foot-col">
          <h3>Learn</h3>
          <ul>
            <li><Link href="/how-to-play">How to play</Link></li>
            <li><Link href="/plants">All plants</Link></li>
            <li><Link href="/how-to-play#faq">Questions</Link></li>
          </ul>
        </div>
        <div className="foot-col">
          <h3>Plant guides</h3>
          <ul className="foot-plants">
            {SPECIES.map((s) => (
              <li key={s.key}>
                <Link href={`/plants/${s.key}`}>{s.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="foot-note">
        Made with 💚 · everything drawn with code, no assets harmed
      </p>
    </footer>
  );
}

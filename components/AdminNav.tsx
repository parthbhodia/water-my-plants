import Link from "next/link";
import { ArrowLeft, ChartNoAxesColumn } from "lucide-react";

/**
 * The bar across the top of the admin pages.
 *
 * These pages sit outside the game and outside the marketing site, so without
 * this there is no way back except the browser's own button — and the game is
 * an installed PWA for a lot of people, where that button may not be there at
 * all.
 *
 * It carries no authorisation of its own: the page it sits on is already gated
 * by `admin_funnel()` refusing anybody who is not in `admins`, and a nav that
 * decided who may see what would be a second, weaker gate to keep in step with
 * the first.
 */
export default function AdminNav({ current = "Funnel" }: { current?: string }) {
  return (
    <header className="admin-nav">
      <Link href="/garden" className="admin-back">
        <ArrowLeft size={17} strokeWidth={2.6} aria-hidden />
        Back to the garden
      </Link>
      <span className="admin-here">
        <ChartNoAxesColumn size={16} strokeWidth={2.6} aria-hidden />
        {current}
      </span>
    </header>
  );
}

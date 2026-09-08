import type { Metadata, Viewport } from "next";
import { Patrick_Hand } from "next/font/google";
import "./globals.css";
import PwaSetup from "@/components/PwaSetup";
import { Analytics } from "@vercel/analytics/next";

const hand = Patrick_Hand({ weight: "400", subsets: ["latin"], variable: "--font-hand" });
import { SITE_NAME, SITE_URL } from "@/lib/site";

const DESCRIPTION =
  "A free daily gardening game. Water eight species — each on its own schedule — in about a minute a day, and climb a weekly league of gardeners on your own clock.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Lily Days — a free daily gardening game you play in a minute",
    // Sub-pages set their own title; this keeps the brand in the SERP snippet.
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "daily gardening game",
    "free browser game",
    "plant growing game",
    "idle garden game",
    "cozy game",
    "one minute a day game",
    "water lily game",
    "gardening game with leaderboard",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  verification: { google: "A9C50IFfEPt-9fR_myw1ek_4EuuUVIlQFIGecwXdrvQ" },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "default",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: "/",
    title: "Lily Days — a free daily gardening game",
    description: DESCRIPTION,
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lily Days — a free daily gardening game",
    description: DESCRIPTION,
  },
  category: "games",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#58b368",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={hand.variable}>
      <body>
        {children}
        <PwaSetup />
        {/* Cookieless, so no consent banner — and it stays that way only while
            nothing sent from lib/analytics.ts carries personal data. */}
        <Analytics />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaSetup from "@/components/PwaSetup";

export const metadata: Metadata = {
  title: "Lily Days 🌸 — a tiny daily garden",
  description:
    "Tend a garden of water lilies, sunflowers and stranger things. One watering a day, every day — and a league to climb.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Lily Days",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Lily Days — a daily garden",
    description:
      "One watering a day. Eight species, each with its own schedule. Climb a weekly league of gardeners on your clock.",
    type: "website",
  },
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
    <html lang="en">
      <body>
        {children}
        <PwaSetup />
      </body>
    </html>
  );
}

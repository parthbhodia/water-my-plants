import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { GUIDE_KEYS } from "@/lib/guides";

export default function sitemap(): MetadataRoute.Sitemap {
  // The content is static, so a build-time stamp is the honest lastModified.
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/how-to-play`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/plants`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    ...GUIDE_KEYS.map((key) => ({
      url: `${SITE_URL}/plants/${key}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}

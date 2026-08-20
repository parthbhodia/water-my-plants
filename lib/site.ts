// One source of truth for anything that has to be an absolute URL: canonical
// tags, Open Graph, the sitemap, robots.txt and JSON-LD all read from here.
//
// Set NEXT_PUBLIC_SITE_URL to the domain you actually want indexed. Without it
// we fall back to the Vercel production alias, and in a preview deployment to
// that deployment's own URL so nothing ever points at localhost.

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  const deployment = process.env.NEXT_PUBLIC_VERCEL_URL;
  if (deployment) return `https://${deployment}`;
  return "https://waterlily.app";
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = "Lily Days";
export const SITE_TAGLINE = "a free daily gardening game";

/** Absolute URL for a site-relative path. */
export function abs(path = "/"): string {
  return new URL(path, `${SITE_URL}/`).toString();
}

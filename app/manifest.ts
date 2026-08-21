import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lily Days — a daily garden",
    short_name: "Lily Days",
    description:
      "Tend a garden of water lilies, sunflowers and stranger things. One watering a day, every day.",
    start_url: "/garden",
    scope: "/",
    display: "standalone",
    orientation: "landscape",
    background_color: "#bfe7f2",
    theme_color: "#58b368",
    categories: ["games", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Water my plants", short_name: "Water", url: "/garden" },
    ],
  };
}

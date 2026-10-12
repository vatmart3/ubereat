import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "REMIS. — preuve de remise",
    short_name: "REMIS.",
    description: "Photo, signature, scellé : la preuve horodatée de chaque remise au livreur.",
    id: "/app",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0E1113",
    theme_color: "#0E1113",
    lang: "fr",
    categories: ["business", "food", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Nouvelle remise", short_name: "Remise", url: "/app/nouvelle", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }],
  };
}

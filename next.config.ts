import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  cacheOnNavigation: true,
  // Pas de rechargement automatique au retour réseau : on ne perd jamais une remise en cours.
  reloadOnOnline: false,
});

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: { optimizePackageImports: ["framer-motion", "@react-three/drei"] },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Le reçu livreur ne doit pas fuiter son token via le Referer.
      { source: "/r/:token*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
};

export default withSerwist(nextConfig);

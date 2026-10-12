import type { Metadata, Viewport } from "next";
import { Big_Shoulders, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

// « Big Shoulders Display » est désormais l'axe optique (opsz 72) de la famille Big Shoulders.
const display = Big_Shoulders({ subsets: ["latin"], weight: "variable", axes: ["opsz"], variable: "--font-display", display: "swap", adjustFontFallback: false });
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "REMIS. — la preuve de remise restaurant ↔ livreur", template: "%s · REMIS." },
  description:
    "Photo du sac, signature du livreur, scellé horodaté : en moins de 30 secondes, chaque remise Uber Eats, Deliveroo ou Just Eat devient une preuve vérifiable. Dossier de litige en un clic.",
  applicationName: "REMIS.",
  appleWebApp: { capable: true, title: "REMIS.", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E4E8EA" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1113" },
  ],
};

// Thème appliqué avant le premier rendu (pas de flash).
const themeScript = `try{var t=localStorage.getItem("remis-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="steel">{children}</body>
    </html>
  );
}

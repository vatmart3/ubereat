import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["Pixel 7"],
    // Les tests tournent avec Chromium (le profil Pixel 7 donne viewport, tactile et DPR mobiles).
    browserName: "chromium",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [
    { name: "mobile-360", use: { viewport: { width: 360, height: 780 } } },
    { name: "mobile-430", use: { viewport: { width: 430, height: 932 } }, testMatch: /handover\.spec/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Mode démo forcé (aucune variable Supabase) : données en mémoire, restaurant pré-rempli.
        command: process.env.E2E_DEV ? `npx next dev -p ${PORT}` : `npm run build && npx next start -p ${PORT}`,
        url: `${baseURL}/api/me`,
        timeout: 240_000,
        reuseExistingServer: !process.env.CI,
        env: { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" },
      },
});

import { chromium } from "@playwright/test";
const [,, base, outDir, scheme = "light", ...paths] = process.argv;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && console.log("console:", m.text()));
page.on("pageerror", (e) => console.log("pageerror:", e.message));
for (const p of paths) {
  await page.goto(base + p, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const name = p.replace(/[^a-z0-9]+/gi, "_") || "root";
  await page.screenshot({ path: `${outDir}/${name}-${scheme}.png`, fullPage: true });
  console.log("shot", p);
}
await browser.close();

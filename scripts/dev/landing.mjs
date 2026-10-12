import { chromium } from "@playwright/test";
const [,, base, out, scheme = "light", width = "390"] = process.argv;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: Number(width), height: 844 }, deviceScaleFactor: 1.5, colorScheme: scheme });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));
page.on("console", (m) => m.type() === "error" && console.log("console:", m.text()));
await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/land-hero-${scheme}-${width}.png` });
await page.mouse.wheel(0, 10); await page.waitForTimeout(4000);
for (const y of [500, 900, 1300]) { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(1200); await page.screenshot({ path: `${out}/land-3d-${y}-${scheme}-${width}.png` }); }
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/land-full-${scheme}-${width}.png`, fullPage: true });
await browser.close();
console.log("ok");

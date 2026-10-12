import { chromium } from "@playwright/test";
const [,, base, out, scheme = "light"] = process.argv;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, colorScheme: scheme })).newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto(base + "/", { waitUntil: "networkidle" });
for (const id of ["cout", "demo", "benefices", "avis", "tarif", "faq", "cta-final"]) {
  await page.locator(`#${id}`).scrollIntoViewIfNeeded();
  await page.evaluate((id) => document.getElementById(id).scrollIntoView(), id);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${out}/sec-${id}-${scheme}.png` });
}
await browser.close();
console.log("ok");

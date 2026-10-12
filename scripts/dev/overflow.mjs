// Détecte tout débordement horizontal à 360 px (clair) sur les écrans principaux.
import { chromium } from "@playwright/test";
const [,, base] = process.argv;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true })).newPage();
const paths = ["/", "/app", "/app/nouvelle", "/app/litiges", "/app/reglages", "/comptoir", "/login", "/onboarding", "/r/demo01xxxxxxxxxxxxxxxxxxxxxxxxxx", "/app/remises/7a2e0c1d-0003-4b6a-9c11-0d5c1e2f3a03", "/app/remises/7a2e0c1d-0003-4b6a-9c11-0d5c1e2f3a03/verifier"];
for (const p of paths) {
  await page.goto(base + p, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  if (p.endsWith("verifier")) { await page.getByTestId("simulate-fraud").click(); await page.waitForTimeout(600); }
  const offenders = await page.evaluate(() => {
    document.body.style.overflowX = "visible";
    const w = document.documentElement.clientWidth;
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.right > w + 1 && r.width > 0 && !el.closest(".rail") && getComputedStyle(el).position !== "fixed") out.push(`${el.tagName}.${String(el.className).slice(0, 60)} → ${Math.round(r.right)}`);
    }
    document.body.style.overflowX = "";
    return out.slice(0, 5);
  });
  console.log(p, offenders.length ? offenders : "OK");
}
await browser.close();

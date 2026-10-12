import { expect, test } from "@playwright/test";
import { PHOTO } from "./helpers";

test("hors ligne : la remise part en file d'attente puis est scellée au retour du réseau", async ({ page, context }) => {
  const order = `OFF${Date.now().toString().slice(-5)}`;
  await page.goto("/app/nouvelle");
  await page.getByTestId("platform-justeat").click();
  await page.keyboard.type(order);
  await page.keyboard.press("Enter");

  await context.setOffline(true);
  await page.getByTestId("input-sac").setInputFiles(PHOTO);
  await expect(page.getByTestId("thumb-sac")).toBeVisible();
  await page.getByTestId("next-step").click();
  await page.getByTestId("courier-name").fill("nadia k");
  await page.getByTestId("vehicle-velo").click();
  await page.getByTestId("next-step").click();
  await page.getByTestId("confirm-closed").click();

  const hold = page.getByTestId("hold-to-seal");
  const box = (await hold.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1100);
  await page.mouse.up();

  await expect(page.getByTestId("confirmation")).toContainText("Enregistrée hors ligne");
  await expect(page.getByTestId("handover-ticket")).toContainText("En attente de réseau");
  await expect(page.getByTestId("send-receipt")).toBeDisabled();

  // Retour du réseau : synchronisation automatique, l'heure serveur fait foi.
  await context.setOffline(false);
  await expect(page.getByText(/en attente de scellé/i)).toBeHidden({ timeout: 20_000 });
  await page.goto("/app");
  await page.getByTestId("registry-search").fill(order);
  await expect(page.getByTestId("registry-row")).toHaveCount(1, { timeout: 10_000 });
  await page.getByTestId("registry-row").click();
  await expect(page.getByText(/saisie hors ligne, scellée au retour du réseau/)).toBeVisible();
});

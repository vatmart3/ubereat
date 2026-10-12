import { expect, test } from "@playwright/test";
import { TapCounter } from "./helpers";

test.describe("Parcours de remise", () => {
  test("une remise complète en moins de 30 s et 10 taps max (hors saisie)", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByTestId("fab-new")).toBeVisible();
    const order = `E2E${Date.now().toString().slice(-5)}`;
    const taps = new TapCounter(page);
    const started = Date.now();

    await taps.tap(page.getByTestId("fab-new"));
    // 1. La commande : tuile plateforme → focus automatique sur le n° → Entrée = étape suivante
    await taps.tap(page.getByTestId("platform-uber"));
    await expect(page.getByTestId("order-ref")).toBeFocused();
    await page.keyboard.type(order);
    await page.keyboard.press("Enter");

    // 2. Les photos : un tap ouvre la caméra arrière
    await taps.photo(page.getByTestId("input-sac"));
    await expect(page.getByTestId("thumb-sac")).toBeVisible();
    await taps.tap(page.getByTestId("next-step"));

    // 3. Le livreur : un tap sur un livreur récent remplit nom + véhicule + code
    await taps.tap(page.getByTestId("recent-courier").first());
    await taps.tap(page.getByTestId("next-step"));

    // 4. Signer et sceller
    await expect(page.getByTestId("rgpd-notice")).toBeVisible();
    await expect(page.getByTestId("hold-to-seal")).toBeDisabled();
    await taps.tap(page.getByTestId("confirm-closed"));
    await taps.hold(page.getByTestId("hold-to-seal"));

    await expect(page.getByTestId("confirmation")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("handover-ticket")).toContainText(`#${order}`);
    await expect(page.getByTestId("ink-stamp").first()).toBeVisible();
    const elapsed = Date.now() - started;

    console.log(`Remise scellée en ${(elapsed / 1000).toFixed(1)} s, ${taps.count} taps`);
    expect(elapsed).toBeLessThan(30_000);
    expect(taps.count).toBeLessThanOrEqual(10);

    // Reçu livreur : QR + lien
    await page.getByTestId("send-receipt").click();
    const url = (await page.getByTestId("receipt-url").textContent())!.trim();
    expect(url).toMatch(/\/r\/[A-Za-z0-9_-]{32}$/);

    // Le livreur ouvre son reçu sans compte
    const courier = await page.context().browser()!.newContext({ viewport: { width: 375, height: 800 } });
    const courierPage = await courier.newPage();
    await courierPage.goto(url);
    await expect(courierPage.getByTestId("courier-message")).toContainText(`#${order}`);
    await expect(courierPage.getByTestId("courier-message")).toContainText("Ce reçu prouve que vous avez récupéré la commande");
    await courier.close();

    // La remise apparaît dans le registre
    await page.goto("/app");
    await page.getByTestId("registry-search").fill(order);
    await expect(page.getByTestId("registry-row")).toHaveCount(1);
  });

  test("le brouillon survit à la fermeture de l'app", async ({ page }) => {
    await page.goto("/app/nouvelle");
    await page.getByTestId("platform-deliveroo").click();
    await page.getByTestId("order-ref").fill("BROUILLON1");
    await page.waitForTimeout(600);
    await page.reload();
    await expect(page.getByTestId("order-ref")).toHaveValue("BROUILLON1");
    await expect(page.getByText("Brouillon restauré")).toBeVisible();
  });

  test("Entrée ne passe pas l'étape tant qu'elle est incomplète", async ({ page }) => {
    await page.goto("/app/nouvelle");
    await page.getByTestId("order-ref").fill("X1");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Étape 1 sur 4")).toBeVisible();
  });
});

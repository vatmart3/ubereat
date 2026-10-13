import { expect, test } from "@playwright/test";
import { TapCounter } from "./helpers";

test.describe("Parcours de remise", () => {
  test("une remise express en moins de 30 s et 5 taps max (hors saisie)", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByTestId("fab-new")).toBeVisible();
    const order = `E2E${Date.now().toString().slice(-5)}`;
    const taps = new TapCounter(page);
    const started = Date.now();

    await taps.tap(page.getByTestId("fab-new"));
    // Remise express : la plateforme est mémorisée, le curseur est déjà sur le n° de commande.
    await expect(page.getByTestId("order-ref")).toBeFocused();
    await taps.tap(page.getByTestId("platform-uber"));
    await page.keyboard.type(order);

    // Un tap sur « Photo du sac » ouvre la caméra arrière
    await taps.photo(page.getByTestId("photo-input"));
    await expect(page.getByTestId("thumb-sac")).toBeVisible();

    // Un tap sur un livreur récent remplit nom + véhicule + code
    await taps.tap(page.getByTestId("recent-courier").first());

    // Maintenir pour sceller (vaut confirmation « sac remis fermé et complet »)
    await expect(page.getByTestId("rgpd-notice")).toBeVisible();
    await taps.hold(page.getByTestId("hold-to-seal"));

    await expect(page.getByTestId("confirmation")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("handover-ticket")).toContainText(`#${order}`);
    await expect(page.getByTestId("ink-stamp").first()).toBeVisible();
    const elapsed = Date.now() - started;

    console.log(`Remise scellée en ${(elapsed / 1000).toFixed(1)} s, ${taps.count} taps`);
    expect(elapsed).toBeLessThan(30_000);
    expect(taps.count).toBeLessThanOrEqual(5);

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

  test("le scellé reste bloqué tant qu'il manque une information", async ({ page }) => {
    await page.goto("/app/nouvelle");
    await page.getByTestId("order-ref").fill("X1");
    await expect(page.getByTestId("hold-to-seal")).toBeDisabled();
    await expect(page.getByTestId("hold-to-seal")).toContainText("Il manque : photo, livreur");
  });
});

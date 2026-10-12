import { expect, test } from "@playwright/test";

test.describe("Intégrité et litiges", () => {
  test("Vérifier : intacte, puis « Simuler une fraude » → modifiée", async ({ page }) => {
    await page.goto("/app");
    await page.getByTestId("registry-row").first().click();
    await page.getByTestId("verify-link").click();
    await expect(page.getByTestId("verdict")).toContainText("Preuve intacte", { timeout: 15_000 });
    await page.getByTestId("simulate-fraud").click();
    await expect(page.getByTestId("verdict")).toContainText("Preuve modifiée");
  });

  test("Litige : ouverture, dossier texte, PDF, résolution", async ({ page }) => {
    await page.goto("/app");
    await page.getByTestId("registry-search").fill("DR-0937");
    await page.getByTestId("registry-row").first().click();
    await page.getByTestId("open-dispute").click();
    await page.getByRole("radio", { name: "Article manquant" }).click();
    await page.getByTestId("confirm-dispute").click();
    await expect(page.getByTestId("copy-dossier")).toBeVisible();

    await page.getByTestId("copy-dossier").click();
    await expect(page.getByTestId("copy-dossier")).toContainText("copié");
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("#DR-0937");
    expect(text).toContain("Empreinte de la preuve (SHA-256)");
    expect(text).toContain("Heure de remise (horodatage serveur");
    expect(text).toContain("Léa M.");
    expect(text).toContain("Historique");
    expect(text).not.toMatch(/incontestable/i);

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-pdf").click()]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    await page.getByTestId("resolve-dispute").click();
    await expect(page.getByTestId("open-dispute")).toContainText("Rouvrir");
  });

  test("Le badge Litiges compte les litiges ouverts", async ({ page }) => {
    await page.goto("/app/litiges");
    const count = await page.getByTestId("dispute-row").count();
    expect(count).toBeGreaterThan(0);
    await expect(page.getByTestId("disputes-badge")).toHaveText(String(count));
  });

  test("Comptoir : connexion par PIN", async ({ page }) => {
    await page.goto("/comptoir");
    await page.getByTestId("member-Yanis").click();
    for (const d of "2580") await page.getByTestId(`pin-${d}`).click();
    await page.waitForURL("**/app");
    await expect(page.getByRole("link", { name: /Opérateur : Yanis/ })).toBeVisible();
  });
});

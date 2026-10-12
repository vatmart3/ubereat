import type { Locator, Page } from "@playwright/test";
import path from "node:path";

export const PHOTO = path.join(process.cwd(), "supabase", "seed-assets", "sac-a.jpg");

/** Compteur de taps : chaque interaction volontaire de l'opérateur (hors saisie clavier). */
export class TapCounter {
  count = 0;
  constructor(private readonly page: Page) {}
  async tap(locator: Locator) {
    this.count++;
    await locator.click();
  }
  /** Prise de vue : un tap sur l'emplacement (la caméra native est simulée par le fichier). */
  async photo(input: Locator, file = PHOTO) {
    this.count++;
    await input.setInputFiles(file);
  }
  /** Appui long « maintenir pour sceller » = un seul geste. */
  async hold(locator: Locator, ms = 1100) {
    this.count++;
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box) throw new Error("Bouton introuvable");
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
    await this.page.waitForTimeout(ms);
    await this.page.mouse.up();
  }
}

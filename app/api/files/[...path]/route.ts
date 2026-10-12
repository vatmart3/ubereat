import { getStore } from "@/lib/data";
import { handleError, HttpError } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Lecture d'un fichier de preuve. Autorisé si :
 *  - l'opérateur appartient au restaurant (1er segment du chemin), ou
 *  - le reçu livreur (?r=token) correspond à la remise (2e segment).
 */
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path: segments } = await params;
    const path = segments.map(decodeURIComponent).join("/");
    if (segments.length !== 3 || path.includes("..")) throw new HttpError(400, "Chemin invalide");
    const [restaurantId, handoverId] = segments as [string, string, string];
    const store = getStore();

    const token = new URL(request.url).searchParams.get("r");
    let allowed = false;
    if (token) {
      const receipt = await store.getReceipt(token);
      allowed = receipt?.handover.id === handoverId && receipt.handover.restaurant_id === restaurantId;
    } else {
      const actor = await store.getActor();
      allowed = actor?.restaurant.id === restaurantId;
    }
    if (!allowed) throw new HttpError(403, "Accès refusé");

    const bytes = await store.getFile(path);
    if (!bytes) throw new HttpError(404, "Fichier introuvable");
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": path.endsWith(".png") ? "image/png" : "image/jpeg",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

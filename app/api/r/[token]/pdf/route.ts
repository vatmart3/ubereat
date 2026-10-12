import { getStore } from "@/lib/data";
import { handleError, HttpError } from "@/lib/api";
import { renderDossierPdf } from "@/lib/pdf/render";
import type { HandoverDetail } from "@/lib/types";

export const runtime = "nodejs";

/** « Enregistrer ma preuve » : le livreur télécharge son reçu en PDF, sans compte. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const store = getStore();
    const r = await store.getReceipt(token);
    if (!r) throw new HttpError(404, "Reçu introuvable ou expiré");
    const detail: HandoverDetail = {
      ...r.handover,
      courier_id: null,
      courier_name_snapshot: r.handover.courier_name,
      client_captured_at: null,
      sealed_by: null,
      sealed_by_name: null,
      timestamp_provider: "server",
      timestamp_token: null,
      geo: null,
      created_at: r.handover.sealed_at,
      photos: r.photos.map((p, i) => ({ id: String(i), original_path: null, ...p })),
      events: [
        { id: "seal", handover_id: r.handover.id, type: "seal", payload: {}, actor: "", actor_name: "le restaurant", created_at: r.handover.sealed_at },
        ...r.courier_events.map((e, i) => ({ id: `c${i}`, handover_id: r.handover.id, type: "courier_photo" as const, payload: e.payload, actor: "livreur", actor_name: "Livreur", created_at: e.created_at })),
      ],
      receipt: { public_token: token, expires_at: r.expires_at },
    };
    const pdf = await renderDossierPdf(store, detail, { name: r.restaurant.name, city: r.restaurant.city, address: null }, `${new URL(request.url).origin}/r/${token}`);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="recu-remis-${r.handover.order_ref.replace(/[^A-Za-z0-9-]/g, "")}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

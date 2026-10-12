import { getStore } from "@/lib/data";
import { handleError, HttpError, requireActor } from "@/lib/api";
import { renderDossierPdf } from "@/lib/pdf/render";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const store = getStore();
    const handover = await store.getHandover(actor, id);
    if (!handover) throw new HttpError(404, "Remise introuvable");
    await store.recordEvent(actor, id, "export", { format: "pdf" });
    const fresh = (await store.getHandover(actor, id)) ?? handover;
    const origin = new URL(request.url).origin;
    const receiptUrl = fresh.receipt ? `${origin}/r/${fresh.receipt.public_token}` : null;
    const pdf = await renderDossierPdf(store, fresh, actor.restaurant, receiptUrl);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="remis-${fresh.order_ref.replace(/[^A-Za-z0-9-]/g, "")}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

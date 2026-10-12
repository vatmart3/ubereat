import { NextResponse } from "next/server";
import { getStore } from "@/lib/data";
import { handleError, HttpError, requireActor } from "@/lib/api";
import { eventRequestSchema } from "@/lib/seal/schema";

export const runtime = "nodejs";

/** Tout ce qui arrive après le scellé est un événement (journal en ajout seul). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const event = eventRequestSchema.parse(await request.json());
    const store = getStore();
    const handover = await store.getHandover(actor, id);
    if (!handover) throw new HttpError(404, "Remise introuvable");
    if (event.type === "resolve" && handover.status !== "litige") throw new HttpError(409, "Aucun litige ouvert sur cette remise");
    await store.recordEvent(actor, id, event.type, event.payload);
    const updated = await store.getHandover(actor, id);
    return NextResponse.json({ status: updated?.status, events: updated?.events ?? [] });
  } catch (error) {
    return handleError(error);
  }
}

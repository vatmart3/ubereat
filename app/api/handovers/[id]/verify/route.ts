import { NextResponse } from "next/server";
import { getStore } from "@/lib/data";
import { handleError, HttpError, requireActor } from "@/lib/api";
import { verifyHandover } from "@/lib/seal/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const store = getStore();
    const handover = await store.getHandover(actor, id);
    if (!handover) throw new HttpError(404, "Remise introuvable");
    return NextResponse.json(await verifyHandover(store, handover), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleError(error);
  }
}

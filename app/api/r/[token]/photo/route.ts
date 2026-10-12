import { NextResponse } from "next/server";
import { getStore } from "@/lib/data";
import { handleError, HttpError, MAX_UPLOAD_BYTES } from "@/lib/api";
import { isJpeg } from "@/lib/image/inspect";
import { sha256Hex } from "@/lib/seal/canonical";
import { proofPaths } from "@/lib/seal/server";

export const runtime = "nodejs";

/**
 * Photo de prise en charge ajoutée par le livreur (sans compte, via le token du reçu).
 * Elle devient un événement `courier_photo` : le contenu scellé par le restaurant n'est jamais touché.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const store = getStore();
    const receipt = await store.getReceipt(token);
    if (!receipt) throw new HttpError(404, "Reçu introuvable ou expiré");
    if (receipt.courier_events.length >= 3) throw new HttpError(409, "3 photos maximum");

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) throw new HttpError(400, "Fichier manquant");
    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, "Fichier trop lourd (4 Mo max)");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isJpeg(bytes)) throw new HttpError(415, "La photo doit être un JPEG");

    const capturedRaw = String(form.get("captured_at") ?? "");
    const captured = Number.isNaN(Date.parse(capturedRaw)) ? new Date() : new Date(Math.min(Date.parse(capturedRaw), Date.now()));
    const path = proofPaths(receipt.handover.restaurant_id, receipt.handover.id).courier(receipt.courier_events.length + 1);
    await store.putFile(path, bytes, "image/jpeg");
    const sha = await sha256Hex(bytes);
    await store.addCourierPhoto(token, path, sha, captured.toISOString());
    return NextResponse.json({ path, sha256: sha }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

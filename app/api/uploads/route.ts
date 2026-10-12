import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/data";
import { handleError, HttpError, MAX_UPLOAD_BYTES, requireActor } from "@/lib/api";
import { isJpeg, isPng } from "@/lib/image/inspect";
import { sha256Hex } from "@/lib/seal/canonical";
import { proofPaths } from "@/lib/seal/server";

export const runtime = "nodejs";

const fieldsSchema = z.object({
  handover_id: z.string().uuid(),
  kind: z.enum(["photo", "orig", "thumb", "signature"]),
  slot: z.enum(["sac", "ticket", "remise"]).optional(),
});

/** Upload d'un fichier de preuve AVANT scellé. Le chemin est imposé par le serveur. */
export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const form = await request.formData();
    const fields = fieldsSchema.parse({
      handover_id: form.get("handover_id"),
      kind: form.get("kind"),
      slot: form.get("slot") ?? undefined,
    });
    const file = form.get("file");
    if (!(file instanceof Blob)) throw new HttpError(400, "Fichier manquant");
    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, "Fichier trop lourd (4 Mo max)");

    const store = getStore();
    if (await store.handoverExists(fields.handover_id)) throw new HttpError(409, "Remise déjà scellée : fichiers verrouillés");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const paths = proofPaths(actor.restaurant.id, fields.handover_id);
    let path: string;
    let contentType: string;
    if (fields.kind === "signature") {
      if (!isPng(bytes)) throw new HttpError(415, "La signature doit être un PNG");
      path = paths.signature;
      contentType = "image/png";
    } else {
      if (!fields.slot) throw new HttpError(400, "Emplacement photo manquant");
      if (!isJpeg(bytes)) throw new HttpError(415, "La photo doit être un JPEG");
      path = fields.kind === "photo" ? paths.photo(fields.slot) : fields.kind === "orig" ? paths.original(fields.slot) : paths.thumb(fields.slot);
      contentType = "image/jpeg";
    }
    await store.putFile(path, bytes, contentType);
    return NextResponse.json({ path, sha256: await sha256Hex(bytes) });
  } catch (error) {
    return handleError(error);
  }
}

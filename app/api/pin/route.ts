import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/data";
import { handleError, HttpError } from "@/lib/api";
import { getDeviceRestaurantId } from "@/lib/device";

export const runtime = "nodejs";

const schema = z.object({ member_id: z.string().uuid(), pin: z.string().regex(/^\d{4}$/, "4 chiffres") });

/** Connexion rapide au comptoir : PIN 4 chiffres, verrouillage 5 min après 5 erreurs. */
export async function POST(request: Request) {
  try {
    const { member_id, pin } = schema.parse(await request.json());
    const restaurantId = await getDeviceRestaurantId();
    if (!restaurantId) throw new HttpError(403, "Ce téléphone n'est rattaché à aucun restaurant");
    const store = getStore();
    const result = await store.checkPin(restaurantId, member_id, pin);
    if (!result.ok) {
      if (result.reason === "locked") return NextResponse.json({ error: "Trop d'essais. Réessayez dans 5 minutes.", until: result.until }, { status: 423 });
      if (result.reason === "no_pin") return NextResponse.json({ error: "Aucun PIN défini pour ce membre" }, { status: 400 });
      return NextResponse.json({ error: "Code incorrect", remaining: result.remaining }, { status: 401 });
    }
    await store.signInAs(result.member);
    return NextResponse.json({ ok: true, display_name: result.member.display_name });
  } catch (error) {
    return handleError(error);
  }
}

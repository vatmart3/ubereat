import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/data";
import { handleError, HttpError, requireActor } from "@/lib/api";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  city: z.string().trim().min(1, "Ville requise").max(80),
  display_name: z.string().trim().max(40).default(""),
});

export async function POST(request: Request) {
  try {
    const store = getStore();
    if (store.mode === "supabase" && !(await store.getUser())) throw new HttpError(401, "Connectez-vous d'abord");
    const body = createSchema.parse(await request.json());
    const id = await store.createRestaurant(body.name, body.city, body.display_name);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  city: z.string().trim().min(1).max(80).optional(),
  address: z.string().trim().max(160).nullable().optional(),
  retention_days: z.number().int().min(30).max(1095).optional(),
});

export async function PATCH(request: Request) {
  try {
    const actor = await requireActor();
    if (actor.role !== "owner") throw new HttpError(403, "Réservé au propriétaire");
    await getStore().updateRestaurant(actor, patchSchema.parse(await request.json()));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/data";
import { handleError, HttpError } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const store = getStore();
    if (store.mode === "supabase" && !(await store.getUser())) throw new HttpError(401, "Connectez-vous d'abord");
    const body = z.object({ token: z.string().min(16).max(64), display_name: z.string().trim().min(1, "Prénom requis").max(40) }).parse(await request.json());
    const restaurantId = await store.acceptInvite(body.token, body.display_name);
    return NextResponse.json({ restaurant_id: restaurantId });
  } catch (error) {
    return handleError(error);
  }
}

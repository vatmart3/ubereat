import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/data";
import { handleError, HttpError, requireActor } from "@/lib/api";
import { SITE_URL } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    if (actor.role !== "owner") throw new HttpError(403, "Réservé au propriétaire");
    const { role } = z.object({ role: z.enum(["owner", "staff"]).default("staff") }).parse(await request.json().catch(() => ({})));
    const token = await getStore().createInvite(actor, role);
    const origin = request.headers.get("origin") ?? SITE_URL;
    return NextResponse.json({ token, url: `${origin}/invite/${token}` }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/data";
import { handleError, requireActor } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await params;
    const { pin } = z.object({ pin: z.string().regex(/^\d{4}$/, "Le PIN doit comporter 4 chiffres") }).parse(await request.json());
    if (/^(\d)\1{3}$/.test(pin)) return NextResponse.json({ error: "PIN trop facile à deviner (0000, 1111…)" }, { status: 400 });
    await getStore().setPin(actor, id, pin);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

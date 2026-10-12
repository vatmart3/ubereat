import { NextResponse } from "next/server";
import { getStore } from "@/lib/data";
import { handleError, requireActor } from "@/lib/api";
import { sealRequestSchema } from "@/lib/seal/schema";
import { sealHandover } from "@/lib/seal/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const body = sealRequestSchema.parse(await request.json());
    const result = await sealHandover(getStore(), actor, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

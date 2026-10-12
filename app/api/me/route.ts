import { NextResponse } from "next/server";
import { handleError, requireActor } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireActor();
    return NextResponse.json({ member_id: actor.memberId, display_name: actor.displayName, role: actor.role, restaurant_id: actor.restaurant.id });
  } catch (error) {
    return handleError(error);
  }
}

import { NextResponse } from "next/server";
import { getStore } from "@/lib/data";

export const runtime = "nodejs";

/** « Verrouiller » : on quitte la session et on revient à l'écran PIN du comptoir. */
export async function POST(request: Request) {
  await getStore().signOut();
  return NextResponse.redirect(new URL("/comptoir", request.url), { status: 303 });
}

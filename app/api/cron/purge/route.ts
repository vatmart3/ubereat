import { NextResponse } from "next/server";
import { getStore } from "@/lib/data";
import { handleError, HttpError } from "@/lib/api";

export const runtime = "nodejs";

/** Purge RGPD planifiée (Vercel Cron, chaque nuit). Protégée par CRON_SECRET. */
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Non autorisé");
    const result = await getStore().purgeExpired();
    return NextResponse.json({ purged: result.handovers, files: result.paths.length });
  } catch (error) {
    return handleError(error);
  }
}

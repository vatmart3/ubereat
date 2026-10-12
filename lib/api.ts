import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getStore } from "./data";
import type { Actor } from "./types";
import { SealError } from "./seal/server";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireActor(): Promise<Actor> {
  const actor = await getStore().getActor();
  if (!actor) throw new HttpError(401, "Session expirée : reconnectez-vous au comptoir.");
  return actor;
}

export function handleError(error: unknown) {
  if (error instanceof HttpError || error instanceof SealError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message ?? "Requête invalide", issues: error.issues }, { status: 400 });
  }
  console.error("[remis]", error);
  const message = error instanceof Error && error.message.startsWith("REMIS:") ? error.message.replace(/^REMIS:\s*/, "") : "Erreur serveur";
  return NextResponse.json({ error: message }, { status: 500 });
}

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

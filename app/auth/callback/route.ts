import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStore } from "@/lib/data";
import { signValue } from "@/lib/security";
import { DEVICE_COOKIE } from "@/lib/data/cookies";

export const runtime = "nodejs";

/** Retour du lien magique : on ouvre la session puis on rattache ce téléphone au restaurant. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/app";
  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?erreur=lien", url));
  }
  const actor = await getStore().getActor();
  if (!actor) return NextResponse.redirect(new URL(safeNext.startsWith("/invite/") ? safeNext : "/onboarding", url));
  const response = NextResponse.redirect(new URL(safeNext, url));
  response.cookies.set(DEVICE_COOKIE, signValue(actor.restaurant.id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365, secure: url.protocol === "https:" });
  return response;
}

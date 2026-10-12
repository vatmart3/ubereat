import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isDemoMode } from "@/lib/env";
import { DEVICE_COOKIE } from "@/lib/data/cookies";

export async function middleware(request: NextRequest) {
  if (isDemoMode()) return NextResponse.next();

  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  if (!user && (pathname.startsWith("/app") || pathname.startsWith("/onboarding"))) {
    const url = request.nextUrl.clone();
    // Téléphone de comptoir déjà rattaché → écran PIN ; sinon → connexion par e-mail.
    url.pathname = request.cookies.get(DEVICE_COOKIE) ? "/comptoir" : "/login";
    url.search = pathname === "/app" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/onboarding", "/invite/:path*", "/comptoir", "/auth/:path*"],
};

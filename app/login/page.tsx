import type { Metadata } from "next";
import Link from "next/link";
import { isDemoMode } from "@/lib/env";
import { AuthFrame } from "@/components/auth/auth-frame";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/app";
  return (
    <AuthFrame kicker="Espace restaurant" title="Connexion">
      {isDemoMode() ? (
        <div className="space-y-3">
          <p className="text-[16px] text-muted">Aucun Supabase configuré : l&apos;app tourne en mode démo, avec le restaurant « La Cantine du Passage » et 6 remises.</p>
          <Link href="/comptoir" className="inline-flex h-16 w-full items-center justify-center rounded-[3px] bg-ink text-lg font-semibold text-bg">
            Entrer dans la démo
          </Link>
        </div>
      ) : (
        <>
          <LoginForm next={safeNext} />
          <p className="mt-6 text-[14px] text-muted">
            Pas encore d&apos;espace ? Connectez-vous avec votre e-mail : la création du restaurant prend 30 secondes.
          </p>
        </>
      )}
    </AuthFrame>
  );
}

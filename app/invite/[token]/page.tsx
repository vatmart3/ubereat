import type { Metadata } from "next";
import Link from "next/link";
import { getStore } from "@/lib/data";
import { AuthFrame } from "@/components/auth/auth-frame";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const store = getStore();
  const invite = await store.getInvite(token);
  if (!invite || !invite.valid) {
    return (
      <AuthFrame kicker="Invitation" title="Lien expiré">
        <p className="text-[16px] text-muted">Ce lien d&apos;invitation n&apos;est plus valable. Demandez-en un nouveau au gérant.</p>
      </AuthFrame>
    );
  }
  const user = store.mode === "supabase" ? await store.getUser() : { id: "demo" };
  return (
    <AuthFrame kicker={`Invitation · ${invite.role === "owner" ? "propriétaire" : "équipier"}`} title={invite.restaurant_name}>
      {user ? (
        <OnboardingForm mode="join" inviteToken={token} />
      ) : (
        <div className="space-y-3">
          <p className="text-[16px] text-muted">Connectez-vous d&apos;abord avec votre e-mail, vous reviendrez ici automatiquement.</p>
          <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="inline-flex h-16 w-full items-center justify-center rounded-[3px] bg-ink text-lg font-semibold text-bg">
            Se connecter
          </Link>
        </div>
      )}
    </AuthFrame>
  );
}

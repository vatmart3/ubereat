import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/data";
import { AuthFrame } from "@/components/auth/auth-frame";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export const metadata: Metadata = { title: "Créer mon espace", robots: { index: false } };

export default async function OnboardingPage() {
  const store = getStore();
  if (store.mode === "supabase" && !(await store.getUser())) redirect("/login");
  return (
    <AuthFrame kicker="Création en 30 secondes" title="Votre restaurant">
      <OnboardingForm mode="create" />
      <p className="mt-6 text-[13px] text-muted">14 jours d&apos;essai gratuit, sans carte bancaire. Vos preuves sont conservées 90 jours par défaut (modifiable).</p>
    </AuthFrame>
  );
}

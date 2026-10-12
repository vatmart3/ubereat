import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/data";
import { getDeviceRestaurantId } from "@/lib/device";
import { AuthFrame } from "@/components/auth/auth-frame";
import { CounterLogin } from "@/components/auth/counter-login";

export const metadata: Metadata = { title: "Comptoir", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CounterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/app") ? next : "/app";
  const restaurantId = await getDeviceRestaurantId();
  if (!restaurantId) redirect("/login");
  const store = getStore();
  const restaurant = await store.getRestaurant(restaurantId);
  if (!restaurant) redirect("/login");
  const members = (await store.listMembers(restaurantId)).filter((m) => m.has_pin);
  return (
    <AuthFrame kicker={restaurant.name} title="Qui est au comptoir ?">
      {members.length ? (
        <CounterLogin members={members} next={safeNext} />
      ) : (
        <p className="text-[16px] text-muted">Aucun PIN défini pour l&apos;instant. Connectez-vous par e-mail puis définissez votre PIN dans les réglages.</p>
      )}
      <div className="mt-8 border-t border-line pt-4 text-[14px] text-muted">
        {store.mode === "demo" ? <p className="mb-2 font-mono text-[12.5px] text-accent">Démo · Camille : 1234 · Yanis : 2580</p> : null}
        <Link href="/login" className="underline decoration-dotted underline-offset-4">
          Se connecter par e-mail
        </Link>
      </div>
    </AuthFrame>
  );
}

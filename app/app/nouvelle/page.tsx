import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/data";
import { Wizard } from "@/components/wizard/wizard";

export const metadata: Metadata = { title: "Nouvelle remise" };

export default async function NewHandoverPage() {
  const store = getStore();
  const actor = await store.getActor();
  if (!actor) redirect("/comptoir");
  const recent = await store.recentCouriers(actor, 8);
  return (
    <Wizard
      restaurantName={actor.restaurant.name}
      restaurantCity={actor.restaurant.city}
      retentionDays={actor.restaurant.retention_days}
      operatorName={actor.displayName}
      recentCouriers={recent}
    />
  );
}

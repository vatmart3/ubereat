import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/data";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Réglages" };

export default async function SettingsPage() {
  const store = getStore();
  const actor = await store.getActor();
  if (!actor) redirect("/comptoir");
  const members = await store.listMembers(actor.restaurant.id);
  return <SettingsView restaurant={actor.restaurant} members={members} me={actor.memberId} isOwner={actor.role === "owner"} demo={store.mode === "demo"} />;
}

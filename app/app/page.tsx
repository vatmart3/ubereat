import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/data";
import { Registry } from "@/components/registry/registry";

export const metadata: Metadata = { title: "Registre" };

export default async function RegistryPage() {
  const store = getStore();
  const actor = await store.getActor();
  if (!actor) redirect("/comptoir");
  const [items, stats] = await Promise.all([store.listHandovers(actor, 300), store.getStats(actor)]);
  const thumbPaths = items.slice(0, 60).flatMap((h) => (h.thumb_path ? [h.thumb_path] : []));
  const thumbs = await store.fileUrls(thumbPaths);
  return <Registry items={items} stats={stats} thumbs={thumbs} now={new Date().toISOString()} />;
}

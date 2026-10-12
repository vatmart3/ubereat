import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/data";
import { HandoverDetail } from "@/components/handover/handover-detail";

export const metadata: Metadata = { title: "Fiche remise" };

export default async function HandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  const actor = await store.getActor();
  if (!actor) redirect("/comptoir");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const h = await store.getHandover(actor, id);
  if (!h) notFound();
  const courierPaths = h.events.filter((e) => e.type === "courier_photo").map((e) => String((e.payload as { storage_path?: string }).storage_path ?? ""));
  const urls = await store.fileUrls([...h.photos.map((p) => p.storage_path), ...(h.signature_path ? [h.signature_path] : []), ...courierPaths.filter(Boolean)]);
  return <HandoverDetail h={h} urls={urls} restaurant={actor.restaurant} />;
}

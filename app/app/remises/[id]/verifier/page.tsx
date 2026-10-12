import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/data";
import { VerifyView } from "@/components/handover/verify-view";

export const metadata: Metadata = { title: "Vérifier la preuve" };

export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  const actor = await store.getActor();
  if (!actor) redirect("/comptoir");
  const h = await store.getHandover(actor, id);
  if (!h) notFound();
  return <VerifyView id={h.id} orderRef={h.order_ref} />;
}

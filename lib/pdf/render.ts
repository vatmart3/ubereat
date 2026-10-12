import "server-only";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DataStore } from "../data/store";
import type { HandoverDetail, Restaurant } from "../types";
import { DossierDocument, type DossierImages } from "./dossier";

export async function renderDossierPdf(store: DataStore, h: HandoverDetail, restaurant: Pick<Restaurant, "name" | "city" | "address">, receiptUrl: string | null) {
  const images: DossierImages = { photos: {}, signature: null, courier: [] };
  for (const p of h.photos) {
    const bytes = await store.getFile(p.storage_path);
    images.photos[p.slot] = bytes ? Buffer.from(bytes) : null;
  }
  if (h.signature_path) {
    const sig = await store.getFile(h.signature_path);
    images.signature = sig ? Buffer.from(sig) : null;
  }
  for (const e of h.events.filter((ev) => ev.type === "courier_photo")) {
    const payload = e.payload as { storage_path?: string; captured_at?: string };
    if (!payload.storage_path) continue;
    const bytes = await store.getFile(payload.storage_path);
    if (bytes) images.courier.push({ buffer: Buffer.from(bytes), captured_at: payload.captured_at ?? e.created_at });
  }
  const element = createElement(DossierDocument, { h, restaurant, images, receiptUrl, generatedAt: new Date().toISOString() });
  return renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
}

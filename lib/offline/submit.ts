"use client";
import { parseEuros } from "../format";
import { processPhoto } from "../image/stamp";
import type { Slot } from "../types";
import type { Draft, DraftPhoto, SealResult } from "./types";

/** Erreur réseau (ou serveur indisponible) : la remise part en file d'attente. */
export class NetworkError extends Error {}
/** Refus métier (4xx) : à afficher, inutile de réessayer tel quel. */
export class RejectedError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request(input: string, init: RequestInit): Promise<Response> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new NetworkError("Hors ligne");
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    throw new NetworkError("Réseau indisponible");
  }
  if (res.status >= 500 || res.status === 408 || res.status === 429) throw new NetworkError(`Serveur indisponible (${res.status})`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new RejectedError(body.error ?? `Erreur ${res.status}`, res.status);
  }
  return res;
}

async function upload(draftId: string, kind: "photo" | "orig" | "thumb" | "signature", blob: Blob, slot?: Slot) {
  const form = new FormData();
  form.set("handover_id", draftId);
  form.set("kind", kind);
  if (slot) form.set("slot", slot);
  form.set("file", blob, kind === "signature" ? "signature.png" : `${slot}-${kind}.jpg`);
  await request("/api/uploads", { method: "POST", body: form });
}

/** Upload en tâche de fond juste après la prise de vue (le scellé n'aura plus qu'à vérifier). */
export async function uploadPhoto(draftId: string, photo: DraftPhoto): Promise<DraftPhoto["uploaded"]> {
  const done = { ...photo.uploaded };
  if (!done.photo) {
    await upload(draftId, "photo", photo.stamped, photo.slot);
    done.photo = true;
  }
  if (!done.orig) {
    await upload(draftId, "orig", photo.original, photo.slot);
    done.orig = true;
  }
  if (!done.thumb) {
    await upload(draftId, "thumb", photo.thumb, photo.slot);
    done.thumb = true;
  }
  return done;
}

/**
 * Envoie une remise complète : re-tamponne si le n° a changé, upload ce qui manque, puis scelle.
 * Le `client_captured_at` est l'heure de l'appui « sceller » ; le `sealed_at` serveur fait foi.
 */
export async function submitDraft(
  draft: Draft,
  opts: { restaurantName: string; clientCapturedAt: string; offline: boolean; geo?: { lat: number; lng: number; accuracy?: number } | null; onProgress?: (label: string) => void },
): Promise<SealResult> {
  const slots = Object.keys(draft.photos) as Slot[];
  for (const slot of slots) {
    let photo = draft.photos[slot]!;
    if (photo.stampRef !== draft.order_ref) {
      opts.onProgress?.("Mise à jour du bandeau…");
      const redone = await processPhoto(photo.original, { orderRef: draft.order_ref, restaurantName: opts.restaurantName, capturedAt: new Date(photo.captured_at), alreadyProcessed: true });
      photo = { ...photo, stamped: redone.stamped, thumb: redone.thumb, stampRef: draft.order_ref, uploaded: { photo: false, orig: photo.uploaded.orig, thumb: false } };
      draft.photos[slot] = photo;
    }
    opts.onProgress?.("Envoi des photos…");
    photo.uploaded = await uploadPhoto(draft.id, photo);
  }
  if (draft.signature) {
    opts.onProgress?.("Envoi de la signature…");
    await upload(draft.id, "signature", draft.signature);
  }
  opts.onProgress?.("Scellé…");
  const res = await request("/api/handovers/seal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: draft.id,
      order_ref: draft.order_ref,
      platform: draft.platform,
      amount_cents: parseEuros(draft.amount),
      items_count: draft.items_count,
      courier_name: draft.courier_name,
      vehicle: draft.vehicle,
      pickup_code: draft.pickup_code.trim() || null,
      client_captured_at: opts.clientCapturedAt,
      offline: opts.offline,
      geo: opts.geo ?? null,
      photos: slots.map((slot) => ({ slot, captured_at: draft.photos[slot]!.captured_at })),
      has_signature: Boolean(draft.signature),
      confirm_closed: draft.confirm_closed,
    }),
  });
  return (await res.json()) as SealResult;
}

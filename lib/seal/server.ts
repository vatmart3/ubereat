import "server-only";
import { computeSealHash, sha256Hex } from "./canonical";
import { getTimestampProvider } from "./timestamp";
import type { SealRequest } from "./schema";
import { isJpeg, isPng, jpegSize } from "../image/inspect";
import { normalizeCourierName, normalizeOrderRef } from "../format";
import { randomToken } from "../security";
import type { DataStore, SealRecord } from "../data/store";
import type { Actor, HandoverDetail } from "../types";

export class SealError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Arborescence imposée par le serveur : le client ne choisit jamais un chemin de preuve. */
export const proofPaths = (restaurantId: string, handoverId: string) => {
  const base = `${restaurantId}/${handoverId}`;
  return {
    base,
    photo: (slot: string) => `${base}/${slot}.jpg`,
    original: (slot: string) => `${base}/${slot}.orig.jpg`,
    thumb: (slot: string) => `${base}/${slot}.thumb.jpg`,
    signature: `${base}/signature.png`,
    courier: (n: number) => `${base}/livreur-${n}.jpg`,
  };
};

const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const MAX_OFFLINE_AGE_MS = 7 * 86_400_000;

/**
 * Scellé serveur :
 *  1. relit chaque fichier déjà uploadé et recalcule son SHA-256,
 *  2. fixe sealed_at avec l'horloge serveur (TimestampProvider),
 *  3. calcule l'empreinte sur la chaîne canonique,
 *  4. insère tout en une transaction (+ événement seal + reçu livreur).
 */
export async function sealHandover(store: DataStore, actor: Actor, req: SealRequest) {
  const now = Date.now();
  const captured = new Date(req.client_captured_at).getTime();
  if (captured > now + MAX_CLOCK_SKEW_MS) throw new SealError("Horloge du téléphone en avance : vérifiez l'heure de l'appareil.");
  if (captured < now - MAX_OFFLINE_AGE_MS) throw new SealError("Remise hors ligne trop ancienne (plus de 7 jours).");

  const slots = req.photos.map((p) => p.slot);
  if (new Set(slots).size !== slots.length) throw new SealError("Emplacement photo en double.");

  if (await store.handoverExists(req.id)) throw new SealError("Cette remise est déjà scellée.", 409);

  const paths = proofPaths(actor.restaurant.id, req.id);
  const photos: SealRecord["photos"] = [];
  for (const p of req.photos) {
    const stamped = await store.getFile(paths.photo(p.slot));
    if (!stamped || !isJpeg(stamped)) throw new SealError(`Photo « ${p.slot} » manquante : renvoi nécessaire.`, 422);
    const size = jpegSize(stamped);
    if (!size) throw new SealError(`Photo « ${p.slot} » illisible.`, 422);
    const original = await store.getFile(paths.original(p.slot));
    photos.push({
      slot: p.slot,
      storage_path: paths.photo(p.slot),
      sha256: await sha256Hex(stamped),
      original_path: original ? paths.original(p.slot) : null,
      original_sha256: original ? await sha256Hex(original) : null,
      captured_at: new Date(Math.min(new Date(p.captured_at).getTime(), now)).toISOString(),
      width: size.width,
      height: size.height,
    });
  }

  let signaturePath: string | null = null;
  let signatureSha: string | null = null;
  if (req.has_signature) {
    const sig = await store.getFile(paths.signature);
    if (!sig || !isPng(sig)) throw new SealError("Signature manquante : renvoi nécessaire.", 422);
    signaturePath = paths.signature;
    signatureSha = await sha256Hex(sig);
  }

  const provider = getTimestampProvider();
  const sealedAt = await provider.now();
  const orderRef = normalizeOrderRef(req.order_ref);
  const courierName = normalizeCourierName(req.courier_name) || req.courier_name.trim();
  const pickupCode = req.pickup_code?.trim() || null;

  const { hash } = await computeSealHash({
    id: req.id,
    restaurant_id: actor.restaurant.id,
    order_ref: orderRef,
    platform: req.platform,
    amount_cents: req.amount_cents,
    items_count: req.items_count,
    courier_name: courierName,
    vehicle: req.vehicle,
    pickup_code: pickupCode,
    sealed_at: sealedAt,
    photos,
    signature_sha256: signatureSha,
  });
  const attestation = await provider.attest(hash);

  const record: SealRecord = {
    id: req.id,
    restaurant_id: actor.restaurant.id,
    order_ref: orderRef,
    platform: req.platform,
    amount_cents: req.amount_cents,
    items_count: req.items_count,
    courier_name: courierName,
    vehicle: req.vehicle,
    pickup_code: pickupCode,
    signature_path: signaturePath,
    signature_sha256: signatureSha,
    sealed_at: sealedAt.toISOString(),
    client_captured_at: new Date(captured).toISOString(),
    sealed_by: actor.userId,
    sealed_by_name: actor.displayName,
    hash_sha256: hash,
    timestamp_provider: attestation.provider,
    timestamp_token: attestation.token,
    geo: req.geo,
    offline: req.offline,
    public_token: randomToken(32),
    photos,
  };

  const result = await store.seal(record);
  return { ...result, sealed_at: record.sealed_at, hash_sha256: hash, order_ref: orderRef, courier_name: courierName };
}

export interface VerificationReport {
  stored_hash: string;
  recomputed_hash: string;
  record_ok: boolean;
  files: { label: string; path: string; stored: string | null; actual: string | null; ok: boolean }[];
  intact: boolean;
  canonical: string;
  checked_at: string;
}

/** Recalcule l'empreinte à partir de la base ET des fichiers réellement présents dans le stockage. */
export async function verifyHandover(store: DataStore, h: HandoverDetail): Promise<VerificationReport> {
  const files: VerificationReport["files"] = [];
  for (const p of h.photos) {
    const bytes = await store.getFile(p.storage_path);
    const actual = bytes ? await sha256Hex(bytes) : null;
    files.push({ label: `Photo ${p.slot}`, path: p.storage_path, stored: p.sha256, actual, ok: actual === p.sha256 });
    if (p.original_path) {
      const orig = await store.getFile(p.original_path);
      const origSha = orig ? await sha256Hex(orig) : null;
      files.push({ label: `Original ${p.slot}`, path: p.original_path, stored: p.original_sha256, actual: origSha, ok: origSha === p.original_sha256 });
    }
  }
  if (h.signature_path) {
    const sig = await store.getFile(h.signature_path);
    const actual = sig ? await sha256Hex(sig) : null;
    files.push({ label: "Signature", path: h.signature_path, stored: h.signature_sha256, actual, ok: actual === h.signature_sha256 });
  }

  // On recalcule avec les empreintes RÉELLES des fichiers : un fichier remplacé change l'empreinte globale.
  const actualByPath = new Map(files.map((f) => [f.path, f.actual]));
  const { canonical, hash } = await computeSealHash({
    id: h.id,
    restaurant_id: h.restaurant_id,
    order_ref: h.order_ref,
    platform: h.platform,
    amount_cents: h.amount_cents,
    items_count: h.items_count,
    courier_name: h.courier_name_snapshot,
    vehicle: h.vehicle,
    pickup_code: h.pickup_code,
    sealed_at: h.sealed_at,
    photos: h.photos.map((p) => ({
      slot: p.slot,
      sha256: actualByPath.get(p.storage_path) ?? "0".repeat(64),
      original_sha256: p.original_path ? (actualByPath.get(p.original_path) ?? "0".repeat(64)) : null,
    })),
    signature_sha256: h.signature_path ? (actualByPath.get(h.signature_path) ?? "0".repeat(64)) : null,
  });

  const record_ok = hash === h.hash_sha256;
  return {
    stored_hash: h.hash_sha256,
    recomputed_hash: hash,
    record_ok,
    files,
    intact: record_ok && files.every((f) => f.ok),
    canonical,
    checked_at: new Date().toISOString(),
  };
}

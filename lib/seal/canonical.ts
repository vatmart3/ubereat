/**
 * Chaîne canonique d'une remise scellée.
 *
 * L'empreinte `hash_sha256` est le SHA-256 (hex) de `canonicalJson(canonicalRecord(...))`.
 * La même fonction tourne côté serveur (scellé, vérification) et côté navigateur
 * (vérification indépendante, démo « Simuler une fraude ») grâce à WebCrypto.
 *
 * Toute évolution du format doit incrémenter `v` et conserver l'ancien calcul.
 */

export const CANONICAL_VERSION = 1 as const;

const SLOT_ORDER = ["sac", "ticket", "remise"] as const;

export interface CanonicalPhotoInput {
  slot: string;
  sha256: string;
  original_sha256?: string | null;
}

export interface CanonicalInput {
  id: string;
  restaurant_id: string;
  order_ref: string;
  platform: string;
  amount_cents: number | null;
  items_count: number;
  courier_name: string;
  vehicle: string;
  pickup_code: string | null;
  sealed_at: string | Date;
  photos: CanonicalPhotoInput[];
  signature_sha256: string | null;
}

export interface CanonicalRecord {
  v: typeof CANONICAL_VERSION;
  id: string;
  restaurant_id: string;
  order_ref: string;
  platform: string;
  amount_cents: number | null;
  items_count: number;
  courier: string;
  vehicle: string;
  pickup_code: string | null;
  sealed_at: string;
  photos: { slot: string; sha256: string; original_sha256: string | null }[];
  signature_sha256: string | null;
}

/** Normalise un horodatage au format ISO 8601 UTC à la milliseconde (stable entre JS et Postgres). */
export function canonicalTimestamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Horodatage invalide: ${String(value)}`);
  return date.toISOString();
}

export function canonicalRecord(input: CanonicalInput): CanonicalRecord {
  const photos = [...input.photos]
    .map((p) => ({ slot: p.slot, sha256: p.sha256.toLowerCase(), original_sha256: p.original_sha256?.toLowerCase() ?? null }))
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot as never) - SLOT_ORDER.indexOf(b.slot as never));
  return {
    v: CANONICAL_VERSION,
    id: input.id,
    restaurant_id: input.restaurant_id,
    order_ref: input.order_ref,
    platform: input.platform,
    amount_cents: input.amount_cents ?? null,
    items_count: input.items_count,
    courier: input.courier_name,
    vehicle: input.vehicle,
    pickup_code: input.pickup_code && input.pickup_code.length > 0 ? input.pickup_code : null,
    sealed_at: canonicalTimestamp(input.sealed_at),
    photos,
    signature_sha256: input.signature_sha256?.toLowerCase() ?? null,
  };
}

/** JSON à clés triées récursivement, sans espaces. `undefined` devient `null`. */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Nombre non fini dans la chaîne canonique");
    return JSON.stringify(value);
  }
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
    return `{${entries.join(",")}}`;
  }
  throw new Error(`Type non canonisable: ${typeof value}`);
}

export async function sha256Hex(data: string | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function computeSealHash(input: CanonicalInput): Promise<{ canonical: string; hash: string }> {
  const canonical = canonicalJson(canonicalRecord(input));
  return { canonical, hash: await sha256Hex(canonical) };
}

/** Construit l'entrée canonique à partir d'une remise stockée. */
export function canonicalInputFromHandover(h: {
  id: string;
  restaurant_id: string;
  order_ref: string;
  platform: string;
  amount_cents: number | null;
  items_count: number;
  courier_name_snapshot: string;
  vehicle: string;
  pickup_code: string | null;
  sealed_at: string;
  signature_sha256: string | null;
  photos: CanonicalPhotoInput[];
}): CanonicalInput {
  return {
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
    photos: h.photos,
    signature_sha256: h.signature_sha256,
  };
}

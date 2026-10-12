/**
 * Restaurant de démo : 6 remises (dont 1 en litige, 1 résolue), 2 membres, 4 livreurs récents.
 * Partagé par le mode démo (mémoire) et le script de seed Supabase (scripts/seed.ts).
 * Imports relatifs uniquement : exécutable par Node sans résolution d'alias.
 */
import { computeSealHash, sha256Hex } from "../seal/canonical";
import { decodeJpeg, downscale, encodeJpeg, stampBand } from "../image/server-stamp";
import { formatDate, formatTime } from "../format";
import type { Platform, Slot, Vehicle } from "../types";

export const DEMO_RESTAURANT = {
  id: "6c1f6f4e-2a1b-4c7e-9d2a-5e8b7a3c1d01",
  name: "La Cantine du Passage",
  city: "Lyon",
  address: "12 rue du Passage, 69002 Lyon",
  slug: "la-cantine-du-passage-demo",
  retention_days: 90,
};

export const DEMO_MEMBERS = [
  { id: "6c1f6f4e-2a1b-4c7e-9d2a-5e8b7a3c1e01", user_id: "6c1f6f4e-2a1b-4c7e-9d2a-5e8b7a3c1f01", email: "camille@demo.remis.app", role: "owner" as const, display_name: "Camille", pin: "1234" },
  { id: "6c1f6f4e-2a1b-4c7e-9d2a-5e8b7a3c1e02", user_id: "6c1f6f4e-2a1b-4c7e-9d2a-5e8b7a3c1f02", email: "yanis@demo.remis.app", role: "staff" as const, display_name: "Yanis", pin: "2580" },
];

interface SeedSpec {
  id: string;
  minutesAgo: number;
  order_ref: string;
  platform: Platform;
  amount_cents: number;
  items_count: number;
  courier: string;
  vehicle: Vehicle;
  pickup_code: string | null;
  photos: { slot: Slot; asset: string }[];
  signature: string | null;
  sealedBy: 0 | 1;
  events?: { type: "litige_open" | "note" | "resolve"; minutesAfter: number; payload: Record<string, unknown>; by: 0 | 1 }[];
}

const SPECS: SeedSpec[] = [
  {
    id: "7a2e0c1d-0001-4b6a-9c11-0d5c1e2f3a01", minutesAgo: 12, order_ref: "UB-4821", platform: "uber", amount_cents: 2450,
    items_count: 3, courier: "Karim B.", vehicle: "scooter", pickup_code: "4821",
    photos: [{ slot: "sac", asset: "sac-a" }, { slot: "remise", asset: "remise" }], signature: "signature-a", sealedBy: 0,
  },
  {
    id: "7a2e0c1d-0002-4b6a-9c11-0d5c1e2f3a02", minutesAgo: 48, order_ref: "DR-0937", platform: "deliveroo", amount_cents: 1890,
    items_count: 2, courier: "Léa M.", vehicle: "velo", pickup_code: "0937",
    photos: [{ slot: "sac", asset: "sac-b" }, { slot: "ticket", asset: "ticket" }], signature: "signature-b", sealedBy: 1,
  },
  {
    id: "7a2e0c1d-0003-4b6a-9c11-0d5c1e2f3a03", minutesAgo: 131, order_ref: "JE-5512", platform: "justeat", amount_cents: 2200,
    items_count: 3, courier: "Samir T.", vehicle: "voiture", pickup_code: null,
    photos: [{ slot: "sac", asset: "sac-a" }, { slot: "ticket", asset: "ticket" }], signature: "signature-a", sealedBy: 0,
    events: [
      { type: "litige_open", minutesAfter: 55, by: 0, payload: { reason: "non_recu", note: "Le client affirme ne rien avoir reçu. Just Eat demande une preuve sous 48 h." } },
    ],
  },
  {
    id: "7a2e0c1d-0004-4b6a-9c11-0d5c1e2f3a04", minutesAgo: 60 * 20 + 14, order_ref: "D-118", platform: "direct", amount_cents: 3600,
    items_count: 4, courier: "Inès R.", vehicle: "pied", pickup_code: null,
    photos: [{ slot: "sac", asset: "sac-b" }], signature: null, sealedBy: 1,
  },
  {
    id: "7a2e0c1d-0005-4b6a-9c11-0d5c1e2f3a05", minutesAgo: 60 * 21 + 30, order_ref: "UB-4710", platform: "uber", amount_cents: 1550,
    items_count: 1, courier: "Karim B.", vehicle: "scooter", pickup_code: "4710",
    photos: [{ slot: "sac", asset: "sac-a" }, { slot: "ticket", asset: "ticket" }, { slot: "remise", asset: "remise" }], signature: "signature-a", sealedBy: 0,
    events: [
      { type: "litige_open", minutesAfter: 90, by: 0, payload: { reason: "article_manquant", note: "Boisson manquante selon le client." } },
      { type: "resolve", minutesAfter: 600, by: 0, payload: { note: "Uber Eats a clôturé en faveur du restaurant après envoi du dossier." } },
    ],
  },
  {
    id: "7a2e0c1d-0006-4b6a-9c11-0d5c1e2f3a06", minutesAgo: 60 * 24 * 3 + 95, order_ref: "DR-0811", platform: "deliveroo", amount_cents: 2980,
    items_count: 2, courier: "Léa M.", vehicle: "velo", pickup_code: "0811",
    photos: [{ slot: "sac", asset: "sac-b" }], signature: "signature-b", sealedBy: 1,
  },
];

export interface PreparedFile {
  path: string;
  bytes: Uint8Array;
  contentType: string;
}

export interface PreparedSeedHandover {
  record: {
    id: string;
    restaurant_id: string;
    order_ref: string;
    platform: Platform;
    amount_cents: number;
    items_count: number;
    courier_name: string;
    vehicle: Vehicle;
    pickup_code: string | null;
    signature_path: string | null;
    signature_sha256: string | null;
    sealed_at: string;
    client_captured_at: string;
    sealed_by: string;
    sealed_by_name: string;
    hash_sha256: string;
    public_token: string;
    photos: {
      slot: Slot;
      storage_path: string;
      sha256: string;
      original_path: string;
      original_sha256: string;
      captured_at: string;
      width: number;
      height: number;
    }[];
  };
  files: PreparedFile[];
  events: { type: "litige_open" | "note" | "resolve"; payload: Record<string, unknown>; actor: string; created_at: string }[];
}

function fromBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

export async function prepareDemoSeed(assets: Record<string, string>, now: Date = new Date()): Promise<PreparedSeedHandover[]> {
  const out: PreparedSeedHandover[] = [];
  const decoded = new Map<string, ReturnType<typeof decodeJpeg>>();
  const raw = (name: string) => {
    let img = decoded.get(name);
    if (!img) {
      img = decodeJpeg(fromBase64(assets[name]!));
      decoded.set(name, img);
    }
    return img;
  };

  for (const [index, spec] of SPECS.entries()) {
    const sealedAt = new Date(now.getTime() - spec.minutesAgo * 60_000);
    sealedAt.setMilliseconds(0);
    const base = `${DEMO_RESTAURANT.id}/${spec.id}`;
    const files: PreparedFile[] = [];
    const photos: PreparedSeedHandover["record"]["photos"] = [];

    for (const [pIndex, p] of spec.photos.entries()) {
      const capturedAt = new Date(sealedAt.getTime() - (50 - pIndex * 12) * 1000);
      const original = raw(p.asset);
      const originalBytes = encodeJpeg(original, 80);
      const stamped = stampBand(original, [
        `${formatTime(capturedAt)} · ${formatDate(capturedAt)}`,
        `#${spec.order_ref} · ${DEMO_RESTAURANT.name}`,
      ]);
      const stampedBytes = encodeJpeg(stamped, 80);
      const thumbBytes = encodeJpeg(downscale(stamped, 240), 70);
      files.push(
        { path: `${base}/${p.slot}.jpg`, bytes: stampedBytes, contentType: "image/jpeg" },
        { path: `${base}/${p.slot}.orig.jpg`, bytes: originalBytes, contentType: "image/jpeg" },
        { path: `${base}/${p.slot}.thumb.jpg`, bytes: thumbBytes, contentType: "image/jpeg" },
      );
      photos.push({
        slot: p.slot,
        storage_path: `${base}/${p.slot}.jpg`,
        sha256: await sha256Hex(stampedBytes),
        original_path: `${base}/${p.slot}.orig.jpg`,
        original_sha256: await sha256Hex(originalBytes),
        captured_at: capturedAt.toISOString(),
        width: stamped.width,
        height: stamped.height,
      });
    }

    let signaturePath: string | null = null;
    let signatureSha: string | null = null;
    if (spec.signature) {
      const bytes = fromBase64(assets[spec.signature]!);
      signaturePath = `${base}/signature.png`;
      signatureSha = await sha256Hex(bytes);
      files.push({ path: signaturePath, bytes, contentType: "image/png" });
    }

    const member = DEMO_MEMBERS[spec.sealedBy]!;
    const { hash } = await computeSealHash({
      id: spec.id,
      restaurant_id: DEMO_RESTAURANT.id,
      order_ref: spec.order_ref,
      platform: spec.platform,
      amount_cents: spec.amount_cents,
      items_count: spec.items_count,
      courier_name: spec.courier,
      vehicle: spec.vehicle,
      pickup_code: spec.pickup_code,
      sealed_at: sealedAt,
      photos,
      signature_sha256: signatureSha,
    });

    out.push({
      record: {
        id: spec.id,
        restaurant_id: DEMO_RESTAURANT.id,
        order_ref: spec.order_ref,
        platform: spec.platform,
        amount_cents: spec.amount_cents,
        items_count: spec.items_count,
        courier_name: spec.courier,
        vehicle: spec.vehicle,
        pickup_code: spec.pickup_code,
        signature_path: signaturePath,
        signature_sha256: signatureSha,
        sealed_at: sealedAt.toISOString(),
        client_captured_at: new Date(sealedAt.getTime() - 4000).toISOString(),
        sealed_by: member.user_id,
        sealed_by_name: member.display_name,
        hash_sha256: hash,
        // Jetons déterministes pour la démo (reçus livreur ouvrables directement).
        public_token: `demo${String(index + 1).padStart(2, "0")}${"x".repeat(26)}`,
        photos,
      },
      files,
      events: (spec.events ?? []).map((e) => ({
        type: e.type,
        payload: e.payload,
        actor: DEMO_MEMBERS[e.by]!.user_id,
        created_at: new Date(sealedAt.getTime() + e.minutesAfter * 60_000).toISOString(),
      })),
    });
  }
  return out;
}

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { proofPaths, SealError, sealHandover, verifyHandover } from "@/lib/seal/server";
import type { DataStore, SealRecord } from "@/lib/data/store";
import type { Actor, HandoverDetail } from "@/lib/types";
import { buildDossierText } from "@/lib/dossier";
import { jpegSize } from "@/lib/image/inspect";

const JPEG = new Uint8Array(readFileSync("supabase/seed-assets/sac-a.jpg"));
const PNG = new Uint8Array(readFileSync("supabase/seed-assets/signature-a.png"));

const actor: Actor = {
  userId: "11111111-1111-4111-8111-111111111111",
  memberId: "22222222-2222-4222-8222-222222222222",
  displayName: "Camille",
  role: "owner",
  restaurant: { id: "33333333-3333-4333-8333-333333333333", name: "La Cantine", city: "Lyon", address: null, slug: "la-cantine", logo_url: null, retention_days: 90, created_at: "2026-01-01T00:00:00Z" },
};

/** Faux store minimal : fichiers + remises en mémoire. */
class FakeStore {
  files = new Map<string, Uint8Array>();
  sealed = new Map<string, SealRecord>();
  async handoverExists(id: string) {
    return this.sealed.has(id);
  }
  async getFile(path: string) {
    return this.files.get(path) ?? null;
  }
  async seal(r: SealRecord) {
    this.sealed.set(r.id, r);
    return { id: r.id, public_token: r.public_token };
  }
  detail(id: string): HandoverDetail {
    const r = this.sealed.get(id)!;
    return {
      id: r.id, restaurant_id: r.restaurant_id, order_ref: r.order_ref, platform: r.platform, amount_cents: r.amount_cents,
      items_count: r.items_count, courier_id: null, courier_name_snapshot: r.courier_name, vehicle: r.vehicle, pickup_code: r.pickup_code,
      signature_path: r.signature_path, signature_sha256: r.signature_sha256, sealed_at: r.sealed_at, client_captured_at: r.client_captured_at,
      sealed_by: r.sealed_by, sealed_by_name: r.sealed_by_name, hash_sha256: r.hash_sha256, timestamp_provider: r.timestamp_provider,
      timestamp_token: null, status: "remis", geo: null, created_at: r.sealed_at,
      photos: r.photos.map((p, i) => ({ id: String(i), ...p })),
      events: [{ id: "e1", handover_id: r.id, type: "seal", payload: {}, actor: r.sealed_by, actor_name: "Camille", created_at: r.sealed_at }],
      receipt: { public_token: r.public_token, expires_at: r.sealed_at },
    };
  }
}

const id = "44444444-4444-4444-8444-444444444444";
const request = () => ({
  id,
  order_ref: " #ub-4821 ",
  platform: "uber" as const,
  amount_cents: 2450,
  items_count: 3,
  courier_name: "karim bensaïd",
  vehicle: "scooter" as const,
  pickup_code: "4821",
  client_captured_at: new Date().toISOString(),
  offline: false,
  geo: null,
  photos: [{ slot: "sac" as const, captured_at: new Date().toISOString() }],
  has_signature: true,
  confirm_closed: true as const,
});

let store: FakeStore;
const paths = proofPaths(actor.restaurant.id, id);
beforeEach(() => {
  store = new FakeStore();
  store.files.set(paths.photo("sac"), JPEG);
  store.files.set(paths.original("sac"), JPEG.slice());
  store.files.set(paths.signature, PNG);
});

describe("scellé serveur", () => {
  it("scelle avec l'heure serveur, recalcule les empreintes et normalise la saisie", async () => {
    const before = Date.now();
    const res = await sealHandover(store as unknown as DataStore, actor, { ...request(), client_captured_at: new Date(before - 60_000).toISOString() });
    const rec = store.sealed.get(id)!;
    expect(rec.order_ref).toBe("UB-4821");
    expect(rec.courier_name).toBe("Karim B.");
    expect(new Date(rec.sealed_at).getTime()).toBeGreaterThanOrEqual(before);
    expect(rec.client_captured_at).not.toBe(rec.sealed_at);
    expect(rec.photos[0]!.width).toBe(jpegSize(JPEG)!.width);
    expect(rec.photos[0]!.storage_path).toBe(`${actor.restaurant.id}/${id}/sac.jpg`);
    expect(res.public_token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(res.hash_sha256).toBe(rec.hash_sha256);
  });

  it("refuse un double scellé, une photo manquante, une horloge client en avance", async () => {
    await sealHandover(store as unknown as DataStore, actor, request());
    await expect(sealHandover(store as unknown as DataStore, actor, request())).rejects.toThrow(SealError);

    const s2 = new FakeStore();
    await expect(sealHandover(s2 as unknown as DataStore, actor, request())).rejects.toThrow(/manquante/);

    const s3 = new FakeStore();
    s3.files = new Map(store.files);
    await expect(
      sealHandover(s3 as unknown as DataStore, actor, { ...request(), client_captured_at: new Date(Date.now() + 3_600_000).toISOString() }),
    ).rejects.toThrow(/Horloge/);
  });
});

describe("vérification", () => {
  it("« intacte » sur une vraie remise", async () => {
    await sealHandover(store as unknown as DataStore, actor, request());
    const report = await verifyHandover(store as unknown as DataStore, store.detail(id));
    expect(report.intact).toBe(true);
    expect(report.recomputed_hash).toBe(report.stored_hash);
    expect(report.files.every((f) => f.ok)).toBe(true);
  });

  it("« modifiée » si une donnée change (montant + 1 €)", async () => {
    await sealHandover(store as unknown as DataStore, actor, request());
    const forged = { ...store.detail(id), amount_cents: 2550 };
    const report = await verifyHandover(store as unknown as DataStore, forged);
    expect(report.intact).toBe(false);
    expect(report.record_ok).toBe(false);
  });

  it("« modifiée » si un fichier est remplacé dans le stockage", async () => {
    await sealHandover(store as unknown as DataStore, actor, request());
    const tampered = JPEG.slice();
    tampered[tampered.length - 10] = (tampered[tampered.length - 10] ?? 0) ^ 0xff;
    store.files.set(paths.photo("sac"), tampered);
    const report = await verifyHandover(store as unknown as DataStore, store.detail(id));
    expect(report.intact).toBe(false);
    expect(report.files.find((f) => f.label === "Photo sac")?.ok).toBe(false);
  });
});

describe("dossier de litige", () => {
  it("contient photos, heure serveur, livreur, empreinte et historique — sans promesse juridique", async () => {
    await sealHandover(store as unknown as DataStore, actor, request());
    const h = store.detail(id);
    h.events.push({ id: "e2", handover_id: id, type: "litige_open", payload: { reason: "non_recu", note: "Client absent" }, actor: actor.userId, actor_name: "Camille", created_at: new Date().toISOString() });
    const text = buildDossierText(h, actor.restaurant, "https://remis.app/r/abc");
    expect(text).toContain("#UB-4821");
    expect(text).toContain("Karim B.");
    expect(text).toContain("horodatage serveur");
    expect(text).toContain(h.hash_sha256);
    expect(text).toContain("Sac fermé");
    expect(text).toContain("Client « non reçu »");
    expect(text).toContain("Historique");
    expect(text).not.toMatch(/incontestable/i);
  });
});

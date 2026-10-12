import { describe, expect, it } from "vitest";
import { canonicalJson, canonicalRecord, canonicalTimestamp, computeSealHash, sha256Hex, type CanonicalInput } from "@/lib/seal/canonical";

const base: CanonicalInput = {
  id: "7a2e0c1d-0001-4b6a-9c11-0d5c1e2f3a01",
  restaurant_id: "6c1f6f4e-2a1b-4c7e-9d2a-5e8b7a3c1d01",
  order_ref: "UB-4821",
  platform: "uber",
  amount_cents: 2450,
  items_count: 3,
  courier_name: "Karim B.",
  vehicle: "scooter",
  pickup_code: "4821",
  sealed_at: "2026-10-12T12:32:07.000Z",
  photos: [
    { slot: "remise", sha256: "b".repeat(64), original_sha256: "d".repeat(64) },
    { slot: "sac", sha256: "a".repeat(64), original_sha256: "c".repeat(64) },
  ],
  signature_sha256: "e".repeat(64),
};

describe("chaîne canonique", () => {
  it("trie les clés récursivement, sans espaces", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })).toBe('{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}');
  });

  it("transforme undefined en null et refuse les nombres non finis", () => {
    expect(canonicalJson({ a: undefined })).toBe('{"a":null}');
    expect(() => canonicalJson({ a: Number.NaN })).toThrow();
  });

  it("normalise l'heure : le format Postgres et le format JS donnent la même chaîne", () => {
    expect(canonicalTimestamp("2026-10-12 12:32:07+00")).toBe("2026-10-12T12:32:07.000Z");
    expect(canonicalTimestamp("2026-10-12T14:32:07.000+02:00")).toBe("2026-10-12T12:32:07.000Z");
    expect(() => canonicalTimestamp("pas une date")).toThrow();
  });

  it("ordonne les photos par emplacement (sac, ticket, remise) quel que soit l'ordre reçu", () => {
    const rec = canonicalRecord(base);
    expect(rec.photos.map((p) => p.slot)).toEqual(["sac", "remise"]);
    expect(rec.v).toBe(1);
    expect(rec.courier).toBe("Karim B.");
  });

  it("un code de retrait vide devient null", () => {
    expect(canonicalRecord({ ...base, pickup_code: "" }).pickup_code).toBeNull();
  });
});

describe("empreinte SHA-256", () => {
  it("connaît le vecteur de test standard", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("est déterministe", async () => {
    const a = await computeSealHash(base);
    const b = await computeSealHash({ ...base, photos: [...base.photos].reverse() });
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ["montant + 1 €", { amount_cents: 2550 }],
    ["n° de commande", { order_ref: "UB-4822" }],
    ["heure serveur + 1 ms", { sealed_at: "2026-10-12T12:32:07.001Z" }],
    ["livreur", { courier_name: "Karim C." }],
    ["signature", { signature_sha256: "f".repeat(64) }],
    ["photo remplacée", { photos: [{ slot: "sac", sha256: "0".repeat(64), original_sha256: "c".repeat(64) }, base.photos[0]!] }],
  ])("change si on modifie : %s", async (_label, patch) => {
    const original = await computeSealHash(base);
    const forged = await computeSealHash({ ...base, ...patch } as CanonicalInput);
    expect(forged.hash).not.toBe(original.hash);
  });
});

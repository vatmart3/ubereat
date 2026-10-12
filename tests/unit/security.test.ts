import { describe, expect, it } from "vitest";
import { hashPin, isValidPin, randomToken, signValue, verifyPin, verifySigned } from "@/lib/security";

describe("PIN équipe", () => {
  it("hache et vérifie (scrypt + sel)", async () => {
    const h1 = await hashPin("2580");
    const h2 = await hashPin("2580");
    expect(h1).not.toBe(h2);
    expect(h1).not.toContain("2580");
    expect(await verifyPin("2580", h1)).toBe(true);
    expect(await verifyPin("2581", h1)).toBe(false);
    expect(await verifyPin("2580", null)).toBe(false);
  });

  it("n'accepte que 4 chiffres", async () => {
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
    await expect(hashPin("12345")).rejects.toThrow();
  });
});

describe("jetons et cookies signés", () => {
  it("jeton de reçu : 32 caractères URL-safe, uniques", () => {
    const t = randomToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(new Set(Array.from({ length: 200 }, () => randomToken())).size).toBe(200);
  });

  it("détecte un cookie falsifié", () => {
    const signed = signValue("restaurant-123");
    expect(verifySigned(signed)).toBe("restaurant-123");
    expect(verifySigned(signed.replace("123", "456"))).toBeNull();
    expect(verifySigned("restaurant-123")).toBeNull();
    expect(verifySigned(undefined)).toBeNull();
  });
});

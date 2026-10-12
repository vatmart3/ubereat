import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
export { hashPin, isValidPin, verifyPin } from "./pin";

const URL_SAFE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Jeton aléatoire URL-safe (32 caractères = 192 bits). */
export function randomToken(length = 32): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += URL_SAFE[bytes[i]! & 63];
  return out;
}

function secret(): string {
  const value = process.env.REMIS_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("REMIS_SECRET (32 caractères minimum) est requis en production.");
  }
  return "remis-demo-secret-ne-pas-utiliser-en-production";
}

/** Valeur signée HMAC pour les cookies (appareil comptoir, opérateur démo). */
export function signValue(value: string): string {
  const mac = createHmac("sha256", secret()).update(value).digest("base64url");
  return `${value}.${mac}`;
}

export function verifySigned(signed: string | undefined | null): string | null {
  if (!signed) return null;
  const idx = signed.lastIndexOf(".");
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  const expected = Buffer.from(signValue(value).slice(idx + 1));
  const given = Buffer.from(signed.slice(idx + 1));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return value;
}

export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 5;

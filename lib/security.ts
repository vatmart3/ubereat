import "server-only";
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pwd: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>;

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

const PIN_PARAMS = { N: 16384, r: 8, p: 1 };

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) throw new Error("Le code PIN doit comporter 4 chiffres.");
  const salt = randomBytes(16);
  const hash = await scrypt(pin, salt, 32, PIN_PARAMS);
  return `scrypt$${PIN_PARAMS.N}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPin(pin: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored || !isValidPin(pin)) return false;
  const [algo, n, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !n || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = await scrypt(pin, Buffer.from(saltB64, "base64url"), expected.length, { ...PIN_PARAMS, N: Number(n) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 5;

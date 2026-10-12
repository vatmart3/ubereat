/** Hachage des PIN équipe (scrypt + sel). Sans "server-only" : utilisé aussi par le script de seed. */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pwd: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>;

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


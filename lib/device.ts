import "server-only";
import { cookies } from "next/headers";
import { DEVICE_COOKIE } from "./data/cookies";
import { verifySigned } from "./security";
import { isDemoMode } from "./env";
import { DEMO_RESTAURANT } from "./data/seed";

/** Restaurant auquel ce téléphone de comptoir est rattaché (cookie signé). */
export async function getDeviceRestaurantId(): Promise<string | null> {
  const jar = await cookies();
  const value = verifySigned(jar.get(DEVICE_COOKIE)?.value);
  if (value) return value;
  return isDemoMode() ? DEMO_RESTAURANT.id : null;
}

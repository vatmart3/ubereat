import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../env";

let admin: ReturnType<typeof createClient> | null = null;

/** Client service_role : uniquement côté serveur, pour le scellé, le PIN et la purge. */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant.");
  admin ??= createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

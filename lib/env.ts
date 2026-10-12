export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Sans Supabase configuré, l'app tourne en mode démo (données en mémoire, restaurant de démo pré-rempli). */
export const isDemoMode = (): boolean => !SUPABASE_URL || !SUPABASE_ANON_KEY;

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const PROOFS_BUCKET = "proofs";

import "server-only";
import { isDemoMode } from "../env";
import type { DataStore } from "./store";
import { MemoryStore } from "./memory-store";
import { SupabaseStore } from "./supabase-store";

let instance: DataStore | null = null;

export function getStore(): DataStore {
  instance ??= isDemoMode() ? new MemoryStore() : new SupabaseStore();
  return instance;
}

export type { DataStore, SealRecord } from "./store";

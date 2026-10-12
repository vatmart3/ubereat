import type {
  Actor,
  Courier,
  EventType,
  HandoverDetail,
  HandoverListItem,
  Member,
  Platform,
  ReceiptView,
  RegistryStats,
  Restaurant,
  Role,
  Slot,
  Vehicle,
} from "../types";

export interface SealRecord {
  id: string;
  restaurant_id: string;
  order_ref: string;
  platform: Platform;
  amount_cents: number | null;
  items_count: number;
  courier_name: string;
  vehicle: Vehicle;
  pickup_code: string | null;
  signature_path: string | null;
  signature_sha256: string | null;
  sealed_at: string;
  client_captured_at: string | null;
  sealed_by: string;
  sealed_by_name: string;
  hash_sha256: string;
  timestamp_provider: string;
  timestamp_token: string | null;
  geo: { lat: number; lng: number; accuracy?: number } | null;
  offline: boolean;
  public_token: string;
  photos: {
    slot: Slot;
    storage_path: string;
    sha256: string;
    original_path: string | null;
    original_sha256: string | null;
    captured_at: string;
    width: number;
    height: number;
  }[];
}

export type PinCheck =
  | { ok: true; member: Member }
  | { ok: false; reason: "invalid"; remaining: number }
  | { ok: false; reason: "locked"; until: string }
  | { ok: false; reason: "no_pin" };

export interface InviteInfo {
  restaurant_name: string;
  role: Role;
  valid: boolean;
}

export interface DataStore {
  readonly mode: "supabase" | "demo";

  /** Utilisateur authentifié (avec ou sans restaurant). */
  getUser(): Promise<{ id: string; email: string | null } | null>;
  /** Opérateur courant avec son restaurant, ou null. */
  getActor(): Promise<Actor | null>;

  listHandovers(actor: Actor, limit?: number): Promise<HandoverListItem[]>;
  getHandover(actor: Actor, id: string): Promise<HandoverDetail | null>;
  getStats(actor: Actor): Promise<RegistryStats>;
  recentCouriers(actor: Actor, limit?: number): Promise<Courier[]>;

  /** Accès serveur (sans RLS) — à n'utiliser qu'après contrôle d'appartenance. */
  handoverExists(id: string): Promise<boolean>;
  putFile(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  getFile(path: string): Promise<Uint8Array | null>;
  /** URLs d'affichage (signées en mode Supabase). */
  fileUrls(paths: string[], opts?: { receiptToken?: string }): Promise<Record<string, string>>;

  seal(record: SealRecord): Promise<{ id: string; public_token: string }>;
  recordEvent(actor: Actor, handoverId: string, type: Exclude<EventType, "seal" | "courier_photo">, payload: Record<string, unknown>): Promise<void>;

  getReceipt(token: string): Promise<ReceiptView | null>;
  addCourierPhoto(token: string, path: string, sha256: string, capturedAt: string): Promise<void>;

  getRestaurant(id: string): Promise<Restaurant | null>;
  listMembers(restaurantId: string): Promise<Member[]>;
  createRestaurant(name: string, city: string, displayName: string): Promise<string>;
  updateRestaurant(actor: Actor, patch: Partial<Pick<Restaurant, "name" | "city" | "address" | "retention_days">>): Promise<void>;
  createInvite(actor: Actor, role: Role): Promise<string>;
  getInvite(token: string): Promise<InviteInfo | null>;
  acceptInvite(token: string, displayName: string): Promise<string>;
  setPin(actor: Actor, memberId: string, pin: string): Promise<void>;
  checkPin(restaurantId: string, memberId: string, pin: string): Promise<PinCheck>;
  /** Bascule la session sur ce membre (connexion rapide au comptoir). */
  signInAs(member: Member): Promise<void>;
  signOut(): Promise<void>;

  purgeExpired(): Promise<{ handovers: number; paths: string[] }>;
}

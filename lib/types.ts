export type Platform = "uber" | "deliveroo" | "justeat" | "direct";
export type Vehicle = "velo" | "scooter" | "voiture" | "pied";
export type Slot = "sac" | "ticket" | "remise";
export type HandoverStatus = "remis" | "litige" | "resolu";
export type EventType = "seal" | "litige_open" | "note" | "export" | "resolve" | "courier_photo";
export type Role = "owner" | "staff";

export const PLATFORMS: readonly Platform[] = ["uber", "deliveroo", "justeat", "direct"];
export const VEHICLES: readonly Vehicle[] = ["velo", "scooter", "voiture", "pied"];
export const SLOTS: readonly Slot[] = ["sac", "ticket", "remise"];

export interface Restaurant {
  id: string;
  name: string;
  city: string;
  address: string | null;
  slug: string;
  logo_url: string | null;
  retention_days: number;
  created_at: string;
}

export interface Member {
  id: string;
  restaurant_id: string;
  user_id: string;
  role: Role;
  display_name: string;
  has_pin: boolean;
}

export interface Courier {
  id: string;
  display_name: string;
  vehicle: Vehicle;
  last_code: string | null;
  last_seen_at: string;
}

export interface HandoverPhoto {
  id: string;
  slot: Slot;
  storage_path: string;
  sha256: string;
  original_path: string | null;
  original_sha256: string | null;
  captured_at: string;
  width: number;
  height: number;
}

export interface Handover {
  id: string;
  restaurant_id: string;
  order_ref: string;
  platform: Platform;
  amount_cents: number | null;
  items_count: number;
  courier_id: string | null;
  courier_name_snapshot: string;
  vehicle: Vehicle;
  pickup_code: string | null;
  signature_path: string | null;
  signature_sha256: string | null;
  sealed_at: string;
  client_captured_at: string | null;
  sealed_by: string | null;
  sealed_by_name: string | null;
  hash_sha256: string;
  timestamp_provider: string;
  timestamp_token: string | null;
  status: HandoverStatus;
  geo: { lat: number; lng: number; accuracy?: number } | null;
  created_at: string;
}

export interface HandoverEvent {
  id: string;
  handover_id: string;
  type: EventType;
  payload: Record<string, unknown>;
  actor: string;
  actor_name: string | null;
  created_at: string;
}

export interface HandoverListItem extends Handover {
  thumb_path: string | null;
  photo_count: number;
}

export interface HandoverDetail extends Handover {
  photos: HandoverPhoto[];
  events: HandoverEvent[];
  receipt: { public_token: string; expires_at: string } | null;
}

export interface RegistryStats {
  today_count: number;
  today_amount_cents: number;
  open_disputes: number;
}

export interface ReceiptView {
  token: string;
  expires_at: string;
  restaurant: { name: string; city: string };
  handover: Pick<
    Handover,
    | "id"
    | "restaurant_id"
    | "order_ref"
    | "platform"
    | "amount_cents"
    | "items_count"
    | "vehicle"
    | "pickup_code"
    | "signature_path"
    | "signature_sha256"
    | "sealed_at"
    | "hash_sha256"
    | "status"
  > & { courier_name: string };
  photos: Pick<HandoverPhoto, "slot" | "storage_path" | "sha256" | "original_sha256" | "captured_at" | "width" | "height">[];
  courier_events: { type: "courier_photo"; payload: { storage_path: string; sha256: string; captured_at: string }; created_at: string }[];
}

/** Opérateur courant : un membre authentifié, rattaché à un restaurant. */
export interface Actor {
  userId: string;
  memberId: string;
  displayName: string;
  role: Role;
  restaurant: Restaurant;
}

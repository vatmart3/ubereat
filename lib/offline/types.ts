import type { Platform, Slot, Vehicle } from "../types";

export interface DraftPhoto {
  slot: Slot;
  original: Blob;
  stamped: Blob;
  thumb: Blob;
  captured_at: string;
  width: number;
  height: number;
  /** N° de commande incrusté dans le bandeau (re-tamponné si le n° change avant scellé). */
  stampRef: string;
  uploaded: { photo: boolean; orig: boolean; thumb: boolean };
}

export interface Draft {
  id: string;
  step: number;
  platform: Platform | null;
  order_ref: string;
  amount: string;
  items_count: number;
  photos: Partial<Record<Slot, DraftPhoto>>;
  courier_name: string;
  vehicle: Vehicle | null;
  pickup_code: string;
  signature: Blob | null;
  confirm_closed: boolean;
  started_at: string;
  updated_at: string;
}

export interface QueuedHandover {
  id: string;
  draft: Draft;
  client_captured_at: string;
  queued_at: string;
  attempts: number;
  last_error: string | null;
}

export interface SealResult {
  id: string;
  public_token: string;
  sealed_at: string;
  hash_sha256: string;
  order_ref: string;
  courier_name: string;
}

import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { hashPin, PIN_LOCK_MINUTES, PIN_MAX_ATTEMPTS, randomToken, signValue, verifySigned, verifyPin } from "../security";
import { dayKey } from "../format";
import { DEMO_ASSETS } from "./demo-assets";
import { DEMO_MEMBERS, DEMO_RESTAURANT, prepareDemoSeed } from "./seed";
import type { DataStore, InviteInfo, PinCheck, SealRecord } from "./store";
import { DEMO_MEMBER_COOKIE, DEVICE_COOKIE } from "./cookies";
import type {
  Actor,
  Courier,
  Handover,
  HandoverDetail,
  HandoverEvent,
  HandoverListItem,
  HandoverPhoto,
  HandoverStatus,
  Member,
  ReceiptView,
  RegistryStats,
  Restaurant,
  Role,
} from "../types";

/**
 * Mode démo : tout vit en mémoire du process serveur (réinitialisé au redémarrage).
 * Il applique les mêmes règles que la base : remises immuables hors `status`,
 * journal en ajout seul, transitions de statut contrôlées.
 */

interface MemberRow extends Member {
  email: string;
  pin_hash: string | null;
  pin_failed_count: number;
  pin_locked_until: string | null;
}

interface State {
  restaurants: Map<string, Restaurant>;
  members: Map<string, MemberRow>;
  couriers: Map<string, Courier & { restaurant_id: string }>;
  handovers: Map<string, Handover>;
  photos: Map<string, HandoverPhoto[]>;
  events: HandoverEvent[];
  receipts: Map<string, { handover_id: string; expires_at: string }>;
  invites: Map<string, { restaurant_id: string; role: Role; expires_at: string; used_at: string | null }>;
  files: Map<string, { bytes: Uint8Array; contentType: string }>;
}


const globalState = globalThis as unknown as { __remisMemory?: Promise<State> };

async function createState(): Promise<State> {
  const state: State = {
    restaurants: new Map(),
    members: new Map(),
    couriers: new Map(),
    handovers: new Map(),
    photos: new Map(),
    events: [],
    receipts: new Map(),
    invites: new Map(),
    files: new Map(),
  };
  state.restaurants.set(DEMO_RESTAURANT.id, { ...DEMO_RESTAURANT, logo_url: null, created_at: new Date(Date.now() - 30 * 86_400_000).toISOString() });
  for (const m of DEMO_MEMBERS) {
    state.members.set(m.id, {
      id: m.id,
      restaurant_id: DEMO_RESTAURANT.id,
      user_id: m.user_id,
      role: m.role,
      display_name: m.display_name,
      has_pin: true,
      email: m.email,
      pin_hash: await hashPin(m.pin),
      pin_failed_count: 0,
      pin_locked_until: null,
    });
  }

  const prepared = await prepareDemoSeed(DEMO_ASSETS);
  // Les plus anciennes d'abord : les livreurs récents gardent le dernier passage.
  for (const item of [...prepared].reverse()) {
    for (const f of item.files) state.files.set(f.path, { bytes: f.bytes, contentType: f.contentType });
    insertSealed(state, { ...item.record, timestamp_provider: "server", timestamp_token: null, geo: null, offline: false });
    for (const e of item.events) {
      state.events.push({ id: randomUUID(), handover_id: item.record.id, type: e.type, payload: e.payload, actor: e.actor, actor_name: null, created_at: e.created_at });
      applyStatus(state, item.record.id, e.type);
    }
  }
  return state;
}

function insertSealed(state: State, r: SealRecord) {
  if (state.handovers.has(r.id)) throw new Error("REMIS: remise déjà scellée (id en double)");
  const nameKey = r.courier_name.toLowerCase();
  let courier = [...state.couriers.values()].find((c) => c.restaurant_id === r.restaurant_id && c.display_name.toLowerCase() === nameKey);
  if (!courier) {
    courier = { id: randomUUID(), restaurant_id: r.restaurant_id, display_name: r.courier_name, vehicle: r.vehicle, last_code: r.pickup_code, last_seen_at: r.sealed_at };
    state.couriers.set(courier.id, courier);
  } else {
    courier.vehicle = r.vehicle;
    courier.last_code = r.pickup_code ?? courier.last_code;
    courier.last_seen_at = r.sealed_at > courier.last_seen_at ? r.sealed_at : courier.last_seen_at;
  }
  const handover: Handover = Object.freeze({
    id: r.id,
    restaurant_id: r.restaurant_id,
    order_ref: r.order_ref,
    platform: r.platform,
    amount_cents: r.amount_cents,
    items_count: r.items_count,
    courier_id: courier.id,
    courier_name_snapshot: r.courier_name,
    vehicle: r.vehicle,
    pickup_code: r.pickup_code,
    signature_path: r.signature_path,
    signature_sha256: r.signature_sha256,
    sealed_at: r.sealed_at,
    client_captured_at: r.client_captured_at,
    sealed_by: r.sealed_by,
    sealed_by_name: r.sealed_by_name,
    hash_sha256: r.hash_sha256,
    timestamp_provider: r.timestamp_provider,
    timestamp_token: r.timestamp_token,
    status: "remis" as HandoverStatus,
    geo: r.geo,
    created_at: r.sealed_at,
  });
  state.handovers.set(r.id, handover);
  state.photos.set(
    r.id,
    r.photos.map((p) => Object.freeze({ id: randomUUID(), ...p })),
  );
  state.events.push({
    id: randomUUID(),
    handover_id: r.id,
    type: "seal",
    payload: { hash: r.hash_sha256, sealed_at: r.sealed_at, client_captured_at: r.client_captured_at, offline: r.offline, timestamp_provider: r.timestamp_provider },
    actor: r.sealed_by,
    actor_name: null,
    created_at: r.sealed_at,
  });
  const restaurant = state.restaurants.get(r.restaurant_id);
  const expires = new Date(new Date(r.sealed_at).getTime() + (restaurant?.retention_days ?? 90) * 86_400_000).toISOString();
  state.receipts.set(r.public_token, { handover_id: r.id, expires_at: expires });
}

/** Seule mutation autorisée sur une remise : le statut, selon les mêmes transitions que le trigger SQL. */
function applyStatus(state: State, id: string, type: string) {
  const h = state.handovers.get(id);
  if (!h) return;
  let next: HandoverStatus | null = null;
  if (type === "litige_open" && h.status !== "litige") next = "litige";
  if (type === "resolve" && h.status === "litige") next = "resolu";
  if (next) state.handovers.set(id, Object.freeze({ ...h, status: next }));
}

function state(): Promise<State> {
  globalState.__remisMemory ??= createState();
  return globalState.__remisMemory;
}

const toMember = (m: MemberRow): Member => ({
  id: m.id,
  restaurant_id: m.restaurant_id,
  user_id: m.user_id,
  role: m.role,
  display_name: m.display_name,
  has_pin: Boolean(m.pin_hash),
});

function actorName(s: State, userId: string): string | null {
  if (userId === "livreur") return "Livreur";
  return [...s.members.values()].find((m) => m.user_id === userId)?.display_name ?? null;
}

export class MemoryStore implements DataStore {
  readonly mode = "demo" as const;

  private async currentMember(s: State): Promise<MemberRow | null> {
    const jar = await cookies();
    const raw = jar.get(DEMO_MEMBER_COOKIE)?.value;
    if (!raw) return s.members.get(DEMO_MEMBERS[0]!.id) ?? null;
    const value = verifySigned(raw);
    if (!value || value === "none") return null;
    return s.members.get(value) ?? null;
  }

  async getUser() {
    const s = await state();
    const m = await this.currentMember(s);
    return m ? { id: m.user_id, email: m.email } : null;
  }

  async getActor(): Promise<Actor | null> {
    const s = await state();
    const m = await this.currentMember(s);
    if (!m) return null;
    const restaurant = s.restaurants.get(m.restaurant_id);
    if (!restaurant) return null;
    return { userId: m.user_id, memberId: m.id, displayName: m.display_name, role: m.role, restaurant };
  }

  async listHandovers(actor: Actor, limit = 300): Promise<HandoverListItem[]> {
    const s = await state();
    return [...s.handovers.values()]
      .filter((h) => h.restaurant_id === actor.restaurant.id)
      .sort((a, b) => b.sealed_at.localeCompare(a.sealed_at))
      .slice(0, limit)
      .map((h) => {
        const photos = s.photos.get(h.id) ?? [];
        const first = photos[0];
        return { ...h, photo_count: photos.length, thumb_path: first ? first.storage_path.replace(/\.jpg$/, ".thumb.jpg") : null };
      });
  }

  async getHandover(actor: Actor, id: string): Promise<HandoverDetail | null> {
    const s = await state();
    const h = s.handovers.get(id);
    if (!h || h.restaurant_id !== actor.restaurant.id) return null;
    const receipt = [...s.receipts.entries()].find(([, r]) => r.handover_id === id);
    return {
      ...h,
      photos: [...(s.photos.get(id) ?? [])],
      events: s.events
        .filter((e) => e.handover_id === id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((e) => ({ ...e, actor_name: actorName(s, e.actor) })),
      receipt: receipt ? { public_token: receipt[0], expires_at: receipt[1].expires_at } : null,
    };
  }

  async getStats(actor: Actor): Promise<RegistryStats> {
    const s = await state();
    const today = dayKey(new Date());
    let today_count = 0;
    let today_amount_cents = 0;
    let open_disputes = 0;
    for (const h of s.handovers.values()) {
      if (h.restaurant_id !== actor.restaurant.id) continue;
      if (dayKey(h.sealed_at) === today) {
        today_count++;
        today_amount_cents += h.amount_cents ?? 0;
      }
      if (h.status === "litige") open_disputes++;
    }
    return { today_count, today_amount_cents, open_disputes };
  }

  async recentCouriers(actor: Actor, limit = 8): Promise<Courier[]> {
    const s = await state();
    return [...s.couriers.values()]
      .filter((c) => c.restaurant_id === actor.restaurant.id)
      .sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at))
      .slice(0, limit)
      .map(({ restaurant_id: _r, ...c }) => c);
  }

  async handoverExists(id: string) {
    return (await state()).handovers.has(id);
  }

  async putFile(path: string, bytes: Uint8Array, contentType: string) {
    (await state()).files.set(path, { bytes, contentType });
  }

  async getFile(path: string) {
    return (await state()).files.get(path)?.bytes ?? null;
  }

  async fileUrls(paths: string[], opts?: { receiptToken?: string }) {
    const suffix = opts?.receiptToken ? `?r=${encodeURIComponent(opts.receiptToken)}` : "";
    return Object.fromEntries(paths.map((p) => [p, `/api/files/${p}${suffix}`]));
  }

  async seal(record: SealRecord) {
    const s = await state();
    const isMember = [...s.members.values()].some((m) => m.user_id === record.sealed_by && m.restaurant_id === record.restaurant_id);
    if (!isMember) throw new Error("REMIS: le scelleur n'est pas membre du restaurant");
    insertSealed(s, record);
    return { id: record.id, public_token: record.public_token };
  }

  async recordEvent(actor: Actor, handoverId: string, type: "litige_open" | "note" | "export" | "resolve", payload: Record<string, unknown>) {
    const s = await state();
    const h = s.handovers.get(handoverId);
    if (!h || h.restaurant_id !== actor.restaurant.id) throw new Error("Remise introuvable");
    s.events.push({ id: randomUUID(), handover_id: handoverId, type, payload, actor: actor.userId, actor_name: null, created_at: new Date().toISOString() });
    applyStatus(s, handoverId, type);
  }

  async getReceipt(token: string): Promise<ReceiptView | null> {
    const s = await state();
    const r = s.receipts.get(token);
    if (!r || r.expires_at < new Date().toISOString()) return null;
    const h = s.handovers.get(r.handover_id);
    if (!h) return null;
    const restaurant = s.restaurants.get(h.restaurant_id)!;
    return {
      token,
      expires_at: r.expires_at,
      restaurant: { name: restaurant.name, city: restaurant.city },
      handover: {
        id: h.id,
        restaurant_id: h.restaurant_id,
        order_ref: h.order_ref,
        platform: h.platform,
        amount_cents: h.amount_cents,
        items_count: h.items_count,
        courier_name: h.courier_name_snapshot,
        vehicle: h.vehicle,
        pickup_code: h.pickup_code,
        signature_path: h.signature_path,
        signature_sha256: h.signature_sha256,
        sealed_at: h.sealed_at,
        hash_sha256: h.hash_sha256,
        status: h.status,
      },
      photos: (s.photos.get(h.id) ?? []).map(({ slot, storage_path, sha256, original_sha256, captured_at, width, height }) => ({
        slot, storage_path, sha256, original_sha256, captured_at, width, height,
      })),
      courier_events: s.events
        .filter((e) => e.handover_id === h.id && e.type === "courier_photo")
        .map((e) => ({ type: "courier_photo" as const, payload: e.payload as ReceiptView["courier_events"][number]["payload"], created_at: e.created_at })),
    };
  }

  async addCourierPhoto(token: string, path: string, sha256: string, capturedAt: string) {
    const s = await state();
    const r = s.receipts.get(token);
    if (!r) throw new Error("Reçu introuvable");
    const count = s.events.filter((e) => e.handover_id === r.handover_id && e.type === "courier_photo").length;
    if (count >= 3) throw new Error("REMIS: 3 photos livreur maximum");
    s.events.push({
      id: randomUUID(),
      handover_id: r.handover_id,
      type: "courier_photo",
      payload: { storage_path: path, sha256, captured_at: capturedAt },
      actor: "livreur",
      actor_name: null,
      created_at: new Date().toISOString(),
    });
  }

  async getRestaurant(id: string) {
    return (await state()).restaurants.get(id) ?? null;
  }

  async listMembers(restaurantId: string) {
    const s = await state();
    return [...s.members.values()].filter((m) => m.restaurant_id === restaurantId).map(toMember);
  }

  async createRestaurant(name: string, city: string, displayName: string) {
    const s = await state();
    const id = randomUUID();
    s.restaurants.set(id, {
      id,
      name: name.trim(),
      city: city.trim(),
      address: null,
      slug: `${name}-${city}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-") + "-" + id.slice(0, 6),
      logo_url: null,
      retention_days: 90,
      created_at: new Date().toISOString(),
    });
    const memberId = randomUUID();
    s.members.set(memberId, {
      id: memberId,
      restaurant_id: id,
      user_id: randomUUID(),
      role: "owner",
      display_name: displayName.trim() || "Gérant",
      has_pin: false,
      email: `${memberId.slice(0, 8)}@demo.remis.app`,
      pin_hash: null,
      pin_failed_count: 0,
      pin_locked_until: null,
    });
    await this.signInAs(toMember(s.members.get(memberId)!));
    return id;
  }

  async updateRestaurant(actor: Actor, patch: Partial<Pick<Restaurant, "name" | "city" | "address" | "retention_days">>) {
    if (actor.role !== "owner") throw new Error("Réservé au propriétaire");
    const s = await state();
    const r = s.restaurants.get(actor.restaurant.id)!;
    s.restaurants.set(r.id, { ...r, ...patch });
  }

  async createInvite(actor: Actor, role: Role) {
    if (actor.role !== "owner") throw new Error("Réservé au propriétaire");
    const token = randomToken();
    (await state()).invites.set(token, { restaurant_id: actor.restaurant.id, role, expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(), used_at: null });
    return token;
  }

  async getInvite(token: string): Promise<InviteInfo | null> {
    const s = await state();
    const inv = s.invites.get(token);
    if (!inv) return null;
    const restaurant = s.restaurants.get(inv.restaurant_id);
    return { restaurant_name: restaurant?.name ?? "", role: inv.role, valid: !inv.used_at && inv.expires_at > new Date().toISOString() };
  }

  async acceptInvite(token: string, displayName: string) {
    const s = await state();
    const inv = s.invites.get(token);
    if (!inv || inv.used_at || inv.expires_at < new Date().toISOString()) throw new Error("Invitation invalide ou expirée");
    inv.used_at = new Date().toISOString();
    const memberId = randomUUID();
    const row: MemberRow = {
      id: memberId,
      restaurant_id: inv.restaurant_id,
      user_id: randomUUID(),
      role: inv.role,
      display_name: displayName.trim() || "Équipier",
      has_pin: false,
      email: `${memberId.slice(0, 8)}@demo.remis.app`,
      pin_hash: null,
      pin_failed_count: 0,
      pin_locked_until: null,
    };
    s.members.set(memberId, row);
    await this.signInAs(toMember(row));
    return inv.restaurant_id;
  }

  async setPin(actor: Actor, memberId: string, pin: string) {
    const s = await state();
    const m = s.members.get(memberId);
    if (!m || m.restaurant_id !== actor.restaurant.id) throw new Error("Membre introuvable");
    if (m.id !== actor.memberId && actor.role !== "owner") throw new Error("Réservé au propriétaire");
    m.pin_hash = await hashPin(pin);
    m.has_pin = true;
    m.pin_failed_count = 0;
    m.pin_locked_until = null;
  }

  async checkPin(restaurantId: string, memberId: string, pin: string): Promise<PinCheck> {
    const s = await state();
    const m = s.members.get(memberId);
    if (!m || m.restaurant_id !== restaurantId) return { ok: false, reason: "invalid", remaining: 0 };
    if (!m.pin_hash) return { ok: false, reason: "no_pin" };
    if (m.pin_locked_until && m.pin_locked_until > new Date().toISOString()) return { ok: false, reason: "locked", until: m.pin_locked_until };
    if (await verifyPin(pin, m.pin_hash)) {
      m.pin_failed_count = 0;
      m.pin_locked_until = null;
      return { ok: true, member: toMember(m) };
    }
    m.pin_failed_count += 1;
    if (m.pin_failed_count >= PIN_MAX_ATTEMPTS) {
      m.pin_failed_count = 0;
      m.pin_locked_until = new Date(Date.now() + PIN_LOCK_MINUTES * 60_000).toISOString();
      return { ok: false, reason: "locked", until: m.pin_locked_until };
    }
    return { ok: false, reason: "invalid", remaining: PIN_MAX_ATTEMPTS - m.pin_failed_count };
  }

  async signInAs(member: Member) {
    const jar = await cookies();
    const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30, secure: process.env.NODE_ENV === "production" };
    jar.set(DEMO_MEMBER_COOKIE, signValue(member.id), opts);
    jar.set(DEVICE_COOKIE, signValue(member.restaurant_id), { ...opts, maxAge: 60 * 60 * 24 * 365 });
  }

  async signOut() {
    const jar = await cookies();
    jar.set(DEMO_MEMBER_COOKIE, signValue("none"), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  }

  async purgeExpired() {
    const s = await state();
    const now = Date.now();
    const paths: string[] = [];
    let handovers = 0;
    for (const h of [...s.handovers.values()]) {
      const r = s.restaurants.get(h.restaurant_id);
      if (!r || new Date(h.sealed_at).getTime() >= now - r.retention_days * 86_400_000) continue;
      for (const p of s.photos.get(h.id) ?? []) paths.push(p.storage_path, ...(p.original_path ? [p.original_path] : []));
      if (h.signature_path) paths.push(h.signature_path);
      s.handovers.delete(h.id);
      s.photos.delete(h.id);
      s.events = s.events.filter((e) => e.handover_id !== h.id);
      for (const [t, rc] of s.receipts) if (rc.handover_id === h.id) s.receipts.delete(t);
      handovers++;
    }
    for (const p of paths) s.files.delete(p);
    return { handovers, paths };
  }
}

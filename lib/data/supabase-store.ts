import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerSupabase } from "../supabase/server";
import { supabaseAdmin } from "../supabase/admin";
import { PROOFS_BUCKET } from "../env";
import { hashPin, PIN_LOCK_MINUTES, PIN_MAX_ATTEMPTS, randomToken, signValue, verifyPin } from "../security";
import { startOfDayParis } from "./time";
import type { DataStore, InviteInfo, PinCheck, SealRecord } from "./store";
import { ACTIVE_RESTAURANT_COOKIE, DEVICE_COOKIE } from "./cookies";
import type {
  Actor,
  Courier,
  Handover,
  HandoverDetail,
  HandoverEvent,
  HandoverListItem,
  HandoverPhoto,
  Member,
  ReceiptView,
  RegistryStats,
  Restaurant,
  Role,
} from "../types";


const SIGNED_URL_TTL = 60 * 30;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

const resolveActor = cache(async (): Promise<Actor | null> => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await (supabase as Db)
    .from("memberships")
    .select("id, restaurant_id, role, display_name, restaurants(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error || !data?.length) return null;
  const preferred = (await cookies()).get(ACTIVE_RESTAURANT_COOKIE)?.value;
  const row = data.find((m: any) => m.restaurant_id === preferred) ?? data[0];
  return {
    userId: user.id,
    memberId: row.id,
    displayName: row.display_name,
    role: row.role,
    restaurant: row.restaurants as Restaurant,
  };
});

function normalizeHandover(row: any): Handover {
  return { ...row, sealed_at: new Date(row.sealed_at).toISOString() } as Handover;
}

export class SupabaseStore implements DataStore {
  readonly mode = "supabase" as const;

  async getUser() {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ? { id: user.id, email: user.email ?? null } : null;
  }

  getActor() {
    return resolveActor();
  }

  async listHandovers(actor: Actor, limit = 300): Promise<HandoverListItem[]> {
    const supabase = (await createServerSupabase()) as Db;
    const { data, error } = await supabase
      .from("handovers")
      .select("*, handover_photos(slot, storage_path)")
      .eq("restaurant_id", actor.restaurant.id)
      .order("sealed_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((row: any) => {
      const { handover_photos: photos, ...h } = row;
      const order = ["sac", "ticket", "remise"];
      const first = [...(photos ?? [])].sort((a: any, b: any) => order.indexOf(a.slot) - order.indexOf(b.slot))[0];
      return {
        ...normalizeHandover(h),
        photo_count: photos?.length ?? 0,
        thumb_path: first ? String(first.storage_path).replace(/\.jpg$/, ".thumb.jpg") : null,
      };
    });
  }

  async getHandover(actor: Actor, id: string): Promise<HandoverDetail | null> {
    const supabase = (await createServerSupabase()) as Db;
    const { data: h } = await supabase.from("handovers").select("*").eq("id", id).eq("restaurant_id", actor.restaurant.id).maybeSingle();
    if (!h) return null;
    const [{ data: photos }, { data: events }, { data: receipt }, { data: members }] = await Promise.all([
      supabase.from("handover_photos").select("*").eq("handover_id", id),
      supabase.from("handover_events").select("*").eq("handover_id", id).order("created_at", { ascending: true }),
      supabase.from("courier_receipts").select("public_token, expires_at").eq("handover_id", id).maybeSingle(),
      supabase.from("memberships").select("user_id, display_name").eq("restaurant_id", actor.restaurant.id),
    ]);
    const names = new Map<string, string>((members ?? []).map((m: any) => [m.user_id, m.display_name]));
    return {
      ...normalizeHandover(h),
      photos: (photos ?? []) as HandoverPhoto[],
      events: (events ?? []).map((e: any) => ({ ...e, actor_name: e.actor === "livreur" ? "Livreur" : (names.get(e.actor) ?? null) })) as HandoverEvent[],
      receipt: receipt ?? null,
    };
  }

  async getStats(actor: Actor): Promise<RegistryStats> {
    const supabase = (await createServerSupabase()) as Db;
    const since = startOfDayParis(new Date()).toISOString();
    const [{ data: today }, { count }] = await Promise.all([
      supabase.from("handovers").select("amount_cents").eq("restaurant_id", actor.restaurant.id).gte("sealed_at", since),
      supabase.from("handovers").select("id", { count: "exact", head: true }).eq("restaurant_id", actor.restaurant.id).eq("status", "litige"),
    ]);
    return {
      today_count: today?.length ?? 0,
      today_amount_cents: (today ?? []).reduce((sum: number, r: any) => sum + (r.amount_cents ?? 0), 0),
      open_disputes: count ?? 0,
    };
  }

  async recentCouriers(actor: Actor, limit = 8): Promise<Courier[]> {
    const supabase = (await createServerSupabase()) as Db;
    const { data } = await supabase
      .from("couriers")
      .select("id, display_name, vehicle, last_code, last_seen_at")
      .eq("restaurant_id", actor.restaurant.id)
      .order("last_seen_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as Courier[];
  }

  async handoverExists(id: string) {
    const { count } = await (supabaseAdmin() as Db).from("handovers").select("id", { count: "exact", head: true }).eq("id", id);
    return (count ?? 0) > 0;
  }

  async putFile(path: string, bytes: Uint8Array, contentType: string) {
    // upsert autorisé uniquement avant le scellé : la route d'upload vérifie que la remise n'existe pas encore.
    const { error } = await supabaseAdmin().storage.from(PROOFS_BUCKET).upload(path, bytes, { contentType, upsert: true });
    if (error) throw error;
  }

  async getFile(path: string) {
    const { data, error } = await supabaseAdmin().storage.from(PROOFS_BUCKET).download(path);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  }

  async fileUrls(paths: string[], opts?: { receiptToken?: string }) {
    if (paths.length === 0) return {};
    // Reçu public : le token a déjà été validé par l'appelant → URLs signées via service_role.
    const client = opts?.receiptToken ? supabaseAdmin() : await createServerSupabase();
    const { data } = await client.storage.from(PROOFS_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
    return Object.fromEntries((data ?? []).flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as const] : [])));
  }

  async seal(record: SealRecord) {
    const { data, error } = await (supabaseAdmin() as Db).rpc("seal_handover", { p: record });
    if (error) throw new Error(error.message);
    return { id: data.id as string, public_token: data.public_token as string };
  }

  async recordEvent(_actor: Actor, handoverId: string, type: string, payload: Record<string, unknown>) {
    const supabase = (await createServerSupabase()) as Db;
    const { error } = await supabase.rpc("record_handover_event", { p_handover: handoverId, p_type: type, p_payload: payload });
    if (error) throw new Error(error.message);
  }

  async getReceipt(token: string): Promise<ReceiptView | null> {
    const { data, error } = await (supabaseAdmin() as Db).rpc("get_courier_receipt", { p_token: token });
    if (error || !data) return null;
    return { ...data, handover: { ...data.handover, sealed_at: new Date(data.handover.sealed_at).toISOString() } } as ReceiptView;
  }

  async addCourierPhoto(token: string, path: string, sha256: string, capturedAt: string) {
    const { error } = await (supabaseAdmin() as Db).rpc("add_courier_photo", { p_token: token, p_path: path, p_sha256: sha256, p_captured_at: capturedAt });
    if (error) throw new Error(error.message);
  }

  async getRestaurant(id: string) {
    const { data } = await (supabaseAdmin() as Db).from("restaurants").select("*").eq("id", id).maybeSingle();
    return (data as Restaurant) ?? null;
  }

  async listMembers(restaurantId: string): Promise<Member[]> {
    const { data } = await (supabaseAdmin() as Db)
      .from("memberships")
      .select("id, restaurant_id, user_id, role, display_name, pin_hash")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: true });
    return (data ?? []).map(({ pin_hash, ...m }: any) => ({ ...m, has_pin: Boolean(pin_hash) }));
  }

  async createRestaurant(name: string, city: string, displayName: string) {
    const supabase = (await createServerSupabase()) as Db;
    const { data, error } = await supabase.rpc("create_restaurant", { p_name: name, p_city: city, p_display_name: displayName });
    if (error) throw new Error(error.message);
    await this.rememberRestaurant(data as string);
    return data as string;
  }

  async updateRestaurant(actor: Actor, patch: Partial<Pick<Restaurant, "name" | "city" | "address" | "retention_days">>) {
    const supabase = (await createServerSupabase()) as Db;
    const { error } = await supabase.from("restaurants").update(patch).eq("id", actor.restaurant.id);
    if (error) throw new Error(error.message);
  }

  async createInvite(actor: Actor, role: Role) {
    const supabase = (await createServerSupabase()) as Db;
    const token = randomToken();
    const { error } = await supabase.from("invitations").insert({ restaurant_id: actor.restaurant.id, token, role, created_by: actor.userId });
    if (error) throw new Error(error.message);
    return token;
  }

  async getInvite(token: string): Promise<InviteInfo | null> {
    const { data } = await (supabaseAdmin() as Db).from("invitations").select("role, expires_at, used_at, restaurants(name)").eq("token", token).maybeSingle();
    if (!data) return null;
    return { restaurant_name: data.restaurants?.name ?? "", role: data.role, valid: !data.used_at && new Date(data.expires_at) > new Date() };
  }

  async acceptInvite(token: string, displayName: string) {
    const supabase = (await createServerSupabase()) as Db;
    const { data, error } = await supabase.rpc("accept_invitation", { p_token: token, p_display_name: displayName });
    if (error) throw new Error(error.message);
    await this.rememberRestaurant(data as string);
    return data as string;
  }

  async setPin(actor: Actor, memberId: string, pin: string) {
    const admin = supabaseAdmin() as Db;
    const { data: m } = await admin.from("memberships").select("id, restaurant_id").eq("id", memberId).maybeSingle();
    if (!m || m.restaurant_id !== actor.restaurant.id) throw new Error("Membre introuvable");
    if (m.id !== actor.memberId && actor.role !== "owner") throw new Error("Réservé au propriétaire");
    const { error } = await admin
      .from("memberships")
      .update({ pin_hash: await hashPin(pin), pin_failed_count: 0, pin_locked_until: null })
      .eq("id", memberId);
    if (error) throw new Error(error.message);
  }

  async checkPin(restaurantId: string, memberId: string, pin: string): Promise<PinCheck> {
    const admin = supabaseAdmin() as Db;
    const { data: m } = await admin.from("memberships").select("*").eq("id", memberId).eq("restaurant_id", restaurantId).maybeSingle();
    if (!m) return { ok: false, reason: "invalid", remaining: 0 };
    if (!m.pin_hash) return { ok: false, reason: "no_pin" };
    if (m.pin_locked_until && new Date(m.pin_locked_until) > new Date()) return { ok: false, reason: "locked", until: m.pin_locked_until };
    if (await verifyPin(pin, m.pin_hash)) {
      await admin.from("memberships").update({ pin_failed_count: 0, pin_locked_until: null }).eq("id", memberId);
      return { ok: true, member: { id: m.id, restaurant_id: m.restaurant_id, user_id: m.user_id, role: m.role, display_name: m.display_name, has_pin: true } };
    }
    const failed = (m.pin_failed_count ?? 0) + 1;
    if (failed >= PIN_MAX_ATTEMPTS) {
      const until = new Date(Date.now() + PIN_LOCK_MINUTES * 60_000).toISOString();
      await admin.from("memberships").update({ pin_failed_count: 0, pin_locked_until: until }).eq("id", memberId);
      return { ok: false, reason: "locked", until };
    }
    await admin.from("memberships").update({ pin_failed_count: failed }).eq("id", memberId);
    return { ok: false, reason: "invalid", remaining: PIN_MAX_ATTEMPTS - failed };
  }

  /** Connexion rapide : on émet un lien magique côté serveur et on le consomme immédiatement. */
  async signInAs(member: Member) {
    const admin = supabaseAdmin();
    const { data: user, error: userError } = await admin.auth.admin.getUserById(member.user_id);
    if (userError || !user.user?.email) throw new Error("Compte introuvable");
    const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.user.email });
    if (error || !link.properties?.hashed_token) throw new Error("Connexion impossible");
    const supabase = await createServerSupabase();
    const { error: otpError } = await supabase.auth.verifyOtp({ type: "email", token_hash: link.properties.hashed_token });
    if (otpError) throw new Error(otpError.message);
    await this.rememberRestaurant(member.restaurant_id);
  }

  async signOut() {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }

  async purgeExpired() {
    const admin = supabaseAdmin() as Db;
    const { data, error } = await admin.rpc("purge_expired_handovers");
    if (error) throw new Error(error.message);
    const paths: string[] = (data?.paths ?? []).filter(Boolean);
    const thumbs = paths.filter((p) => /\/(sac|ticket|remise)\.jpg$/.test(p)).map((p) => p.replace(/\.jpg$/, ".thumb.jpg"));
    const all = [...paths, ...thumbs];
    for (let i = 0; i < all.length; i += 100) {
      await admin.storage.from(PROOFS_BUCKET).remove(all.slice(i, i + 100));
    }
    return { handovers: data?.handovers ?? 0, paths: all };
  }

  private async rememberRestaurant(restaurantId: string) {
    const jar = await cookies();
    const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", secure: process.env.NODE_ENV === "production" };
    jar.set(ACTIVE_RESTAURANT_COOKIE, restaurantId, { ...opts, maxAge: 60 * 60 * 24 * 365 });
    jar.set(DEVICE_COOKIE, signValue(restaurantId), { ...opts, maxAge: 60 * 60 * 24 * 365 });
  }
}

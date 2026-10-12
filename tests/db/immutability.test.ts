/**
 * Tests au niveau base : immutabilité, RLS, reçu public, purge RGPD.
 * Prérequis : TEST_DATABASE_URL (créée par `npm run db:local`). Ignorés sinon.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

const R1 = randomUUID();
const R2 = randomUUID();
const U1 = randomUUID();
const U2 = randomUUID();
const HASH = "a".repeat(64);

let client: pg.Client;

async function asRole(role: "authenticated" | "anon" | "service_role", userId?: string) {
  await client.query(`set local role ${role}`);
  await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ""]);
}

function sealPayload(restaurant: string, user: string, overrides: Record<string, unknown> = {}) {
  const id = randomUUID();
  return {
    id,
    restaurant_id: restaurant,
    order_ref: "UB-1",
    platform: "uber",
    amount_cents: 2450,
    items_count: 2,
    courier_name: "Karim B.",
    vehicle: "scooter",
    pickup_code: "4821",
    signature_path: null,
    signature_sha256: null,
    sealed_at: new Date().toISOString(),
    client_captured_at: new Date().toISOString(),
    sealed_by: user,
    sealed_by_name: "Camille",
    hash_sha256: HASH,
    public_token: randomUUID().replace(/-/g, ""),
    photos: [{ slot: "sac", storage_path: `${restaurant}/${id}/sac.jpg`, sha256: "b".repeat(64), original_path: null, original_sha256: null, captured_at: new Date().toISOString(), width: 1200, height: 1600 }],
    ...overrides,
  };
}

async function seal(restaurant = R1, user = U1, overrides: Record<string, unknown> = {}) {
  const p = sealPayload(restaurant, user, overrides);
  await client.query("savepoint s");
  await asRole("service_role");
  await client.query("select public.seal_handover($1::jsonb)", [JSON.stringify(p)]);
  await client.query("reset role");
  await client.query("release savepoint s");
  return p;
}

async function expectError(sql: string, params: unknown[] = [], pattern: RegExp = /REMIS|permission|violates|denied/) {
  await client.query("savepoint e");
  try {
    await client.query(sql, params);
    throw new Error(`La requête aurait dû échouer : ${sql}`);
  } catch (error) {
    expect(String((error as Error).message)).toMatch(pattern);
  } finally {
    await client.query("rollback to savepoint e");
  }
}

d("base de données REMIS.", () => {
  beforeAll(async () => {
    client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query("insert into auth.users (id, email) values ($1, 'a@test'), ($2, 'b@test')", [U1, U2]);
    await client.query("insert into public.restaurants (id, name, city, slug) values ($1, 'Resto A', 'Lyon', $3), ($2, 'Resto B', 'Paris', $4)", [R1, R2, `resto-a-${R1.slice(0, 6)}`, `resto-b-${R2.slice(0, 6)}`]);
    await client.query("insert into public.memberships (restaurant_id, user_id, role, display_name) values ($1, $2, 'owner', 'Camille'), ($3, $4, 'owner', 'Bob')", [R1, U1, R2, U2]);
  });
  afterAll(async () => {
    await client?.end();
  });
  beforeEach(async () => {
    await client.query("begin");
  });
  afterEach(async () => {
    await client.query("rollback");
  });

  describe("immutabilité", () => {
    it("une remise scellée ne peut plus être modifiée (même par le propriétaire de la base)", async () => {
      const p = await seal();
      for (const [col, value] of [
        ["amount_cents", 9999],
        ["order_ref", "'FAUX'"],
        ["sealed_at", "now() - interval '1 hour'"],
        ["hash_sha256", `'${"c".repeat(64)}'`],
        ["courier_name_snapshot", "'Autre L.'"],
      ] as const) {
        await expectError(`update public.handovers set ${col} = ${value} where id = $1`, [p.id], /seule la colonne status/);
      }
    });

    it("seul le statut change, selon des transitions contrôlées", async () => {
      const p = await seal();
      await client.query("update public.handovers set status = 'litige' where id = $1", [p.id]);
      await client.query("update public.handovers set status = 'resolu' where id = $1", [p.id]);
      await expectError("update public.handovers set status = 'remis' where id = $1", [p.id], /transition de statut interdite/);
    });

    it("aucune suppression (remise, photos, journal) ni TRUNCATE", async () => {
      const p = await seal();
      await expectError("delete from public.handovers where id = $1", [p.id], /ne peut pas être supprimée/);
      await expectError("delete from public.handover_photos where handover_id = $1", [p.id], /ajout seul/);
      await expectError("update public.handover_photos set sha256 = $2 where handover_id = $1", [p.id, "c".repeat(64)], /ajout seul/);
      await expectError("update public.handover_events set payload = '{}' where handover_id = $1", [p.id], /ajout seul/);
      await expectError("delete from public.handover_events where handover_id = $1", [p.id], /ajout seul/);
      await expectError("truncate public.handovers cascade", [], /TRUNCATE interdit/);
    });

    it("sealed_at doit être l'heure du serveur (pas d'antidatage)", async () => {
      await client.query("savepoint s");
      await asRole("service_role");
      await expectError("select public.seal_handover($1::jsonb)", [JSON.stringify(sealPayload(R1, U1, { sealed_at: new Date(Date.now() - 3_600_000).toISOString() }))], /fixé par le serveur/);
      await client.query("reset role");
    });

    it("le scellé crée l'événement seal, le reçu et le livreur récent en une transaction", async () => {
      const p = await seal();
      const ev = await client.query("select type from public.handover_events where handover_id = $1", [p.id]);
      expect(ev.rows.map((r) => r.type)).toEqual(["seal"]);
      const rc = await client.query("select public_token from public.courier_receipts where handover_id = $1", [p.id]);
      expect(rc.rows[0].public_token).toBe(p.public_token);
      const c = await client.query("select display_name, last_code from public.couriers where restaurant_id = $1", [R1]);
      expect(c.rows[0]).toMatchObject({ display_name: "Karim B.", last_code: "4821" });
    });

    it("refuse un scelleur qui n'est pas membre du restaurant", async () => {
      await client.query("savepoint s");
      await asRole("service_role");
      await expectError("select public.seal_handover($1::jsonb)", [JSON.stringify(sealPayload(R1, U2))], /pas membre/);
      await client.query("reset role");
    });
  });

  describe("RLS multi-tenant", () => {
    it("un membre ne voit que les remises de son restaurant", async () => {
      await seal(R1, U1);
      await seal(R2, U2);
      await asRole("authenticated", U1);
      const rows = await client.query("select restaurant_id from public.handovers");
      expect(rows.rows.length).toBe(1);
      expect(rows.rows[0].restaurant_id).toBe(R1);
      const other = await client.query("select * from public.handover_photos p join public.handovers h on h.id = p.handover_id where h.restaurant_id = $1", [R2]);
      expect(other.rows.length).toBe(0);
    });

    it("un client ne peut pas insérer de remise ni lire les PIN", async () => {
      await asRole("authenticated", U1);
      await expectError("insert into public.handovers (restaurant_id, order_ref, platform, items_count, courier_name_snapshot, vehicle, sealed_at, hash_sha256) values ($1, 'X', 'uber', 1, 'A B.', 'velo', now(), $2)", [R1, HASH], /permission denied/);
      await expectError("select pin_hash from public.memberships", [], /permission denied/);
      await expectError("select public.seal_handover('{}'::jsonb)", [], /permission denied/);
    });

    it("un membre ouvre un litige via record_handover_event (statut + journal atomiques)", async () => {
      const p = await seal();
      await asRole("authenticated", U1);
      await client.query("select public.record_handover_event($1, 'litige_open', '{\"reason\":\"non_recu\"}'::jsonb)", [p.id]);
      const h = await client.query("select status from public.handovers where id = $1", [p.id]);
      expect(h.rows[0].status).toBe("litige");
      await expectError("select public.record_handover_event($1, 'seal', '{}'::jsonb)", [p.id], /interdit/);
    });

    it("un autre restaurant ne peut pas modifier le statut", async () => {
      const p = await seal();
      await asRole("authenticated", U2);
      const res = await client.query("update public.handovers set status = 'litige' where id = $1", [p.id]);
      expect(res.rowCount).toBe(0);
    });
  });

  describe("reçu livreur public", () => {
    it("lisible sans compte uniquement avec le token", async () => {
      const p = await seal();
      await asRole("anon");
      await expectError("select * from public.courier_receipts", [], /permission denied/);
      await expectError("select * from public.handovers", [], /permission denied/);
      const ok = await client.query("select public.get_courier_receipt($1) as r", [p.public_token]);
      expect(ok.rows[0].r.handover.order_ref).toBe("UB-1");
      expect(ok.rows[0].r.photos).toHaveLength(1);
      const ko = await client.query("select public.get_courier_receipt($1) as r", ["x".repeat(32)]);
      expect(ko.rows[0].r).toBeNull();
    });
  });

  describe("purge RGPD", () => {
    it("supprime uniquement les remises hors durée de conservation", async () => {
      const recent = await seal();
      // Remise ancienne : insérée en mode seed (connexion superutilisateur uniquement).
      await client.query("select set_config('remis.seeding', 'on', true)");
      const old = await seal(R1, U1, { sealed_at: new Date(Date.now() - 120 * 86_400_000).toISOString(), public_token: "o".repeat(32) });
      await client.query("select set_config('remis.seeding', 'off', true)");

      await client.query("savepoint s");
      await asRole("service_role");
      const res = await client.query("select public.purge_expired_handovers() as r");
      await client.query("reset role");
      expect(res.rows[0].r.handovers).toBeGreaterThanOrEqual(1);
      expect(res.rows[0].r.paths).toContain(`${R1}/${old.id}/sac.jpg`);
      const left = await client.query("select id from public.handovers where id = any($1)", [[recent.id, old.id]]);
      expect(left.rows.map((r) => r.id)).toEqual([recent.id]);
      // Hors purge, la suppression reste interdite.
      await expectError("delete from public.handovers where id = $1", [recent.id], /ne peut pas être supprimée/);
    });
  });
});

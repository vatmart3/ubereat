// Vérifie la partie SQL du seed sur la base locale (sans Storage/Auth Supabase).
import pg from "pg";
import { DEMO_ASSETS } from "../../lib/data/demo-assets";
import { DEMO_MEMBERS, DEMO_RESTAURANT, prepareDemoSeed } from "../../lib/data/seed";
import { computeSealHash, canonicalInputFromHandover } from "../../lib/seal/canonical";

const db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
await db.connect();
await db.query("begin");
await db.query("select set_config('remis.seeding', 'on', true)");
for (const m of DEMO_MEMBERS) await db.query("insert into auth.users (id, email) values ($1, $2) on conflict do nothing", [m.user_id, m.email]);
await db.query("insert into public.restaurants (id, name, city, address, slug) values ($1,$2,$3,$4,$5)", [DEMO_RESTAURANT.id, DEMO_RESTAURANT.name, DEMO_RESTAURANT.city, DEMO_RESTAURANT.address, DEMO_RESTAURANT.slug]);
for (const m of DEMO_MEMBERS) await db.query("insert into public.memberships (id, restaurant_id, user_id, role, display_name) values ($1,$2,$3,$4,$5)", [m.id, DEMO_RESTAURANT.id, m.user_id, m.role, m.display_name]);
const prepared = await prepareDemoSeed(DEMO_ASSETS);
for (const item of [...prepared].reverse()) {
  await db.query("select public.seal_handover($1::jsonb)", [JSON.stringify(item.record)]);
  for (const e of item.events) {
    await db.query("insert into public.handover_events (handover_id, type, payload, actor, created_at) values ($1,$2,$3,$4,$5)", [item.record.id, e.type, e.payload, e.actor, e.created_at]);
    if (e.type === "litige_open") await db.query("update public.handovers set status = 'litige' where id = $1", [item.record.id]);
    if (e.type === "resolve") await db.query("update public.handovers set status = 'resolu' where id = $1", [item.record.id]);
  }
}
// Relecture depuis Postgres et recalcul de l'empreinte : le format d'horodatage doit rester stable.
const { rows } = await db.query("select h.*, (select json_agg(p) from public.handover_photos p where p.handover_id = h.id) as photos from public.handovers h where restaurant_id = $1", [DEMO_RESTAURANT.id]);
let ok = 0;
for (const h of rows) {
  const { hash } = await computeSealHash(canonicalInputFromHandover({ ...h, sealed_at: h.sealed_at.toISOString(), photos: h.photos }));
  if (hash === h.hash_sha256) ok++;
}
const status = await db.query("select status, count(*)::int n from public.handovers where restaurant_id = $1 group by status order by status", [DEMO_RESTAURANT.id]);
console.log(`${rows.length} remises, ${ok} empreintes recalculées identiques`, status.rows);
await db.query("rollback");
await db.end();

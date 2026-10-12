/**
 * Seed Supabase : restaurant de démo « La Cantine du Passage » + 6 remises (dont 1 en litige, 1 résolue).
 *
 *   DATABASE_URL=postgresql://postgres:…@db.<ref>.supabase.co:5432/postgres \
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
 *   npm run seed
 *
 * Les remises sont datées du passé : l'insertion passe par le mode `remis.seeding`, accepté
 * uniquement sur une connexion directe en `postgres` (jamais via l'API).
 */
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { DEMO_ASSETS } from "../lib/data/demo-assets";
import { DEMO_MEMBERS, DEMO_RESTAURANT, prepareDemoSeed } from "../lib/data/seed";
import { hashPin } from "../lib/pin";

const { DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!DATABASE_URL || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Variables requises : DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const db = new pg.Client({ connectionString: DATABASE_URL, ssl: DATABASE_URL.includes("localhost") ? undefined : { rejectUnauthorized: false } });

async function ensureUser(email: string): Promise<string> {
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.data.user) return created.data.user.id;
  for (let page = 1; page < 50; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  throw new Error(`Impossible de créer ${email} : ${created.error?.message}`);
}

async function main() {
  await db.connect();
  const exists = await db.query("select 1 from public.restaurants where id = $1", [DEMO_RESTAURANT.id]);
  if (exists.rowCount) {
    console.log("Le restaurant de démo existe déjà (les remises scellées ne peuvent pas être réécrites). Rien à faire.");
    return;
  }

  const userIds = new Map<string, string>();
  for (const m of DEMO_MEMBERS) userIds.set(m.user_id, await ensureUser(m.email));
  const realId = (seedUserId: string) => userIds.get(seedUserId) ?? seedUserId;

  console.log("Préparation des photos tamponnées…");
  const prepared = await prepareDemoSeed(DEMO_ASSETS);

  console.log("Upload vers le bucket privé « proofs »…");
  for (const item of prepared) {
    for (const f of item.files) {
      const { error } = await admin.storage.from("proofs").upload(f.path, f.bytes, { contentType: f.contentType, upsert: true });
      if (error) throw new Error(`${f.path} : ${error.message}`);
    }
  }

  await db.query("begin");
  try {
    await db.query("select set_config('remis.seeding', 'on', true)");
    await db.query("insert into public.restaurants (id, name, city, address, slug, retention_days) values ($1, $2, $3, $4, $5, $6)", [
      DEMO_RESTAURANT.id, DEMO_RESTAURANT.name, DEMO_RESTAURANT.city, DEMO_RESTAURANT.address, DEMO_RESTAURANT.slug, DEMO_RESTAURANT.retention_days,
    ]);
    for (const m of DEMO_MEMBERS) {
      await db.query("insert into public.memberships (id, restaurant_id, user_id, role, display_name, pin_hash) values ($1, $2, $3, $4, $5, $6)", [
        m.id, DEMO_RESTAURANT.id, realId(m.user_id), m.role, m.display_name, await hashPin(m.pin),
      ]);
    }
    // Les plus anciennes d'abord : les « livreurs récents » gardent le dernier passage.
    for (const item of [...prepared].reverse()) {
      await db.query("select public.seal_handover($1::jsonb)", [JSON.stringify({ ...item.record, sealed_by: realId(item.record.sealed_by) })]);
      for (const e of item.events) {
        await db.query("insert into public.handover_events (handover_id, type, payload, actor, created_at) values ($1, $2, $3, $4, $5)", [
          item.record.id, e.type, e.payload, realId(e.actor), e.created_at,
        ]);
        if (e.type === "litige_open") await db.query("update public.handovers set status = 'litige' where id = $1", [item.record.id]);
        if (e.type === "resolve") await db.query("update public.handovers set status = 'resolu' where id = $1", [item.record.id]);
      }
    }
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
  console.log(`✓ ${prepared.length} remises scellées. PIN : ${DEMO_MEMBERS.map((m) => `${m.display_name} ${m.pin}`).join(" · ")}`);
  console.log(`  Reçus livreur : /r/${prepared[0]!.record.public_token}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.end());

-- Fonctions transactionnelles.

-- Le seed local (supabase db reset) a besoin d'insérer des remises datées du passé.
-- Ce contournement n'est possible que depuis une connexion directe en superutilisateur,
-- jamais via l'API (PostgREST se connecte en `authenticator`).
create or replace function public.handovers_guard_insert() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('remis.seeding', true), '') = 'on'
     and session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if abs(extract(epoch from (new.sealed_at - now()))) > 120 then
    raise exception 'REMIS: sealed_at doit être fixé par le serveur (écart > 120 s)'
      using errcode = 'P0001';
  end if;
  return new;
end
$$;

create or replace function public.remis_slugify(input text) returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(
    translate(lower(input),
      'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ',
      'aaaaaaceeeeiiiinooooouuuuyyoa'),
    '[^a-z0-9]+', '-', 'g'))
$$;

-- Création d'un espace restaurant en 30 s : restaurant + membership propriétaire.
create or replace function public.create_restaurant(p_name text, p_city text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_id   uuid;
  v_base text;
begin
  if v_uid is null then
    raise exception 'REMIS: authentification requise' using errcode = '42501';
  end if;
  v_base := left(public.remis_slugify(p_name || '-' || p_city), 56);
  if length(v_base) < 3 then v_base := 'resto'; end if;

  insert into public.restaurants (name, city, slug)
  values (trim(p_name), trim(p_city), v_base || '-' || substr(md5(gen_random_uuid()::text), 1, 6))
  returning id into v_id;

  insert into public.memberships (restaurant_id, user_id, role, display_name)
  values (v_id, v_uid, 'owner', trim(coalesce(nullif(p_display_name, ''), 'Gérant')));

  return v_id;
end
$$;

create or replace function public.accept_invitation(p_token text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invitations;
begin
  if v_uid is null then
    raise exception 'REMIS: authentification requise' using errcode = '42501';
  end if;
  select * into v_inv from public.invitations
   where token = p_token and used_at is null and expires_at > now()
   for update;
  if not found then
    raise exception 'REMIS: invitation invalide ou expirée' using errcode = 'P0002';
  end if;

  insert into public.memberships (restaurant_id, user_id, role, display_name)
  values (v_inv.restaurant_id, v_uid, v_inv.role, trim(coalesce(nullif(p_display_name, ''), 'Équipier')))
  on conflict (restaurant_id, user_id) do nothing;

  update public.invitations set used_at = now(), used_by = v_uid where id = v_inv.id;
  return v_inv.restaurant_id;
end
$$;

-- Scellé : tout en une transaction (livreur récent, remise, photos, événement seal, reçu livreur).
-- Appelé uniquement par le serveur (service_role) après recalcul des empreintes.
create or replace function public.seal_handover(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id          uuid := (p ->> 'id')::uuid;
  v_restaurant  uuid := (p ->> 'restaurant_id')::uuid;
  v_sealed_by   uuid := (p ->> 'sealed_by')::uuid;
  v_sealed_at   timestamptz := (p ->> 'sealed_at')::timestamptz;
  v_courier_id  uuid;
  v_retention   integer;
  v_photo       jsonb;
begin
  if not exists (
    select 1 from public.memberships where restaurant_id = v_restaurant and user_id = v_sealed_by
  ) then
    raise exception 'REMIS: le scelleur n''est pas membre du restaurant' using errcode = '42501';
  end if;

  select retention_days into v_retention from public.restaurants where id = v_restaurant;

  insert into public.couriers (restaurant_id, display_name, vehicle, last_code, last_seen_at)
  values (v_restaurant, p ->> 'courier_name', p ->> 'vehicle', nullif(p ->> 'pickup_code', ''), v_sealed_at)
  on conflict (restaurant_id, display_name) do update
    set vehicle      = excluded.vehicle,
        last_code    = coalesce(excluded.last_code, public.couriers.last_code),
        last_seen_at = greatest(excluded.last_seen_at, public.couriers.last_seen_at)
  returning id into v_courier_id;

  insert into public.handovers (
    id, restaurant_id, order_ref, platform, amount_cents, items_count, courier_id,
    courier_name_snapshot, vehicle, pickup_code, signature_path, signature_sha256,
    sealed_at, client_captured_at, sealed_by, sealed_by_name, hash_sha256,
    timestamp_provider, timestamp_token, status, geo
  ) values (
    v_id, v_restaurant, p ->> 'order_ref', p ->> 'platform', (p ->> 'amount_cents')::integer,
    (p ->> 'items_count')::integer, v_courier_id, p ->> 'courier_name', p ->> 'vehicle',
    nullif(p ->> 'pickup_code', ''), p ->> 'signature_path', p ->> 'signature_sha256',
    v_sealed_at, (p ->> 'client_captured_at')::timestamptz, v_sealed_by, p ->> 'sealed_by_name',
    p ->> 'hash_sha256', coalesce(p ->> 'timestamp_provider', 'server'), p ->> 'timestamp_token',
    coalesce(p ->> 'status', 'remis'), p -> 'geo'
  );

  for v_photo in select * from jsonb_array_elements(coalesce(p -> 'photos', '[]'::jsonb)) loop
    insert into public.handover_photos (
      handover_id, slot, storage_path, sha256, original_path, original_sha256, captured_at, width, height
    ) values (
      v_id, v_photo ->> 'slot', v_photo ->> 'storage_path', v_photo ->> 'sha256',
      v_photo ->> 'original_path', v_photo ->> 'original_sha256',
      (v_photo ->> 'captured_at')::timestamptz, (v_photo ->> 'width')::integer, (v_photo ->> 'height')::integer
    );
  end loop;

  insert into public.handover_events (handover_id, type, payload, actor, created_at)
  values (v_id, 'seal', jsonb_build_object(
    'hash', p ->> 'hash_sha256',
    'sealed_at', v_sealed_at,
    'client_captured_at', p ->> 'client_captured_at',
    'offline', coalesce((p ->> 'offline')::boolean, false),
    'timestamp_provider', coalesce(p ->> 'timestamp_provider', 'server')
  ), v_sealed_by::text, v_sealed_at);

  insert into public.courier_receipts (handover_id, public_token, expires_at)
  values (v_id, p ->> 'public_token', v_sealed_at + make_interval(days => coalesce(v_retention, 90)));

  return jsonb_build_object('id', v_id, 'public_token', p ->> 'public_token', 'courier_id', v_courier_id);
end
$$;

-- Événement + changement de statut en une seule transaction (sécurité de l'appelant : RLS appliquée).
create or replace function public.record_handover_event(p_handover uuid, p_type text, p_payload jsonb)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_event uuid;
begin
  if p_type not in ('litige_open', 'note', 'export', 'resolve') then
    raise exception 'REMIS: type d''événement interdit (%)', p_type using errcode = '22023';
  end if;

  insert into public.handover_events (handover_id, type, payload, actor)
  values (p_handover, p_type, coalesce(p_payload, '{}'::jsonb), auth.uid()::text)
  returning id into v_event;

  if p_type = 'litige_open' then
    update public.handovers set status = 'litige' where id = p_handover and status <> 'litige';
  elsif p_type = 'resolve' then
    update public.handovers set status = 'resolu' where id = p_handover and status = 'litige';
  end if;

  return v_event;
end
$$;

-- Reçu livreur public : lisible uniquement avec le token (pas de SELECT anonyme sur les tables).
create or replace function public.get_courier_receipt(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'token', r.public_token,
    'expires_at', r.expires_at,
    'handover', jsonb_build_object(
      'id', h.id, 'restaurant_id', h.restaurant_id, 'order_ref', h.order_ref, 'platform', h.platform,
      'amount_cents', h.amount_cents, 'items_count', h.items_count,
      'courier_name', h.courier_name_snapshot, 'vehicle', h.vehicle, 'pickup_code', h.pickup_code,
      'signature_path', h.signature_path, 'signature_sha256', h.signature_sha256,
      'sealed_at', h.sealed_at, 'hash_sha256', h.hash_sha256, 'status', h.status
    ),
    'restaurant', jsonb_build_object('name', rs.name, 'city', rs.city),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slot', p.slot, 'storage_path', p.storage_path, 'sha256', p.sha256,
        'original_sha256', p.original_sha256, 'captured_at', p.captured_at,
        'width', p.width, 'height', p.height) order by p.captured_at)
      from public.handover_photos p where p.handover_id = h.id), '[]'::jsonb),
    'courier_events', coalesce((
      select jsonb_agg(jsonb_build_object('type', e.type, 'payload', e.payload, 'created_at', e.created_at)
        order by e.created_at)
      from public.handover_events e where e.handover_id = h.id and e.type = 'courier_photo'), '[]'::jsonb)
  )
  from public.courier_receipts r
  join public.handovers h on h.id = r.handover_id
  join public.restaurants rs on rs.id = h.restaurant_id
  where r.public_token = p_token and r.expires_at > now()
$$;

-- Photo de prise en charge ajoutée par le livreur : un événement, jamais le contenu scellé.
create or replace function public.add_courier_photo(p_token text, p_path text, p_sha256 text, p_captured_at timestamptz)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_handover uuid;
  v_count    integer;
  v_event    uuid;
begin
  select handover_id into v_handover from public.courier_receipts
   where public_token = p_token and expires_at > now();
  if v_handover is null then
    raise exception 'REMIS: reçu introuvable ou expiré' using errcode = 'P0002';
  end if;
  select count(*) into v_count from public.handover_events
   where handover_id = v_handover and type = 'courier_photo';
  if v_count >= 3 then
    raise exception 'REMIS: 3 photos livreur maximum' using errcode = 'P0001';
  end if;
  insert into public.handover_events (handover_id, type, payload, actor)
  values (v_handover, 'courier_photo',
          jsonb_build_object('storage_path', p_path, 'sha256', p_sha256, 'captured_at', p_captured_at),
          'livreur')
  returning id into v_event;
  return v_event;
end
$$;

revoke execute on function public.seal_handover(jsonb) from public, anon, authenticated;
revoke execute on function public.add_courier_photo(text, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.create_restaurant(text, text, text) from public, anon;
revoke execute on function public.accept_invitation(text, text) from public, anon;
revoke execute on function public.record_handover_event(uuid, text, jsonb) from public, anon;

grant execute on function public.seal_handover(jsonb) to service_role;
grant execute on function public.add_courier_photo(text, text, text, timestamptz) to service_role;
grant execute on function public.create_restaurant(text, text, text) to authenticated;
grant execute on function public.accept_invitation(text, text) to authenticated;
grant execute on function public.record_handover_event(uuid, text, jsonb) to authenticated;
grant execute on function public.get_courier_receipt(text) to anon, authenticated, service_role;

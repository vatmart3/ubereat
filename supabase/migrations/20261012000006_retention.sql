-- RGPD : durée de conservation paramétrable par restaurant (90 jours par défaut).
-- La purge est déclenchée chaque nuit par le cron Vercel (/api/cron/purge) qui :
--   1. appelle purge_expired_handovers() → supprime les lignes et renvoie les chemins Storage,
--   2. supprime ces fichiers du bucket `proofs` via l'API Storage.

create or replace function public.purge_expired_handovers() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_paths   jsonb;
  v_count   integer;
  v_couriers integer;
begin
  perform set_config('remis.purge', 'on', true);  -- local à la transaction

  with expired as (
    select h.id, h.signature_path
      from public.handovers h
      join public.restaurants r on r.id = h.restaurant_id
     where h.sealed_at < now() - make_interval(days => r.retention_days)
  ),
  paths as (
    select signature_path as path from expired where signature_path is not null
    union all
    select p.storage_path from public.handover_photos p join expired e on e.id = p.handover_id
    union all
    select p.original_path from public.handover_photos p join expired e on e.id = p.handover_id
     where p.original_path is not null
    union all
    select ev.payload ->> 'storage_path' from public.handover_events ev join expired e on e.id = ev.handover_id
     where ev.type = 'courier_photo'
  )
  select coalesce(jsonb_agg(path), '[]'::jsonb) into v_paths from paths;

  with deleted as (
    delete from public.handovers h
     using public.restaurants r
     where r.id = h.restaurant_id
       and h.sealed_at < now() - make_interval(days => r.retention_days)
    returning h.id
  )
  select count(*) into v_count from deleted;

  -- Livreurs plus vus depuis la durée de conservation et sans remise restante : effacés.
  with gone as (
    delete from public.couriers c
     using public.restaurants r
     where r.id = c.restaurant_id
       and c.last_seen_at < now() - make_interval(days => r.retention_days)
       and not exists (select 1 from public.handovers h where h.courier_id = c.id)
    returning c.id
  )
  select count(*) into v_couriers from gone;

  delete from public.invitations where expires_at < now() - interval '30 days';

  perform set_config('remis.purge', 'off', true);
  return jsonb_build_object('handovers', v_count, 'couriers', v_couriers, 'paths', v_paths);
end
$$;

revoke execute on function public.purge_expired_handovers() from public, anon, authenticated;
grant execute on function public.purge_expired_handovers() to service_role;

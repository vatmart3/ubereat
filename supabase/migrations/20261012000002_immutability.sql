-- Immutabilité des preuves.
-- Une remise scellée ne peut plus être modifiée, sauf sa colonne `status`.
-- Aucune suppression, sauf la purge RGPD planifiée (purge_expired_handovers) qui active
-- `remis.purge` le temps de sa transaction et ne touche que les remises hors durée de conservation.

create or replace function public.remis_purge_active() returns boolean
language sql stable as $$
  select coalesce(current_setting('remis.purge', true), '') = 'on'
$$;

create or replace function public.handovers_guard_update() returns trigger
language plpgsql as $$
begin
  if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception 'REMIS: remise scellée — seule la colonne status est modifiable (handover %)', old.id
      using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'remis'  and new.status = 'litige') or
      (old.status = 'litige' and new.status = 'resolu') or
      (old.status = 'resolu' and new.status = 'litige')
    ) then
      raise exception 'REMIS: transition de statut interdite % -> %', old.status, new.status
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end
$$;

create or replace function public.handovers_guard_delete() returns trigger
language plpgsql as $$
declare
  v_retention integer;
begin
  if public.remis_purge_active() then
    select retention_days into v_retention from public.restaurants where id = old.restaurant_id;
    if v_retention is null or old.sealed_at < now() - make_interval(days => v_retention) then
      return old;
    end if;
  end if;
  raise exception 'REMIS: une remise scellée ne peut pas être supprimée (handover %)', old.id
    using errcode = 'P0001';
end
$$;

create or replace function public.immutable_row_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if public.remis_purge_active() then
      return old;
    end if;
    raise exception 'REMIS: % est en ajout seul — suppression interdite', tg_table_name
      using errcode = 'P0001';
  end if;
  raise exception 'REMIS: % est en ajout seul — modification interdite', tg_table_name
    using errcode = 'P0001';
end
$$;

-- Le sealed_at doit être l'heure du serveur : on refuse un horodatage décalé de plus de 2 minutes.
create or replace function public.handovers_guard_insert() returns trigger
language plpgsql as $$
begin
  if abs(extract(epoch from (new.sealed_at - now()))) > 120 then
    raise exception 'REMIS: sealed_at doit être fixé par le serveur (écart > 120 s)'
      using errcode = 'P0001';
  end if;
  return new;
end
$$;

create trigger handovers_guard_insert before insert on public.handovers
  for each row execute function public.handovers_guard_insert();
create trigger handovers_guard_update before update on public.handovers
  for each row execute function public.handovers_guard_update();
create trigger handovers_guard_delete before delete on public.handovers
  for each row execute function public.handovers_guard_delete();

create trigger handover_photos_guard before update or delete on public.handover_photos
  for each row execute function public.immutable_row_guard();
create trigger handover_events_guard before update or delete on public.handover_events
  for each row execute function public.immutable_row_guard();

-- TRUNCATE contournerait les triggers de ligne : on le bloque aussi.
create or replace function public.block_truncate() returns trigger
language plpgsql as $$
begin
  raise exception 'REMIS: TRUNCATE interdit sur %', tg_table_name using errcode = 'P0001';
end
$$;
create trigger handovers_no_truncate before truncate on public.handovers
  for each statement execute function public.block_truncate();
create trigger handover_photos_no_truncate before truncate on public.handover_photos
  for each statement execute function public.block_truncate();
create trigger handover_events_no_truncate before truncate on public.handover_events
  for each statement execute function public.block_truncate();

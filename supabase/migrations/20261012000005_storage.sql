-- Bucket privé `proofs`. Arborescence : {restaurant_id}/{handover_id}/{fichier}
-- Les écritures passent par le serveur (service_role, sans upsert) : un fichier de preuve
-- n'est jamais écrasé. Les membres lisent les fichiers de leur restaurant (URL signées).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_restaurant_id(object_name text) returns uuid
language plpgsql immutable as $$
begin
  return (split_part(object_name, '/', 1))::uuid;
exception when others then
  return null;
end
$$;

create policy proofs_member_read on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and public.is_member(public.storage_restaurant_id(name)));

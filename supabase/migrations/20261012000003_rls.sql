-- Row Level Security : un membre ne voit que les données de son restaurant.

create or replace function public.is_member(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.restaurant_id = rid and m.user_id = auth.uid()
  )
$$;

create or replace function public.is_owner(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.restaurant_id = rid and m.user_id = auth.uid() and m.role = 'owner'
  )
$$;

create or replace function public.handover_restaurant(hid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select restaurant_id from public.handovers where id = hid
$$;

alter table public.restaurants      enable row level security;
alter table public.memberships      enable row level security;
alter table public.couriers         enable row level security;
alter table public.handovers        enable row level security;
alter table public.handover_photos  enable row level security;
alter table public.handover_events  enable row level security;
alter table public.courier_receipts enable row level security;
alter table public.invitations      enable row level security;

-- Privilèges explicites : on part de zéro, puis on n'accorde que le nécessaire.
revoke all on public.restaurants, public.memberships, public.couriers, public.handovers,
  public.handover_photos, public.handover_events, public.courier_receipts, public.invitations
  from anon, authenticated;

grant select, update (name, city, address, logo_url, retention_days) on public.restaurants to authenticated;
-- pin_hash et compteurs d'échec ne sont jamais lisibles côté client.
grant select (id, restaurant_id, user_id, role, display_name, created_at) on public.memberships to authenticated;
grant update (display_name, role) on public.memberships to authenticated;
grant delete on public.memberships to authenticated;
grant select, insert, update (display_name, vehicle, last_code, last_seen_at) on public.couriers to authenticated;
grant select, update (status) on public.handovers to authenticated;
grant select on public.handover_photos to authenticated;
grant select, insert on public.handover_events to authenticated;
grant select on public.courier_receipts to authenticated;
grant select, insert, delete on public.invitations to authenticated;

-- restaurants
create policy restaurants_select on public.restaurants for select to authenticated
  using (public.is_member(id));
create policy restaurants_update on public.restaurants for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));

-- memberships
create policy memberships_select on public.memberships for select to authenticated
  using (public.is_member(restaurant_id));
create policy memberships_update on public.memberships for update to authenticated
  using (public.is_owner(restaurant_id)) with check (public.is_owner(restaurant_id));
create policy memberships_delete on public.memberships for delete to authenticated
  using (public.is_owner(restaurant_id) and user_id <> auth.uid());

-- couriers
create policy couriers_select on public.couriers for select to authenticated
  using (public.is_member(restaurant_id));
create policy couriers_insert on public.couriers for insert to authenticated
  with check (public.is_member(restaurant_id));
create policy couriers_update on public.couriers for update to authenticated
  using (public.is_member(restaurant_id)) with check (public.is_member(restaurant_id));

-- handovers : lecture + changement de statut (le trigger d'immutabilité verrouille le reste).
-- Pas d'INSERT client : le scellé passe exclusivement par le serveur (seal_handover).
create policy handovers_select on public.handovers for select to authenticated
  using (public.is_member(restaurant_id));
create policy handovers_update_status on public.handovers for update to authenticated
  using (public.is_member(restaurant_id)) with check (public.is_member(restaurant_id));

create policy handover_photos_select on public.handover_photos for select to authenticated
  using (public.is_member(public.handover_restaurant(handover_id)));

create policy handover_events_select on public.handover_events for select to authenticated
  using (public.is_member(public.handover_restaurant(handover_id)));
create policy handover_events_insert on public.handover_events for insert to authenticated
  with check (
    public.is_member(public.handover_restaurant(handover_id))
    and actor = auth.uid()::text
    and type in ('litige_open', 'note', 'export', 'resolve')
  );

-- Reçus livreurs : lisibles par le restaurant. Côté public, uniquement via get_courier_receipt(token).
create policy courier_receipts_select on public.courier_receipts for select to authenticated
  using (public.is_member(public.handover_restaurant(handover_id)));

-- Invitations : gérées par les propriétaires.
create policy invitations_select on public.invitations for select to authenticated
  using (public.is_owner(restaurant_id));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (public.is_owner(restaurant_id) and created_by = auth.uid());
create policy invitations_delete on public.invitations for delete to authenticated
  using (public.is_owner(restaurant_id));

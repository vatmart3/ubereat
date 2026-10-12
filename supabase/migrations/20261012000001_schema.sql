-- REMIS. — schéma multi-tenant
-- Chaque table métier porte (directement ou via handover) un restaurant_id : c'est la clé du cloisonnement RLS.

create table public.restaurants (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(trim(name)) between 1 and 80),
  city            text not null check (length(trim(city)) between 1 and 80),
  address         text,
  slug            text not null unique check (slug ~ '^[a-z0-9-]{3,64}$'),
  logo_url        text,
  retention_days  integer not null default 90 check (retention_days between 30 and 1095),
  created_at      timestamptz not null default now()
);

create table public.memberships (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references public.restaurants (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  role              text not null check (role in ('owner', 'staff')),
  pin_hash          text,
  pin_failed_count  integer not null default 0,
  pin_locked_until  timestamptz,
  display_name      text not null check (length(trim(display_name)) between 1 and 40),
  created_at        timestamptz not null default now(),
  unique (restaurant_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

-- Livreurs récents : un tap remplit nom + véhicule + code.
create table public.couriers (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  display_name   text not null check (length(trim(display_name)) between 1 and 40),
  vehicle        text not null default 'velo' check (vehicle in ('velo', 'scooter', 'voiture', 'pied')),
  last_code      text,
  last_seen_at   timestamptz not null default now(),
  unique (restaurant_id, display_name)
);
create index couriers_recent_idx on public.couriers (restaurant_id, last_seen_at desc);

-- Remises scellées.
create table public.handovers (
  id                     uuid primary key default gen_random_uuid(),
  restaurant_id          uuid not null references public.restaurants (id) on delete cascade,
  order_ref              text not null check (length(trim(order_ref)) between 1 and 40),
  platform               text not null check (platform in ('uber', 'deliveroo', 'justeat', 'direct')),
  amount_cents           integer check (amount_cents is null or amount_cents between 0 and 10000000),
  items_count            integer not null default 1 check (items_count between 1 and 999),
  courier_id             uuid references public.couriers (id),
  courier_name_snapshot  text not null check (length(trim(courier_name_snapshot)) between 1 and 40),
  vehicle                text not null check (vehicle in ('velo', 'scooter', 'voiture', 'pied')),
  pickup_code            text check (pickup_code is null or length(pickup_code) <= 20),
  signature_path         text,
  signature_sha256       text check (signature_sha256 is null or signature_sha256 ~ '^[0-9a-f]{64}$'),
  sealed_at              timestamptz not null,                -- horloge serveur, jamais client
  client_captured_at     timestamptz,                         -- informatif (utile hors ligne)
  sealed_by              uuid,                                -- pas de FK : la preuve survit au compte
  sealed_by_name         text,
  hash_sha256            text not null check (hash_sha256 ~ '^[0-9a-f]{64}$'),
  timestamp_provider     text not null default 'server',
  timestamp_token        text,                                -- jeton RFC 3161 (futur)
  status                 text not null default 'remis' check (status in ('remis', 'litige', 'resolu')),
  geo                    jsonb,
  created_at             timestamptz not null default now()
);
create index handovers_registry_idx on public.handovers (restaurant_id, sealed_at desc);
create index handovers_status_idx on public.handovers (restaurant_id, status) where status = 'litige';
create index handovers_order_idx on public.handovers (restaurant_id, order_ref);

create table public.handover_photos (
  id               uuid primary key default gen_random_uuid(),
  handover_id      uuid not null references public.handovers (id) on delete cascade,
  slot             text not null check (slot in ('sac', 'ticket', 'remise')),
  storage_path     text not null,                -- version tamponnée (bandeau incrusté)
  sha256           text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  original_path    text,                         -- original non tamponné
  original_sha256  text check (original_sha256 is null or original_sha256 ~ '^[0-9a-f]{64}$'),
  captured_at      timestamptz not null,
  width            integer not null check (width > 0),
  height           integer not null check (height > 0),
  unique (handover_id, slot)
);

-- Journal append-only : tout ce qui arrive après le scellé passe ici.
create table public.handover_events (
  id           uuid primary key default gen_random_uuid(),
  handover_id  uuid not null references public.handovers (id) on delete cascade,
  type         text not null check (type in ('seal', 'litige_open', 'note', 'export', 'resolve', 'courier_photo')),
  payload      jsonb not null default '{}'::jsonb,
  actor        text not null,
  created_at   timestamptz not null default now()
);
create index handover_events_idx on public.handover_events (handover_id, created_at);

create table public.courier_receipts (
  id            uuid primary key default gen_random_uuid(),
  handover_id   uuid not null unique references public.handovers (id) on delete cascade,
  public_token  text not null unique check (public_token ~ '^[A-Za-z0-9_-]{32}$'),
  expires_at    timestamptz not null
);

-- Invitation de l'équipe par lien.
create table public.invitations (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  token          text not null unique check (token ~ '^[A-Za-z0-9_-]{32}$'),
  role           text not null default 'staff' check (role in ('owner', 'staff')),
  created_by     uuid references auth.users (id) on delete set null,
  expires_at     timestamptz not null default now() + interval '7 days',
  used_at        timestamptz,
  used_by        uuid references auth.users (id) on delete set null
);

-- Single-use device pairing, credential lifecycle, and provisioning audit data.
create type public.device_pairing_status as enum (
  'AVAILABLE', 'CLAIMED', 'REVOKED'
);
create type public.device_credential_status as enum (
  'STAGED', 'ACTIVE', 'REVOKED'
);

create table public.device_pairing_tokens (
  id uuid primary key default gen_random_uuid(),
  hardware_id varchar(120) not null,
  token_hash char(64) not null unique,
  status public.device_pairing_status not null default 'AVAILABLE',
  firmware_version varchar(40),
  is_virtual boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  claimed_by uuid references public.profiles(id) on delete set null,
  device_id uuid unique references public.devices(id) on delete set null,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((status = 'CLAIMED') = (claimed_at is not null)),
  check (status <> 'REVOKED' or revoked_at is not null)
);

create table public.device_credentials (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  credential_id varchar(120) not null unique,
  secret_hash char(64) not null,
  status public.device_credential_status not null default 'STAGED',
  rotated_from_id uuid references public.device_credentials(id) on delete set null,
  issued_by uuid references public.profiles(id) on delete set null,
  issued_at timestamptz not null default now(),
  activated_at timestamptz,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > issued_at),
  check (status <> 'ACTIVE' or activated_at is not null),
  check (status <> 'REVOKED' or revoked_at is not null)
);

create table public.device_provisioning_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  home_id uuid references public.homes(id) on delete set null,
  device_id uuid references public.devices(id) on delete set null,
  pairing_token_id uuid references public.device_pairing_tokens(id) on delete set null,
  action varchar(60) not null,
  outcome varchar(20) not null check (outcome in ('SUCCESS', 'FAILURE')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create index pairing_tokens_hardware_created_idx
  on public.device_pairing_tokens(hardware_id, created_at desc);
create index pairing_tokens_creator_created_idx
  on public.device_pairing_tokens(created_by, created_at desc)
  where created_by is not null;
create index pairing_tokens_expiry_idx
  on public.device_pairing_tokens(expires_at)
  where status = 'AVAILABLE';
create unique index device_credentials_current_idx
  on public.device_credentials(device_id)
  where status in ('STAGED', 'ACTIVE');
create index device_credentials_device_issued_idx
  on public.device_credentials(device_id, issued_at desc);
create index device_credentials_rotated_from_idx
  on public.device_credentials(rotated_from_id)
  where rotated_from_id is not null;
create index provisioning_events_actor_created_idx
  on public.device_provisioning_events(actor_user_id, created_at desc)
  where actor_user_id is not null;
create index provisioning_events_device_created_idx
  on public.device_provisioning_events(device_id, created_at desc)
  where device_id is not null;
create index provisioning_events_home_created_idx
  on public.device_provisioning_events(home_id, created_at desc)
  where home_id is not null;
create index provisioning_events_pairing_token_idx
  on public.device_provisioning_events(pairing_token_id)
  where pairing_token_id is not null;

create trigger device_pairing_tokens_set_updated_at
before update on public.device_pairing_tokens
for each row execute function private.set_updated_at();
create trigger device_credentials_set_updated_at
before update on public.device_credentials
for each row execute function private.set_updated_at();

alter table public.device_pairing_tokens enable row level security;
alter table public.device_credentials enable row level security;
alter table public.device_provisioning_events enable row level security;

-- These tables intentionally have no anon/authenticated policies or grants.
-- Pairing secrets and credential hashes are accessible only through the API.
revoke all on public.device_pairing_tokens from anon, authenticated;
revoke all on public.device_credentials from anon, authenticated;
revoke all on public.device_provisioning_events from anon, authenticated;
revoke all on sequence public.device_provisioning_events_id_seq from anon, authenticated;

grant all on public.device_pairing_tokens to service_role;
grant all on public.device_credentials to service_role;
grant all on public.device_provisioning_events to service_role;
grant all on sequence public.device_provisioning_events_id_seq to service_role;
